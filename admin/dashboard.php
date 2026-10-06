<?php
// ============================================================
// Word Wheel — Admin Dashboard
// ============================================================

session_start();
require_once '../api/db.php';

// Redirect to login if not authenticated
if (empty($_SESSION['admin'])) {
    header('Location: login.php');
    exit;
}

// Fetch all puzzles for display
try {
    $pdo  = get_db();
    $stmt = $pdo->prepare("
        SELECT id, word, direction, hidden_count, center_letter,
               language, status, scheduled_date, created_date
        FROM puzzles
        ORDER BY created_date DESC
    ");
    $stmt->execute();
    $puzzles = $stmt->fetchAll();
} catch (PDOException $e) {
    $puzzles = [];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Admin Dashboard — Word Wheel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css">
</head>
<body class="bg-light">
<div class="container py-4">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0">Word Wheel — Admin Dashboard</h1>
        <a href="logout.php" class="btn btn-sm btn-outline-secondary">Log out</a>
    </div>

    <?php if (empty($puzzles)): ?>
        <p class="text-muted">No puzzles yet. Generate one from the main page.</p>
    <?php else: ?>
    <div class="card shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Word</th>
                        <th>Direction</th>
                        <th>Hidden</th>
                        <th>Language</th>
                        <th>Status</th>
                        <th>Scheduled Date</th>
                        <th>Created</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ($puzzles as $p): ?>
                    <tr id="row-<?= $p['id'] ?>">
                        <td><?= $p['id'] ?></td>
                        <td><strong><?= htmlspecialchars($p['word']) ?></strong></td>
                        <td><?= htmlspecialchars($p['direction']) ?></td>
                        <td><?= (int)$p['hidden_count'] ?></td>
                        <td><?= htmlspecialchars($p['language']) ?></td>
                        <td>
                            <span class="badge <?= $p['status'] === 'published' ? 'bg-success' : 'bg-secondary' ?>">
                                <?= $p['status'] ?>
                            </span>
                        </td>
                        <td>
                            <input type="date"
                                   class="form-control form-control-sm date-input"
                                   data-id="<?= $p['id'] ?>"
                                   value="<?= htmlspecialchars($p['scheduled_date'] ?? '') ?>">
                        </td>
                        <td><?= date('M j, Y', strtotime($p['created_date'])) ?></td>
                        <td>
                            <div class="d-flex gap-1">
                                <button class="btn btn-sm <?= $p['status'] === 'published' ? 'btn-outline-secondary' : 'btn-outline-success' ?> toggle-btn"
                                        data-id="<?= $p['id'] ?>"
                                        data-status="<?= $p['status'] ?>">
                                    <?= $p['status'] === 'published' ? 'Unpublish' : 'Publish' ?>
                                </button>
                                <button class="btn btn-sm btn-outline-danger delete-btn"
                                        data-id="<?= $p['id'] ?>"
                                        data-word="<?= htmlspecialchars($p['word']) ?>">
                                    Delete
                                </button>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </div>
    <?php endif; ?>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script>
$(function () {

    // Toggle publish / unpublish
    $(document).on('click', '.toggle-btn', function () {
        const $btn    = $(this);
        const id      = $btn.data('id');
        const current = $btn.data('status');
        const next    = current === 'published' ? 'draft' : 'published';

        $.ajax({
            url: '../api/update_puzzle.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, status: next }),
            success: function (res) {
                if (res.success) {
                    $btn.data('status', next);
                    $btn.text(next === 'published' ? 'Unpublish' : 'Publish');
                    $btn.toggleClass('btn-outline-success btn-outline-secondary');
                    const $badge = $btn.closest('tr').find('.badge');
                    $badge.text(next);
                    $badge.removeClass('bg-success bg-secondary')
                          .addClass(next === 'published' ? 'bg-success' : 'bg-secondary');
                } else {
                    alert('Error: ' + res.error);
                }
            }
        });
    });

    // Save scheduled date on change
    $(document).on('change', '.date-input', function () {
        const id   = $(this).data('id');
        const date = $(this).val() || null;

        $.ajax({
            url: '../api/update_puzzle.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id, scheduled_date: date }),
            success: function (res) {
                if (!res.success) alert('Error saving date: ' + res.error);
            }
        });
    });

    // Delete puzzle
    $(document).on('click', '.delete-btn', function () {
        const id   = $(this).data('id');
        const word = $(this).data('word');

        if (!confirm('Delete puzzle "' + word + '"? This cannot be undone.')) return;

        $.ajax({
            url: '../api/delete_puzzle.php',
            method: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({ id: id }),
            success: function (res) {
                if (res.success) {
                    $('#row-' + id).fadeOut(300, function () { $(this).remove(); });
                } else {
                    alert('Error: ' + res.error);
                }
            }
        });
    });

});
</script>
</body>
</html>
