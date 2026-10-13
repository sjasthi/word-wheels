-- ============================================================
-- Word Wheel — Migration: optional puzzle name
-- ============================================================
-- Run once against an existing `wordwheel` database created from
-- an older wordwheel_schema.sql. Fresh installs already have this
-- column. Existing puzzles get NULL and show as "Unnamed".
-- ============================================================

USE wordwheel;

ALTER TABLE puzzles
    ADD COLUMN name VARCHAR(100) NULL AFTER id;
