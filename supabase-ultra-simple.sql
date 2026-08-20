-- ============================================
-- VERSION ULTRA SIMPLE
-- ============================================

-- Supprimer si existent
DROP TABLE IF EXISTS work_orders CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Créer profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Créer work_orders
CREATE TABLE work_orders (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  team_leader_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  assigned_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- Policies profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT
USING (auth.uid() = id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- Policies work_orders
CREATE POLICY "workorders_select" ON work_orders FOR SELECT
USING (auth.uid() = team_leader_id OR (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "workorders_update" ON work_orders FOR UPDATE
USING (auth.uid() = team_leader_id);

CREATE POLICY "workorders_insert" ON work_orders FOR INSERT
WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');

-- ✅ DONE
