$(function () {
  const {
    toChars,
    extractWords,
    uniqueWords,
    lengthRangeError,
    filterByLength,
    maxHidden,
    applyHiddenLimit,
    buildPuzzle,
    puzzleToApi,
    apiError,
    renderWheel,
  } = window.WordWheel;

  const MAX_PUZZLES = 100;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const DIRECTIONS = ["random", "cw", "ccw"];
  const DIRECTION_LABELS = {
    random: "Random",
    cw: "Clockwise",
    ccw: "Anticlockwise",
  };

  const MAX_EXAMPLES = 5; // rejected words named in the status line

  let candidates = []; // unique words from the file: { word, chars }
  let duplicateCount = 0;
  let rejected = []; // unique tokens with apostrophes, hyphens, or digits
  let shown = []; // candidates in the length range, in checkbox order
  let entries = []; // generated sheet: { puzzle, savedId, $note }

  function alertBox(type, content) {
    return $('<div class="alert py-2 mb-0"></div>')
      .addClass("alert-" + type)
      .append(content);
  }

  function showStatus(selector, type, message) {
    $(selector).html(alertBox(type, document.createTextNode(message)));
  }

  // ---- Step 1: import words ----

  // Decode UTF-8 by default, or UTF-16 when the file starts with its
  // byte-order mark (Notepad's "Unicode" encoding).
  async function readText(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const encoding =
      bytes[0] === 0xff && bytes[1] === 0xfe
        ? "utf-16le"
        : bytes[0] === 0xfe && bytes[1] === 0xff
          ? "utf-16be"
          : "utf-8";
    return new TextDecoder(encoding).decode(bytes);
  }

  $("#batchFileInput").on("change", async function () {
    const file = this.files[0];
    candidates = [];
    duplicateCount = 0;
    rejected = [];
    clearSheet();
    $("#batchImportStatus").empty();

    if (!file) return refreshWordList();
    if (!/\.txt$/i.test(file.name)) {
      refreshWordList();
      return showStatus("#batchImportStatus", "danger", "Choose a .txt file.");
    }
    if (file.size > MAX_FILE_BYTES) {
      refreshWordList();
      return showStatus(
        "#batchImportStatus",
        "danger",
        "That file is too large (5 MB maximum).",
      );
    }

    let text;
    try {
      text = await readText(file);
    } catch (_) {
      refreshWordList();
      return showStatus("#batchImportStatus", "danger", "Could not read that file.");
    }

    const extracted = extractWords(text);
    const { unique, repeats } = uniqueWords(extracted.words);
    candidates = unique.map((word) => ({ word, chars: toChars(word) }));
    duplicateCount = repeats;
    rejected = uniqueWords(extracted.rejected).unique;

    if (!candidates.length) {
      showStatus(
        "#batchImportStatus",
        "warning",
        "No letters-only words found in that file." + rejectedNote(),
      );
    }
    refreshWordList();
  });

  // " Skipped N with apostrophes, hyphens, or numbers (a, b, …)." or "".
  function rejectedNote() {
    if (!rejected.length) return "";
    const examples = rejected.slice(0, MAX_EXAMPLES).join(", ");
    return (
      ` Skipped ${rejected.length} with apostrophes, hyphens, or numbers ` +
      `(${examples}${rejected.length > MAX_EXAMPLES ? ", …" : ""}).`
    );
  }

  // Returns { min, max } or null (with the reason shown) when invalid.
  function readLengthRange() {
    const min = parseInt($("#batchMinLength").val(), 10);
    const max = parseInt($("#batchMaxLength").val(), 10);
    const error = lengthRangeError(min, max);
    $("#batchLengthFeedback").text(error);
    $("#batchMinLength, #batchMaxLength").toggleClass("is-invalid", !!error);
    return error ? null : { min, max };
  }

  // Re-filter the imported words by length and rebuild the checkbox list.
  // The first 100 words in range start out selected.
  function refreshWordList() {
    const $list = $("#batchWordList").empty();
    const range = readLengthRange();
    clearSheet();
    shown = [];

    if (!candidates.length || !range) {
      $("#batchWordPicker").addClass("d-none");
      return updateSelection();
    }

    const { inRange: words, tooShort, tooLong } = filterByLength(candidates, range);
    shown = words;
    shown.forEach(function (c, i) {
      const id = "batch-word-" + i;
      $list.append(
        $('<div class="form-check mb-0"></div>')
          .append(
            $('<input class="form-check-input" type="checkbox">')
              .attr({ id, "data-index": i })
              .prop("checked", i < MAX_PUZZLES),
          )
          .append(
            $('<label class="form-check-label"></label>')
              .attr("for", id)
              .text(c.word),
          ),
      );
    });

    const inRange = shown.length;
    const skipped = [
      tooShort && `${tooShort} too short`,
      tooLong && `${tooLong} too long`,
      duplicateCount && `${duplicateCount} repeats`,
    ].filter(Boolean);
    showStatus(
      "#batchImportStatus",
      inRange ? "secondary" : "warning",
      `Found ${candidates.length} different words; ${inRange} are ` +
        `${range.min}–${range.max} letters long.` +
        (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : "") +
        rejectedNote(),
    );

    $("#batchWordPicker").toggleClass("d-none", !inRange);
    updateSelection();
  }

  function selectedWords() {
    return $("#batchWordList input:checked")
      .map(function () {
        return shown[$(this).data("index")];
      })
      .get();
  }

  function updateSelection() {
    const count = $("#batchWordList input:checked").length;
    const tooMany = count > MAX_PUZZLES;
    $("#batchSelectionCount")
      .text(
        `${count} selected (max ${MAX_PUZZLES})` +
          (tooMany ? ` — unselect ${count - MAX_PUZZLES}` : ""),
      )
      .toggleClass("text-danger", tooMany);
    $("#batchGenerateBtn").prop("disabled", count === 0 || tooMany);
  }

  // Every listed word is at least `min` letters, so the hidden options
  // allowed for `min` work for every word ("Same settings" mode).
  // Options above that are disabled with the reason, and a too-high
  // choice is lowered.
  function updateHiddenOptions() {
    const range = readLengthRange();
    const center = $('input[name="batchCentralCharacter"]:checked').val() === "yes";
    $("#batchHiddenNote").text(
      applyHiddenLimit($("#batchHiddenSelect"), range && range.min, center),
    );
  }

  $("#batchMinLength, #batchMaxLength").on("input", function () {
    updateHiddenOptions();
    refreshWordList();
  });
  $('input[name="batchCentralCharacter"]').on("change", updateHiddenOptions);
  $("#batchWordList").on("change", "input", function () {
    clearSheet();
    updateSelection();
  });

  $("#batchSelectFirstBtn").on("click", function () {
    $("#batchWordList input").each(function (i) {
      this.checked = i < MAX_PUZZLES;
    });
    clearSheet();
    updateSelection();
  });

  $("#batchClearSelectionBtn").on("click", function () {
    $("#batchWordList input").prop("checked", false);
    clearSheet();
    updateSelection();
  });

  // ---- Step 2: configure and generate ----

  $('input[name="batchMode"]').on("change", function () {
    $("#batchSameSettings").prop("disabled", this.value === "vary");
  });

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Settings for one word, from the form or varied per word. "Vary"
  // picks the hidden count from what this word can hide. The final cap
  // is a safety net so at least one ring letter always shows.
  function settingsFor(chars) {
    let s;
    if ($('input[name="batchMode"]:checked').val() === "vary") {
      const centralCharacter = Math.random() < 0.5;
      s = {
        direction: randomItem(DIRECTIONS),
        centralCharacter,
        hiddenCount: Math.floor(
          Math.random() * (maxHidden(chars.length, centralCharacter) + 1),
        ),
      };
    } else {
      s = {
        direction: $('input[name="batchDirection"]:checked').val(),
        centralCharacter:
          $('input[name="batchCentralCharacter"]:checked').val() === "yes",
        hiddenCount: parseInt($("#batchHiddenSelect").val(), 10),
      };
    }
    return {
      chars,
      ...s,
      hiddenCount: Math.min(s.hiddenCount, maxHidden(chars.length, s.centralCharacter)),
    };
  }

  function puzzleDetails(p) {
    return [
      DIRECTION_LABELS[p.direction],
      p.centralCharacter ? "center letter" : "no center letter",
      p.hiddenCount + " hidden",
    ].join(" · ");
  }

  function clearSheet() {
    entries = [];
    $("#batchSheet").empty();
    $("#batchSheetStatus").empty();
    $("#batchPrintBtn, #batchSaveAllBtn").prop("disabled", true);
  }

  $("#batchGenerateBtn").on("click", function () {
    const words = selectedWords();
    if (!words.length || words.length > MAX_PUZZLES) return;

    clearSheet();
    entries = words.map(function (c) {
      return { puzzle: buildPuzzle(settingsFor(c.chars)), savedId: null };
    });

    const $sheet = $("#batchSheet");
    entries.forEach(function (entry, i) {
      const $wheel = $('<div class="wheel"></div>');
      renderWheel(entry.puzzle, $wheel);
      entry.$note = $('<p class="small text-muted mb-0"></p>').text(
        puzzleDetails(entry.puzzle),
      );

      $sheet.append(
        $('<section class="batch-puzzle-preview card mb-3 p-3 text-center"></section>').append(
          $('<h2 class="h5 mb-1"></h2>').text("Puzzle " + (i + 1)),
          $('<p class="text-muted small mb-0"></p>').text(
            "Read the letters around the wheel to find the hidden word.",
          ),
          $wheel,
          $('<p class="mb-1"></p>').text("Answer: ______________________"),
          entry.$note,
        ),
      );
    });

    $("#batchPrintBtn, #batchSaveAllBtn").prop("disabled", false);
    showStatus(
      "#batchSheetStatus",
      "success",
      `Generated ${entries.length} puzzles below. Print them, or save them to the database.`,
    );
  });

  // ---- Step 3: print ----

  // Queues the generated puzzles into the shared print modal (dashboard.js
  // exposes window.openPrintModal once it initialises).
  $("#batchPrintBtn").on("click", function () {
    if (!entries.length) return;
    const puzzles = entries.map(function (e) { return e.puzzle; });
    window.openPrintModal(puzzles);
  });

  // ---- Step 4: save all ----

  function savePuzzle(p, name) {
    return new Promise(function (resolve, reject) {
      $.ajax({
        url: "../api/save_puzzle.php",
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify(puzzleToApi(p, name)),
      })
        .done(function (res) {
          if (res && res.success) resolve(res.id);
          else reject((res && res.error) || "Could not save the puzzle.");
        })
        .fail(function (xhr) {
          reject(apiError(xhr, "Could not save the puzzle."));
        });
    });
  }

  // Saves one puzzle at a time. Clicking again after a partial failure
  // only retries the puzzles that haven't been saved yet.
  $("#batchSaveAllBtn").on("click", async function () {
    const pending = entries.filter((entry) => !entry.savedId);
    if (!pending.length) {
      return showStatus(
        "#batchSheetStatus",
        "secondary",
        "All puzzles are already saved.",
      );
    }

    const $controls = $(
      "#batchSaveAllBtn, #batchGenerateBtn, #batchFileInput, #batchMinLength, #batchMaxLength, #batchWordPicker button, #batchWordList input",
    ).prop("disabled", true);
    const prefix = $("#batchNamePrefix").val().trim();
    const failures = [];

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];
      const number = entries.indexOf(entry) + 1;
      showStatus(
        "#batchSheetStatus",
        "secondary",
        `Saving ${i + 1} of ${pending.length}…`,
      );
      try {
        entry.savedId = await savePuzzle(
          entry.puzzle,
          prefix ? `${prefix} #${number}` : "",
        );
        entry.$note.text(puzzleDetails(entry.puzzle) + " · saved");
      } catch (error) {
        failures.push(
          `Puzzle ${number} (${entry.puzzle.chars.join("")}): ${error}`,
        );
      }
    }

    $controls.prop("disabled", false);
    updateSelection(); // re-applies the generate button's own rule

    const saved = pending.length - failures.length;
    if (!failures.length) {
      return showStatus(
        "#batchSheetStatus",
        "success",
        `Saved ${saved} puzzle${saved === 1 ? "" : "s"}.`,
      );
    }
    const $list = $('<ul class="mb-0 mt-1"></ul>');
    failures.forEach((f) => $list.append($("<li></li>").text(f)));
    $("#batchSheetStatus").html(
      alertBox("warning", [
        document.createTextNode(
          `Saved ${saved} of ${pending.length}. These failed — click Save all again to retry them:`,
        ),
        $list,
      ]),
    );
  });

  // Browsers can restore form state on reload, so sync the UI to it.
  $('input[name="batchMode"]:checked').trigger("change");
  updateHiddenOptions();
  refreshWordList();
});
