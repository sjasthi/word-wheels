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
        SELECT id, name, word, direction, hidden_count, center_letter,
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
    <style>
      :root {
        --wheel-size: min(300px, 82vw);
      }

      .wheel {
        position: relative;
        width: var(--wheel-size);
        aspect-ratio: 1;
        margin: 0 auto;
      }
      .wheel svg {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }
      .wheel svg circle {
        fill: #f8f9fa;
        stroke: #adb5bd;
        stroke-width: 0.6;
      }
      .wheel svg line {
        stroke: #ced4da;
        stroke-width: 0.5;
      }

      .tile {
        position: absolute;
        width: 17%;
        aspect-ratio: 1;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: #fff;
        border: 2px solid #0d6efd;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: calc(var(--wheel-size) * 0.08);
        text-transform: uppercase;
        user-select: none;
      }
      .tile.hub {
        width: 20%;
        background: #0d6efd;
        color: #fff;
      }
      .tile.blank {
        border-style: dashed;
        color: #adb5bd;
      }
      .tile.revealed {
        color: #198754;
        border-color: #198754;
        border-style: solid;
      }

      #savedList {
        max-height: 260px;
        overflow-y: auto;
      }
      #savedList .list-group-item.active .text-muted,
      #savedList .list-group-item.active .text-body-tertiary {
        color: inherit !important;
        opacity: 0.85;
      }
    </style>
</head>
<body class="bg-light">
<div class="container-fluid py-4" style="max-width: 1400px">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0">Word Wheel — Admin Dashboard</h1>
        <a href="logout.php" class="btn btn-sm btn-outline-secondary">Log out</a>
    </div>

    <!-- =====================================================
         SECTION 1: Puzzle Creator
         ===================================================== -->
    <h2 class="h5 text-uppercase text-muted mb-3">Create a Puzzle</h2>
    <div class="row g-4 mb-5">

        <!-- Config panel -->
        <div class="col-lg-3">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h3 class="h6 text-uppercase text-muted mb-3">Configuration</h3>
                    <form id="createForm" novalidate>
                        <label for="wordInput" class="form-label">Word (7–9 letters)</label>
                        <input
                            id="wordInput"
                            class="form-control"
                            autocomplete="off"
                            spellcheck="false"
                            placeholder="e.g. elephant"
                        />
                        <div id="wordFeedback" class="invalid-feedback"></div>

                        <div class="mt-3">
                            <span class="form-label d-block">Direction</span>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="direction" id="dirRandom" value="random" checked />
                                <label class="form-check-label" for="dirRandom">Random</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="direction" id="dirCw" value="cw" />
                                <label class="form-check-label" for="dirCw">Clockwise</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="direction" id="dirCcw" value="ccw" />
                                <label class="form-check-label" for="dirCcw">Anticlockwise</label>
                            </div>
                        </div>

                        <div class="mt-3">
                            <span class="form-label d-block">Central character</span>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="centralCharacter" id="centralYes" value="yes" checked />
                                <label class="form-check-label" for="centralYes">Yes</label>
                            </div>
                            <div class="form-check form-check-inline">
                                <input class="form-check-input" type="radio" name="centralCharacter" id="centralNo" value="no" />
                                <label class="form-check-label" for="centralNo">No</label>
                            </div>
                        </div>

                        <div class="mt-3">
                            <label for="hiddenSelect" class="form-label">Hidden letters (difficulty)</label>
                            <select id="hiddenSelect" class="form-select">
                                <option value="0" selected>0 – show all</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>
                        </div>

                        <button class="btn btn-primary w-100 mt-4" type="submit">
                            Generate wheel
                        </button>
                    </form>
                </div>
            </div>
        </div>

        <!-- Wheel preview -->
        <div class="col-lg-5">
            <div class="card shadow-sm">
                <div class="card-body text-center">
                    <p id="emptyState" class="text-muted my-5">
                        Enter a word to generate a wheel.
                    </p>

                    <div id="puzzleArea" class="d-none">
                        <div id="wheel" class="wheel">
                            <svg viewBox="0 0 100 100" aria-hidden="true"></svg>
                        </div>

                        <form id="guessForm" class="mt-4 mx-auto" style="max-width: 300px" novalidate>
                            <div class="input-group">
                                <input
                                    id="guessInput"
                                    class="form-control"
                                    autocomplete="off"
                                    spellcheck="false"
                                    placeholder="Type the word"
                                    aria-label="Your answer"
                                />
                                <button class="btn btn-success" type="submit">Check</button>
                            </div>
                        </form>

                        <div class="mt-3 d-flex gap-2 justify-content-center">
                            <button id="revealBtn" class="btn btn-sm btn-outline-secondary" type="button">Reveal</button>
                            <button id="relayoutBtn" class="btn btn-sm btn-outline-primary" type="button">New layout</button>
                        </div>

                        <div id="result" class="mt-3" role="status" aria-live="polite"></div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Save / load panel -->
        <div class="col-lg-4">
            <div class="card shadow-sm">
                <div class="card-body">
                    <h3 class="h6 text-uppercase text-muted mb-3">Save &amp; Load</h3>
                    <form id="saveForm" novalidate>
                        <label for="nameInput" class="form-label">
                            Puzzle name <span class="text-muted">(optional)</span>
                        </label>
                        <div class="input-group">
                            <input
                                id="nameInput"
                                class="form-control"
                                autocomplete="off"
                                maxlength="100"
                                placeholder="e.g. Animals #1"
                            />
                            <button id="saveBtn" class="btn btn-success" type="submit">Save</button>
                        </div>
                    </form>
                    <button id="loadSavedBtn" class="btn btn-outline-primary w-100 mt-3" type="button">
                        Load saved puzzles
                    </button>
                    <div id="savedStatus" class="mt-3" role="status" aria-live="polite"></div>
                    <div id="savedList" class="list-group mt-3"></div>
                </div>
            </div>
        </div>

    </div><!-- /row -->

    <!-- =====================================================
         SECTION 2: Puzzle Management Table
         ===================================================== -->
    <h2 class="h5 text-uppercase text-muted mb-3">Manage Puzzles</h2>

    <?php if (empty($puzzles)): ?>
        <p class="text-muted">No puzzles yet. Generate one above.</p>
    <?php else: ?>
    <div class="card shadow-sm">
        <div class="table-responsive">
            <table class="table table-hover mb-0">
                <thead class="table-light">
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
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
                        <td><?= $p['name'] ? htmlspecialchars($p['name']) : '<span class="fst-italic text-muted">Unnamed</span>' ?></td>
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
<script src="dashboard.js"></script>
</body>
</html>
