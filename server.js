const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Variables d'environnement issues du dashboard Render
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 1. Client Supabase Standard (Gestion de la connexion des utilisateurs)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. Client Supabase Administrateur (Privilèges élevés pour la création d'utilisateurs)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Middleware : Sécurisation des routes restreintes
const authenticateUser = async (req, res, next) => {
  const token = req.cookies.access_token;
  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé. Veuillez vous connecter.' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Session invalide ou expirée.' });
  }

  req.user = user;
  next();
};

// Route : Connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  // Stockage du jeton dans un cookie HTTPOnly sécurisé
  res.cookie('access_token', data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 3600 * 1000 // Expire après 1 heure
  });

  res.json({ message: 'Connexion réussie.' });
});

// Route Protégée : Création directe d'un nouvel utilisateur par l'admin
app.post('/api/create-user', authenticateUser, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' });
  }

  // Création d'un compte via l'API Admin de Supabase
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true // Valide l'e-mail immédiatement sans envoyer de mail de confirmation
  });

  if (error) {
    return res.status(400).json({ error: error.message });
  }

  res.status(201).json({ message: `Utilisateur ${data.user.email} créé avec succès !` });
});

// Route : Déconnexion
app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ message: 'Déconnexion réussie.' });
});

// Redirection globale vers l'accueil
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
