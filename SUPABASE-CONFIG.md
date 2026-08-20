# 🔧 Configuration Supabase – Pas à Pas

## Étape 1: Créer Projet Supabase

1. Aller sur https://supabase.com
2. Cliquer **Sign Up**
3. Choisir **Continue with GitHub**
4. Autoriser Supabase
5. Cliquer **New project**
6. Remplir:
   - **Name:** `cadexair` (ou autre)
   - **Database Password:** Générer un mot de passe fort
   - **Region:** Europe (ou ta région)
7. Cliquer **Create new project**

⏳ Attendre 5 min (création en cours)...

---

## Étape 2: Récupérer les Clés API

1. Quand le projet est prêt, aller **Settings** (gauche)
2. Cliquer **API**
3. Copier ces 3 clés dans un fichier texte:

**Project URL:**
```
https://xxxxx.supabase.co
```
↓ Coller dans `.env` comme `SUPABASE_URL`

**Anon public key:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
↓ Coller dans `.env` comme `SUPABASE_ANON_KEY`
↓ Aussi dans les fichiers HTML

**Service role key:** (Chercher dans la page)
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
↓ Coller dans `.env` comme `SUPABASE_SERVICE_KEY`
⚠️ **NE JAMAIS METTRE EN FRONTEND** (backend seulement)

---

## Étape 3: Créer Tables + RLS

1. Aller: **SQL Editor** (gauche)
2. Cliquer **New Query**
3. Copier-coller **TOUT** le fichier `supabase-setup.sql`
4. Cliquer **Run** (coin haut droit)

✅ Tables créées + RLS activé

---

## Étape 4: Ajouter Email Auth (optionnel - recommandé)

1. Aller: **Authentication** > **Providers**
2. Chercher **Email**
3. Cliquer toggle "Enable Email provider"
4. Garder **Autoconfirm enabled** (OFF pour demander confirmation)
5. Cliquer **Save**

---

## Étape 5: Créer Premier Admin (IMPORTANT)

1. Aller: **Authentication** > **Users** (en haut)
2. Cliquer **Invite new user**
3. Remplir:
   - **Email:** `admin@cadexair.com` (ou ton email)
   - **Password:** Générer sécurisé (min 8 caractères)
4. Cliquer **Send invite**

⏳ Invite envoyée (pas besoin de cliquer le lien)

---

## Étape 6: Ajouter RÔLE ADMIN

1. Aller: **SQL Editor**
2. Nouveau query:

```sql
INSERT INTO profiles (id, name, role)
SELECT id, 'Admin Principal', 'admin'
FROM auth.users
WHERE email = 'admin@cadexair.com'
LIMIT 1;
```

3. Cliquer **Run**

✅ L'admin est maintenant créé + autorisé

---

## Étape 7: Tester l'Authentification

**Local:**
```bash
npm start
# Ouvrir http://localhost:3000
```

**Login:**
- Email: `admin@cadexair.com`
- Password: (celui généré à l'étape 5)

✅ Doit rediriger vers `/admin.html`

---

## Étape 8: Vérifier RLS

1. Aller: **Table Editor**
2. Cliquer sur `work_orders`
3. Onglet **Row Level Security**

✅ Doit voir 2 policies:
- `workorders_select_policy`
- `workorders_update_policy`
- `workorders_insert_policy`

---

## Étape 9: Monitoring (optionnel)

**Voir les logs d'authentification:**
1. Aller: **Authentication** > **Logs**
2. Chercher les tentatives de login

**Voir les données:**
1. Aller: **Table Editor**
2. Cliquer sur `profiles` ou `work_orders`
3. Voir les entrées créées

---

## 🆘 Checklist Finale

- [ ] Projet créé sur Supabase
- [ ] 3 clés API copiées
- [ ] SQL script exécuté
- [ ] Tables créées (profiles + work_orders)
- [ ] RLS activé
- [ ] Premier admin créé
- [ ] Admin ajouté à la table profiles
- [ ] Clés dans `.env`
- [ ] Clés dans `*.html` (login, admin, chef)
- [ ] Authentification testée en local

✅ **Supabase est prêt!**

---

## 📝 Notes

- Ne JAMAIS partager `SUPABASE_SERVICE_KEY`
- `SUPABASE_ANON_KEY` est OK de mettre en frontend
- Chaque utilisateur créé via l'app aura son profil auto-généré
- RLS empêche les chefs de voir les bons d'autres chefs

---

**Prochaine étape:** Lire `QUICKSTART.md` pour local + Render.
