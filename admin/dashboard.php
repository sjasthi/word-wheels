<?php
// ============================================================
// Word Wheel — Admin Dashboard
// ============================================================

session_start();
require_once '../api/db.php';

if (empty($_SESSION['admin'])) {
    header('Location: login.php');
    exit;
}

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
    <link rel="stylesheet" href="../wheel.css">
    <style>
      /* Override wheel size for the dashboard (smaller than the default 340px) */
      :root { --wheel-size: min(260px, 80vw); }

      /* Saved list */
      #savedList { max-height: 260px; overflow-y: auto; }
      #savedList .list-group-item.active .text-muted,
      #savedList .list-group-item.active .text-body-tertiary {
        color: inherit !important; opacity: 0.85;
      }

      /* Manage table */
      .puzzle-row { cursor: pointer; }
      .puzzle-row:hover { background-color: #f8f9fa; }
      .puzzle-row td:first-child { width: 40px; }

      .detail-row td { background: #f8f9fa; border-top: none; padding: 1.25rem; }
      .detail-row .preview-wheel { --wheel-size: min(220px, 70vw); }

      /* Bulk toolbar */
      #bulkToolbar {
        position: sticky; top: 0; z-index: 10;
        background: #0d6efd; color: #fff;
        border-radius: 0.375rem;
        padding: 0.5rem 1rem;
        display: none;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      #bulkToolbar.visible { display: flex; }

      /* Batch tab — word list */
      #batchWordList {
        max-height: 280px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.25rem 1rem;
      }

      /* Batch tab — generated sheet (screen preview) */
      .batch-puzzle-preview {
        max-width: 480px;
        margin: 0 auto;
      }
      .batch-puzzle-preview .wheel {
        --wheel-size: min(240px, 70vw);
      }
    </style>
</head>
<body class="bg-light">
<div class="container-fluid py-4" style="max-width: 1400px">

    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1 class="h3 mb-0">Word Wheel — Admin Dashboard</h1>
        <a href="logout.php" class="btn btn-sm btn-outline-secondary">Log out</a>
    </div>

    <!-- ── Tabs ── -->
    <ul class="nav nav-tabs mb-4" id="adminTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tab-create"
                    data-bs-toggle="tab" data-bs-target="#pane-create"
                    type="button" role="tab">Create Puzzle</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-batch"
                    data-bs-toggle="tab" data-bs-target="#pane-batch"
                    type="button" role="tab">Batch Generate</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-manage"
                    data-bs-toggle="tab" data-bs-target="#pane-manage"
                    type="button" role="tab">Manage Puzzles</button>
        </li>
    </ul>

    <div class="tab-content">

        <!-- ════════════════════════════════════════════════
             TAB 1 — Create Puzzle
             ════════════════════════════════════════════════ -->
        <div class="tab-pane fade show active" id="pane-create" role="tabpanel">
            <div class="row g-4">

                <!-- Config -->
                <div class="col-lg-3">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <h2 class="h6 text-uppercase text-muted mb-3">Configuration</h2>
                            <form id="createForm" novalidate>
                                <label for="wordInput" class="form-label fw-semibold">Word (7–9 letters)</label>
                                <input id="wordInput" class="form-control" autocomplete="off"
                                       spellcheck="false" placeholder="e.g. elephant" />
                                <div id="wordFeedback" class="invalid-feedback"></div>

                                <div class="mt-3">
                                    <span class="form-label fw-semibold d-block">Direction</span>
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
                                    <span class="form-label fw-semibold d-block">Central character</span>
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
                                    <label for="hiddenSelect" class="form-label fw-semibold">Hidden letters</label>
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
                                <form id="guessForm" class="mt-4 mx-auto" style="max-width:300px" novalidate>
                                    <div class="input-group">
                                        <input id="guessInput" class="form-control" autocomplete="off"
                                               spellcheck="false" placeholder="Type the word" aria-label="Your answer" />
                                        <button class="btn btn-success" type="submit">Check</button>
                                    </div>
                                </form>
                                <div class="mt-3 d-flex gap-2 justify-content-center">
                                    <button id="revealBtn"   class="btn btn-sm btn-outline-secondary">Reveal</button>
                                    <button id="relayoutBtn" class="btn btn-sm btn-outline-primary">New layout</button>
                                </div>
                                <div id="result" class="mt-3" role="status" aria-live="polite"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Save / load -->
                <div class="col-lg-4">
                    <div class="card shadow-sm">
                        <div class="card-body">
                            <h2 class="h6 text-uppercase text-muted mb-3">Save &amp; Load</h2>
                            <form id="saveForm" novalidate>
                                <label for="nameInput" class="form-label">
                                    Puzzle name <span class="text-muted">(optional)</span>
                                </label>
                                <div class="input-group">
                                    <input id="nameInput" class="form-control" autocomplete="off"
                                           maxlength="100" placeholder="e.g. Animals #1" />
                                    <button id="saveBtn" class="btn btn-success" type="submit">Save</button>
                                </div>
                            </form>
                            <button id="loadSavedBtn" class="btn btn-outline-primary w-100 mt-3">
                                Load saved puzzles
                            </button>
                            <div id="savedStatus" class="mt-3" role="status" aria-live="polite"></div>
                            <div id="savedList" class="list-group mt-3"></div>
                        </div>
                    </div>
                </div>

            </div>
        </div><!-- /pane-create -->


        <!-- ════════════════════════════════════════════════
             TAB 2 — Batch Generate
             ════════════════════════════════════════════════ -->
        <div class="tab-pane fade" id="pane-batch" role="tabpanel">
            <div class="row g-4 mb-4">

                <!-- Step 1: import words -->
                <div class="col-lg-7">
                    <div class="card shadow-sm h-100">
                        <div class="card-body">
                            <h2 class="h6 text-uppercase text-muted mb-3">1. Import words</h2>

                            <label for="batchFileInput" class="form-label">Text file (.txt)</label>
                            <input id="batchFileInput" class="form-control" type="file" accept=".txt,text/plain">
                            <div class="form-text">
                                Any text works — one word per line, a comma-separated list, or a passage
                                from a book. Punctuation, numbers, and spaces separate words, and repeated
                                words are listed once.
                            </div>

                            <div class="row g-2 mt-2">
                                <div class="col-6 col-md-3">
                                    <label for="batchMinLength" class="form-label fw-semibold">Min length</label>
                                    <input id="batchMinLength" class="form-control" type="number" min="3" max="12" value="7">
                                </div>
                                <div class="col-6 col-md-3">
                                    <label for="batchMaxLength" class="form-label fw-semibold">Max length</label>
                                    <input id="batchMaxLength" class="form-control" type="number" min="3" max="12" value="9">
                                </div>
                            </div>
                            <div id="batchLengthFeedback" class="text-danger small mt-1"></div>

                            <div id="batchImportStatus" class="mt-3" role="status" aria-live="polite"></div>

                            <div id="batchWordPicker" class="d-none mt-3">
                                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                    <span id="batchSelectionCount" class="fw-semibold"></span>
                                    <div class="d-flex gap-2">
                                        <button id="batchSelectFirstBtn" class="btn btn-sm btn-outline-secondary" type="button">Select first 100</button>
                                        <button id="batchClearSelectionBtn" class="btn btn-sm btn-outline-secondary" type="button">Clear</button>
                                    </div>
                                </div>
                                <div id="batchWordList" class="border rounded p-2 bg-white"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Step 2: configure and generate -->
                <div class="col-lg-5">
                    <div class="card shadow-sm h-100">
                        <div class="card-body">
                            <h2 class="h6 text-uppercase text-muted mb-3">2. Configure</h2>

                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="batchMode" id="batchModeSame" value="same" checked>
                                <label class="form-check-label" for="batchModeSame">Same settings for every word</label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="batchMode" id="batchModeVary" value="vary">
                                <label class="form-check-label" for="batchModeVary">Vary settings for each word</label>
                            </div>

                            <fieldset id="batchSameSettings" class="mt-3">
                                <span class="form-label fw-semibold d-block">Direction</span>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="batchDirection" id="batchDirRandom" value="random" checked>
                                    <label class="form-check-label" for="batchDirRandom">Random</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="batchDirection" id="batchDirCw" value="cw">
                                    <label class="form-check-label" for="batchDirCw">Clockwise</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="batchDirection" id="batchDirCcw" value="ccw">
                                    <label class="form-check-label" for="batchDirCcw">Anticlockwise</label>
                                </div>

                                <span class="form-label fw-semibold d-block mt-3">Central character</span>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="batchCentralCharacter" id="batchCentralYes" value="yes" checked>
                                    <label class="form-check-label" for="batchCentralYes">Yes</label>
                                </div>
                                <div class="form-check form-check-inline">
                                    <input class="form-check-input" type="radio" name="batchCentralCharacter" id="batchCentralNo" value="no">
                                    <label class="form-check-label" for="batchCentralNo">No</label>
                                </div>

                                <label for="batchHiddenSelect" class="form-label fw-semibold d-block mt-3">Hidden letters (difficulty)</label>
                                <select id="batchHiddenSelect" class="form-select" aria-describedby="batchHiddenNote">
                                    <option value="0" data-label="0 – show all" selected>0 – show all</option>
                                    <option value="1" data-label="1">1</option>
                                    <option value="2" data-label="2">2</option>
                                    <option value="3" data-label="3">3</option>
                                </select>
                                <div id="batchHiddenNote" class="form-text" aria-live="polite"></div>
                            </fieldset>

                            <button id="batchGenerateBtn" class="btn btn-primary w-100 mt-4" type="button" disabled>
                                Mass generate
                            </button>

                            <hr>

                            <h2 class="h6 text-uppercase text-muted mb-3">3. Print or save</h2>
                            <button id="batchPrintBtn" class="btn btn-outline-primary w-100" type="button" disabled>
                                Print / Save as PDF
                            </button>

                            <label for="batchNamePrefix" class="form-label mt-3">
                                Name prefix <span class="text-muted">(optional)</span>
                            </label>
                            <input id="batchNamePrefix" class="form-control" autocomplete="off" maxlength="90"
                                   placeholder="e.g. Animals → Animals #1, #2, …">
                            <button id="batchSaveAllBtn" class="btn btn-success w-100 mt-2" type="button" disabled>
                                Save all to database
                            </button>

                            <div id="batchSheetStatus" class="mt-3" role="status" aria-live="polite"></div>
                        </div>
                    </div>
                </div>

            </div><!-- /row -->

            <!-- Generated sheet preview -->
            <div id="batchSheet"></div>

        </div><!-- /pane-batch -->


        <!-- ════════════════════════════════════════════════
             TAB 3 — Manage Puzzles
             ════════════════════════════════════════════════ -->
        <div class="tab-pane fade" id="pane-manage" role="tabpanel">

            <!-- Bulk action toolbar (shown when ≥1 checkbox checked) -->
            <div id="bulkToolbar">
                <span id="bulkCount" class="fw-semibold"></span>
                <button id="bulkPrintBtn"  class="btn btn-sm btn-light">Print selected</button>
                <button id="bulkDeleteBtn" class="btn btn-sm btn-danger">Delete selected</button>
                <button id="bulkClearBtn"  class="btn btn-sm btn-link text-white text-decoration-none ms-auto">
                    Clear selection
                </button>
            </div>

            <?php if (empty($puzzles)): ?>
                <p class="text-muted">No puzzles yet. Create one in the Create Puzzle tab.</p>
            <?php else: ?>
            <div class="card shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover mb-0" id="manageTable">
                        <thead class="table-light">
                            <tr>
                                <th>
                                    <input type="checkbox" class="form-check-input" id="selectAll"
                                           title="Select all">
                                </th>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Word</th>
                                <th>Direction</th>
                                <th>Hidden</th>
                                <th>Status</th>
                                <th>Scheduled</th>
                                <th>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ($puzzles as $p): ?>
                            <!-- Summary row -->
                            <tr class="puzzle-row" id="row-<?= $p['id'] ?>"
                                data-id="<?= $p['id'] ?>">
                                <td onclick="event.stopPropagation()">
                                    <input type="checkbox" class="form-check-input row-checkbox"
                                           value="<?= $p['id'] ?>">
                                </td>
                                <td><?= $p['id'] ?></td>
                                <td>
                                    <?= $p['name']
                                        ? htmlspecialchars($p['name'])
                                        : '<span class="fst-italic text-muted">Unnamed</span>' ?>
                                </td>
                                <td><strong><?= htmlspecialchars($p['word']) ?></strong></td>
                                <td><?= htmlspecialchars($p['direction']) ?></td>
                                <td><?= (int)$p['hidden_count'] ?></td>
                                <td>
                                    <span class="badge <?= $p['status'] === 'published' ? 'bg-success' : 'bg-secondary' ?>">
                                        <?= $p['status'] ?>
                                    </span>
                                </td>
                                <td><?= htmlspecialchars($p['scheduled_date'] ?? '—') ?></td>
                                <td><?= date('M j, Y', strtotime($p['created_date'])) ?></td>
                            </tr>
                            <!-- Detail row (hidden until row clicked) -->
                            <tr class="detail-row d-none" id="detail-<?= $p['id'] ?>">
                                <td colspan="9">
                                    <div class="row g-3 align-items-start">
                                        <!-- Wheel preview -->
                                        <div class="col-md-4 text-center">
                                            <div class="wheel preview-wheel" id="preview-wheel-<?= $p['id'] ?>">
                                                <svg viewBox="0 0 100 100" aria-hidden="true"></svg>
                                            </div>
                                            <div class="text-muted small mt-2" id="preview-loading-<?= $p['id'] ?>">
                                                Loading preview…
                                            </div>
                                        </div>
                                        <!-- Actions -->
                                        <div class="col-md-8">
                                            <h6 class="fw-semibold mb-3">
                                                <?= $p['name'] ? htmlspecialchars($p['name']) : htmlspecialchars($p['word']) ?>
                                            </h6>
                                            <div class="mb-3">
                                                <label class="form-label small text-muted mb-1">Scheduled date</label>
                                                <input type="date"
                                                       class="form-control form-control-sm date-input"
                                                       style="max-width:200px"
                                                       data-id="<?= $p['id'] ?>"
                                                       value="<?= htmlspecialchars($p['scheduled_date'] ?? '') ?>">
                                            </div>
                                            <div class="d-flex gap-2 flex-wrap">
                                                <button class="btn btn-sm <?= $p['status'] === 'published' ? 'btn-outline-secondary' : 'btn-outline-success' ?> toggle-btn"
                                                        data-id="<?= $p['id'] ?>"
                                                        data-status="<?= $p['status'] ?>">
                                                    <?= $p['status'] === 'published' ? 'Unpublish' : 'Publish' ?>
                                                </button>
                                                <button class="btn btn-sm btn-outline-primary print-one-btn"
                                                        data-id="<?= $p['id'] ?>">
                                                    Print
                                                </button>
                                                <button class="btn btn-sm btn-outline-danger delete-btn"
                                                        data-id="<?= $p['id'] ?>"
                                                        data-word="<?= htmlspecialchars($p['word']) ?>">
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
            <?php endif; ?>

        </div><!-- /pane-manage -->

    </div><!-- /tab-content -->

</div><!-- /container -->


<!-- ── Print Settings Modal ── -->
<div class="modal fade" id="printModal" tabindex="-1" aria-labelledby="printModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-sm">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="printModalLabel">Print Settings</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
            </div>
            <div class="modal-body">
                <label for="printPerPageSelect" class="form-label fw-semibold">Puzzles per page</label>
                <select id="printPerPageSelect" class="form-select">
                    <option value="1" selected>1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                    <option value="4">4</option>
                    <option value="5">5</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="8">8</option>
                </select>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" class="btn btn-primary" id="printConfirmBtn">Print</button>
            </div>
        </div>
    </div>
</div>


<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="../wheel.js"></script>
<script src="print.js"></script>
<script src="dashboard.js"></script>
<script src="batch.js"></script>
</body>
</html>
