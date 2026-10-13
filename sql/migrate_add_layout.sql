-- ============================================================
-- Word Wheel — Migration: store the wheel layout with a puzzle
-- ============================================================
-- Run once against an existing `wordwheel` database created from
-- an older wordwheel_schema.sql. Fresh installs already have these
-- columns. Rows saved before this migration keep NULL layout
-- columns, and the frontend generates a new layout for them.
-- ============================================================

USE wordwheel;

ALTER TABLE puzzles
    ADD COLUMN start_slot     INT  NULL AFTER center_letter,
    ADD COLUMN ring_order     JSON NULL AFTER start_slot,
    ADD COLUMN hidden_indexes JSON NULL AFTER ring_order;
