<?php
// ============================================================
// Word Wheel — Mass Generate (admin only)
// ============================================================
// Import a .txt file, filter its words by length, generate up to
// 100 wheels with one shared (or randomized) configuration, then
// print them (browser print / Save as PDF) and optionally save
// them all to the database. All logic lives in batch.js.
// ============================================================

session_start();

// Redirect to login if not authenticated
if (empty($_SESSION['admin'])) {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Mass Generate — Word Wheel</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap/5.3.3/css/bootstrap.min.css">
    <link rel="stylesheet" href="../wheel.css">
    <style>
      #wordList {
        max-height: 280px;
        overflow-y: auto;
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 0.25rem 1rem;
      }

      /* ---- Generated sheet: on screen, one card per puzzle ---- */
      .puzzle,
      .solutions {
        max-width: 700px;
        margin: 0 auto 1.5rem;
        padding: 2rem;
        background: #fff;
        border: 1px solid #dee2e6;
        border-radius: 0.5rem;
        text-align: center;
      }
      .puzzle .wheel {
        --wheel-size: min(360px, 80vw);
        margin: 1.5rem auto;
      }
      .answer-line {
        font-size: 1.25rem;
        margin-top: 1.5rem;
      }
      .solutions {
        text-align: left;
      }
      .solutions ol {
        columns: 2;
        font-size: 1.1rem;
      }

      /* ---- Printed: one wheel per page, then the solutions ---- */
      @page {
        margin: 2cm;
      }
      @media print {
        body.bg-light {
          background: #fff !important;
        }
        .no-print {
          display: none !important;
        }
        .container-fluid {
          padding: 0 !important;
          max-width: none !important;
        }
        .puzzle,
        .solutions {
          max-width: none;
          margin: 0;
          padding: 0;
          border: 0;
        }
        .puzzle {
          break-after: page;
          break-inside: avoid;
        }
        .puzzle .wheel {
          --wheel-size: 14cm;
          margin: 1.5cm auto;
        }
        .answer-line {
          font-size: 16pt;
        }
        .solutions {
          break-before: page;
        }
      }
    </style>
</head>
<body class="bg-light">
<div class="container-fluid py-4" style="max-width: 1400px">

    <div class="d-flex justify-content-between align-items-center mb-4 no-print">
        <h1 class="h3 mb-0">Word Wheel — Mass Generate</h1>
        <div class="d-flex gap-2">
            <a href="dashboard.php" class="btn btn-sm btn-outline-primary">Back to dashboard</a>
            <a href="logout.php" class="btn btn-sm btn-outline-secondary">Log out</a>
        </div>
    </div>

    <div class="row g-4 mb-4 no-print">

        <!-- Step 1: import words -->
        <div class="col-lg-7">
            <div class="card shadow-sm h-100">
                <div class="card-body">
                    <h2 class="h6 text-uppercase text-muted mb-3">1. Import words</h2>

                    <label for="fileInput" class="form-label">Text file (.txt)</label>
                    <input id="fileInput" class="form-control" type="file" accept=".txt,text/plain">
                    <div class="form-text">
                        Any text works — one word per line, a comma-separated list, or a passage
                        from a book. Punctuation, numbers, and spaces separate words, and repeated
                        words are listed once.
                    </div>

                    <div class="row g-2 mt-2">
                        <div class="col-6 col-md-3">
                            <label for="minLength" class="form-label">Min length</label>
                            <input id="minLength" class="form-control" type="number" min="3" max="12" value="7">
                        </div>
                        <div class="col-6 col-md-3">
                            <label for="maxLength" class="form-label">Max length</label>
                            <input id="maxLength" class="form-control" type="number" min="3" max="12" value="9">
                        </div>
                    </div>
                    <div id="lengthFeedback" class="text-danger small mt-1"></div>

                    <div id="importStatus" class="mt-3" role="status" aria-live="polite"></div>

                    <div id="wordPicker" class="d-none mt-3">
                        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                            <span id="selectionCount" class="fw-semibold"></span>
                            <div class="d-flex gap-2">
                                <button id="selectFirstBtn" class="btn btn-sm btn-outline-secondary" type="button">Select first 100</button>
                                <button id="clearSelectionBtn" class="btn btn-sm btn-outline-secondary" type="button">Clear</button>
                            </div>
                        </div>
                        <div id="wordList" class="border rounded p-2 bg-white"></div>
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
                        <input class="form-check-input" type="radio" name="mode" id="modeSame" value="same" checked>
                        <label class="form-check-label" for="modeSame">Same settings for every word</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="mode" id="modeRandom" value="random">
                        <label class="form-check-label" for="modeRandom">Randomize settings for each word</label>
                    </div>

                    <fieldset id="sameSettings" class="mt-3">
                        <span class="form-label d-block">Direction</span>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="direction" id="dirRandom" value="random" checked>
                            <label class="form-check-label" for="dirRandom">Random</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="direction" id="dirCw" value="cw">
                            <label class="form-check-label" for="dirCw">Clockwise</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="direction" id="dirCcw" value="ccw">
                            <label class="form-check-label" for="dirCcw">Anticlockwise</label>
                        </div>

                        <span class="form-label d-block mt-3">Central character</span>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="centralCharacter" id="centralYes" value="yes" checked>
                            <label class="form-check-label" for="centralYes">Yes</label>
                        </div>
                        <div class="form-check form-check-inline">
                            <input class="form-check-input" type="radio" name="centralCharacter" id="centralNo" value="no">
                            <label class="form-check-label" for="centralNo">No</label>
                        </div>

                        <label for="hiddenSelect" class="form-label d-block mt-3">Hidden letters (difficulty)</label>
                        <select id="hiddenSelect" class="form-select">
                            <option value="0" selected>0 – show all</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                        </select>
                        <div class="form-text">Very short words hide fewer letters so the wheel stays solvable.</div>
                    </fieldset>

                    <button id="generateBtn" class="btn btn-primary w-100 mt-4" type="button" disabled>
                        Mass generate
                    </button>

                    <hr>

                    <h2 class="h6 text-uppercase text-muted mb-3">3. Print or save</h2>
                    <button id="printBtn" class="btn btn-outline-primary w-100" type="button" disabled>
                        Print / Save as PDF
                    </button>

                    <label for="namePrefix" class="form-label mt-3">
                        Name prefix <span class="text-muted">(optional)</span>
                    </label>
                    <input id="namePrefix" class="form-control" autocomplete="off" maxlength="90" placeholder="e.g. Animals → Animals #1, #2, …">
                    <button id="saveAllBtn" class="btn btn-success w-100 mt-2" type="button" disabled>
                        Save all to database
                    </button>

                    <div id="sheetStatus" class="mt-3" role="status" aria-live="polite"></div>
                </div>
            </div>
        </div>

    </div><!-- /row -->

    <!-- Generated puzzles + solutions (this is what gets printed) -->
    <div id="sheet"></div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js"></script>
<script src="../wheel.js"></script>
<script src="batch.js"></script>
</body>
</html>
