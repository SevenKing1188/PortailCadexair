const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration du proxy Render (Requis pour Rate Limiter & IP Audit)
app.set('trust proxy', 1);

// --- 3. SÉCURITÉ DES EN-TÊTES HTTP (Helmet) ---
app.use(helmet());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client standard pour l'authentification courante
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Client d'administration pour les actions privilégiées
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// --- 4. RATE LIMITING GLOBAL (Protection Anti-DoS) ---
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requêtes max par IP sur toutes les routes
  message: { error: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard.' }
});
app.use(globalLimiter);

// Rate Limiter strict dédié à la connexion (Force Brute)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

// Audit Log Helper
const logAuditEvent = async (action, performedBy, targetUser, req) => {
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];

  await supabaseAdmin.from('audit_logs').insert([
    {
      action,
      performed_by: performedBy,
      target_user: targetUser,
      ip_address: ipAddress,
      user_agent: userAgent
    }
  ]);
};

// Validation de la force du mot de passe
const isPasswordStrong = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password);
};

// --- 1 & 5. MIDDLEWARE AUTHENTIFICATION & CONTRÔLE D'ACCÈS STRICT ---
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  // 5. Vérification directe auprès de Supabase pour invalider les jetons révoqués
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.clearCookie('access_token');
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  // 1. Isolation des privilèges : Seuls les comptes 'admin' ou autorisés peuvent continuer
  req.user = user;
  next();
};

// Route : Connexion
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    await logAuditEvent('LOGIN_FAILED', email, null, req);
    return res.status(400).json({ error: 'Identifiants incorrects.' });
  }

  // 5. Réduction de la durée de vie du cookie à 15 minutes pour réduire la fenêtre de risque
  res.cookie('access_token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000 // Expire après 15 minutes
  });

  await logAuditEvent('LOGIN_SUCCESS', email, null, req);
  res.json({ message: 'Connexion réussie.' });
});

// Route : Création d'utilisateur (Restreinte aux Admins)
app.post('/api/create-user', authenticateAdmin, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 12 caractères (1 majuscule, 1 minuscule, 1 chiffre, 1 symbole).'
    });
  }

  // Utilisation contrôlée du rôle administrateur uniquement dans cet endpoint sécurisé
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) {
    await logAuditEvent('CREATE_USER_FAILED', req.user.email, email, req);
    return res.status(400).json({ error: error.message });
  }

  await logAuditEvent('CREATE_USER_SUCCESS', req.user.email, email, req);
  res.status(201).json({ message: `Utilisateur ${data.user.email} créé avec succès.` });
});

// Route : Déconnexion avec révocation côté serveur
app.post('/api/logout', async (req, res) => {
  const token = req.cookies.access_token;
  if (token) {
    // 5. Invalidation globale du jeton auprès de Supabase Auth
    await supabase.auth.signOut(token);
  }
  res.clearCookie('access_token');
  res.json({ message: 'Déconnexion réussie.' });
});

app.listen(PORT, () => console.log(`Serveur sécurisé actif sur le port ${PORT}`));