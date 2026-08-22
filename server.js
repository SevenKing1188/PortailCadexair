import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Clients Supabase
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ============================================
// MIDDLEWARE: Vérifier Token + Rôle
// ============================================

async function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ error: "Token invalide" });
    }
    req.user = data.user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Erreur auth" });
  }
}

async function adminMiddleware(req, res, next) {
  await authMiddleware(req, res, () => {
    // Vérifier rôle admin
    const { error, data } = supabase
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();

    // Utilise admin pour voir la data
    supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single()
      .then(({ data }) => {
        if (data?.role !== "admin") {
          return res.status(403).json({ error: "Admin requis" });
        }
        next();
      });
  });
}

// ============================================
// ROUTES: Authentification
// ============================================

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email et mot de passe requis" });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return res.status(401).json({ error: "Email ou mot de passe incorrect" });
  }

  res.json({
    success: true,
    user: data.user,
    session: data.session,
  });
});

app.post("/api/auth/logout", async (req, res) => {
  res.json({ success: true });
});

// ============================================
// ROUTES: Gestion Utilisateurs (ADMIN)
// ============================================

app.post("/api/admin/create-user", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  // Vérifie admin
  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }

  if (!["admin", "chef"].includes(role)) {
    return res.status(400).json({ error: "Rôle invalide (admin ou chef)" });
  }

  try {
    // Crée user Supabase
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) return res.status(400).json({ error: error.message });

    // Crée profil
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: data.user.id,
        name,
        role,
      });

    if (profileError) throw new Error(profileError.message);

    res.json({
      success: true,
      user: {
        id: data.user.id,
        email,
        name,
        role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/users", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, role")
      .order("name");

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTES: Bons de Travail
// ============================================

app.post("/api/admin/assign-workorder", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { title, description, team_leader_id, assigned_date } = req.body;

  if (!title || !team_leader_id || !assigned_date) {
    return res.status(400).json({ error: "Champs requis manquants" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("work_orders")
      .insert({
        title,
        description: description || "",
        team_leader_id,
        assigned_date,
        status: "pending",
      })
      .select();

    if (error) throw error;

    res.json({
      success: true,
      order: data[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/admin/workorders", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("work_orders")
      .select("*")
      .order("assigned_date", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/my-workorders", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) throw error;

    const { data: orders, error: orderError } = await supabase
      .from("work_orders")
      .select("*")
      .eq("team_leader_id", data.user.id)
      .order("assigned_date", { ascending: false });

    if (orderError) throw orderError;
    res.json(orders || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/api/workorder/:id/status", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { id } = req.params;
  const { status } = req.body;

  if (!["pending", "in_progress", "completed"].includes(status)) {
    return res.status(400).json({ error: "Statut invalide" });
  }

  try {
    const { data, error } = await supabase
      .from("work_orders")
      .update({ status })
      .eq("id", id)
      .select();

    if (error) throw error;
    res.json({ success: true, order: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ============================================
// ADMIN ENDPOINTS SUPPLÉMENTAIRES
// À AJOUTER dans server.js après les routes existantes
// ============================================

// ============================================
// DELETE USER (Supprimer utilisateur)
// ============================================

app.delete("/api/admin/delete-user", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { user_id } = req.body;

  if (!user_id) {
    return res.status(400).json({ error: "user_id requis" });
  }

  try {
    // Supprimer l'utilisateur auth via admin API
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) throw error;

    res.json({ success: true, message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// UPLOAD SCHEDULE (Horaire PDF)
// ============================================

app.post("/api/upload-schedule", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { pdf_base64 } = req.body;

  if (!pdf_base64) {
    return res.status(400).json({ error: "PDF requis" });
  }

  try {
    // Générer un nom unique
    const filename = `schedule_${Date.now()}.pdf`;

    // Upload vers Supabase Storage
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from("schedules")
      .upload(filename, Buffer.from(pdf_base64, "base64"), {
        contentType: "application/pdf",
        upsert: true, // Remplacer s'il existe
      });

    if (uploadError) throw uploadError;

    // Récupérer l'URL publique
    const { data: urlData } = supabaseAdmin.storage
      .from("schedules")
      .getPublicUrl(filename);

    res.json({
      success: true,
      url: urlData.publicUrl,
      message: "Horaire uploadé",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET SCHEDULE (Récupérer l'horaire)
// ============================================

app.get("/api/get-schedule", async (req, res) => {
  try {
    // Lister les fichiers du bucket
    const { data, error } = await supabaseAdmin.storage
      .from("schedules")
      .list("", {
        limit: 1,
        sortBy: { column: "updated_at", order: "desc" },
      });

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({ url: null, message: "Aucun horaire" });
    }

    // Récupérer l'URL du dernier fichier
    const latestFile = data[0];
    const { data: urlData } = supabaseAdmin.storage
      .from("schedules")
      .getPublicUrl(latestFile.name);

    res.json({
      url: urlData.publicUrl,
      filename: latestFile.name,
      uploadedAt: latestFile.updated_at,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// STORAGE BUCKETS
// ============================================
// Important: Créer deux buckets dans Supabase Storage:
// 1. "schedules" - Public (pour les horaires PDF)
// 2. "work_order_photos" - Public (pour les photos des bons)


// ============================================
// TEAM MEMBERS (Techniciens)
// ============================================

app.post("/api/team-members", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { work_order_id, user_id, name, role } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("team_members")
      .insert({
        work_order_id,
        user_id,
        name,
        role: role || "technician",
      })
      .select();

    if (error) throw error;
    res.json({ success: true, member: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/work-order/:id/team", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("team_members")
      .select("*")
      .eq("work_order_id", id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// TIME ENTRIES (Heures travaillées)
// ============================================

app.post("/api/time-entries", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { work_order_id, team_member_id, hours, description } = req.body;

  try {
    const { data, error } = await supabaseAdmin
      .from("time_entries")
      .insert({
        work_order_id,
        team_member_id,
        hours,
        description,
      })
      .select();

    if (error) throw error;
    res.json({ success: true, entry: data[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/work-order/:id/time-entries", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("time_entries")
      .select("*")
      .eq("work_order_id", id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WORK ORDER PHOTOS (Upload photos)
// ============================================

app.post("/api/work-order-photos", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { work_order_id, photo_type, photo_base64 } = req.body;

  if (!["hood", "door", "fan"].includes(photo_type)) {
    return res.status(400).json({ error: "Type de photo invalide" });
  }

  try {
    // Générer un nom unique pour la photo
    const filename = `work_order_${work_order_id}_${photo_type}_${Date.now()}.jpg`;

    // Upload vers Supabase Storage
    const { data, error: uploadError } = await supabaseAdmin.storage
      .from("work_order_photos")
      .upload(filename, Buffer.from(photo_base64, "base64"), {
        contentType: "image/jpeg",
      });

    if (uploadError) throw uploadError;

    // Récupérer l'URL publique
    const { data: urlData } = supabaseAdmin.storage
      .from("work_order_photos")
      .getPublicUrl(filename);

    // Enregistrer dans la base de données
    const { data: photoRecord, error: dbError } = await supabaseAdmin
      .from("work_order_photos")
      .insert({
        work_order_id,
        photo_type,
        photo_url: urlData.publicUrl,
        uploaded_by: userData.user.id,
      })
      .select();

    if (dbError) throw dbError;

    res.json({ success: true, photo: photoRecord[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/work-order/:id/photos", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// WORK ORDER HISTORY (Historique)
// ============================================

app.get("/api/work-order/:id/history", async (req, res) => {
  const { id } = req.params;

  try {
    const { data, error } = await supabase
      .from("work_order_history")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// REASSIGN WORK ORDER (Réassigner à un chef)
// ============================================

app.post("/api/work-order/:id/reassign", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Pas de token" });

  const { data: userData } = await supabase.auth.getUser(token);
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "admin") {
    return res.status(403).json({ error: "Admin requis" });
  }

  const { id } = req.params;
  const { new_chef_id } = req.body;

  try {
    // Récupérer le bon actuel
    const { data: order, error: getError } = await supabaseAdmin
      .from("work_orders")
      .select("team_leader_id")
      .eq("id", id)
      .single();

    if (getError) throw getError;

    // Mettre à jour le bon
    const { error: updateError } = await supabaseAdmin
      .from("work_orders")
      .update({ team_leader_id: new_chef_id })
      .eq("id", id);

    if (updateError) throw updateError;

    // Enregistrer dans l'historique
    const { error: historyError } = await supabaseAdmin
      .from("work_order_history")
      .insert({
        work_order_id: id,
        action: "reassigned",
        old_chef_id: order.team_leader_id,
        new_chef_id,
        changed_by: userData.user.id,
        details: `Réassigné de ${order.team_leader_id} à ${new_chef_id}`,
      });

    if (historyError) throw historyError;

    res.json({ success: true, message: "Bon réassigné avec succès" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// GET WORK ORDER DETAILS (Détails complets)
// ============================================

app.get("/api/work-order/:id/details", async (req, res) => {
  const { id } = req.params;

  try {
    // Récupérer le bon
    const { data: order, error: orderError } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError) throw orderError;

    // Récupérer les techniciens
    const { data: team, error: teamError } = await supabase
      .from("team_members")
      .select("*")
      .eq("work_order_id", id);

    if (teamError) throw teamError;

    // Récupérer les heures
    const { data: timeEntries, error: timeError } = await supabase
      .from("time_entries")
      .select("*")
      .eq("work_order_id", id);

    if (timeError) throw timeError;

    // Récupérer les photos
    const { data: photos, error: photosError } = await supabase
      .from("work_order_photos")
      .select("*")
      .eq("work_order_id", id);

    if (photosError) throw photosError;

    // Récupérer l'historique
    const { data: history, error: historyError } = await supabase
      .from("work_order_history")
      .select("*")
      .eq("work_order_id", id)
      .order("created_at", { ascending: false });

    if (historyError) throw historyError;

    res.json({
      order,
      team,
      timeEntries,
      photos,
      history,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// ROUTE: Fichiers statiques
// ============================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✓ Serveur lancé sur http://localhost:${PORT}`);
});
