-- ============================================================
-- Word Wheel Puzzle Application
-- Database Schema
-- ============================================================
-- Course:      ICS 499 - Capstone Project
-- Instructor:  Siva Jasthi
-- Team:        Austin Nguyen, Henry Nguyen
-- Version:     1.0
-- Date:        October 2026
-- ============================================================

-- Create and select database
CREATE DATABASE IF NOT EXISTS wordwheel;
USE wordwheel;

-- ============================================================
-- USERS TABLE
-- Stores admin and future user accounts
-- ============================================================
CREATE TABLE users (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    username     VARCHAR(50)  NOT NULL UNIQUE,
    password     VARCHAR(255) NOT NULL,               -- bcrypt hashed, never plain text
    role         ENUM('admin', 'user') DEFAULT 'user',
    created_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- PUZZLES TABLE
-- Stores all generated word wheel puzzles
-- ============================================================
CREATE TABLE puzzles (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    word           VARCHAR(20)  NOT NULL,             -- the target word (7-9 characters)
    arrangement    JSON         NOT NULL,             -- letter order as JSON array e.g. ["p","h","e","l","a","n","t"]
    direction      ENUM('cw', 'ccw', 'random') DEFAULT 'cw',
    hidden_count   INT          DEFAULT 0,            -- number of hidden letters (0-3)
    center_letter  BOOLEAN      DEFAULT TRUE,         -- whether first letter is center hub
    language       VARCHAR(10)  DEFAULT 'en',         -- language code e.g. 'en', 'ko', 'ja', 'hi'
    status         ENUM('draft', 'published') DEFAULT 'draft',
    scheduled_date DATE         NULL,                 -- date assigned for daily puzzle, nullable
    created_by     INT          NULL,                 -- foreign key to users table
    created_date   TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================================
-- INDEXES
-- Improves query performance for common operations
-- ============================================================

-- Daily puzzle lookup by date
CREATE INDEX idx_scheduled_date ON puzzles(scheduled_date);

-- Admin filtering by status (draft/published)
CREATE INDEX idx_status ON puzzles(status);

-- Filtering puzzles by creator
CREATE INDEX idx_created_by ON puzzles(created_by);

-- ============================================================
-- DEFAULT ADMIN USER
-- ============================================================
-- Default credentials: username = admin / password = admin123
-- Password is bcrypt hashed (cost factor 10)
-- !! CHANGE THIS PASSWORD before deploying to production !!
INSERT INTO users (username, password, role) VALUES (
    'admin',
    '$2y$10$ker9CqRbuY3oJs0i3Y0TpOjM2WIt9L67V/8zteMvB439LpHwyK3mC',
    'admin'
);
