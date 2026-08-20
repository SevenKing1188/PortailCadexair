# 🔧 Portail Administratif Cadexair

Portail sécurisé pour gestion administrative : créer utilisateurs, assigner bons, suivi statuts.

---

## 📋 ÉTAPES DE MISE EN PLACE

### 1️⃣ **SUPABASE – Créer la base**

**Créer tables + RLS:**

```sql
-- Table: profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table: work_orders
CREATE TABLE work_orders (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  team_leader_id UUID REFERENCES auth.users(id),
  status TEXT DEFAULT 'pending',
  assigned_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activer RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Politique: Chefs voient uniquement leurs bons
CREATE POLICY "Chef sees own orders"
  ON work_orders
  FOR SELECT
  USING (
    auth.uid() = team_leader_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Politique: Chefs voient leur profil, admins voient tout
CREATE POLICY "Chef sees own profile"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );
```

**Récupérer les clés:**
- Aller dans Settings > API
- Copier: `SUPABASE_URL` et `SUPABASE_ANON_KEY`
- Aller dans Settings > Service Role Key
- Copier: `SUPABASE_SERVICE_KEY` (SECRET - jamais en frontend!)

---

### 2️⃣ **GITHUB – Pousser le code**

```bash
# Initialiser le repo
git init
git add .
git commit -m "Init Cadexair portal"
git remote add origin https://github.com/ton-user/cadexair-portal.git
git push -u origin main
```

**Important:** Créer `.gitignore`:
```
.env
node_modules/
```

---

### 3️⃣ **RENDER – Déployer**

1. Aller sur **[render.com](https://render.com)**
2. Créer compte (GitHub login)
3. New > Web Service
4. Connecter repo GitHub
5. Configuration:
   - **Name:** `cadexair-portal`
   - **Runtime:** `Node`
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free (ou Pro pour plus de stabilité)

6. Ajouter variables d'environnement (Environment):
   ```
   SUPABASE_URL=https://xxxxx.supabase.co
   SUPABASE_ANON_KEY=eyxxxxx
   SUPABASE_SERVICE_KEY=eyxxxxx
   NODE_ENV=production
   ```

7. Deploy

**URL finale:** `https://cadexair-portal.onrender.com`

---

### 4️⃣ **CONFIGUREZ LES FICHIERS HTML**

Remplacer dans tous les fichiers HTML:

```javascript
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
```

Par vos vraies clés Supabase.

---

## 🚀 LANCEMENT LOCAL

```bash
# 1. Installer
npm install

# 2. Créer .env
cp .env.example .env
# Éditer .env avec vos clés Supabase

# 3. Lancer
npm start

# Accès: http://localhost:3000
```

---

## 👥 UTILISATION

### **Admin:**
1. Login: `admin.html`
2. Créer utilisateurs (Chef ou Admin)
3. Assigner bons de travail
4. Voir tous les bons + statuts

### **Chef d'équipe:**
1. Login: `chef.html`
2. Voir ses bons assignés
3. Mettre à jour statut:
   - ⏳ En attente → 🔄 En cours → ✅ Complété

---

## 🔒 SÉCURITÉ

✅ JWT Supabase (authentification)
✅ RLS en base (Chefs voient UNIQUEMENT leurs bons)
✅ Service Key seulement en backend
✅ Variables env sur Render (jamais en code)
✅ CORS limité

---

## 📊 API ROUTES

| Méthode | Route | Auth | Rôle |
|---------|-------|------|------|
| POST | `/api/auth/login` | Non | Tous |
| POST | `/api/admin/create-user` | JWT | Admin |
| GET | `/api/admin/users` | JWT | Admin |
| POST | `/api/admin/assign-workorder` | JWT | Admin |
| GET | `/api/admin/workorders` | JWT | Admin |
| GET | `/api/my-workorders` | JWT | Chef |
| PATCH | `/api/workorder/:id/status` | JWT | Chef |

---

## 🆘 TROUBLESHOOTING

**"Token invalide"**
- Vérifier clés Supabase dans HTML + .env
- Vérifier que JWT n'est pas expiré

**"Admin requis"**
- Vérifier que l'utilisateur a rôle 'admin' dans profiles
- Vérifier RLS en Supabase

**"Aucun bon n'apparaît"**
- Vérifier que assigned_date est une date valide
- Vérifier RLS: `SELECT * FROM work_orders` en Supabase console

**Render redémarre en boucle**
- Vérifier Node version: `node --version` (min 18.x)
- Vérifier `npm start` dans `package.json`
- Regarder logs Render

---

## 📝 NOTES

- Fichiers statiques (HTML) servis depuis `/public`
- Backend Express sur port 3000
- CORS actif (à adapter en production)
- Logs d'accès advisé pour audit

---

**Version:** 1.0.0  
**Auteur:** Cadexair  
**Support:** Guillaume - guillaume@cadexair.com
