const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || 'cadexair-secret-key-2026';

// Augmentation de la limite pour recevoir les photos en base64
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialisation de la base de données SQLite
const db = new sqlite3.Database('./cadexair.db', (err) => {
  if (!err) {
    console.log('Connecté à la BDD SQLite Cadexair.');
    initDb();
  } else {
    console.error('Erreur BDD:', err.message);
  }
});

function initDb() {
  db.serialize(async () => {
    // Table Utilisateurs
    db.run(`CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      passwordHash TEXT,
      role TEXT
    )`);

    // Table Bons de Travail
    db.run(`CREATE TABLE IF NOT EXISTS work_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Utilisateurs par défaut
    db.get(`SELECT COUNT(*) as count FROM users`, async (err, row) => {
      if (row && row.count === 0) {
        const defaultHash = await bcrypt.hash('password123', 10);
        db.run(`INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)`, ['admin', defaultHash, 'admin']);
        db.run(`INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)`, ['employe1', defaultHash, 'employe']);
        db.run(`INSERT INTO users (username, passwordHash, role) VALUES (?, ?, ?)`, ['employe2', defaultHash, 'employe']);
        console.log('Comptes par défaut créés.');
      }
    });
  });
}

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
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Utilisateur non trouvé' });

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) return res.status(400).json({ error: 'Mot de passe incorrect' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  });
});

// Liste des utilisateurs
app.get('/api/users', authenticateToken, (req, res) => {
  db.all(`SELECT id, username, role FROM users`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Historique des clients pour préremplissage
app.get('/api/clients-history', authenticateToken, (req, res) => {
  db.all(`SELECT DISTINCT client_name, client_address, nb_hottes, nb_portes, nb_ventilateurs FROM work_orders`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Liste des bons de travail
app.get('/api/work-orders', authenticateToken, (req, res) => {
  const { history } = req.query;
  let query = `SELECT * FROM work_orders`;
  let params = [];

  if (history === 'true') {
    query += ` ORDER BY id DESC`;
  } else if (req.user.role !== 'admin') {
    query += ` WHERE (team_lead_id = ? OR helpers LIKE ?) AND status != 'Terminé' ORDER BY id DESC`;
    params.push(req.user.id, `%${req.user.username}%`);
  } else {
    query += ` WHERE status != 'Terminé' ORDER BY id DESC`;
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Créer un bon de travail (Admin)
app.post('/api/work-orders', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Réservé aux admins' });

  const {
    client_name, client_address, appointment_date, appointment_time,
    team_lead_id, helpers, work_details, nb_hottes, nb_portes, nb_ventilateurs
  } = req.body;

  db.get(`SELECT username FROM users WHERE id = ?`, [team_lead_id], (err, user) => {
    const team_lead_name = user ? user.username : 'Inconnu';

    db.run(
      `INSERT INTO work_orders 
      (client_name, client_address, appointment_date, appointment_time, team_lead_id, team_lead_name, helpers, work_details, team_lead_comments, nb_hottes, nb_portes, nb_ventilateurs, photos_data, time_entries, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        client_name, client_address, appointment_date, appointment_time,
        team_lead_id, team_lead_name, JSON.stringify(helpers || []), work_details, '',
        nb_hottes || 0, nb_portes || 0, nb_ventilateurs || 0,
        '{}', '{}', 'En attente'
      ],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, client_name });
      }
    );
  });
});

// Mettre à jour un bon de travail
app.patch('/api/work-orders/:id', authenticateToken, (req, res) => {
  const { photos_data, time_entries, team_lead_comments, status } = req.body;
  
  db.run(
    `UPDATE work_orders SET 
      photos_data = COALESCE(?, photos_data),
      time_entries = COALESCE(?, time_entries),
      team_lead_comments = COALESCE(?, team_lead_comments),
      status = COALESCE(?, status)
     WHERE id = ?`,
    [
      photos_data ? JSON.stringify(photos_data) : null,
      time_entries ? JSON.stringify(time_entries) : null,
      team_lead_comments !== undefined ? team_lead_comments : null,
      status || null,
      req.params.id
    ],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Bon de travail mis à jour avec succès' });
    }
  );
});

// Redirection vers le frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Serveur Cadexair en ligne sur le port ${PORT}`);
});
