# 🚀 DÉPLOIEMENT SUR RENDER

## Étape 1: Préparer GitHub

```bash
# Terminal (local)
git init
git add .
git commit -m "Initial commit - Cadexair portal"
git branch -M main
git remote add origin https://github.com/TON_USER/cadexair-portal.git
git push -u origin main
```

## Étape 2: Render Dashboard

1. Aller sur **https://render.com**
2. S'inscrire avec GitHub
3. Cliquer **New +** → **Web Service**
4. Sélectionner le repo `cadexair-portal`

## Étape 3: Configurer le Service

### Informations de base:
- **Name:** `cadexair-portal` (sera l'URL)
- **Runtime:** Node
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Plan:** Free (gratuit)

### Environment Variables:

Cliquer **Environment** et ajouter:

```
SUPABASE_URL = https://xxxxx.supabase.co
SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NODE_ENV = production
PORT = 3000
```

**⚠️ IMPORTANT:** 
- Les clés viennent de **Supabase Settings > API**
- `SUPABASE_SERVICE_KEY` doit rester SECRET (jamais en frontend)

## Étape 4: Deploy

Cliquer **Create Web Service**

Render va:
1. Cloner ton repo
2. Installer `npm install`
3. Lancer `npm start`
4. Déployer sur: `https://cadexair-portal.onrender.com`

**Temps:** ~2-3 minutes

## Étape 5: Vérifier

```bash
# Test URL
curl https://cadexair-portal.onrender.com
# Doit retourner le HTML de login.html
```

Ouvrir dans navigateur:
- **Login:** https://cadexair-portal.onrender.com
- **Admin Dashboard:** https://cadexair-portal.onrender.com/admin.html
- **Chef Dashboard:** https://cadexair-portal.onrender.com/chef.html

## Étape 6: Updates Futurs

Chaque fois que tu fais `git push main`:
1. Render détecte le changement automatiquement
2. Re-déploie en quelques minutes
3. Zéro downtime

---

## 🆘 Problèmes courants

### "Cannot GET /"
- Vérifier que `server.js` existe dans la racine
- Vérifier `start` command dans `package.json`

### "Service Unavailable" (503)
- Attendre 5 min (démarrage)
- Vérifier logs sur Render Dashboard

### Port 3000 utilisé
- Render gère automatiquement (enregistre PORT env var)
- Rien à faire

### Clés Supabase invalides
- Copier exactement depuis Supabase (Settings > API)
- Pas d'espaces avant/après
- Vérifier dans Render Environment

---

## 📊 Monitoring

Sur Render Dashboard:
- **Logs:** Voir les erreurs en live
- **Metrics:** CPU, RAM, temps de réponse
- **Deployments:** Historique des déploiements

---

## 💡 Astuces

**Déployer une branche spécifique:**
- Par défaut: `main`
- Changer dans Render Settings > Build & Deploy

**Redéployer manuellement:**
- Cliquer **Redeploy** dans Render Dashboard
- Utile si bug ou cache

**Auto-redeploy:**
- C'est déjà activé (chaque git push)
- Peut se désactiver dans Settings

---

**URL finale:**
```
https://cadexair-portal.onrender.com
```

Partager ce lien avec les admins et chefs pour login.
