const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Autorise les scripts inline internes
        styleSrc: ["'self'", "'unsafe-inline'"],  // Autorise le CSS inline
        connectSrc: ["'self'", SUPABASE_URL]      // Autorise les requêtes vers Supabase
      }
    }
  })
);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// --- PROTECTION CSRF / VERIFICATION DE L'ORIGINE ---
const csrfOriginCheck = (req, res, next) => {
  // On applique la vérification uniquement aux requêtes de modification (POST, PUT, DELETE)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers['origin'] || req.headers['referer'];
    const host = req.headers['host'];

    // Si la requête ne possède pas d'en-tête Origin/Referer ou vient d'un autre hôte
    if (!origin || !origin.includes(host)) {
      return res.status(403).json({ error: 'Requête bloquée : Origine non autorisée (CSRF Shield).' });
    }
  }
  next();
};

app.use(csrfOriginCheck);

// Rate Limiters
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réanalyser plus tard.' }
});
app.use(globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

// Helper Audit
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

// Validation mot de passe
const isPasswordStrong = (password) => {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/.test(password);
};

// Middleware Auth
const authenticateAdmin = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.clearCookie('access_token');
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  req.user = user;
  next();
};

// Routes API
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
    maxAge: 15 * 60 * 1000
  });

  await logAuditEvent('LOGIN_SUCCESS', email, null, req);
  res.json({ message: 'Connexion réussie.' });
});

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

app.post('/api/logout', async (req, res) => {
  const token = req.cookies.access_token;
  if (token) {
    await supabase.auth.signOut(token);
  }
  res.clearCookie('access_token');
  res.json({ message: 'Déconnexion réussie.' });
});

app.listen(PORT, () => console.log(`Serveur actif sur le port ${PORT}`));