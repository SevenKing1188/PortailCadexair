const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'cadexair-secret-key-2026';

// Augmentation de la limite pour recevoir les photos en base64
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configuration de la connexion PostgreSQL (Render ou local)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test de connexion et initialisation de la base de données PostgreSQL
async function initDb() {
  try {
    // Table Utilisateurs
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE,
        password_hash TEXT,
        role VARCHAR(50)
      )
    `);

    // Table Bons de Travail
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_orders (
        id SERIAL PRIMARY KEY,
        client_name TEXT,
        client_address TEXT,
        appointment_date TEXT,
        appointment_time TEXT,
        team_lead_id INTEGER,
        team_lead_name TEXT,
        helpers TEXT,
        work_details TEXT,
        team_lead_comments TEXT,
        nb_hottes INTEGER DEFAULT 0,
        nb_portes INTEGER DEFAULT 0,
        nb_ventilateurs INTEGER DEFAULT 0,
        photos_data TEXT,
        time_entries TEXT,
        status TEXT DEFAULT 'En attente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('Connecté et tables prêtes sur PostgreSQL (Cadexair).');

    // Vérification et création des comptes par défaut
    const userCountResult = await pool.query(`SELECT COUNT(*) as count FROM users`);
    if (parseInt(userCountResult.rows[0].count) === 0) {
      const defaultHash = await bcrypt.hash('password123', 10);
      await pool.query(
  
        `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)`,
         ['adminmaster', defaultHash, 'admin']
        );
      console.log('Comptes par défaut créés avec succès.');
    }
  } catch (err) {
    console.error('Erreur d initialisation BDD PostgreSQL:', err.message);
  }
}

initDb();

// Middleware de vérification JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Accès non autorisé' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token invalide' });
    req.user = user;
    next();
  });
}

// --- ROUTES API ---

// Connexion
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Utilisateur non trouvé' });

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste des utilisateurs
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, username, role FROM users`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Historique des clients pour préremplissage
app.get('/api/clients-history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`SELECT DISTINCT client_name, client_address, nb_hottes, nb_portes, nb_ventilateurs FROM work_orders`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Liste des bons de travail
app.get('/api/work-orders', authenticateToken, async (req, res) => {
  const { history } = req.query;
  try {
    let query = `SELECT * FROM work_orders`;
    let params = [];

    if (history === 'true') {
      query += ` ORDER BY id DESC`;
    } else if (req.user.role !== 'admin') {
      query += ` WHERE (team_lead_id = $1 OR helpers LIKE $2) AND status != 'Terminé' ORDER BY id DESC`;
      params.push(req.user.id, `%${req.user.username}%`);
    } else {
      query += ` WHERE status != 'Terminé' ORDER BY id DESC`;
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Créer un bon de travail (Admin)
app.post('/api/work-orders', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé aux admins' });

  const {
    client_name, client_address, appointment_date, appointment_time,
    team_lead_id, helpers, work_details, nb_hottes, nb_portes, nb_ventilateurs
  } = req.body;

  try {
    const userResult = await pool.query(`SELECT username FROM users WHERE id = $1`, [team_lead_id]);
    const team_lead_name = userResult.rows.length > 0 ? userResult.rows[0].username : 'Inconnu';

    const insertQuery = `
      INSERT INTO work_orders 
      (client_name, client_address, appointment_date, appointment_time, team_lead_id, team_lead_name, helpers, work_details, team_lead_comments, nb_hottes, nb_portes, nb_ventilateurs, photos_data, time_entries, status) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id
    `;

    const values = [
      client_name, client_address, appointment_date, appointment_time,
      team_lead_id, team_lead_name, JSON.stringify(helpers || []), work_details, '',
      nb_hottes || 0, nb_portes || 0, nb_ventilateurs || 0,
      '{}', '{}', 'En attente'
    ];

    const result = await pool.query(insertQuery, values);
    res.status(201).json({ id: result.rows[0].id, client_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mettre à jour un bon de travail
app.patch('/api/work-orders/:id', authenticateToken, async (req, res) => {
  const { photos_data, time_entries, team_lead_comments, status } = req.body;
  const orderId = req.params.id;

  try {
    const updateQuery = `
      UPDATE work_orders SET 
        photos_data = COALESCE($1, photos_data),
        time_entries = COALESCE($2, time_entries),
        team_lead_comments = COALESCE($3, team_lead_comments),
        status = COALESCE($4, status)
       WHERE id = $5
    `;

    const values = [
      photos_data ? JSON.stringify(photos_data) : null,
      time_entries ? JSON.stringify(time_entries) : null,
      team_lead_comments !== undefined ? team_lead_comments : null,
      status || null,
      orderId
    ];

    await pool.query(updateQuery, values);
    res.json({ message: 'Bon de travail mis à jour avec succès' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Redirection vers le frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur Cadexair en ligne sur le port ${PORT}`);
});
