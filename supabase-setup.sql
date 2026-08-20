-- ============================================
-- SUPABASE SETUP - Cadexair Portal
-- Copier-coller dans SQL Editor Supabase
-- ============================================

-- 1. Créer table profiles (infos utilisateurs)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'chef')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Créer table work_orders (bons de travail)
CREATE TABLE work_orders (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  team_leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  assigned_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Activer RLS sur profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Chefs voient leur propre profil, admins voient tout
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy: Chefs peuvent mettre à jour leur profil seulement
CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Activer RLS sur work_orders
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Policy: Chefs voient leurs bons, admins voient tout
CREATE POLICY "workorders_select_policy"
  ON work_orders
  FOR SELECT
  USING (
    auth.uid() = team_leader_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Policy: Chefs peuvent mettre à jour le statut de leurs bons
CREATE POLICY "workorders_update_policy"
  ON work_orders
  FOR UPDATE
  USING (auth.uid() = team_leader_id)
  WITH CHECK (auth.uid() = team_leader_id);

-- Policy: Admin peut insérer bons
CREATE POLICY "workorders_insert_policy"
  ON work_orders
  FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================
-- INDEXES (Performance)
-- ============================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_workorders_team_leader_id ON work_orders(team_leader_id);
CREATE INDEX idx_workorders_status ON work_orders(status);
CREATE INDEX idx_workorders_assigned_date ON work_orders(assigned_date);

-- ============================================
-- TRIGGERS (Automatique)
-- ============================================

-- Mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_work_orders_updated_at
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();

-- ============================================
-- DONNÉES TEST (optionnel - à supprimer en prod)
-- ============================================

-- Créer un admin test (email: admin@test.com, password: Password123!)
-- Note: Utiliser Supabase Admin Panel pour créer les users

-- Exemple de bon de travail (après créer les users):
/*
INSERT INTO work_orders (title, description, team_leader_id, status, assigned_date)
VALUES (
  'Nettoyage hotte Restaurant ABC',
  'Nettoyage complet système ventilation',
  'PASTE_USER_ID_HERE',
  'pending',
  CURRENT_DATE + INTERVAL '1 day'
);
*/

-- ============================================
-- DONE!
-- ============================================
-- La base est prête. Créer les utilisateurs via:
-- - Supabase Auth Panel (manuel)
-- - Ou via API /api/admin/create-user (app)
