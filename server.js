// ============================================
// API EXPRESS - Portail Cadexair v3.0
// ============================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// SUPABASE CLIENT
// ============================================

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// MIDDLEWARE
// ============================================

app.use(cors());
app.use(express.json());

// Middleware Auth JWT
const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    // Récupère rôle depuis DB
    const { data: user } = await supabase
      .from('utilisateurs')
      .select('role')
      .eq('id', decoded.id)
      .single();
    
    req.user.role = user?.role;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Middleware Rôle Master
const masterOnly = (req, res, next) => {
  if (req.user.role !== 'master') {
    return res.status(403).json({ error: 'Accès Master uniquement' });
  }
  next();
};

// Middleware Rôle Master/Admin
const adminOrMaster = (req, res, next) => {
  if (!['master', 'admin_secondaire'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès Admin/Master required' });
  }
  next();
};

// ============================================
// ROUTES ADMIN SETUP (Initialisation)
// ============================================

app.post('/api/admin/create-master', async (req, res) => {
  const { email, nom, password } = req.body;

  // Vérification basique
  if (!email || !nom || !password) {
    return res.status(400).json({ error: 'Email, nom et mot de passe requis' });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: 'Mot de passe minimum 12 caractères' });
  }

  try {
    // 1. Vérifier s'il existe déjà un master
    const { data: existingMaster } = await supabase
      .from('utilisateurs')
      .select('id')
      .eq('role', 'master')
      .single();

    if (existingMaster) {
      return res.status(403).json({ error: 'Un master existe déjà. Cette opération ne peut être effectuée qu\'une fois.' });
    }

    // 2. Créer utilisateur Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 3. Insérer dans DB avec rôle master
    const { data, error } = await supabase
      .from('utilisateurs')
      .insert({
        id: authUser.user.id,
        email,
        nom,
        role: 'master',
        departement: 'Admin',
        created_by: authUser.user.id
      })
      .select();

    if (error) throw error;

    res.status(201).json({ 
      message: 'Master créé avec succès',
      user: data[0]
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// ROUTES AUTH (Login)
// ============================================

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;

    const { data: user } = await supabase
      .from('utilisateurs')
      .select('id, email, nom, role')
      .eq('id', data.user.id)
      .single();

    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

// ============================================
// ROUTES UTILISATEURS (Master/Admin)
// ============================================

// GET: Tous les utilisateurs
app.get('/api/utilisateurs', authMiddleware, adminOrMaster, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('utilisateurs')
      .select('id, email, nom, role, departement, actif, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Créer utilisateur (Admin/Master)
app.post('/api/utilisateurs', authMiddleware, adminOrMaster, async (req, res) => {
  const { email, password, nom, role, departement } = req.body;

  // Master seul peut créer admin_secondaire
  if (role === 'admin_secondaire' && req.user.role !== 'master') {
    return res.status(403).json({ error: 'Seul Master crée les admins secondaires' });
  }

  try {
    // 1. Créer utilisateur Supabase Auth
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw authError;

    // 2. Insérer dans DB
    const { data, error } = await supabase
      .from('utilisateurs')
      .insert({
        id: authUser.user.id,
        email,
        nom,
        role,
        departement,
        created_by: req.user.id
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE: Supprimer utilisateur (Master/Admin)
app.delete('/api/utilisateurs/:id', authMiddleware, adminOrMaster, async (req, res) => {
  const { id } = req.params;

  // Vérifier rôle cible
  const { data: targetUser } = await supabase
    .from('utilisateurs')
    .select('role')
    .eq('id', id)
    .single();

  // Master seul peut supprimer admin_secondaire
  if (targetUser.role === 'admin_secondaire' && req.user.role !== 'master') {
    return res.status(403).json({ error: 'Seul Master supprime les admins secondaires' });
  }

  try {
    // Supprimer de Supabase Auth
    await supabase.auth.admin.deleteUser(id);

    // Supprimer de DB
    const { error } = await supabase
      .from('utilisateurs')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Utilisateur supprimé' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// ROUTES BONS DE TRAVAIL
// ============================================

// GET: Tous les bons (avec filtres)
app.get('/api/bons', authMiddleware, async (req, res) => {
  try {
    const { statut, chef_id, mois } = req.query;
    let query = supabase.from('bons_travail').select('*');

    if (statut) query = query.eq('statut', statut);
    if (chef_id) query = query.eq('chef_equipe_id', chef_id);
    if (mois) {
      const [year, month] = mois.split('-');
      query = query.gte('date_intervention', `${year}-${month}-01`)
               .lt('date_intervention', `${year}-${month}-32`);
    }

    const { data, error } = await query.order('date_intervention', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Détail bon + historique
app.get('/api/bons/:id', authMiddleware, async (req, res) => {
  try {
    const { data: bon, error: errBon } = await supabase
      .from('bons_travail')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (errBon) throw errBon;

    const { data: historique, error: errHist } = await supabase
      .from('historique_bons')
      .select(`
        *,
        changed_by:utilisateurs(nom)
      `)
      .eq('bon_id', req.params.id)
      .order('changed_at', { ascending: false });

    if (errHist) throw errHist;

    res.json({ bon, historique });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Créer bon (Chef/Admin)
app.post('/api/bons', authMiddleware, adminOrMaster, async (req, res) => {
  const { numero, client_nom, client_adresse, date_intervention, chef_equipe_id } = req.body;

  try {
    const { data, error } = await supabase
      .from('bons_travail')
      .insert({
        numero,
        client_nom,
        client_adresse,
        date_intervention,
        chef_equipe_id,
        created_by: req.user.id
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH: Assigner/Modifier bon
app.patch('/api/bons/:id', authMiddleware, adminOrMaster, async (req, res) => {
  const { id } = req.params;
  const { statut, chef_equipe_id, techniciens_ids, notes_travail, heure_arrivee, heure_depart } = req.body;

  try {
    const { data, error } = await supabase
      .from('bons_travail')
      .update({
        statut,
        chef_equipe_id,
        techniciens_ids,
        notes_travail,
        heure_arrivee,
        heure_depart,
        updated_by: req.user.id,
        updated_at: new Date()
      })
      .eq('id', id)
      .select();

    if (error) throw error;
    res.json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// ROUTES ÉVÉNEMENTS (Bannière)
// ============================================

// GET: Événements actuels
app.get('/api/evenements', async (req, res) => {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('evenements')
      .select(`
        *,
        created_by:utilisateurs(nom)
      `)
      .eq('visible_a_tous', true)
      .lte('date_debut', now)
      .gte('date_fin', now)
      .order('priorite', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST: Créer événement (Admin seulement)
app.post('/api/evenements', authMiddleware, adminOrMaster, async (req, res) => {
  const { titre, description, date_debut, date_fin, priorite, type } = req.body;

  try {
    const { data, error } = await supabase
      .from('evenements')
      .insert({
        titre,
        description,
        date_debut,
        date_fin,
        priorite,
        type,
        created_by: req.user.id
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// ROUTES HEURES TRAVAIL
// ============================================

// POST: Enregistrer heures (Chef/Tech)
app.post('/api/heures', authMiddleware, async (req, res) => {
  const { bon_id, technicien_id, heures_travaillees, notes } = req.body;

  try {
    const { data, error } = await supabase
      .from('heures_travail')
      .insert({
        bon_id,
        technicien_id,
        heures_travaillees,
        notes
      })
      .select();

    if (error) throw error;
    res.status(201).json(data[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// ============================================
// SERVIR FRONTEND STATIQUE
// ============================================

app.use(express.static(__dirname));

app.get('/setup', (req, res) => {
  res.sendFile(__dirname + '/setup.html');
});

app.get('/login', (req, res) => {
  res.sendFile(__dirname + '/login.html');
});

app.get('/portail-cadexair-frontend.html', (req, res) => {
  res.sendFile(__dirname + '/portail-cadexair-frontend.html');
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/portail-cadexair-frontend.html');
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log(`✅ API Cadexair en écoute sur port ${PORT}`);
  console.log(`📍 Stack: Express + Supabase`);
  console.log(`🔐 Auth: JWT + Supabase Auth`);
});
