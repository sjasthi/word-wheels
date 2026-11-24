<?php
// ============================================================
// Word Wheel — Admin Dashboard
// ============================================================
// The Manage tab's table is filled by admin/manage.js from
// api/get_all.php, so it can refresh after saves without a reload.
// ============================================================

session_start();

if (empty($_SESSION['admin'])) {
    header('Location: login.php');
    exit;
}

require_once __DIR__ . '/../partials/layout.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <?php ww_head('Teacher Dashboard', '../'); ?>
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
      .puzzle-row:hover { background-color: #FFF4E2; }
      .puzzle-row td:first-child { width: 40px; }
      #manageTable th { white-space: nowrap; }
      #manageTable th.sortable { cursor: pointer; user-select: none; }
      #manageTable th.sortable:hover { background-color: #EADCC8; }
      #manageTable th .sort-arrow { display: inline-block; width: 0.9em; color: var(--ww-coral); }
      #manageTable td { vertical-align: middle; }
      #manageFilters .form-label { font-size: 0.85rem; margin-bottom: 0.15rem; color: var(--ww-muted); }

      .detail-row td { background: var(--ww-cream); border-top: none; padding: 1.25rem; }
      .detail-row .preview-wheel { --wheel-size: min(220px, 70vw); }

      /* Bulk toolbar */
      #bulkToolbar {
        position: sticky; top: 0; z-index: 10;
        background: var(--ww-coral); color: #fff;
        border-radius: var(--ww-radius-sm);
        padding: 0.5rem 1rem;
        display: none;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 0.75rem;
      }
      #bulkToolbar.visible { display: flex; flex-wrap: wrap; }
      #bulkToolbar .form-control { width: auto; }

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
      .batch-puzzle-preview { transition: opacity 0.15s; }
      .batch-puzzle-preview.is-excluded { opacity: 0.4; }
      #batchSheetBar {
        position: sticky; top: 0; z-index: 10;
        max-width: 480px; margin: 0 auto 0.75rem;
      }

      /* ── Calendar tab ── */
      .cal-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px 20px; }
      .cal-nav { width: 44px; height: 44px; padding: 0; border-radius: 50%; font-size: 1.4rem; line-height: 1; }
      .cal-month { min-width: 13ch; text-align: center; }
      @media (max-width: 420px) { .cal-month { min-width: 0; font-size: 1.15rem; } .cal-nav { width: 40px; height: 40px; } }
      .cal-summary { padding: 6px 14px; border-radius: 12px; background: var(--bs-warning-bg-subtle); color: var(--bs-warning-text-emphasis); font-weight: 600; }
      .cal-summary.is-covered { background: var(--bs-success-bg-subtle); color: var(--bs-success-text-emphasis); }
      .cal-legend { display: flex; gap: 14px; font-size: 0.85rem; color: var(--ww-muted); }
      .cal-legend > span { display: inline-flex; align-items: center; gap: 6px; }
      .cal-key { width: 14px; height: 14px; border-radius: 4px; display: inline-block; }
      .cal-key-today { border: 2px solid var(--ww-coral); }
      .cal-key-gap { border: 2px dashed var(--ww-coral); background: #FFF4EE; }
      .cal-key-past { background: #F7F1E8; }
      .cal-weekdays, .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 8px; }
      .cal-weekdays { margin: 16px 0 8px; text-align: center; font-size: 0.8rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ww-muted); }
      .cal-grid > p { grid-column: 1 / -1; }
      .cal-day {
        min-height: 112px; padding: 8px 10px; border-radius: 12px; text-align: left;
        display: flex; flex-direction: column; gap: 3px; overflow: hidden;
        background: #fff; border: 1px solid var(--ww-line); color: var(--ww-ink); font: inherit;
      }
      .cal-day:hover { border-color: var(--ww-coral); }
      .cal-day:focus-visible { outline: 3px solid rgba(200, 67, 31, 0.4); outline-offset: 2px; }
      .cal-day-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
      .cal-day-num { font-weight: 800; font-size: 1.05rem; }
      .cal-day-today { font-size: 0.75rem; font-weight: 700; color: #fff; background: var(--ww-coral); border-radius: 999px; padding: 0 8px; }
      .cal-count { align-self: flex-start; font-size: 0.78rem; font-weight: 700; border-radius: 999px; padding: 0 8px; color: var(--bs-success-text-emphasis); background: var(--bs-success-bg-subtle); }
      .cal-words { font-size: 0.85rem; line-height: 1.25; overflow-wrap: anywhere; }
      .cal-day.is-today { border: 3px solid var(--ww-coral); padding: 6px 8px; }
      .cal-day.is-past { background: #F7F1E8; border-color: #F7F1E8; color: #7A6654; }
      .cal-day.is-past .cal-count { background: transparent; color: #7A6654; padding: 0; }
      .cal-day.is-gap { background: #FFF4EE; border: 2px dashed var(--ww-coral); padding: 7px 9px; }
      .cal-gap-text { font-size: 0.85rem; font-weight: 700; color: var(--bs-primary-text-emphasis); }
      .cal-add { font-size: 0.85rem; font-weight: 700; color: var(--ww-coral); }
      .cal-day.is-outside { opacity: 0.55; }
      @media (max-width: 767.98px) {
        .cal-day { min-height: 64px; padding: 6px; }
        .cal-day.is-today, .cal-day.is-gap { padding: 4px; }
        .cal-words, .cal-gap-text, .cal-add, .cal-day-today, .cal-day-month, .cal-count-label, .cal-count-none { display: none; }
        .cal-count { font-size: 0.7rem; padding: 0 5px; }
        .cal-legend { display: none; }
      }

      /* ── Calendar day pop-up ── */
      .cal-list { border: 1px solid var(--ww-line); border-radius: 12px; overflow: hidden; }
      .cal-row { border-bottom: 1px solid var(--ww-sand); background: #fff; }
      .cal-row:last-child { border-bottom: 0; }
      .cal-row.is-ticked { background: #FFF4EE; }
      .cal-row.is-open { background: #FFFBF4; }
      .cal-row.is-pending-add { background: #F2FAF8; }
      .cal-row.is-pending-remove .cal-row-word { text-decoration: line-through; color: var(--ww-muted); }
      .cal-row-head { display: flex; align-items: center; min-height: 48px; }
      .cal-row-check { display: flex; align-items: center; justify-content: center; width: 48px; min-height: 48px; flex: 0 0 auto; margin: 0; cursor: pointer; }
      .cal-row-check input { width: 20px; height: 20px; margin: 0; }
      .cal-row-toggle {
        flex: 1 1 auto; min-width: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px;
        min-height: 48px; padding: 6px 12px; border: 0; background: transparent; text-align: left; font: inherit; color: inherit;
      }
      .cal-row-check + .cal-row-toggle { padding-left: 0; }
      .cal-row-word { font-weight: 800; min-width: 8ch; }
      .cal-row-meta { font-size: 0.85rem; color: var(--ww-muted); flex: 1 1 auto; }
      .cal-chip { font-size: 0.75rem; font-weight: 700; border-radius: 999px; padding: 1px 10px; background: var(--ww-sand); color: var(--ww-muted); white-space: nowrap; }
      .cal-chip-hints { background: var(--bs-success-bg-subtle); color: var(--bs-success-text-emphasis); }
      .cal-chip-move { background: var(--bs-warning-bg-subtle); color: var(--bs-warning-text-emphasis); }
      .cal-chip-add { background: var(--bs-success-bg-subtle); color: var(--bs-success-text-emphasis); }
      .cal-chip-remove { background: var(--bs-danger-bg-subtle); color: var(--bs-danger-text-emphasis); }
      .cal-caret { width: 1.2em; text-align: center; color: var(--ww-muted); }
      .cal-row-action { margin-right: 10px; flex: 0 0 auto; }
      /* align-items: flex-start keeps the wheel square when the hint form makes the row taller */
      .cal-row-detail { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 16px 24px; padding: 4px 16px 16px 48px; }
      .cal-row-detail .wheel { --wheel-size: 150px; flex: 0 0 auto; margin: 0; }
      .cal-row-detail-info { flex: 1 1 260px; min-width: 0; }
      @media (max-width: 575.98px) { .cal-row-detail { padding-left: 16px; } }
    </style>
</head>
<body class="ww-wide">
<?php ww_header('../', 'dashboard'); ?>
<main class="ww-main container-fluid py-4" style="max-width: 1400px">

    <h1 class="h3 mb-4">Teacher Dashboard</h1>

    <!-- ── Tabs ── -->
    <ul class="nav nav-tabs mb-4" id="adminTabs" role="tablist">
        <li class="nav-item" role="presentation">
            <button class="nav-link active" id="tab-calendar" data-tab-name="calendar"
                    data-bs-toggle="tab" data-bs-target="#pane-calendar"
                    type="button" role="tab">Calendar</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-create" data-tab-name="create"
                    data-bs-toggle="tab" data-bs-target="#pane-create"
                    type="button" role="tab">Create Puzzle</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-batch" data-tab-name="batch"
                    data-bs-toggle="tab" data-bs-target="#pane-batch"
                    type="button" role="tab">Batch Generate</button>
        </li>
        <li class="nav-item" role="presentation">
            <button class="nav-link" id="tab-manage" data-tab-name="manage"
                    data-bs-toggle="tab" data-bs-target="#pane-manage"
                    type="button" role="tab">Manage Puzzles</button>
        </li>
    </ul>

    <div class="tab-content">

        <!-- ════════════════════════════════════════════════
             TAB — Calendar (the teacher's home: calendar.js)
             ════════════════════════════════════════════════ -->
        <div class="tab-pane fade show active" id="pane-calendar" role="tabpanel">
            <section class="card shadow-sm">
                <div class="card-body">
                    <div class="cal-toolbar">
                        <div class="d-flex align-items-center gap-2">
                            <button id="calPrevBtn" class="btn btn-outline-secondary cal-nav" type="button" aria-label="Previous month">‹</button>
                            <h2 id="calMonthLabel" class="h4 mb-0 cal-month" aria-live="polite"></h2>
                            <button id="calNextBtn" class="btn btn-outline-secondary cal-nav" type="button" aria-label="Next month">›</button>
                            <button id="calTodayBtn" class="btn btn-outline-primary btn-sm ms-1" type="button">Today</button>
                        </div>
                        <p id="calSummary" class="cal-summary mb-0" aria-live="polite"></p>
                        <div class="cal-legend" aria-hidden="true">
                            <span><span class="cal-key cal-key-today"></span>Today</span>
                            <span><span class="cal-key cal-key-gap"></span>No puzzle yet</span>
                            <span><span class="cal-key cal-key-past"></span>Past (view only)</span>
                        </div>
                    </div>
                    <div id="calStatus" class="mt-3" role="status" aria-live="polite"></div>
                    <div class="cal-weekdays" aria-hidden="true">
                        <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                    </div>
                    <div id="calGrid" class="cal-grid">
                        <p class="text-muted my-4">Loading the calendar…</p>
                    </div>
                    <p class="small text-muted mt-3 mb-0">
                        Click a day to see or change its puzzles.
                        <a href="#" id="calManageAllLink">Manage all puzzles →</a>
                    </p>
                </div>
            </section>
        </div>

        <!-- ════════════════════════════════════════════════
             TAB — Create Puzzle
             ════════════════════════════════════════════════ -->
        <div class="tab-pane fade" id="pane-create" role="tabpanel">
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
                            <div class="form-text">Only the puzzles ticked “Include” are printed and saved.</div>

                            <label for="batchNamePrefix" class="form-label mt-3">
                                Name prefix <span class="text-muted">(optional)</span>
                            </label>
                            <input id="batchNamePrefix" class="form-control" autocomplete="off" maxlength="90"
                                   placeholder="e.g. Animals → Animals #1, #2, …">
                            <button id="batchSaveAllBtn" class="btn btn-success w-100 mt-2" type="button" disabled>
                                Save to database
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

            <!-- Filters -->
            <div id="manageFilters" class="card shadow-sm mb-3">
                <div class="card-body py-3">
                    <div class="row g-2 align-items-end">
                        <div class="col-12 col-md-4 col-xl-2">
                            <label for="filterSearch" class="form-label">Search</label>
                            <input id="filterSearch" type="search" class="form-control form-control-sm"
                                   placeholder="Name or word" autocomplete="off" spellcheck="false">
                        </div>
                        <div class="col-6 col-md-3 col-xl-2">
                            <label for="filterSchedule" class="form-label">Schedule status</label>
                            <select id="filterSchedule" class="form-select form-select-sm">
                                <option value="">All</option>
                                <option value="unscheduled">Unscheduled (free play)</option>
                                <option value="scheduled">Any scheduled date</option>
                                <option value="today">Today</option>
                                <option value="upcoming">Upcoming</option>
                                <option value="past">Past</option>
                            </select>
                        </div>
                        <div class="col-6 col-md-3 col-xl-2">
                            <label for="filterDate" class="form-label">Scheduled date</label>
                            <input id="filterDate" type="date" class="form-control form-control-sm"
                                   aria-describedby="filterDateHelp">
                            <span id="filterDateHelp" class="visually-hidden">Shows only puzzles scheduled on this day. Clear it to show all dates.</span>
                        </div>
                        <div class="col-6 col-md-2 col-xl-1">
                            <label for="filterHints" class="form-label">Hints</label>
                            <select id="filterHints" class="form-select form-select-sm">
                                <option value="">Any</option>
                                <option value="yes">Has hints</option>
                                <option value="no">No hints</option>
                            </select>
                        </div>
                        <div class="col-6 col-md-3 col-xl-2">
                            <span class="form-label d-block">Length</span>
                            <div class="input-group input-group-sm">
                                <input id="filterLengthMin" type="number" class="form-control" min="1" max="30"
                                       placeholder="min" aria-label="Minimum length">
                                <span class="input-group-text">–</span>
                                <input id="filterLengthMax" type="number" class="form-control" min="1" max="30"
                                       placeholder="max" aria-label="Maximum length">
                            </div>
                        </div>
                        <div class="col-6 col-md-9 col-xl-3 d-flex flex-wrap gap-2 align-items-center justify-content-end">
                            <button id="moreFiltersBtn" class="btn btn-sm btn-outline-secondary" type="button"
                                    aria-expanded="false" aria-controls="moreFilters">More filters</button>
                            <button id="resetFiltersBtn" class="btn btn-sm btn-link" type="button">Reset</button>
                        </div>
                    </div>
                    <div id="moreFilters" class="row g-2 mt-1 d-none">
                        <div class="col-4 col-md-2">
                            <label for="filterHidden" class="form-label">Hidden letters</label>
                            <select id="filterHidden" class="form-select form-select-sm">
                                <option value="">Any</option>
                                <option value="0">0</option>
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                            </select>
                        </div>
                        <div class="col-4 col-md-2">
                            <label for="filterCenter" class="form-label">Center letter</label>
                            <select id="filterCenter" class="form-select form-select-sm">
                                <option value="">Any</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
                        </div>
                        <div class="col-4 col-md-2">
                            <label for="filterDirection" class="form-label">Direction</label>
                            <select id="filterDirection" class="form-select form-select-sm">
                                <option value="">Any</option>
                                <option value="random">Random</option>
                                <option value="cw">Clockwise</option>
                                <option value="ccw">Anticlockwise</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Bulk action toolbar (shown when ≥1 checkbox checked) -->
            <div id="bulkToolbar">
                <span id="bulkCount" class="fw-semibold"></span>
                <div class="input-group input-group-sm w-auto">
                    <input id="bulkDateInput" type="date" class="form-control" aria-label="Date to schedule">
                    <button id="bulkScheduleBtn" class="btn btn-light" type="button">Schedule</button>
                </div>
                <button id="bulkUnscheduleBtn" class="btn btn-sm btn-light" type="button">Unschedule</button>
                <button id="bulkPrintBtn"      class="btn btn-sm btn-light" type="button">Print</button>
                <button id="bulkDeleteBtn"     class="btn btn-sm btn-danger" type="button">Delete</button>
                <button id="bulkClearBtn"      class="btn btn-sm btn-link text-white text-decoration-none ms-auto" type="button">
                    Clear selection
                </button>
            </div>

            <div class="d-flex justify-content-between align-items-center mb-2">
                <span id="manageCount" class="small text-muted" aria-live="polite"></span>
                <button id="manageRefreshBtn" class="btn btn-sm btn-link" type="button">Refresh</button>
            </div>
            <div id="manageStatus" class="mb-2" role="status" aria-live="polite"></div>

            <div class="card shadow-sm">
                <div class="table-responsive">
                    <table class="table table-hover mb-0" id="manageTable">
                        <thead class="table-light">
                            <tr>
                                <th>
                                    <input type="checkbox" class="form-check-input" id="selectAll"
                                           title="Select all shown" aria-label="Select all shown puzzles">
                                </th>
                                <th class="sortable" data-sort="id">ID</th>
                                <th class="sortable" data-sort="name">Name</th>
                                <th class="sortable" data-sort="word">Word</th>
                                <th class="sortable" data-sort="length">Length</th>
                                <th class="sortable" data-sort="hints">Hints</th>
                                <th class="sortable" data-sort="direction">Direction</th>
                                <th class="sortable" data-sort="hidden">Hidden</th>
                                <th class="sortable" data-sort="center">Center</th>
                                <th class="sortable" data-sort="scheduled">Scheduled</th>
                                <th class="sortable" data-sort="created">Created</th>
                            </tr>
                        </thead>
                        <tbody id="manageBody">
                            <tr><td colspan="11" class="text-center text-muted py-4">Loading puzzles…</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

        </div><!-- /pane-manage -->

    </div><!-- /tab-content -->


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

<!-- ── Calendar day pop-up (calendar.js fills it) ── -->
<div class="modal fade" id="calDayModal" tabindex="-1" aria-labelledby="calDayTitle" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable modal-fullscreen-sm-down">
        <div class="modal-content">
            <div class="modal-header">
                <div>
                    <h2 class="modal-title h4 mb-1" id="calDayTitle"></h2>
                    <span id="calDayBadge" class="badge"></span>
                </div>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body" id="calDayBody"></div>
            <div class="modal-footer justify-content-between">
                <a href="#" id="calDayManageLink" class="fw-semibold">Manage puzzles for this day →</a>
                <div class="d-flex align-items-center gap-2">
                    <span id="calDayChanges" class="small text-muted"></span>
                    <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal" id="calDayCancelBtn">Cancel</button>
                    <button type="button" class="btn btn-primary" id="calDaySaveBtn">Save changes</button>
                </div>
            </div>
        </div>
    </div>
</div>
</main>

<?php ww_footer('../'); ?>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="../wheel.js"></script>
<script src="print.js"></script>
<script src="dashboard.js"></script>
<script src="hint-editor.js"></script>
<script src="manage.js"></script>
<script src="calendar.js"></script>
<script src="batch.js"></script>
</body>
</html>
