-- ============================================
-- TABLES CADEXAIR - Portail Opérationnel v3.0
-- ============================================

-- 1️⃣ UTILISATEURS (géré par Master/Admin secondaires)
CREATE TABLE utilisateurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  nom TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('master', 'admin_secondaire', 'chef_equipe', 'technicien')),
  departement TEXT,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID REFERENCES utilisateurs(id),
  updated_at TIMESTAMP DEFAULT now()
);

-- 2️⃣ ÉVÉNEMENTS / INFOS GÉNÉRALES (Bannière)
CREATE TABLE evenements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titre TEXT NOT NULL,
  description TEXT,
  date_debut TIMESTAMP NOT NULL,
  date_fin TIMESTAMP,
  priorite TEXT DEFAULT 'normal' CHECK (priorite IN ('basse', 'normal', 'haute')),
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'alerte', 'fermeture')),
  visible_a_tous BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT now()
);

-- 3️⃣ BONS DE TRAVAIL (cœur du système)
CREATE TABLE bons_travail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT UNIQUE NOT NULL,
  client_nom TEXT NOT NULL,
  client_adresse TEXT NOT NULL,
  client_tel TEXT,
  date_intervention DATE NOT NULL,
  heure_rdv TIME,
  description_travaux TEXT,
  
  -- ASSIGNATION
  chef_equipe_id UUID REFERENCES utilisateurs(id),
  techniciens_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- STATUT
  statut TEXT DEFAULT 'cree' CHECK (statut IN ('cree', 'confirme', 'en_cours', 'termine', 'facture')),
  priorite TEXT DEFAULT 'normal' CHECK (priorite IN ('basse', 'normal', 'haute')),
  
  -- SUIVI
  heure_arrivee TIMESTAMP,
  heure_depart TIMESTAMP,
  notes_travail TEXT,
  photos_avant JSONB,
  photos_apres JSONB,
  
  -- METADATA
  created_by UUID NOT NULL REFERENCES utilisateurs(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES utilisateurs(id)
);

-- 4️⃣ HISTORIQUE BONS (Audit trail)
CREATE TABLE historique_bons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id UUID NOT NULL REFERENCES bons_travail(id) ON DELETE CASCADE,
  ancien_statut TEXT,
  nouveau_statut TEXT,
  ancien_chef UUID,
  nouveau_chef UUID,
  ancien_techniciens UUID[],
  nouveau_techniciens UUID[],
  notes TEXT,
  changed_by UUID NOT NULL REFERENCES utilisateurs(id),
  changed_at TIMESTAMP DEFAULT now()
);

-- 5️⃣ HEURES DE TRAVAIL (Par technicien/bon)
CREATE TABLE heures_travail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bon_id UUID NOT NULL REFERENCES bons_travail(id) ON DELETE CASCADE,
  technicien_id UUID NOT NULL REFERENCES utilisateurs(id),
  heures_travaillees NUMERIC(5,2),
  notes TEXT,
  recorded_at TIMESTAMP DEFAULT now()
);

-- 6️⃣ INVENTAIRE CAMIONS
CREATE TABLE inventaire_camions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_camion TEXT UNIQUE NOT NULL,
  chef_equipe_id UUID REFERENCES utilisateurs(id),
  articles JSONB DEFAULT '{}'::JSONB,
  carburant NUMERIC(5,2),
  kilométrage INTEGER,
  etat_general TEXT,
  updated_at TIMESTAMP DEFAULT now(),
  updated_by UUID REFERENCES utilisateurs(id)
);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE utilisateurs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evenements ENABLE ROW LEVEL SECURITY;
ALTER TABLE bons_travail ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_bons ENABLE ROW LEVEL SECURITY;
ALTER TABLE heures_travail ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_camions ENABLE ROW LEVEL SECURITY;

-- Utilisateurs: Tous lisent, Master/Admin modifient
CREATE POLICY "utilisateurs_read" ON utilisateurs FOR SELECT USING (true);
CREATE POLICY "utilisateurs_create" ON utilisateurs FOR INSERT WITH CHECK (
  auth.role() IN ('master', 'admin_secondaire')
);
CREATE POLICY "utilisateurs_delete" ON utilisateurs FOR DELETE USING (
  auth.role() IN ('master', 'admin_secondaire')
);

-- Événements: Tous lisent
CREATE POLICY "evenements_read" ON evenements FOR SELECT USING (visible_a_tous = true);

-- Bons: Tous lisent, Chef/Admin créent/modifient
CREATE POLICY "bons_read" ON bons_travail FOR SELECT USING (true);
CREATE POLICY "bons_insert" ON bons_travail FOR INSERT WITH CHECK (
  auth.role() IN ('admin_secondaire', 'chef_equipe')
);
CREATE POLICY "bons_update" ON bons_travail FOR UPDATE USING (
  auth.role() IN ('admin_secondaire', 'chef_equipe')
);

-- Historique: Tous lisent, système écrit
CREATE POLICY "historique_read" ON historique_bons FOR SELECT USING (true);

-- Heures: Tous lisent, techniciens/chef enregistrent
CREATE POLICY "heures_read" ON heures_travail FOR SELECT USING (true);
CREATE POLICY "heures_insert" ON heures_travail FOR INSERT WITH CHECK (
  auth.role() IN ('technicien', 'chef_equipe', 'admin_secondaire')
);

-- ============================================
-- TRIGGERS (Audit automatique)
-- ============================================

CREATE OR REPLACE FUNCTION audit_bon_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO historique_bons (
    bon_id, ancien_statut, nouveau_statut, 
    ancien_chef, nouveau_chef, changed_by
  ) VALUES (
    NEW.id, OLD.statut, NEW.statut,
    OLD.chef_equipe_id, NEW.chef_equipe_id,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_audit_bon
AFTER UPDATE ON bons_travail
FOR EACH ROW
WHEN (OLD.statut IS DISTINCT FROM NEW.statut OR OLD.chef_equipe_id IS DISTINCT FROM NEW.chef_equipe_id)
EXECUTE FUNCTION audit_bon_change();

-- ============================================
-- INDEX (Performances)
-- ============================================

CREATE INDEX idx_bons_chef ON bons_travail(chef_equipe_id);
CREATE INDEX idx_bons_statut ON bons_travail(statut);
CREATE INDEX idx_bons_date ON bons_travail(date_intervention);
CREATE INDEX idx_historique_bon ON historique_bons(bon_id);
CREATE INDEX idx_heures_bon ON heures_travail(bon_id);
CREATE INDEX idx_evenements_date ON evenements(date_debut);
