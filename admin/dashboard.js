$(function () {
  const MIN_CHARS = 7;
  const MAX_CHARS = 9;

  // Pull shared engine from wheel.js (window.WordWheel)
  const { toChars, buildPuzzle, puzzleFromApi, puzzleToApi, apiError, renderWheel } =
    window.WordWheel;

  // ── Puzzle state (Create tab) ──────────────────────────────
  let settings = null;
  let puzzle   = null;

  // Convenience: render current puzzle into the Create tab wheel
  function render() { renderWheel(puzzle, $("#wheel")); }

  function showResult(type, message) {
    $("#result").html(
      $('<div class="alert py-2 mb-0"></div>').addClass("alert-" + type).text(message)
    );
  }

  // Generate wheel / New layout: a fresh random layout from `settings`.
  function startPuzzle() {
    showPuzzle(buildPuzzle(settings));
  }

  // Put a built or loaded puzzle on the Create tab wheel, ready to play.
  function showPuzzle(p) {
    puzzle = p;
    render();
    $("#guessInput").val("").prop("disabled", false);
    $("#result").empty();
    $("#emptyState").addClass("d-none");
    $("#puzzleArea").removeClass("d-none");
  }

  function validateWord(raw) {
    const word = raw.trim();
    if (!word) return "Enter a word.";
    if (/\s/.test(word)) return "Single words only for now (no spaces).";
    if (!/^[\p{L}\p{M}]+$/u.test(word)) return "Letters only — no numbers or punctuation.";
    const count = toChars(word).length;
    if (count < MIN_CHARS || count > MAX_CHARS)
      return `Word must be ${MIN_CHARS}–${MAX_CHARS} letters (this one has ${count}).`;
    return null;
  }

  function fillCreateForm(s) {
    $("#wordInput").val(s.chars.join("")).removeClass("is-invalid");
    $("#wordFeedback").text("");
    $('input[name="direction"]').filter(function () {
      return this.value === s.direction;
    }).prop("checked", true);
    $(s.centralCharacter ? "#centralYes" : "#centralNo").prop("checked", true);
    $("#hiddenSelect").val(String(s.hiddenCount));
  }

  // ── Create tab handlers ────────────────────────────────────
  $("#createForm").on("submit", function (e) {
    e.preventDefault();
    const raw   = $("#wordInput").val();
    const error = validateWord(raw);
    $("#wordInput").toggleClass("is-invalid", !!error);
    $("#wordFeedback").text(error || "");
    if (error) return;

    settings = {
      chars:            toChars(raw.trim()),
      direction:        $('input[name="direction"]:checked').val(),
      centralCharacter: $('input[name="centralCharacter"]:checked').val() === "yes",
      hiddenCount:      parseInt($("#hiddenSelect").val(), 10),
    };
    startPuzzle();
  });

  $("#guessForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle || puzzle.solved) return;
    const guess  = toChars($("#guessInput").val().trim()).join("").toLocaleLowerCase();
    if (!guess) return showResult("warning", "Type your answer first.");
    const answer = puzzle.chars.join("").toLocaleLowerCase();
    if (guess === answer) {
      puzzle.solved = true; render();
      $("#guessInput").prop("disabled", true);
      showResult("success", "Correct! 🎉");
    } else {
      showResult("danger", "Not quite — try again.");
    }
  });

  $("#revealBtn").on("click", function () {
    if (!puzzle) return;
    puzzle.solved = true; render();
    $("#guessInput").prop("disabled", true);
    showResult("secondary", "Answer: " + puzzle.chars.join(""));
  });

  $("#relayoutBtn").on("click", function () {
    if (settings) startPuzzle();
  });

  // ── Save / Load ────────────────────────────────────────────
  function showSavedStatus(type, message) {
    $("#savedStatus").html(
      $('<div class="alert py-2 mb-0"></div>').addClass("alert-" + type).text(message)
    );
  }

  $("#saveForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle) return showSavedStatus("warning", "Generate a wheel first.");
    const $btn = $("#saveBtn").prop("disabled", true);
    $("#savedStatus").empty();

    $.ajax({
      url: "../api/save_puzzle.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify(puzzleToApi(puzzle, $("#nameInput").val().trim())),
    })
      .done(function (res) {
        if (res && res.success) {
          $("#nameInput").val("");
          showSavedStatus("success", "Puzzle saved!");
          loadSavedPuzzles(res.id);
          if (window.refreshManage) window.refreshManage(); // show it in Manage Puzzles
        } else {
          showSavedStatus("danger", (res && res.error) || "Could not save the puzzle.");
        }
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "Could not save the puzzle."));
      })
      .always(function () { $btn.prop("disabled", false); });
  });

  function formatSavedDate(raw) {
    const date = new Date(String(raw || "").replace(" ", "T"));
    return isNaN(date) ? String(raw || "")
      : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  }

  function savedPuzzleItem(p) {
    const details = [p.word, "saved " + formatSavedDate(p.created_date)].join(" · ");
    const $title  = p.name
      ? $('<div class="fw-semibold"></div>').text(p.name)
      : $('<div class="fst-italic text-body-tertiary"></div>').text("Unnamed");
    return $('<button type="button" class="list-group-item list-group-item-action"></button>')
      .attr("data-id", p.id)
      .append($title)
      .append($('<small class="text-muted"></small>').text(details));
  }

  function loadSavedPuzzles(activeId) {
    const $btn  = $("#loadSavedBtn").prop("disabled", true);
    const $list = $("#savedList").empty();

    $.ajax({ url: "../api/get_all.php", method: "GET", dataType: "json", cache: false })
      .done(function (res) {
        if (!res || !res.success)
          return showSavedStatus("danger", (res && res.error) || "Could not load saved puzzles.");
        if (!res.puzzles || !res.puzzles.length)
          return showSavedStatus("secondary", "No saved puzzles yet.");
        res.puzzles.forEach(function (p) {
          const $item = savedPuzzleItem(p);
          if (p.id == activeId) $item.addClass("active").attr("aria-current", "true");
          $list.append($item);
        });
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "Could not load saved puzzles."));
      })
      .always(function () { $btn.prop("disabled", false); });
  }

  $("#loadSavedBtn").on("click", function () {
    $("#savedStatus").empty();
    loadSavedPuzzles();
  });

  $("#savedList").on("click", ".list-group-item", function () {
    const $item = $(this);
    $("#savedStatus").empty();

    $.ajax({ url: "../api/get_puzzle.php", method: "GET",
             data: { id: $item.data("id") }, dataType: "json" })
      .done(function (res) {
        if (!res || !res.success || !res.puzzle)
          return showSavedStatus("danger", (res && res.error) || "That puzzle could not be loaded.");
        const loaded = puzzleFromApi(res.puzzle);
        if (!loaded)
          return showSavedStatus("danger", "That puzzle's saved layout is invalid.");

        const { chars, direction, centralCharacter, hiddenCount } = loaded;
        settings = { chars, direction, centralCharacter, hiddenCount };
        fillCreateForm(settings);
        showPuzzle(loaded);

        $item.addClass("active").attr("aria-current", "true")
             .siblings().removeClass("active").removeAttr("aria-current");
        showSavedStatus("success", "Puzzle loaded.");
      })
      .fail(function (xhr) {
        showSavedStatus("danger", apiError(xhr, "That puzzle could not be loaded."));
      });
  });

  // ── Tabs — remember the open tab across reloads ──────────
  // The active tab is kept in the URL (#create, #batch, #manage), so a
  // refresh reopens it and dashboard.php#manage links straight to it.
  $("#adminTabs [data-tab-name]").on("shown.bs.tab", function () {
    history.replaceState(null, "", "#" + $(this).data("tab-name"));
  });

  const startTab = location.hash.slice(1);
  if (["create", "batch", "manage"].includes(startTab)) {
    const startBtn = document.querySelector('#adminTabs [data-tab-name="' + startTab + '"]');
    bootstrap.Tab.getOrCreateInstance(startBtn).show();
  }

  // ── Print modal — shared by manage tab and batch tab ──────
  // Takes built puzzles (puzzleFromApi / buildPuzzle, optional .name).
  // batch.js calls window.openPrintModal(puzzles) to queue batch puzzles.
  let _printQueue = [];
  const printModal = new bootstrap.Modal(document.getElementById("printModal"));

  function openPrintModal(puzzles) {
    _printQueue = puzzles;
    printModal.show();
  }

  // Expose globally so batch.js can open the modal with its puzzles
  window.openPrintModal = openPrintModal;

  $("#printConfirmBtn").on("click", function () {
    printModal.hide();
    const perPage = parseInt($("#printPerPageSelect").val(), 10) || 1;
    printPuzzles(_printQueue, { perPage: perPage });
  });
});
