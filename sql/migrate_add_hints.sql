-- ============================================================
-- Migration: add the puzzle_hints table (AI hints)
-- ============================================================
-- Run once on databases created before AI hints existed. Fresh
-- installs get this table from wordwheel_schema.sql.
-- The player endpoints read this table, so run this before
-- deploying the hint code.
-- ============================================================

USE wordwheel;

CREATE TABLE IF NOT EXISTS puzzle_hints (
    puzzle_id       INT          PRIMARY KEY,
    generated_hints JSON         NULL,
    final_hints     JSON         NOT NULL,
    prompt_version  VARCHAR(20)  NULL,
    model           VARCHAR(60)  NULL,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    approved_at     TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (puzzle_id) REFERENCES puzzles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
