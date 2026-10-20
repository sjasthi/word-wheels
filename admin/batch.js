$(function () {
  const { toChars, extractWords, buildPuzzle, renderWheel } = window.WordWheel;

  const LENGTH_LIMITS = { min: 3, max: 12 }; // absolute range for the min/max inputs
  const MAX_PUZZLES = 100;
  const MAX_FILE_BYTES = 5 * 1024 * 1024;
  const DEFAULT_LANGUAGE = "en"; // no language picker in the UI yet
  const DIRECTIONS = ["random", "cw", "ccw"];
  const DIRECTION_LABELS = {
    random: "Random",
    cw: "Clockwise",
    ccw: "Anticlockwise",
  };

  let candidates = []; // unique words from the file: { word, chars }
  let duplicateCount = 0;
  let entries = []; // generated sheet: { puzzle, savedId, $note }

  function alertBox(type, content) {
    return $('<div class="alert py-2 mb-0"></div>')
      .addClass("alert-" + type)
      .append(content);
  }

  function showStatus(selector, type, message) {
    $(selector).html(alertBox(type, document.createTextNode(message)));
  }

  // The endpoints answer { success:false, error } with a 4xx/5xx status.
  function apiError(xhr, fallback) {
    let body = xhr.responseJSON;
    if (!body) {
      try {
        body = JSON.parse(xhr.responseText);
      } catch (_) {
        body = null;
      }
    }
    return (body && body.error) || fallback;
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

  $("#fileInput").on("change", async function () {
    const file = this.files[0];
    candidates = [];
    duplicateCount = 0;
    clearSheet();
    $("#importStatus").empty();

    if (!file) return refreshWordList();
    if (!/\.txt$/i.test(file.name)) {
      refreshWordList();
      return showStatus("#importStatus", "danger", "Choose a .txt file.");
    }
    if (file.size > MAX_FILE_BYTES) {
      refreshWordList();
      return showStatus(
        "#importStatus",
        "danger",
        "That file is too large (5 MB maximum).",
      );
    }

    let text;
    try {
      text = await readText(file);
    } catch (_) {
      refreshWordList();
      return showStatus("#importStatus", "danger", "Could not read that file.");
    }

    const seen = new Set();
    extractWords(text).forEach(function (word) {
      const key = word.toLocaleLowerCase();
      if (seen.has(key)) {
        duplicateCount++;
        return;
      }
      seen.add(key);
      candidates.push({ word, chars: toChars(word) });
    });

    if (!candidates.length) {
      showStatus("#importStatus", "warning", "No words found in that file.");
    }
    refreshWordList();
  });

  // Returns { min, max } or null (with the reason shown) when invalid.
  function readLengthRange() {
    const min = parseInt($("#minLength").val(), 10);
    const max = parseInt($("#maxLength").val(), 10);
    let error = "";
    if (
      !Number.isInteger(min) ||
      !Number.isInteger(max) ||
      min < LENGTH_LIMITS.min ||
      max > LENGTH_LIMITS.max
    ) {
      error = `Lengths must be between ${LENGTH_LIMITS.min} and ${LENGTH_LIMITS.max}.`;
    } else if (min > max) {
      error = "Min length can't be more than max length.";
    }
    $("#lengthFeedback").text(error);
    $("#minLength, #maxLength").toggleClass("is-invalid", !!error);
    return error ? null : { min, max };
  }

  // Re-filter the imported words by length and rebuild the checkbox list.
  // The first 100 words in range start out selected.
  function refreshWordList() {
    const $list = $("#wordList").empty();
    const range = readLengthRange();
    clearSheet();

    if (!candidates.length || !range) {
      $("#wordPicker").addClass("d-none");
      return updateSelection();
    }

    let tooShort = 0;
    let tooLong = 0;
    candidates.forEach(function (c, i) {
      const length = c.chars.length;
      if (length < range.min) return tooShort++;
      if (length > range.max) return tooLong++;

      const id = "word-" + i;
      $list.append(
        $('<div class="form-check mb-0"></div>')
          .append(
            $('<input class="form-check-input" type="checkbox">')
              .attr({ id, "data-index": i })
              .prop("checked", $list.children().length < MAX_PUZZLES),
          )
          .append(
            $('<label class="form-check-label"></label>')
              .attr("for", id)
              .text(c.word),
          ),
      );
    });

    const inRange = $list.children().length;
    const skipped = [
      tooShort && `${tooShort} too short`,
      tooLong && `${tooLong} too long`,
      duplicateCount && `${duplicateCount} repeats`,
    ].filter(Boolean);
    showStatus(
      "#importStatus",
      inRange ? "secondary" : "warning",
      `Found ${candidates.length} different words; ${inRange} are ` +
        `${range.min}–${range.max} letters long.` +
        (skipped.length ? ` Skipped: ${skipped.join(", ")}.` : ""),
    );

    $("#wordPicker").toggleClass("d-none", !inRange);
    updateSelection();
  }

  function selectedWords() {
    return $("#wordList input:checked")
      .map(function () {
        return candidates[$(this).data("index")];
      })
      .get();
  }

  function updateSelection() {
    const count = $("#wordList input:checked").length;
    const tooMany = count > MAX_PUZZLES;
    $("#selectionCount")
      .text(
        `${count} selected (max ${MAX_PUZZLES})` +
          (tooMany ? ` — unselect ${count - MAX_PUZZLES}` : ""),
      )
      .toggleClass("text-danger", tooMany);
    $("#generateBtn").prop("disabled", count === 0 || tooMany);
  }

  $("#minLength, #maxLength").on("input", refreshWordList);
  $("#wordList").on("change", "input", function () {
    clearSheet();
    updateSelection();
  });

  $("#selectFirstBtn").on("click", function () {
    $("#wordList input").each(function (i) {
      this.checked = i < MAX_PUZZLES;
    });
    clearSheet();
    updateSelection();
  });

  $("#clearSelectionBtn").on("click", function () {
    $("#wordList input").prop("checked", false);
    clearSheet();
    updateSelection();
  });

  // ---- Step 2: configure and generate ----

  $('input[name="mode"]').on("change", function () {
    $("#sameSettings").prop("disabled", this.value === "random");
  });

  function randomItem(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  // Settings for one word, from the form or randomized. Short words
  // hide at most ringSize - 1 letters so at least one ring letter shows.
  function settingsFor(chars) {
    const s =
      $('input[name="mode"]:checked').val() === "random"
        ? {
            direction: randomItem(DIRECTIONS),
            centralCharacter: Math.random() < 0.5,
            hiddenCount: randomItem([0, 1, 2, 3]),
          }
        : {
            direction: $('input[name="direction"]:checked').val(),
            centralCharacter:
              $('input[name="centralCharacter"]:checked').val() === "yes",
            hiddenCount: parseInt($("#hiddenSelect").val(), 10),
          };
    const ringSize = s.centralCharacter ? chars.length - 1 : chars.length;
    return { chars, ...s, hiddenCount: Math.min(s.hiddenCount, ringSize - 1) };
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
    $("#sheet").empty();
    $("#sheetStatus").empty();
    $("#printBtn, #saveAllBtn").prop("disabled", true);
  }

  $("#generateBtn").on("click", function () {
    const words = selectedWords();
    if (!words.length || words.length > MAX_PUZZLES) return;

    clearSheet();
    entries = words.map(function (c) {
      return { puzzle: buildPuzzle(settingsFor(c.chars)), savedId: null };
    });

    const $sheet = $("#sheet");
    entries.forEach(function (entry, i) {
      const $wheel = $('<div class="wheel"></div>');
      renderWheel(entry.puzzle, $wheel);
      entry.$note = $('<p class="small text-muted mb-0 no-print"></p>').text(
        puzzleDetails(entry.puzzle),
      );

      $sheet.append(
        $('<section class="puzzle"></section>').append(
          $('<h2 class="h3"></h2>').text("Puzzle " + (i + 1)),
          $('<p class="text-muted mb-0"></p>').text(
            "Read the letters around the wheel to find the hidden word.",
          ),
          $wheel,
          $('<p class="answer-line"></p>').text(
            "Answer: ______________________",
          ),
          entry.$note,
        ),
      );
    });

    const $answers = $("<ol></ol>");
    entries.forEach(function (entry) {
      $answers.append($("<li></li>").text(entry.puzzle.chars.join("")));
    });
    $sheet.append(
      $('<section class="solutions"></section>').append(
        $('<h2 class="h3 mb-3"></h2>').text("Solutions"),
        $answers,
      ),
    );

    $("#printBtn, #saveAllBtn").prop("disabled", false);
    showStatus(
      "#sheetStatus",
      "success",
      `Generated ${entries.length} puzzles below. Print them, or save them to the database.`,
    );
  });

  // ---- Step 3: print or save ----

  $("#printBtn").on("click", function () {
    window.print();
  });

  function savePuzzle(p, name) {
    return new Promise(function (resolve, reject) {
      $.ajax({
        url: "../api/save_puzzle.php",
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({
          name: name, // blank = unnamed
          word: p.chars.join(""),
          arrangement: p.chars, // graphemes in answer order
          direction: p.direction,
          hidden_count: p.hiddenCount,
          center_letter: p.centralCharacter,
          // the generated layout, so loading shows the same wheel as the printout
          start_slot: p.startSlot,
          ring_order: p.ringOrder,
          hidden_indexes: [...p.hidden],
          language: DEFAULT_LANGUAGE,
        }),
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
  $("#saveAllBtn").on("click", async function () {
    const pending = entries.filter((entry) => !entry.savedId);
    if (!pending.length) {
      return showStatus(
        "#sheetStatus",
        "secondary",
        "All puzzles are already saved.",
      );
    }

    const $controls = $(
      "#saveAllBtn, #generateBtn, #fileInput, #minLength, #maxLength, #wordPicker button, #wordList input",
    ).prop("disabled", true);
    const prefix = $("#namePrefix").val().trim();
    const failures = [];

    for (let i = 0; i < pending.length; i++) {
      const entry = pending[i];
      const number = entries.indexOf(entry) + 1;
      showStatus(
        "#sheetStatus",
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
        "#sheetStatus",
        "success",
        `Saved ${saved} puzzle${saved === 1 ? "" : "s"}.`,
      );
    }
    const $list = $('<ul class="mb-0 mt-1"></ul>');
    failures.forEach((f) => $list.append($("<li></li>").text(f)));
    $("#sheetStatus").html(
      alertBox("warning", [
        document.createTextNode(
          `Saved ${saved} of ${pending.length}. These failed — click Save all again to retry them:`,
        ),
        $list,
      ]),
    );
  });

  // Browsers can restore form state on reload, so sync the UI to it.
  $('input[name="mode"]:checked').trigger("change");
  refreshWordList();
});
