-- ============================================
-- RESET COMPLET - Supprimer + Recréer
-- ============================================

-- Supprimer les tables (si elles existent)
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- ============================================
-- CRÉER tables
-- ============================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'chef')),
  created_at TIMESTAMP DEFAULT NOW()
);

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

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  USING (
    auth.uid() = id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "profiles_update_policy"
  ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Work Orders
CREATE POLICY "workorders_select_policy"
  ON work_orders
  FOR SELECT
  USING (
    auth.uid() = team_leader_id OR
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

CREATE POLICY "workorders_update_policy"
  ON work_orders
  FOR UPDATE
  USING (auth.uid() = team_leader_id);

CREATE POLICY "workorders_insert_policy"
  ON work_orders
  FOR INSERT
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_workorders_team_leader_id ON work_orders(team_leader_id);
CREATE INDEX idx_workorders_status ON work_orders(status);
CREATE INDEX idx_workorders_assigned_date ON work_orders(assigned_date);

-- ============================================
-- TRIGGERS
-- ============================================

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

-- ✅ DONE
