const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du proxy pour Render (Capture correcte des adresses IP)
app.set('trust proxy', 1);

// Variables Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// En-têtes de sécurité HTTP & Content Security Policy (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", SUPABASE_URL],
        imgSrc: ["'self'", "data:", "blob:", SUPABASE_URL]
      }
    }
  })
);

// Clients Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Middlewares d'analyse de requêtes (limite 50mb pour le transfert d'images/photos)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// Protection CSRF / Vérification d'origine des requêtes de modification
const csrfOriginCheck = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers['origin'] || req.headers['referer'];
    const host = req.headers['host'];
    if (!origin || !origin.includes(host)) {
      return res.status(403).json({ error: 'Requête bloquée : Origine non autorisée.' });
    }
  }
  next();
};
app.use(csrfOriginCheck);

// Limitateurs de requêtes (Rate Limiting)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use(globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

// Helper pour l'enregistrement des journaux d'audit
const logAuditEvent = async (action, performedBy, targetUser, req) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const { error } = await supabaseAdmin.from('audit_logs').insert([
      {
        action,
        performed_by: performedBy || 'Système',
        target_user: targetUser || null,
        ip_address: ipAddress,
        user_agent: userAgent
      }
    ]);

    if (error) {
      console.error("❌ ERREUR SUPABASE AUDIT LOG:", error.message, error.details);
    } else {
      console.log("✅ Audit log enregistré avec succès !");
    }
  } catch (err) {
    console.error("❌ EXCEPTION AUDIT LOG:", err);
  }
};

// Validation de la robustesse des mots de passe
const isPasswordStrong = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password);
};

// Middleware d'authentification et d'extraction du profil
const attachUserProfile = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.clearCookie('access_token', { path: '/', httpOnly: true, sameSite: 'strict' });
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  req.user = user;
  req.profile = profile || {
    role: user.email === 'glesieur@cadexair.com' ? 'master' : 'chef_equipe'
  };

  next();
};

// --- ROUTES API ---

// 1. Authentification / Connexion
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAuditEvent('LOGIN_FAILED', email, null, req);
    return res.status(400).json({ error: 'Identifiants incorrects.' });
  }

  res.cookie('access_token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/'
  });

  await logAuditEvent('LOGIN_SUCCESS', email, null, req);
  res.json({ message: 'Connexion réussie.' });
});

// 2. Création d'utilisateur hiérarchisé
app.post('/api/create-user', attachUserProfile, async (req, res) => {
  const { email, password, username, role, department } = req.body;
  const callerRole = req.profile.role;

  if (!email || !password || !username || !role || !department) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  if (role === 'admin' && callerRole !== 'master') {
    return res.status(403).json({ error: 'Seul le Master (glesieur@cadexair.com) peut créer des Administrateurs.' });
  }

  if (role === 'chef_equipe' && !['master', 'admin'].includes(callerRole)) {
    return res.status(403).json({ error: 'Permissions insuffisantes pour créer un Chef d’équipe.' });
  }

  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 12 caractères (1 majuscule, 1 minuscule, 1 chiffre, 1 symbole).'
    });
  }

  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    await logAuditEvent('CREATE_USER_FAILED', req.user.email, email, req);
    return res.status(400).json({ error: authError.message });
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').insert([
    { id: authData.user.id, email, username, role, department }
  ]);

  if (profileError) {
    return res.status(400).json({ error: "Erreur lors de l'enregistrement du profil." });
  }

  await logAuditEvent(`CREATE_${role.toUpperCase()}_SUCCESS`, req.user.email, email, req);
  res.status(201).json({ message: `Compte ${role} créé avec succès pour ${username}.` });
});

// 3. Obtenir la liste des chefs d'équipe
app.get('/api/chefs', attachUserProfile, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, department')
    .eq('role', 'chef_equipe');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// 4. Création d'un bon de travail (Restreint au Master et Admins)
app.post('/api/work-orders', attachUserProfile, async (req, res) => {
  const callerRole = req.profile.role;

  if (!['master', 'admin'].includes(callerRole)) {
    return res.status(403).json({ 
      error: 'Permission refusée. Seuls les Administrateurs et le Master peuvent créer des bons de travail.' 
    });
  }

  const { 
    title, description, department, assignedTo,
    clientName, clientAddress, appointmentDate, appointmentTime,
    nbHottes, nbPortesAcces, nbVentilateurs
  } = req.body;

  if (!title || !description || !department || !assignedTo) {
    return res.status(400).json({ error: 'Tous les champs requis du bon de travail doivent être remplis.' });
  }

  const { error } = await supabaseAdmin.from('work_orders').insert([
    {
      title,
      description,
      department,
      assigned_to: assignedTo,
      created_by: req.user.id,
      client_name: clientName,
      client_address: clientAddress,
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      nb_hottes: nbHottes || 0,
      nb_portes_acces: nbPortesAcces || 0,
      nb_ventilateurs: nbVentilateurs || 0
    }
  ]);

  if (error) {
    await logAuditEvent('CREATE_WORK_ORDER_FAILED', req.user.email, title, req);
    return res.status(400).json({ error: error.message });
  }

  await logAuditEvent('CREATE_WORK_ORDER_SUCCESS', req.user.email, title, req);
  res.status(201).json({ message: 'Bon de travail créé et attribué avec succès.' });
});

// 5. Récupération des bons de travail (avec la syntaxe profiles!assigned_to explicite)
app.get('/api/work-orders', attachUserProfile, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('work_orders')
    .select('*, profiles!assigned_to(username)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("❌ Erreur récupération work_orders:", error.message);
    return res.status(400).json({ error: error.message });
  }

  res.json(data);
});

// 6. Ajout / Mise à jour des photos terrain par le chef d'équipe
app.post('/api/work-orders/:id/photos', attachUserProfile, async (req, res) => {
  const { id } = req.params;
  const { photos } = req.body;

  const { error } = await supabaseAdmin
    .from('work_orders')
    .update({ photos, status: 'Terminé' })
    .eq('id', id);

  if (error) return res.status(400).json({ error: error.message });
  res.json({ message: 'Photos enregistrées et bon de travail complété.' });
});

// 7. Déconnexion
app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token', {
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.status(200).json({ message: 'Déconnexion réussie.' });
});

app.listen(PORT, () => console.log(`Serveur Cadexair v3.1 actif sur le port ${PORT}`));