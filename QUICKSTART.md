# ⚡ QUICKSTART – Mise en place en 15 min

## 1️⃣ SUPABASE (2 min)

1. Aller: https://supabase.com
2. Sign up → New Project
3. **Copier ces 3 clés** (Settings > API):
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_KEY` ⚠️ SECRET!

4. Aller: **SQL Editor** (gauche)
5. Copier-coller tout le contenu de `supabase-setup.sql`
6. Cliquer **Run**

✅ Base de données prête.

---

## 2️⃣ LOCAL (3 min)

```bash
# Cloner ou télécharger les fichiers
cd cadexair-portal

# Installer dépendances
npm install

# Créer .env
cp .env.example .env
```

**Éditer `.env`** avec tes 3 clés Supabase:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...
```

**Éditer les fichiers HTML** (remplacer dans login.html, admin.html, chef.html):
```javascript
// Avant:
const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

// Après:
const SUPABASE_URL = "https://xxxxx.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGc...";
```

**Lancer:**
```bash
npm start
```

Ouvrir: http://localhost:3000

✅ App tourne en local.

---

## 3️⃣ CRÉER PREMIER ADMIN (2 min)

**Dans Supabase:**
1. Aller: **Authentication** > **Users**
2. **Invite new user**
3. Email: `admin@cadexair.com`
4. Password: (générer sécurisé)
5. Cliquer **Send invite**

**Dans SQL Editor:**
```sql
INSERT INTO profiles (id, name, role)
SELECT id, 'Admin', 'admin'
FROM auth.users
WHERE email = 'admin@cadexair.com';
```

**Tester:**
- Aller: http://localhost:3000
- Email: `admin@cadexair.com`
- Password: (celui générée)
- ✅ Doit rediriger vers `/admin.html`

---

## 4️⃣ GITHUB (2 min)

```bash
git init
git add .
git commit -m "Init"
git branch -M main

# Remplacer TON_USER par ton username GitHub
git remote add origin https://github.com/TON_USER/cadexair-portal.git
git push -u origin main
```

✅ Code sur GitHub.

---

## 5️⃣ RENDER (3 min)

1. Aller: https://render.com
2. Sign up avec GitHub
3. **New** > **Web Service**
4. Connecter repo GitHub
5. Remplir:
   - Name: `cadexair-portal`
   - Build: `npm install`
   - Start: `npm start`
   - Plan: Free

6. **Environment Variables** (ajouter 3):
   ```
   SUPABASE_URL = https://xxxxx.supabase.co
   SUPABASE_ANON_KEY = eyJhbGc...
   SUPABASE_SERVICE_KEY = eyJhbGc...
   NODE_ENV = production
   ```

7. **Create Web Service**

⏳ Attendre 2-3 min...

✅ App en ligne sur: https://cadexair-portal.onrender.com

---

## ✨ DONE!

**Tester:**
- Login: https://cadexair-portal.onrender.com
- Admin: `admin@cadexair.com`

**Créer plus d'utilisateurs:**
- Admin Dashboard → Créer Utilisateur
- Assigner des bons

**Chefs voient leurs bons:**
- Créer chef → Il reçoit email
- Login avec son compte
- Voir ses bons assignés

---

## 🆘 Ça marche pas?

| Problème | Solution |
|----------|----------|
| "Token invalide" | Vérifier clés Supabase dans .env + HTML |
| "Admin requis" | Vérifier que user a role='admin' dans profiles table |
| Render redémarre | Vérifier `npm start` dans package.json |
| "Cannot GET /" | Vérifier server.js dans racine |

---

**Besoin d'aide?** Lire `README.md` ou `DEPLOY.md` pour détails complets.
