<?php
// ============================================================
// Word Wheel — player page (the site's home page)
// ============================================================
// Three tabs, each standing on its own:
//   Today's Puzzle — the day's scheduled puzzles, progress and streak
//                    (player.js, daily section)
//   Free Play      — random past/unscheduled puzzles, always open
//                    (player.js, free play section)
//   Sandbox        — make your own wheels from a word list (sandbox.js)
// The open tab is kept in the URL (#today, #free, #sandbox).
// ============================================================

require_once __DIR__ . '/partials/layout.php';
ww_is_admin(); // reads the session (if any) before output starts
?>
<!doctype html>
<html lang="en">
<head>
  <?php ww_head(null, ''); ?>
</head>
<body class="ww-player">
<?php ww_header('', 'player'); ?>

<main class="ww-main container py-4" style="max-width: 640px">
  <p class="ww-tagline text-center mb-3 d-print-none">
    Read the letters around the wheel to find the hidden word.
  </p>
  <p class="ww-tagline text-center mb-3 d-none d-print-block">
    Read the letters sequentially around the wheel to find the hidden word.
  </p>

  <ul class="nav nav-fill ww-tabs mb-4 d-print-none" id="playerTabs" role="tablist">
    <li class="nav-item" role="presentation">
      <button class="nav-link active" id="tab-today" data-tab-name="today"
              data-bs-toggle="tab" data-bs-target="#pane-today" type="button"
              role="tab" aria-controls="pane-today" aria-selected="true">
        <span class="d-none d-sm-inline">Today's Puzzle</span><span class="d-sm-none">Today</span>
      </button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="tab-free" data-tab-name="free"
              data-bs-toggle="tab" data-bs-target="#pane-free" type="button"
              role="tab" aria-controls="pane-free" aria-selected="false">Free Play</button>
    </li>
    <li class="nav-item" role="presentation">
      <button class="nav-link" id="tab-sandbox" data-tab-name="sandbox"
              data-bs-toggle="tab" data-bs-target="#pane-sandbox" type="button"
              role="tab" aria-controls="pane-sandbox" aria-selected="false">Sandbox</button>
    </li>
  </ul>

  <div class="tab-content">

    <!-- ══════════════ Today's Puzzle ══════════════ -->
    <section class="tab-pane fade show active" id="pane-today" role="tabpanel" aria-labelledby="tab-today" tabindex="0">
      <p id="streakRow" class="text-center mb-3 d-none d-print-none">
        <span id="streakBadge" class="ww-streak"></span>
      </p>

      <div class="card shadow-sm">
        <div class="card-body text-center py-4">
          <div id="dailyLoading" class="text-muted my-5">
            <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            Loading today's puzzles…
          </div>

          <div id="dailyMessage" class="d-none my-5">
            <p id="dailyMessageText" class="text-muted mb-0"></p>
          </div>

          <div id="dailyPlay" class="d-none">
            <nav id="dailyNav" class="d-none d-print-none mb-3" aria-label="Today's puzzles">
              <div class="d-flex justify-content-center align-items-center gap-2 flex-wrap">
                <button id="dailyPrevBtn" class="btn btn-outline-secondary ww-arrow" type="button" aria-label="Previous puzzle">‹</button>
                <div id="dailyPills" class="d-flex flex-wrap justify-content-center gap-2"></div>
                <button id="dailyNextArrowBtn" class="btn btn-outline-secondary ww-arrow" type="button" aria-label="Next puzzle">›</button>
              </div>
              <p id="dailyProgress" class="small text-muted mt-2 mb-0"></p>
            </nav>

            <div id="dailyWheel" class="wheel">
              <svg viewBox="0 0 100 100" aria-hidden="true"></svg>
            </div>

            <p class="d-none d-print-block fs-5 mt-4">Answer: ______________________</p>

            <form id="dailyGuessForm" class="mt-4 mx-auto d-print-none" style="max-width: 360px" novalidate>
              <div class="input-group">
                <input id="dailyGuessInput" class="form-control" autocomplete="off" autocorrect="off"
                       autocapitalize="off" spellcheck="false" placeholder="Type the word"
                       aria-label="Your answer">
                <button id="dailyCheckBtn" class="btn btn-primary" type="submit">Check</button>
              </div>
            </form>

            <div class="mt-3 d-flex flex-wrap gap-2 justify-content-center d-print-none">
              <button id="dailyHintBtn" class="btn btn-outline-primary d-none" type="button">💡 Hint</button>
              <button id="dailyRevealBtn" class="btn btn-outline-secondary" type="button">Reveal</button>
              <button id="dailyPrintBtn" class="btn btn-outline-secondary" type="button">Print</button>
              <button id="dailyNextBtn" class="btn btn-outline-primary" type="button">Skip</button>
            </div>

            <div id="dailyResult" class="mt-3 d-print-none" role="status" aria-live="polite"></div>

            <div id="dailyHints" class="ww-hints mt-3 d-print-none" aria-live="polite"></div>

            <!-- Shown once every daily puzzle is solved or revealed -->
            <div id="dailyDone" class="d-none d-print-none mt-4 pt-3 border-top">
              <p class="h5 mb-2">All done for today!</p>
              <p id="dailySummary" class="mb-1"></p>
              <p id="dailyStreakNote" class="small text-muted mb-0"></p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════ Free Play ══════════════ -->
    <section class="tab-pane fade" id="pane-free" role="tabpanel" aria-labelledby="tab-free" tabindex="0">
      <p class="text-center mb-3 d-print-none" style="min-height: 2rem">
        <span id="freeCounter" class="badge rounded-pill text-bg-primary fs-6 px-3 py-2">Solved this visit: 0</span>
      </p>

      <div class="card shadow-sm">
        <div class="card-body text-center py-4">
          <div id="freeLoading" class="d-none text-muted my-5">
            <div class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
            Loading puzzles…
          </div>

          <div id="freeMessage" class="d-none my-5">
            <p id="freeMessageText" class="text-muted mb-0"></p>
          </div>

          <div id="freePlay" class="d-none">
            <div id="freeWheel" class="wheel">
              <svg viewBox="0 0 100 100" aria-hidden="true"></svg>
            </div>

            <p class="d-none d-print-block fs-5 mt-4">Answer: ______________________</p>

            <form id="freeGuessForm" class="mt-4 mx-auto d-print-none" style="max-width: 360px" novalidate>
              <div class="input-group">
                <input id="freeGuessInput" class="form-control" autocomplete="off" autocorrect="off"
                       autocapitalize="off" spellcheck="false" placeholder="Type the word"
                       aria-label="Your answer">
                <button id="freeCheckBtn" class="btn btn-primary" type="submit">Check</button>
              </div>
            </form>

            <div class="mt-3 d-flex flex-wrap gap-2 justify-content-center d-print-none">
              <button id="freeHintBtn" class="btn btn-outline-primary d-none" type="button">💡 Hint</button>
              <button id="freeRevealBtn" class="btn btn-outline-secondary" type="button">Reveal</button>
              <button id="freePrintBtn" class="btn btn-outline-secondary" type="button">Print</button>
              <button id="freeNextBtn" class="btn btn-outline-primary" type="button">Skip</button>
            </div>

            <div id="freeResult" class="mt-3 d-print-none" role="status" aria-live="polite"></div>

            <div id="freeHints" class="ww-hints mt-3 d-print-none" aria-live="polite"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════ Sandbox ══════════════ -->
    <section class="tab-pane fade" id="pane-sandbox" role="tabpanel" aria-labelledby="tab-sandbox" tabindex="0">
      <p class="text-muted text-center mb-3 d-print-none">
        Paste some words, pick your settings, and guess which word is on the wheel.
      </p>

      <!-- Word bank -->
      <section class="card shadow-sm mb-3 d-print-none">
        <div class="card-header d-flex align-items-center justify-content-between">
          <h2 class="h6 mb-0">
            Word bank <span id="sbBankCount" class="text-muted fw-normal"></span>
          </h2>
          <button class="btn btn-sm btn-link text-decoration-none sb-toggle" type="button"
                  aria-expanded="true" aria-controls="sbBankBody">Hide</button>
        </div>
        <div id="sbBankBody" class="card-body">
          <label for="sbBankInput" class="form-label">Paste words</label>
          <textarea id="sbBankInput" class="form-control" rows="5" spellcheck="false"
                    placeholder="elephant, giraffe, dolphin&#10;or one word per line"
                    aria-describedby="sbBankHelp sbBankStatus"></textarea>
          <div id="sbBankHelp" class="form-text">
            One per line, separated by commas, or a whole paragraph. Use letters
            only: words with apostrophes, hyphens, or numbers are skipped.
          </div>
          <div id="sbBankStatus" class="mt-2" role="status" aria-live="polite"></div>
        </div>
      </section>

      <!-- Settings -->
      <section class="card shadow-sm mb-3 d-print-none">
        <div class="card-header d-flex align-items-center justify-content-between">
          <h2 class="h6 mb-0">Settings</h2>
          <button class="btn btn-sm btn-link text-decoration-none sb-toggle" type="button"
                  aria-expanded="true" aria-controls="sbSettingsBody">Hide</button>
        </div>
        <div id="sbSettingsBody" class="card-body">
          <fieldset class="mb-3">
            <legend class="form-label fs-6 fw-semibold mb-1">Word length</legend>
            <div class="row g-2 align-items-center">
              <div class="col-auto">
                <label for="sbMinLength" class="visually-hidden">Minimum length</label>
                <input id="sbMinLength" class="form-control" type="number" min="3" max="12" value="7" style="width: 5.5rem">
              </div>
              <div class="col-auto">to</div>
              <div class="col-auto">
                <label for="sbMaxLength" class="visually-hidden">Maximum length</label>
                <input id="sbMaxLength" class="form-control" type="number" min="3" max="12" value="9" style="width: 5.5rem">
              </div>
              <div class="col-auto text-muted small">letters (3–12)</div>
            </div>
            <div id="sbLengthFeedback" class="small text-danger mt-1" role="alert"></div>
          </fieldset>

          <fieldset class="mb-3">
            <legend class="form-label fs-6 fw-semibold mb-1">Direction</legend>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="sbDirection" id="sbDirRandom" value="random" checked>
              <label class="form-check-label" for="sbDirRandom">Random</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="sbDirection" id="sbDirCw" value="cw">
              <label class="form-check-label" for="sbDirCw">Clockwise</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="sbDirection" id="sbDirCcw" value="ccw">
              <label class="form-check-label" for="sbDirCcw">Anticlockwise</label>
            </div>
          </fieldset>

          <fieldset class="mb-3">
            <legend class="form-label fs-6 fw-semibold mb-1">Center letter</legend>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="sbCentralCharacter" id="sbCentralYes" value="yes" checked>
              <label class="form-check-label" for="sbCentralYes">Yes</label>
            </div>
            <div class="form-check form-check-inline">
              <input class="form-check-input" type="radio" name="sbCentralCharacter" id="sbCentralNo" value="no">
              <label class="form-check-label" for="sbCentralNo">No</label>
            </div>
          </fieldset>

          <div class="mb-3">
            <label for="sbHiddenSelect" class="form-label fw-semibold">Hidden letters</label>
            <select id="sbHiddenSelect" class="form-select" aria-describedby="sbHiddenNote">
              <option value="0" data-label="0 (show every letter)" selected>0 (show every letter)</option>
              <option value="1" data-label="1">1</option>
              <option value="2" data-label="2">2</option>
              <option value="3" data-label="3">3</option>
            </select>
            <div id="sbHiddenNote" class="form-text" aria-live="polite"></div>
          </div>

          <button id="sbGenerateBtn" class="btn btn-primary w-100" type="button" disabled>
            Generate wheel
          </button>
        </div>
      </section>

      <!-- Sandbox play area -->
      <div id="sbPuzzleArea" class="card shadow-sm d-none">
        <div class="card-body text-center py-4">
          <div id="sbWheel" class="wheel">
            <svg viewBox="0 0 100 100" aria-hidden="true"></svg>
          </div>

          <p class="d-none d-print-block fs-5 mt-4">Answer: ______________________</p>

          <form id="sbGuessForm" class="mt-4 mx-auto d-print-none" style="max-width: 360px" novalidate>
            <div class="input-group">
              <input id="sbGuessInput" class="form-control" autocomplete="off" autocorrect="off"
                     autocapitalize="off" spellcheck="false" placeholder="Type the word"
                     aria-label="Your answer">
              <button class="btn btn-primary" type="submit">Check</button>
            </div>
          </form>

          <div class="mt-3 d-flex flex-wrap gap-2 justify-content-center align-items-center d-print-none">
            <button id="sbRevealBtn" class="btn btn-outline-secondary" type="button">Reveal</button>
            <button id="sbPrintBtn" class="btn btn-outline-secondary" type="button">Print</button>
            <button id="sbRelayoutBtn" class="btn btn-outline-secondary" type="button">New layout</button>
            <button id="sbNewWordBtn" class="btn btn-outline-primary" type="button">New word</button>
          </div>
          <p id="sbWordCount" class="small text-muted mt-2 mb-0 d-print-none"></p>

          <div id="sbResult" class="mt-3 d-print-none" role="status" aria-live="polite"></div>
        </div>
      </div>
    </section>

  </div>
</main>

<?php ww_footer('', 'player'); ?>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/js/bootstrap.bundle.min.js"></script>
<script src="wheel.js"></script>
<script src="player.js"></script>
<script src="sandbox.js"></script>
</body>
</html>
