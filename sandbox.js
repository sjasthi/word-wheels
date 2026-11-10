// ============================================================
// Word Wheel — Sandbox
// ============================================================
// The player pastes a word bank, picks settings, and plays wheels
// built from random words in the bank. Nothing is sent to the server;
// the bank and settings are remembered in this browser only.
// ============================================================

$(function () {
  const {
    toChars,
    extractWords,
    uniqueWords,
    lengthRangeError,
    filterByLength,
    maxHidden,
    applyHiddenLimit,
    checkGuess,
    buildPuzzle,
    renderWheel,
  } = window.WordWheel;

  const MAX_EXAMPLES = 5; // rejected words named in the status line
  const STORAGE_KEY = "wordWheel.sandbox";

  let ready = []; // unique bank words in the length range: { word, chars }
  let bag = []; // words not dealt yet this round
  let bagStale = true; // bank or length changed since the bag was filled
  let puzzle = null;

  function alertBox(type, message) {
    return $('<div class="alert py-2 mb-0"></div>')
      .addClass("alert-" + type)
      .text(message);
  }

  function showResult(type, message) {
    $("#result").html(alertBox(type, message));
  }

  // ---- Setup cards ----

  function setCardOpen($toggle, open) {
    $("#" + $toggle.attr("aria-controls")).toggleClass("d-none", !open);
    $toggle.attr("aria-expanded", String(open)).text(open ? "Hide" : "Show");
  }

  $(".sb-toggle").on("click", function () {
    setCardOpen($(this), $(this).attr("aria-expanded") !== "true");
  });

  // Returns { min, max } or null (with the reason shown) when invalid.
  function readLengthRange() {
    const min = parseInt($("#sbMinLength").val(), 10);
    const max = parseInt($("#sbMaxLength").val(), 10);
    const error = lengthRangeError(min, max);
    $("#sbLengthFeedback").text(error);
    $("#sbMinLength, #sbMaxLength").toggleClass("is-invalid", !!error);
    return error ? null : { min, max };
  }

  function centerOn() {
    return $('input[name="sbCentralCharacter"]:checked').val() === "yes";
  }

  // Every word in the bank is at least `min` letters, so the hidden
  // options allowed for `min` work for every word. Options above that
  // are disabled with the reason, and a too-high choice is lowered.
  function updateHiddenOptions() {
    const range = readLengthRange();
    $("#sbHiddenNote").text(
      applyHiddenLimit($("#sbHiddenSelect"), range && range.min, centerOn()),
    );
  }

  // Re-read the bank: letters-only words, no repeats, in the length range.
  function refreshBank() {
    const { words, rejected } = extractWords($("#sbBankInput").val());
    const range = readLengthRange();
    const { unique, repeats } = uniqueWords(words);
    const uniqueRejected = uniqueWords(rejected).unique;
    let tooShort = 0;
    let tooLong = 0;

    ready = [];
    if (range) {
      ({ inRange: ready, tooShort, tooLong } = filterByLength(
        unique.map((word) => ({ word, chars: toChars(word) })),
        range,
      ));
    }
    bagStale = true;

    const skipped = [
      tooShort && `${tooShort} too short`,
      tooLong && `${tooLong} too long`,
      repeats && `${repeats} repeats`,
      uniqueRejected.length &&
        `${uniqueRejected.length} with apostrophes, hyphens, or numbers (` +
          uniqueRejected.slice(0, MAX_EXAMPLES).join(", ") +
          (uniqueRejected.length > MAX_EXAMPLES ? ", …" : "") +
          ")",
    ].filter(Boolean);

    let message;
    if (!words.length && !uniqueRejected.length) {
      message = "Paste some words to get started.";
    } else if (!range) {
      message = "Fix the word length in Settings.";
    } else {
      message =
        `${ready.length} word${ready.length === 1 ? "" : "s"} ready ` +
        `(${range.min}–${range.max} letters).` +
        (skipped.length ? ` Skipped: ${skipped.join("; ")}.` : "");
    }
    $("#sbBankStatus").html(alertBox(ready.length ? "secondary" : "warning", message));
    $("#sbBankCount").text(ready.length ? `· ${ready.length} ready` : "");
    $("#sbGenerateBtn, #sbNewWordBtn").prop("disabled", !ready.length);
  }

  // ---- Remember the bank and settings in this browser ----

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          bank: $("#sbBankInput").val(),
          min: $("#sbMinLength").val(),
          max: $("#sbMaxLength").val(),
          direction: $('input[name="sbDirection"]:checked').val(),
          center: centerOn(),
          hidden: $("#sbHiddenSelect").val(),
        }),
      );
    } catch (_) {
      // Storage blocked or full: Sandbox still works, it just won't remember.
    }
  }

  function restoreState() {
    let s = null;
    try {
      s = JSON.parse(localStorage.getItem(STORAGE_KEY));
    } catch (_) {
      s = null;
    }
    if (!s || typeof s !== "object") return;
    if (typeof s.bank === "string") $("#sbBankInput").val(s.bank);
    if (s.min) $("#sbMinLength").val(s.min);
    if (s.max) $("#sbMaxLength").val(s.max);
    $('input[name="sbDirection"]')
      .filter(function () {
        return this.value === s.direction;
      })
      .prop("checked", true);
    if (typeof s.center === "boolean") {
      $(s.center ? "#sbCentralYes" : "#sbCentralNo").prop("checked", true);
    }
    if (["0", "1", "2", "3"].includes(s.hidden)) $("#sbHiddenSelect").val(s.hidden);
  }

  $("#sbBankInput").on("input", function () {
    refreshBank();
    saveState();
  });
  $("#sbMinLength, #sbMaxLength").on("input", function () {
    updateHiddenOptions();
    refreshBank();
    saveState();
  });
  $('input[name="sbCentralCharacter"]').on("change", function () {
    updateHiddenOptions();
    saveState();
  });
  $('input[name="sbDirection"], #sbHiddenSelect').on("change", saveState);

  // ---- Dealing words ----

  function shuffled(list) {
    const arr = [...list];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // Next word from a shuffled bag, so every word comes up once before
  // any repeats. A refilled bag doesn't start with the word on screen.
  function nextWord() {
    if (bagStale || !bag.length) {
      bag = shuffled(ready);
      const current = puzzle && puzzle.chars.join("").toLocaleLowerCase();
      if (bag.length > 1 && bag[0].word.toLocaleLowerCase() === current) {
        bag.push(bag.shift());
      }
      bagStale = false;
    }
    return bag.shift();
  }

  // Settings from the form for these letters. The hidden count is also
  // capped for this word, in case the length range changed after it was dealt.
  function settingsFor(chars) {
    const centralCharacter = centerOn();
    return {
      chars,
      direction: $('input[name="sbDirection"]:checked').val(),
      centralCharacter,
      hiddenCount: Math.min(
        parseInt($("#sbHiddenSelect").val(), 10),
        maxHidden(chars.length, centralCharacter),
      ),
    };
  }

  function render() {
    renderWheel(puzzle, $("#wheel"));
  }

  function showPuzzle(p) {
    puzzle = p;
    render();
    $("#guessInput").val("").prop("disabled", false);
    $("#result").empty();
    $("#sbNewWordBtn").removeClass("btn-primary").addClass("btn-outline-primary");
    $("#puzzleArea").removeClass("d-none");
  }

  function playNextWord() {
    if (!ready.length) return;
    const word = nextWord();
    showPuzzle(buildPuzzle(settingsFor(word.chars)));
    $("#sbWordCount").text(`Word ${ready.length - bag.length} of ${ready.length}`);
  }

  // Solved or revealed: show the answer and point to the next word.
  function finishPuzzle() {
    puzzle.solved = true;
    render();
    $("#guessInput").prop("disabled", true);
    $("#sbNewWordBtn").removeClass("btn-outline-primary").addClass("btn-primary");
  }

  // ---- Play ----

  $("#sbGenerateBtn").on("click", function () {
    bagStale = true; // Generate starts a fresh round
    playNextWord();
    if (!puzzle) return;
    $(".sb-toggle").each(function () {
      setCardOpen($(this), false);
    });
    $("#guessInput").trigger("focus");
  });

  $("#sbNewWordBtn").on("click", function () {
    playNextWord();
    $("#guessInput").trigger("focus");
  });

  $("#sbRelayoutBtn").on("click", function () {
    if (!puzzle) return;
    showPuzzle(buildPuzzle(settingsFor(puzzle.chars)));
  });

  $("#guessForm").on("submit", function (e) {
    e.preventDefault();
    if (!puzzle || puzzle.solved) return;

    const outcome = checkGuess(puzzle, $("#guessInput").val());
    if (outcome === "empty") return showResult("warning", "Type your answer first.");
    if (outcome === "correct") {
      finishPuzzle();
      showResult("success", "Correct! 🎉");
    } else {
      showResult("danger", "Not quite — try again.");
    }
  });

  $("#revealBtn").on("click", function () {
    if (!puzzle) return;
    finishPuzzle();
    showResult("secondary", "Answer: " + puzzle.chars.join(""));
  });

  restoreState();
  updateHiddenOptions();
  refreshBank();
});
