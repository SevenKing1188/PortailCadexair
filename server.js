const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// --- 1. RATE LIMITER (Protection Anti-Brute Force) ---
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Fenêtre de 15 minutes
  max: 5, // Bloque après 5 tentatives échouées ou réussies
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// --- 2. VALIDATION DES MOTS DE PASSE ROBUSTES ---
const isPasswordStrong = (password) => {
  // Min 12 caractères, 1 majuscule, 1 minuscule, 1 chiffre, 1 symbole
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/;
  return strongRegex.test(password);
};

// Middleware Auth
const authenticateUser = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: 'Session invalide ou expirée.' });

  req.user = user;
  next();
};

// Route Connexion (Protégée par le Rate Limiter)
app.post('/api/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: 'Identifiants incorrects.' });

  res.cookie('access_token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 * 1000
  });

  res.json({ message: 'Connexion réussie.' });
});

// Route Création Utilisateur (Validation de mot de passe renforcée)
app.post('/api/create-user', authenticateUser, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' });
  }

  // Vérification de la sécurité du mot de passe
  if (!isPasswordStrong(password)) {
    return res.status(400).json({
      error: 'Le mot de passe doit contenir au moins 12 caractères, dont une majuscule, une minuscule, un chiffre et un caractère spécial (@$!%*?&).'
    });
  }

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) return res.status(400).json({ error: error.message });

  res.status(201).json({ message: `Utilisateur ${data.user.email} créé avec succès.` });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ message: 'Déconnexion réussie.' });
});

app.listen(PORT, () => console.log(`Serveur démarré sur le port ${PORT}`));