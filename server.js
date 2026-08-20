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
      .select("*, profiles(name)")
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
