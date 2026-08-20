-- ============================================
-- FIX: Garder la structure, vider les données
-- ============================================

-- Juste vider les données (garder les tables)
DELETE FROM work_orders;
DELETE FROM profiles;

-- Reset les séquences
ALTER SEQUENCE work_orders_id_seq RESTART WITH 1;

-- ✅ DONE - Tables vides, prêtes pour nouveaux données
