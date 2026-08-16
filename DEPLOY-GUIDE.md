# 🚀 GUIDE DÉPLOIEMENT RENDER + GITHUB

## ✅ ÉTAPE 1: GitHub

### 1.1 Créer repo
```bash
git init
git add .
git commit -m "Init: Portail Cadexair v3.0"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/portail-cadexair.git
git push -u origin main
```

### 1.2 Structure repo
```
portail-cadexair/
├── server.js               # API Express
├── package.json            # Dépendances
├── Procfile                # Config Render
├── .env.example            # Variables (template)
├── .gitignore              # ❌ .env, node_modules
├── init-supabase.sql       # SQL tables
├── portail-cadexair-frontend.html
└── DEPLOY-GUIDE.md
```

---

## ✅ ÉTAPE 2: Supabase Setup

### 2.1 Créer projet Supabase
1. Aller sur https://supabase.com
2. Créer nouveau projet
3. Copier `SUPABASE_URL` et `SUPABASE_ANON_KEY`

### 2.2 Initialiser DB
1. SQL Editor → "New Query"
2. Copier **tout le contenu** de `init-supabase.sql`
3. Coller + Run

### 2.3 Supabase Auth
1. Auth → Users
2. Add user
   - Email: `master@cadexair.com`
   - Password: `GenerateStrongPassword123!`
3. Créer 2-3 users test (chef, technicien)
4. Dans SQL Editor:
```sql
UPDATE utilisateurs SET role = 'master' WHERE email = 'master@cadexair.com';
UPDATE utilisateurs SET role = 'chef_equipe' WHERE email = 'chef@cadexair.com';
UPDATE utilisateurs SET role = 'technicien' WHERE email = 'tech@cadexair.com';
```

---

## ✅ ÉTAPE 3: Render Setup

### 3.1 Créer service Web
1. https://render.com → "New +"
2. "Web Service"
3. Connect GitHub repo `portail-cadexair`

### 3.2 Configurer Render
- **Name:** `portail-cadexair` (ou autre)
- **Environment:** Node
- **Build command:** `npm install`
- **Start command:** `npm start`
- **Plan:** Free (pour test) ou Starter ($7/mois)

### 3.3 Ajouter variables .env
Dans Render → Settings → Environment Variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJxxxxxxx
SUPABASE_SERVICE_KEY=eyJxxxxxxx
JWT_SECRET=ChangeMeNow_SuperSecretKey_12345
MASTER_PASSWORD=ChangeMeAlso_12345
NODE_ENV=production
API_URL=https://portail-cadexair.onrender.com
```

⚠️ **Récupérer clés Supabase:**
- Supabase → Settings → API
- Copier `Project URL` → `SUPABASE_URL`
- Copier `anon public` → `SUPABASE_ANON_KEY`
- Copier `service_role secret` → `SUPABASE_SERVICE_KEY`

### 3.4 Deploy
Render auto-deploy quand tu push sur `main` branch. Attendre 2-3 min.

---

## ✅ ÉTAPE 4: Frontend Setup

### 4.1 Adapter URL API
Dans `portail-cadexair-frontend.html`:
```javascript
const API_URL = 'https://portail-cadexair.onrender.com/api'; // ← Change localhost
```

### 4.2 Créer login.html
À faire: simple form login qui appelle `/api/auth/login`

### 4.3 Héberger Frontend
**Option A:** Netlify (gratuit, facile)
- Upload `portail-cadexair-frontend.html`
- Netlify auto-déploie

**Option B:** Dans Render (même service)
- Ajouter static files à Express

---

## ✅ ÉTAPE 5: Test Production

### Login
- Email: `master@cadexair.com`
- Password: `GenerateStrongPassword123!`

### Tests
1. Créer bon de travail
2. Assigner chef d'équipe
3. Voir historique
4. Créer utilisateur (Master/Admin)

---

## 🔗 URLs Finales

| Service | URL |
|---------|-----|
| API Backend | `https://portail-cadexair.onrender.com` |
| Health Check | `https://portail-cadexair.onrender.com/health` |
| Frontend (Netlify) | `https://portail-cadexair.netlify.app` |
| Supabase | `https://supabase.com/dashboard` |

---

## 🐛 Troubleshooting

### Erreur 503 Render
```
→ Attendre 5 min (démarrage)
→ Vérifier .env variables
→ Vérifier Supabase connexion
```

### Erreur "Token invalide"
```
→ JWT_SECRET mismatch entre .env
→ Token expiré (24h)
```

### Erreur Supabase
```
→ Vérifier RLS enabled
→ Vérifier tables créées (SQL)
→ Vérifier SUPABASE_SERVICE_KEY correct
```

---

## 📝 Checklist final

- [ ] GitHub repo created + code pushed
- [ ] Supabase project created + tables init
- [ ] Render connected to GitHub
- [ ] .env variables set in Render
- [ ] Frontend URL API updated
- [ ] Master user created + tested
- [ ] App deployed ✅

---

## 📞 Support

Logs Render:
```
Render Dashboard → portail-cadexair → Logs
```

Logs Supabase:
```
Supabase → Logs → Realtime
```

---

**Créé:** August 2026
**Stack:** Express + Supabase + GitHub + Render
