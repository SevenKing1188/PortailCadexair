const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

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
    return res.status(403).json({ error: 'Session invalide ou expirée.' });
  }
}

async function isAdmin(req, res, next) {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || data?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé : Seuls les administrateurs peuvent effectuer cette action.' });
    }
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors de la vérification des droits.' });
  }
}

// --- ROUTES API ---

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Champs manquants.' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: 'Identifiants invalides.' });

    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ message: 'Connexion réussie !' });
  } catch (err) {
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token');
  return res.status(200).json({ message: 'Déconnexion réussie' });
});

app.get('/api/chefs', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('profiles').select('id, username, department').eq('role', 'chef');
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOUVEAU : Récupérer la liste des employés terrain
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('employees').select('*').order('full_name', { ascending: true });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// NOUVEAU : Créer un employé (Admin uniquement)
app.post('/api/employees', authenticateToken, isAdmin, async (req, res) => {
  const { fullName } = req.body;
  if (!fullName) return res.status(400).json({ error: 'Le nom est obligatoire.' });

  try {
    const { data, error } = await supabase.from('employees').insert([{ full_name: fullName }]);
    if (error) throw error;
    res.status(201).json({ message: 'Employé créé avec succès !', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/work-orders', authenticateToken, isAdmin, async (req, res) => {
  const { clientName, clientAddress, appointmentDate, appointmentTime, department, nbHottes, nbPortesAcces, nbVentilateurs, assignedTo, description, techniciansLog } = req.body;

  try {
    const { data, error } = await supabase.from('work_orders').insert([{
      title: 'Bon de travail',
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
      technicians_log: techniciansLog || [],
      created_by: req.user.id
    }]);

    if (error) throw error;
    res.status(201).json({ message: 'Bon créé !', data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/work-orders', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase.from('work_orders').select('*, profiles:assigned_to (username)').order('appointment_date', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/create-user', authenticateToken, isAdmin, async (req, res) => {
  const { email, password, username, role, department } = req.body;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('profiles').insert([{ id: authData.user.id, username, full_name: username, role, department }]);
    if (profileError) throw profileError;

    res.status(201).json({ message: 'Utilisateur créé !' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: userData } = await supabase.auth.admin.getUserById(id);
    if (userData?.user?.email?.toLowerCase() === 'glesieur@cadexair.com') {
      return res.status(403).json({ error: 'Compte Master protégé.' });
    }

    await supabase.from('profiles').delete().eq('id', id);
    await supabase.auth.admin.deleteUser(id);
    res.status(200).json({ message: 'Utilisateur supprimé.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/login.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`Serveur prêt sur le port ${PORT}`));
