const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware Authentification
async function authenticateToken(req, res, next) {
  const token = req.cookies.access_token;
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) throw error;
    req.user = user;
    next();
  } catch (err) { res.clearCookie('access_token'); return res.status(403).json({ error: 'Session invalide.' }); }
}

// Middleware Admin uniquement
async function isAdmin(req, res, next) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', req.user.id).single();
  if (error || data.role !== 'admin') return res.status(403).json({ error: 'Accès refusé : Admin requis.' });
  next();
}

// --- ROUTES ---
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(400).json({ error: 'Identifiants invalides.' });
  res.cookie('access_token', data.session.access_token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 86400000 });
  return res.status(200).json({ message: 'OK' });
});

app.post('/api/logout', (req, res) => { res.clearCookie('access_token'); return res.status(200).json({ message: 'Déconnecté' }); });

app.get('/api/chefs', authenticateToken, async (req, res) => {
  const { data } = await supabase.from('profiles').select('id, username, department').eq('role', 'chef');
  res.json(data || []);
});

// Création Bon (Admin uniquement)
app.post('/api/work-orders', authenticateToken, isAdmin, async (req, res) => {
  const { clientName, clientAddress, appointmentDate, appointmentTime, department, nbHottes, nbPortesAcces, nbVentilateurs, assignedTo, description, techniciansLog } = req.body;
  const { error } = await supabase.from('work_orders').insert([{
    title: 'Bon de travail', // Titre par défaut car supprimé du formulaire
    client_name: clientName, client_address: clientAddress, appointment_date: appointmentDate,
    appointment_time: appointmentTime, department, nb_hottes: nbHottes, nb_portes_acces: nbPortesAcces,
    nb_ventilateurs: nbVentilateurs, assigned_to: assignedTo || null, description, 
    technicians_log: techniciansLog || [], created_by: req.user.id
  }]);
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json({ message: 'Bon créé !' });
});

app.get('/api/work-orders', authenticateToken, async (req, res) => {
  const { data } = await supabase.from('work_orders').select('*, profiles:assigned_to(username)').order('appointment_date', { ascending: false });
  res.json(data || []);
});

app.post('/api/create-user', authenticateToken, isAdmin, async (req, res) => {
  const { email, password, username, role, department } = req.body;
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (authError) return res.status(500).json({ error: authError.message });
  const { error: profileError } = await supabase.from('profiles').insert([{ id: authData.user.id, username, full_name: username, role, department }]);
  if (profileError) return res.status(500).json({ error: profileError.message });
  res.status(201).json({ message: 'Utilisateur créé !' });
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;
  const { data: userData } = await supabase.auth.admin.getUserById(id);
  if (userData?.user?.email?.toLowerCase() === 'glesieur@cadexair.com') return res.status(403).json({ error: 'Protection Master activée.' });
  await supabase.from('profiles').delete().eq('id', id);
  await supabase.auth.admin.deleteUser(id);
  res.json({ message: 'Supprimé.' });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'login.html')));
app.listen(PORT);
