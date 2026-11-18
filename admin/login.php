<?php
// ============================================================
// Word Wheel — Teacher (admin) login
// ============================================================
header('Content-Type: text/html; charset=utf-8');
session_start();
require_once '../api/db.php';
require_once __DIR__ . '/../partials/layout.php';

$error = '';

if (!empty($_SESSION['admin'])) {
    header('Location: dashboard.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim($_POST['username'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username && $password) {
        try {
            $pdo  = get_db();
            $stmt = $pdo->prepare("SELECT id, password, role FROM users WHERE username = ?");
            $stmt->execute([$username]);
            $user = $stmt->fetch();

            if ($user && password_verify($password, $user['password']) && $user['role'] === 'admin') {
                $_SESSION['admin']   = true;
                $_SESSION['user_id'] = $user['id'];
                header('Location: dashboard.php');
                exit;
            } else {
                $error = 'Invalid username or password.';
            }

        } catch (PDOException $e) {
            $error = 'Database error. Please try again.';
        }
    } else {
        $error = 'Please enter both username and password.';
    }
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <?php ww_head('Teacher Login', '../'); ?>
</head>
<body>
<?php ww_header('../', 'login'); ?>
<main class="ww-main">
    <div class="container py-5" style="max-width: 420px">
        <div class="card shadow-sm">
            <div class="card-body p-4">
                <h1 class="h3 mb-1">Teacher login</h1>
                <p class="text-muted mb-4">Create, schedule and print puzzles.</p>

                <?php if ($error): ?>
                    <div class="alert alert-danger py-2"><?= htmlspecialchars($error) ?></div>
                <?php endif; ?>

                <form method="POST" novalidate>
                    <div class="mb-3">
                        <label for="username" class="form-label">Username</label>
                        <input type="text" id="username" name="username" class="form-control"
                               autocomplete="username" required>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Password</label>
                        <input type="password" id="password" name="password" class="form-control"
                               autocomplete="current-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100" style="min-height: 44px">Log in</button>
                </form>
            </div>
        </div>
        <p class="text-center mt-3 mb-0"><a href="../index.php">← Back to the puzzles</a></p>
    </div>
</main>
<?php ww_footer('../'); ?>
</body>
</html>
