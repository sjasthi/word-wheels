<?php
// ============================================================
// Word Wheel — admin check for API endpoints
// ============================================================
// require_once this at the top of an admin-only endpoint. It answers
// 403 and stops unless the request comes from a logged-in admin
// (admin/login.php sets $_SESSION['admin']).
// ============================================================

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (empty($_SESSION['admin'])) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Unauthorised. Please log in again.']);
    exit;
}
?>
