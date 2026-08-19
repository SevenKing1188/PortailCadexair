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
  contentSecurityPolicy: false
}));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Limitation de débit
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

// Middleware d'authentification
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
    return res.status(403).json({ error: 'Session invalide.' });
  }
}

// --- ROUTES API ---

// 1. Connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: 'Identifiants invalides.' });

    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
    return res.status(200).json({ message: 'Connexion réussie' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// 2. Déconnexion
app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token');
  return res.status(200).json({ message: 'Déconnexion réussie' });
});

// 3. Récupération chefs
app.get('/api/chefs', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('id, username, department').eq('role', 'chef');
    if (error) throw error;
    res.json(data);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Création Bon de Travail
app.post('/api/work-orders', authenticateToken, async (req, res) => {
  const { title, clientName, clientAddress, appointmentDate, appointmentTime, department, nbHottes, nbPortesAcces, nbVentilateurs, assignedTo, description } = req.body;
  try {
    const { error } = await supabase.from('work_orders').insert([{
      title, client_name: clientName, client_address: clientAddress, appointment_date: appointmentDate,
      appointment_time: appointmentTime, department, nb_hottes: nbHottes, nb_portes_acces: nbPortesAcces,
      nb_ventilateurs: nbVentilateurs, assigned_to: assignedTo || null, description, created_by: req.user.id
    }]);
    if (error) throw error;
    res.status(201).json({ message: 'Bon créé !' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Récupération Bons
app.get('/api/work-orders', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('work_orders').select('*, profiles:assigned_to(username)').order('appointment_date', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Création utilisateur (avec correction full_name)
app.post('/api/create-user', authenticateToken, async (req, res) => {
  const { email, password, username, role, department } = req.body;
  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('profiles').insert([{
      id: authData.user.id, username, full_name: username, role, department
    }]);
    if (profileError) throw profileError;

    res.status(201).json({ message: 'Utilisateur créé !' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 7. Suppression utilisateur (avec verrou Master)
app.delete('/api/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  try {
    const { data: userData, error: getUserError } = await supabase.auth.admin.getUserById(id);
    if (getUserError || !userData?.user) return res.status(404).json({ error: 'Utilisateur introuvable.' });

    const targetEmail = userData.user.email ? userData.user.email.toLowerCase() : '';
    
    // VERROU DE SÉCURITÉ
    if (targetEmail === 'glesieur@cadexair.com') {
      return res.status(403).json({ error: 'Action interdite : Compte Master protégé.' });
    }

    const { error: profileDeleteError } = await supabase.from('profiles').delete().eq('id', id);
    if (profileDeleteError) throw profileDeleteError;

    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(id);
    if (authDeleteError) throw authDeleteError;

    res.status(200).json({ message: 'Utilisateur supprimé.' });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// Redirections pour pages HTML
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));

app.listen(PORT, () => {
  console.log(`Serveur prêt sur le port ${PORT}`);
});
