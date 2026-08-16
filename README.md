# 📋 PORTAIL CADEXAIR v3.0

**API + Frontend pour gestion bons de travail, assignation équipes, et historique complet.**

---

## 🎯 Fonctionnalités

### 📝 Bons de Travail
- ✅ Créer/modifier/supprimer bons
- ✅ Assigner chef d'équipe + techniciens
- ✅ Suivi statut (créé → en cours → terminé)
- ✅ Historique complet (audit trail)
- ✅ Filtrage par statut/date

### 👥 Gestion Utilisateurs
- ✅ Master: crée/supprime admins secondaires
- ✅ Admin/Master: crée/supprime users (chef, technicien)
- ✅ Hiérarchie stricte: Master > Admin > Chef > Tech
- ✅ Supabase Auth intégré

### 📣 Bannière Événements
- ✅ Infos/événements en haut page
- ✅ Filtrage par priorité
- ✅ Visible à tous

### 📊 Dashboard
- ✅ Stats en temps réel (bons en cours, terminés)
- ✅ Événements à venir
- ✅ Synthèse activités

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Backend** | Node.js + Express |
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth + JWT |
| **Frontend** | HTML/CSS/JS vanilla |
| **Hosting** | Render + Netlify |
| **VCS** | GitHub |

---

## 📂 Structure Projet

```
portail-cadexair/
├── server.js                          # API Express principale
├── package.json                       # Dépendances
├── Procfile                          # Config Render
├── .env.example                      # Template variables
├── init-supabase.sql                 # Schéma DB + RLS
├── portail-cadexair-frontend.html    # Frontend mono-fichier
├── DEPLOY-GUIDE.md                   # Guide Render + GitHub
└── README.md                         # Ce fichier
```

---

## 🚀 Quickstart

### Prérequis
- Node.js 18+
- Compte Supabase
- Compte GitHub
- Compte Render

### Dev local (avant deploy)

1. **Clone repo**
```bash
git clone https://github.com/TON_USER/portail-cadexair.git
cd portail-cadexair
```

2. **Install + config**
```bash
npm install
cp .env.example .env
# Éditer .env avec tes clés Supabase
```

3. **Start serveur**
```bash
npm start  # ou 'npm run dev' avec nodemon
```

4. **Open frontend**
```
Fichier → Ouvrir → portail-cadexair-frontend.html
```

### Production (Render)
→ Voir `DEPLOY-GUIDE.md`

---

## 📡 API Routes

### Auth
- `POST /api/auth/login` — Login utilisateur

### Bons Travail
- `GET /api/bons` — Liste tous les bons (filtres: statut, chef_id, mois)
- `GET /api/bons/:id` — Détail bon + historique
- `POST /api/bons` — Créer bon (Admin/Master)
- `PATCH /api/bons/:id` — Modifier bon (assignation, statut)

### Utilisateurs
- `GET /api/utilisateurs` — Liste users (Admin/Master)
- `POST /api/utilisateurs` — Créer user (Admin/Master)
- `DELETE /api/utilisateurs/:id` — Supprimer user (Admin/Master)

### Événements
- `GET /api/evenements` — Événements actuels (public)
- `POST /api/evenements` — Créer événement (Admin/Master)

### Heures Travail
- `POST /api/heures` — Enregistrer heures (Tech/Chef)

### Health
- `GET /health` — Status serveur

---

## 🔐 Sécurité

### Row Level Security (RLS)
- Supabase RLS enabled par défaut
- Utilisateurs voient bons publics + leurs bons
- Admin accès complet

### Authentication
- Supabase Auth + JWT 24h
- Tokens valides via middleware
- Mots de passe hashés bcrypt

### Hiérarchie Permissions
```
Master
├─ Crée/supprime Admin Secondaire
├─ Accès complet (bons, users, events)
│
Admin Secondaire
├─ Crée/supprime Users (Chef, Tech)
├─ Gère bons + assignation
│
Chef d'Équipe
├─ Voit ses bons assignés
├─ Enregistre heures
│
Technicien
├─ Voit bons assignés
├─ Enregistre heures
```

---

## 📋 Schéma DB Principal

```sql
bons_travail {
  id: UUID (PK)
  numero: TEXT UNIQUE
  client_nom: TEXT
  chef_equipe_id: UUID → FK utilisateurs
  techniciens_ids: UUID[]
  statut: ['cree','en_cours','termine','facture']
  date_intervention: DATE
  created_at, updated_at: TIMESTAMP
}

historique_bons {
  id: UUID (PK)
  bon_id: UUID → FK bons_travail
  ancien_statut, nouveau_statut: TEXT
  changed_by: UUID → FK utilisateurs
  changed_at: TIMESTAMP
}

utilisateurs {
  id: UUID (PK)
  email: TEXT UNIQUE
  nom: TEXT
  role: ['master','admin_secondaire','chef_equipe','technicien']
}

evenements {
  id: UUID (PK)
  titre, description: TEXT
  date_debut, date_fin: TIMESTAMP
  priorite: ['basse','normal','haute']
}
```

---

## 🧪 Test Comptes

| Role | Email | Password |
|------|-------|----------|
| Master | master@cadexair.com | `GenerateStrong123!` |
| Admin Sec. | admin@cadexair.com | `GenerateStrong123!` |
| Chef Eq. | chef@cadexair.com | `GenerateStrong123!` |
| Technicien | tech@cadexair.com | `GenerateStrong123!` |

---

## 📊 Roadmap

- [ ] v3.1: Photos avant/après bons
- [ ] v3.2: Export PDF bons
- [ ] v3.3: Comptabilité (cumul heures)
- [ ] v3.4: Mobile app (APK)
- [ ] v4.0: Intégration Epicor

---

## 🐛 Logs & Debug

**Render logs:**
```
Dashboard → portail-cadexair → Logs
```

**Supabase logs:**
```
Supabase Dashboard → Logs → Realtime
```

**Local dev:**
```
npm run dev  # nodemon auto-restart
curl http://localhost:3000/health
```

---

## 📞 Support

| Question | Réponse |
|----------|---------|
| Erreur 503 Render? | Attendre boot + vérifier .env |
| RLS error? | Vérifier tables créées + roles DB |
| Token invalide? | Vérifier JWT_SECRET match |
| Frontend ne charge pas? | Adapter API_URL dans HTML |

---

## 📝 License

MIT © Cadexair 2026

---

**Version:** 3.0.0  
**Créé:** Août 2026  
**Maintenu par:** Guillaume
