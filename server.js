const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middlewares de sécurité
app.use(helmet({
  contentSecurityPolicy: false // À adapter selon vos besoins CSP
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Limitation de débit (Rate Limiting)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

// Middleware d'authentification par Cookie
async function authenticateToken(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Accès non autorisé.' });

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;
    req.user = user;
    next();
  } catch (err) {
    res.clearCookie('access_token');
    return res.status(403).json({ error: 'Session expirée ou invalide.' });
  }
}

// --- ROUTES API ---

// 1. Récupération des chefs d'équipe
app.get('/api/chefs', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, department')
      .eq('role', 'chef');

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Création d'un Bon de Travail
app.post('/api/work-orders', authenticateToken, async (req, res) => {
  const { 
    title, clientName, clientAddress, appointmentDate, 
    appointmentTime, department, nbHottes, nbPortesAcces, 
    nbVentilateurs, assignedTo, description 
  } = req.body;

  try {
    const { data, error } = await supabase
      .from('work_orders')
      .insert([{
        title,
        client_name: clientName,
        client_address: clientAddress,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        department,
        nb_hottes: parseInt(nbHottes) || 0,
        nb_portes_acces: parseInt(nbPortesAcces) || 0,
        nb_ventilateurs: parseInt(nbVentilateurs) || 0,
        assigned_to: assignedTo || null,
        description,
        created_by: req.user.id
      }]);

    if (error) throw error;
    res.status(201).json({ message: 'Bon de travail créé avec succès !', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Récupération des Bons de Travail
app.get('/api/work-orders', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select(`
        *,
        profiles:assigned_to (username)
      `)
      .order('appointment_date', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Création d'un utilisateur
app.post('/api/create-user', authenticateToken, async (req, res) => {
  const { email, password, username, role, department } = req.body;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    const { error: profileError } = await supabase
      .from('profiles')
      .insert([{
        id: authData.user.id,
        username,
        role,
        department
      }]);

    if (profileError) throw profileError;

    res.status(201).json({ message: 'Utilisateur créé avec succès !' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Déconnexion (Suppression du cookie)
app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  return res.status(200).json({ message: 'Déconnexion réussie' });
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
