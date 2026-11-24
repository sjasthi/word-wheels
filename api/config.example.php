<?php
// ============================================================
// Word Wheel — local settings template
// ============================================================
// Copy this file to config.local.php (git-ignored) on each machine
// and server, then fill in the values. Never commit real keys.
//
// AI hints stay switched off while HINTS_API_KEY is empty.
// ============================================================

// Gemini API key from Google AI Studio (aistudio.google.com).
define('HINTS_API_KEY', '');

// Gemini model used to write hints.
define('HINTS_MODEL', 'gemini-3.5-flash-lite');
?>
