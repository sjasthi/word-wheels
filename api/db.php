<?php
// ============================================================
// Word Wheel — Database Connection
// ============================================================
// Fill in your actual credentials before deploying.
// This file is included by all other PHP endpoints.
// Never commit real credentials to a public GitHub repo —
// consider using environment variables on your live server.
// ============================================================

define('DB_HOST', 'localhost');
define('DB_NAME', 'wordwheel');
define('DB_USER', 'root');          // XAMPP default — change for production
define('DB_PASS', '');              // XAMPP default — change for production
define('DB_CHARSET', 'utf8mb4');

function get_db() {
    static $pdo = null;

    if ($pdo === null) {
        $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => 'Database connection failed.']);
            exit;
        }
    }

    return $pdo;
}
// NOTE: No headers set here — headers are set by each endpoint individually
?>
