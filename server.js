const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Requis pour capturer l'adresse IP réelle derrière le proxy Render
app.set('trust proxy', 1);

// 1. DÉCLARATION DES VARIABLES SUPABASE EN PREMIER
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 2. EN-TÊTES DE SÉCURITÉ HTTP ET CONTENT SECURITY POLICY (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'", SUPABASE_URL]
      }
    }
  })
);

// Clients Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Middlewares de base
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// 3. PROTECTION CSRF / VÉRIFICATION DE L'ORIGINE
const csrfOriginCheck = (req, res, next) => {
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers['origin'] || req.headers['referer'];
    const host = req.headers['host'];

    if (!origin || !origin.includes(host)) {
      return res.status(403).json({ error: 'Requête bloquée : Origine non autorisée (CSRF Shield).' });
    }
  }
  next();
};
app.use(csrfOriginCheck);

// 4. RATE LIMITING (Anti-DoS Global & Anti-Brute Force Connexion)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' }
});
app.use(globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

// 5. HELPER D'AUDIT LOGS
const logAuditEvent = async (action, performedBy, targetUser, req) => {
  try {
    const ipAddress = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    const { error } = await supabaseAdmin
      .from('audit_logs')
      .insert([
        {
          action: action,
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

// Validateur de complexité de mot de passe (12 car. min, 1 maj, 1 min, 1 chiffre, 1 symbole)
const isPasswordStrong = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password);
};

// 6. MIDDLEWARE D'AUTHENTIFICATION & RÉCUPÉRATION DU PROFIL
const attachUserProfile = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.clearCookie('access_token');
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  // Récupération du profil depuis la table profiles
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  req.user = user;
  // Définition du rôle master si c'est glesieur@cadexair.com, sinon rôle trouvé ou chef_equipe
  req.profile = profile || {
    role: user.email === 'glesieur@cadexair.com' ? 'master' : 'chef_equipe'
  };

  next();
};

// --- ROUTES API ---

// Route : Connexion
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAuditEvent('LOGIN_FAILED', email, null, req);
    return res.status(400).json({ error: 'Identifiants incorrects.' });
  }

  // Cookie sécurisé limité à 15 minutes
  res.cookie('access_token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000
  });

  await logAuditEvent('LOGIN_SUCCESS', email, null, req);
  res.json({ message: 'Connexion réussie.' });
});

// Route : Création d'Utilisateur avec Rôles
app.post('/api/create-user', attachUserProfile, async (req, res) => {
  const { email, password, username, role, department } = req.body;
  const callerRole = req.profile.role;

  if (!email || !password || !username || !role || !department) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  // Contrôle des permissions de création selon la hiérarchie
  if (role === 'admin' && callerRole !== 'master') {
    return res.status(403).json({ error: 'Seul le compte Master (glesieur@cadexair.com) peut créer des Administrateurs.' });
  }

  if (role === 'chef_equipe' && !['master', 'admin'].includes(callerRole)) {
    return res.status(403).json({ error: 'Permissions insuffisantes pour créer un Chef d’équipe.' });
  }

  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 12 caractères (1 majuscule, 1 minuscule, 1 chiffre, 1 symbole).'
    });
  }

  // 1. Création de l'utilisateur dans Supabase Auth
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (authError) {
    await logAuditEvent('CREATE_USER_FAILED', req.user.email, email, req);
    return res.status(400).json({ error: authError.message });
  }

  // 2. Enregistrement du profil (Nom d'utilisateur, Rôle, Département)
  const { error: profileError } = await supabaseAdmin.from('profiles').insert([
    {
      id: authData.user.id,
      email,
      username,
      role,
      department
    }
  ]);

  if (profileError) {
    console.error("Erreur création profil :", profileError.message);
    return res.status(400).json({ error: "Erreur lors de l'enregistrement du profil." });
  }

  await logAuditEvent(`CREATE_${role.toUpperCase()}_SUCCESS`, req.user.email, email, req);
  res.status(201).json({ message: `Compte ${role} créé avec succès pour ${username}.` });
});

// Route : Récupération de la liste des chefs d'équipe
app.get('/api/chefs', attachUserProfile, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, username, department')
    .eq('role', 'chef_equipe');

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Route : Création et Assignation d'un Bon de Travail
app.post('/api/work-orders', attachUserProfile, async (req, res) => {
  const { title, description, department, assignedTo } = req.body;

  if (!title || !description || !department || !assignedTo) {
    return res.status(400).json({ error: 'Tous les champs du bon de travail sont requis.' });
  }

  const { error } = await supabaseAdmin.from('work_orders').insert([
    {
      title,
      description,
      department,
      assigned_to: assignedTo,
      created_by: req.user.id
    }
  ]);

  if (error) {
    await logAuditEvent('CREATE_WORK_ORDER_FAILED', req.user.email, title, req);
    return res.status(400).json({ error: error.message });
  }

  await logAuditEvent('CREATE_WORK_ORDER_SUCCESS', req.user.email, title, req);
  res.status(201).json({ message: 'Bon de travail créé et attribué avec succès.' });
});

// Route : Déconnexion
app.post('/api/logout', async (req, res) => {
  const token = req.cookies.access_token;
  if (token) {
    await supabase.auth.signOut(token);
  }
  res.clearCookie('access_token');
  res.json({ message: 'Déconnexion réussie.' });
});

// Démarrage du serveur
app.listen(PORT, () => console.log(`Serveur Cadexair actif sur le port ${PORT}`));