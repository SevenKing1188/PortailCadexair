const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Middlewares
app.use(cors());
app.use(express.json());

// Distribution des fichiers statiques du dossier public (PWA)
app.use(express.static(path.join(__dirname, 'public')));

// Route de santé API
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', app: 'Portail Cadexair' });
});

// Redirection SPA/PWA pour éviter l'erreur "Cannot GET /"
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});