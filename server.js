const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MASTER_EMAIL = 'glesieur@cadexair.com';

// Configuration Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// En-têtes de sécurité renforcés
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:"]
    }
  }
}));

app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Limitation du taux de requêtes (Rate Limiter)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});
app.use('/api/', limiter);

// Middleware Authentification Cookie
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

// Middleware d'autorisation Administrateur
async function isAdmin(req, res, next) {
  const userEmail = req.user?.email?.toLowerCase();

  // Traitement prioritaire Master Admin
  if (userEmail === MASTER_EMAIL) {
    req.isMaster = true;
    req.userRole = 'admin';
    return next();
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || data?.role !== 'admin') {
      return res.status(403).json({ error: 'Accès refusé : Droits administrateur requis.' });
    }

    req.userRole = data.role;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Erreur lors du contrôle des privilèges.' });
  }
}

// --- ROUTES API ---

// Connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Identifiants requis.' });

  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(400).json({ error: 'Identifiants invalides.' });

    res.cookie('access_token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    return res.status(200).json({ message: 'Connexion réussie.' });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ error: 'Erreur interne du serveur.' });
  }
});

// Déconnexion
app.post('/api/logout', (req, res) => {
  res.clearCookie('access_token');
  return res.status(200).json({ message: 'Déconnexion réussie.' });
});

// Obtenir la liste des Chefs d'équipe
app.get('/api/chefs', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, full_name, department')
      .eq('role', 'chef');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Fetch Chefs Error:', error);
    res.status(500).json({ error: 'Impossible de récupérer les chefs d\'équipe.' });
  }
});

// Obtenir la liste des Employés Terrain
app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Fetch Employees Error:', error);
    res.status(500).json({ error: 'Impossible de récupérer la liste des employés.' });
  }
});

// Créer un Employé Terrain (Admin)
app.post('/api/employees', authenticateToken, isAdmin, async (req, res) => {
  const { fullName } = req.body;
  const cleanName = typeof fullName === 'string' ? fullName.trim() : '';

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Le nom de l\'employé est invalide.' });
  }

  try {
    const { data, error } = await supabase.from('employees').insert([{ full_name: cleanName }]);
    if (error) throw error;
    res.status(201).json({ message: 'Employé créé avec succès !', data });
  } catch (error) {
    console.error('Create Employee Error:', error);
    res.status(500).json({ error: 'Erreur lors de la création de l\'employé.' });
  }
});

// Supprimer un Employé Terrain (Admin)
app.delete('/api/employees/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { error } = await supabase.from('employees').delete().eq('id', id);
    if (error) throw error;
    res.status(200).json({ message: 'Employé supprimé.' });
  } catch (error) {
    console.error('Delete Employee Error:', error);
    res.status(500).json({ error: 'Erreur lors de la suppression de l\'employé.' });
  }
});

// Créer un Bon de Travail (Admin)
app.post('/api/work-orders', authenticateToken, isAdmin, async (req, res) => {
  const {
    clientName, clientAddress, contactName, contactPhone, appointmentDate, appointmentTime,
    department, nbHottes, nbPortesAcces, nbVentilateurs, assignedTo, description, techniciansLog
  } = req.body;

  try {
    const { data, error } = await supabase.from('work_orders').insert([{
      title: 'Bon de travail',
      client_name: String(clientName || '').trim(),
      client_address: String(clientAddress || '').trim(),
      contact_name: String(contactName || '').trim(),
      contact_phone: String(contactPhone || '').trim(),
      appointment_date: appointmentDate,
      appointment_time: appointmentTime,
      department: String(department || '').trim(),
      nb_hottes: parseInt(nbHottes) || 0,
      nb_portes_acces: parseInt(nbPortesAcces) || 0,
      nb_ventilateurs: parseInt(nbVentilateurs) || 0,
      assigned_to: assignedTo || null,
      description: String(description || '').trim(),
      technicians_log: Array.isArray(techniciansLog) ? techniciansLog : [],
      created_by: req.user.id
    }]);

    if (error) throw error;
    res.status(201).json({ message: 'Bon de travail créé !', data });
  } catch (error) {
    console.error('Create Work Order Error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du bon de travail.' });
  }
});

// Obtenir la liste des Bons de Travail
app.get('/api/work-orders', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*, profiles:assigned_to(username, full_name)')
      .order('appointment_date', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Fetch Work Orders Error:', error);
    res.status(500).json({ error: 'Erreur lors du chargement des bons.' });
  }
});

// Créer un Utilisateur Système (Admin)
app.post('/api/create-user', authenticateToken, isAdmin, async (req, res) => {
  const { email, password, username, role, department } = req.body;

  if (!email || !password || !username) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const targetRole = cleanEmail === MASTER_EMAIL ? 'admin' : (role === 'admin' ? 'admin' : 'chef');

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true
    });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('profiles').insert([{
      id: authData.user.id,
      username: String(username).trim(),
      full_name: String(username).trim(),
      role: targetRole,
      department: String(department || '').trim()
    }]);
    if (profileError) throw profileError;

    res.status(201).json({ message: 'Compte créé avec succès !' });
  } catch (error) {
    console.error('Create User Error:', error);
    res.status(500).json({ error: 'Erreur lors de la création du compte.' });
  }
});

// Supprimer un Utilisateur Système (Admin avec Verrou Master)
app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { data: targetUserData, error: getUserError } = await supabase.auth.admin.getUserById(id);

    if (getUserError || !targetUserData?.user) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const targetEmail = targetUserData.user.email?.toLowerCase();

    // Verrouillage de suppression Master
    if (targetEmail === MASTER_EMAIL) {
      return res.status(403).json({ 
        error: 'Action interdite : Le compte Master Admin ne peut pas être supprimé.' 
      });
    }

    // Restriction : Seul le Master peut supprimer un autre compte Admin
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', id)
      .single();

    if (targetProfile?.role === 'admin' && !req.isMaster) {
      return res.status(403).json({ 
        error: 'Seul le Master Admin peut supprimer un compte administrateur.' 
      });
    }

    await supabase.from('profiles').delete().eq('id', id);
    await supabase.auth.admin.deleteUser(id);

    return res.status(200).json({ message: 'Utilisateur supprimé avec succès.' });

  } catch (error) {
    console.error('Delete User Error:', error);
    return res.status(500).json({ error: 'Erreur lors de la suppression de l\'utilisateur.' });
  }
});

// Route par défaut
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Démarrage Serveur
app.listen(PORT, () => {
  console.log(`Serveur opérationnel sur le port ${PORT}`);
});
