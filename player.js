// ============================================================
// Word Wheel — player page (index.php)
// ============================================================
// Three independent parts:
//   1. Tabs       — Daily / Free Play / Sandbox, kept in the
//                   URL hash (#today, #free, #sandbox)
//   2. Daily      — today's scheduled puzzles, saved progress, streak
//   3. Free play  — random puzzles, always available
// Daily and free play share only the wheel helpers in wheel.js; neither
// reads or changes the other's state. Sandbox lives in sandbox.js.
// ============================================================

$(function () {
  const { checkGuess, playableFromApi, renderWheel } = window.WordWheel;

  // ==========================================================
  // Shared helpers
  // ==========================================================

  // API row → playable puzzle (shared fallback in wheel.js for puzzles
  // saved before layouts were stored).
  function toPlayable(p) {
    return playableFromApi(p);
  }

  function toItems(rows) {
    return (rows || [])
      .map((p) => ({ id: p && p.id, puzzle: toPlayable(p), hints: playerHints(p && p.hints) }))
      .filter((item) => item.id && item.puzzle);
  }

  // Teacher-approved hints from the API, in the order they're shown
  function playerHints(list) {
    return (Array.isArray(list) ? list : []).filter((h) => h && typeof h.text === "string" && h.text.trim());
  }

  // One tab's Hint button and hint list. `shown` = hints opened so far.
  // Once the puzzle is finished, the list becomes a "what it means" note.
  function renderHints(prefix, hints, shown, finished) {
    const total = hints.length;
    const $box = $("#" + prefix + "Hints").empty();
    $("#" + prefix + "HintBtn")
      .toggleClass("d-none", finished || !total || shown >= total)
      .text(`💡 Hint ${Math.min(shown + 1, total)} of ${total}`);
    if (!total) return;

    if (finished) {
      const meaning = hints.find((h) => h.type === "definition");
      if (meaning) {
        $box.append($('<p class="ww-meaning mb-0"></p>').append(
          $("<strong></strong>").text("What it means: "),
          document.createTextNode(meaning.text),
        ));
      }
    } else if (shown) {
      $box.append($('<ol class="ww-hint-list mb-0"></ol>').append(
        hints.slice(0, shown).map((h) => $("<li></li>").text(h.text)),
      ));
    }
  }

  // Tiles are drawn in capitals, so show answers the same way
  function displayAnswer(puzzle) {
    return puzzle.chars.join("").toLocaleUpperCase();
  }

  function alertBox(type, message) {
    return $('<div class="alert py-2 mb-0"></div>').addClass("alert-" + type).text(message);
  }

  // The "Correct!" celebration: a big handwritten headline with a few
  // crayon confetti marks (theme.css), then the answer in plain text.
  // answer is optional (the sandbox leaves it out).
  const CONFETTI =
    '<svg class="ww-correct-confetti" viewBox="0 0 300 70" aria-hidden="true"><g>' +
    '<path d="M18 18 l10 6" stroke="#C8431F"></path>' +
    '<path d="M32 50 l-8 8" stroke="#0F7B6C"></path>' +
    '<path d="M12 38 q6 -4 10 2" stroke="#FFC93C"></path>' +
    '<path d="M272 16 l-9 7" stroke="#0F7B6C"></path>' +
    '<path d="M282 44 q-6 -4 -10 2" stroke="#C8431F"></path>' +
    '<path d="M262 58 l9 6" stroke="#FFC93C"></path></g></svg>';

  function correctBox(answer) {
    const $box = $('<div class="ww-correct"></div>').append(
      CONFETTI,
      $('<p class="ww-correct-title">Correct!</p>'),
    );
    if (answer) {
      $box.append(
        $('<p class="ww-correct-text"></p>').append("The word is ", $("<strong></strong>").text(answer), "."),
      );
    }
    return $box;
  }
  window.wwCorrectBox = correctBox; // sandbox.js uses it too

  // Hand-drawn circle around a pill (two shapes so neighbours differ)
  const PILL_RINGS = [
    "M29 4 C45 3 55 15 54 29 C53 45 41 55 27 54 C12 53 3 42 4 28 C5 15 15 6 31 5",
    "M28 5 C43 4 54 14 53 30 C52 44 42 54 28 53 C13 52 4 42 5 27 C6 13 17 5 32 6",
  ];
  function pillRing(i) {
    return `<svg class="ww-pill-ring" viewBox="0 0 58 58" aria-hidden="true"><g><path d="${PILL_RINGS[i % 2]}"></path></g></svg>`;
  }

  // One tab's loading / message / play sections, found by id prefix.
  function sections(prefix) {
    return {
      show(name) {
        $("#" + prefix + "Loading").toggleClass("d-none", name !== "loading");
        $("#" + prefix + "Message").toggleClass("d-none", name !== "message");
        $("#" + prefix + "Play").toggleClass("d-none", name !== "play");
      },
      message(text) {
        $("#" + prefix + "MessageText").text(text);
        this.show("message");
      },
      result(type, text) {
        $("#" + prefix + "Result").html(alertBox(type, text));
      },
      correct(answer) {
        $("#" + prefix + "Result").html(correctBox(answer));
      },
    };
  }

  // ==========================================================
  // 1. Tabs
  // ==========================================================
  const TABS = ["today", "free", "sandbox"];
  const tabStarted = {}; // tab name → true once its content has loaded

  function showTab(name) {
    const btn = document.querySelector('#playerTabs [data-tab-name="' + name + '"]');
    if (btn) bootstrap.Tab.getOrCreateInstance(btn).show();
  }

  $("#playerTabs [data-tab-name]").on("shown.bs.tab", function () {
    const name = $(this).data("tab-name");
    if (location.hash !== "#" + name) history.replaceState(null, "", "#" + name);
    startTab(name);
  });

  // Footer links (#free etc.) on this page switch tabs without a reload
  $(window).on("hashchange", function () {
    const name = location.hash.slice(1);
    if (TABS.includes(name)) showTab(name);
  });

  // Each tab loads the first time it is opened
  function startTab(name) {
    if (tabStarted[name]) return;
    tabStarted[name] = true;
    if (name === "today") Daily.start();
    if (name === "free") Free.start();
  }

  // Print shows only the open tab's wheel (see @media print in theme.css)
  $("#dailyPrintBtn, #freePrintBtn").on("click", function () { window.print(); });

  // ==========================================================
  // 2. Daily
  // ==========================================================
  const Daily = (function () {
    // Saved progress (this browser only):
    // {
    //   days:   { "2026-11-03": { "12": "solved", "15": "revealed" } },
    //   streak: { current: 3, best: 5, lastDate: "2026-11-02" }
    // }
    // Dates come from the server, so every player shares one "today".
    // A day counts toward the streak once any daily puzzle is solved
    // without Reveal.
    const STORE_KEY = "wordwheel.player.v1";
    const DAYS_KEPT = 30;
    const ui = sections("daily");

    function loadStore() {
      const empty = { days: {}, streak: { current: 0, best: 0, lastDate: null } };
      try {
        const s = JSON.parse(localStorage.getItem(STORE_KEY));
        if (s && typeof s === "object") {
          return {
            days: s.days && typeof s.days === "object" ? s.days : {},
            streak: s.streak && typeof s.streak === "object" ? s.streak : empty.streak,
          };
        }
      } catch (_) {
        // storage blocked or corrupt: play without saving
      }
      return empty;
    }

    const store = loadStore();

    function saveStore() {
      // keep only the most recent days so the record stays small
      Object.keys(store.days).sort().slice(0, -DAYS_KEPT).forEach((d) => delete store.days[d]);
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(store));
      } catch (_) {
        // storage blocked: progress lasts until the page closes
      }
    }

    let today = null;        // server date, "YYYY-MM-DD"
    let previousDate = null; // most recent earlier day with puzzles
    let puzzles = [];        // [{ id, puzzle }] in server order
    let current = 0;         // index into puzzles
    const hintsShown = {};   // puzzle id → hints opened (this visit only)

    function statusOf(id) {
      const day = store.days[today];
      return (day && day[id]) || null;
    }

    function setStatus(id, status) {
      (store.days[today] = store.days[today] || {})[id] = status;
      if (status === "solved") extendStreak();
      saveStore();
    }

    // The streak continues if the last counted day was the most recent
    // earlier day that had puzzles, so days with nothing scheduled
    // don't break it.
    function streakIsAlive() {
      const s = store.streak;
      return !!s.lastDate && (s.lastDate === today || s.lastDate === previousDate);
    }

    function extendStreak() {
      const s = store.streak;
      if (s.lastDate === today) return;
      s.current = streakIsAlive() ? (s.current || 0) + 1 : 1;
      s.best = Math.max(s.best || 0, s.current);
      s.lastDate = today;
    }

    function currentStreak() {
      return streakIsAlive() ? store.streak.current || 0 : 0;
    }

    // Next puzzle that isn't finished, searching forward from `from`
    // and wrapping around; -1 when every other one is done.
    function nextUnfinished(from) {
      for (let k = 1; k < puzzles.length; k++) {
        const i = (from + k) % puzzles.length;
        if (!statusOf(puzzles[i].id)) return i;
      }
      return -1;
    }

    function renderStreak() {
      const n = currentStreak();
      $("#streakRow").toggleClass("d-none", n === 0); // no empty gap before a first streak
      $("#streakBadge").text(`🔥 ${n}-day streak`);
    }

    function renderNav() {
      const many = puzzles.length > 1;
      $("#dailyNav").toggleClass("d-none", !many);
      if (!many) return;

      const $pills = $("#dailyPills").empty();
      puzzles.forEach(function (d, i) {
        const status = statusOf(d.id);
        const label =
          `Puzzle ${i + 1}` +
          (status === "solved" ? ", solved" : status === "revealed" ? ", revealed" : "");
        $pills.append(
          $('<button type="button" class="btn ww-pill"></button>')
            .addClass(
              status === "solved"
                ? "btn-success"
                : status === "revealed"
                  ? "btn-secondary"
                  : "btn-outline-primary",
            )
            .toggleClass("is-current", i === current)
            .toggleClass("has-ring", status === "solved" || i === current)
            .attr({ "aria-label": label, "aria-current": i === current ? "step" : null })
            .text(status === "solved" ? "✓" : String(i + 1))
            .append(status === "solved" || i === current ? pillRing(i) : null)
            .on("click", () => goTo(i)),
        );
      });

      $("#dailyPrevBtn").prop("disabled", current === 0);
      $("#dailyNextArrowBtn").prop("disabled", current === puzzles.length - 1);

      const done = puzzles.filter((d) => statusOf(d.id)).length;
      $("#dailyProgress").text(`${done} of ${puzzles.length} puzzles completed today`);
    }

    function renderDone() {
      const allDone = puzzles.every((d) => statusOf(d.id));
      $("#dailyDone").toggleClass("d-none", !allDone);
      if (!allDone) return;

      const solved = puzzles.filter((d) => statusOf(d.id) === "solved").length;
      const revealed = puzzles.length - solved;
      $("#dailySummary").text(
        puzzles.length === 1
          ? solved ? "You solved today's puzzle." : "You revealed today's puzzle."
          : `You solved ${solved} and revealed ${revealed}.`,
      );
      const n = currentStreak();
      $("#dailyStreakNote").text(
        solved
          ? `🔥 Streak: ${n} day${n === 1 ? "" : "s"} (best ${store.streak.best || n}). Come back tomorrow for a new puzzle!`
          : "Solve a daily puzzle without Reveal to grow your streak. Try again tomorrow!",
      );
    }

    function render() {
      const item = puzzles[current];
      const status = statusOf(item.id);
      item.puzzle.solved = !!status; // finished puzzles show every letter
      renderWheel(item.puzzle, $("#dailyWheel"));

      $("#dailyGuessInput, #dailyCheckBtn").prop("disabled", !!status);
      $("#dailyRevealBtn").toggleClass("d-none", !!status);
      renderHints("daily", item.hints, hintsShown[item.id] || 0, !!status);

      if (status === "solved") {
        ui.correct(displayAnswer(item.puzzle));
      } else if (status === "revealed") {
        ui.result("secondary", `Answer: ${displayAnswer(item.puzzle)}`);
      }

      // Skip while playing, Next once finished; goes to the next
      // unfinished puzzle and hides when there isn't one.
      const target = nextUnfinished(current);
      $("#dailyNextBtn")
        .text(status ? "Next puzzle →" : "Skip")
        .toggleClass("btn-primary", !!status)
        .toggleClass("btn-outline-primary", !status)
        .toggleClass("d-none", target === -1);

      renderNav();
      renderDone();
      renderStreak();
      ui.show("play");
    }

    function goTo(i) {
      current = i;
      $("#dailyGuessInput").val("");
      $("#dailyResult").empty();
      render();
    }

    function finish(status) {
      setStatus(puzzles[current].id, status);
      render();
      if (status === "solved") $("#dailyNextBtn:visible").trigger("focus");
    }

    function start() {
      ui.show("loading");
      renderStreak();
      $.ajax({ url: "api/get_daily.php", method: "GET", dataType: "json", cache: false })
        .done(function (res) {
          if (!res || !res.success) {
            return ui.message("Today's puzzles couldn't be loaded. Please check back later.");
          }
          today = res.date;
          previousDate = res.previous_date || null;
          puzzles = toItems(res.puzzles);
          renderStreak();
          if (Array.isArray(res.puzzles) && res.puzzles.length && !puzzles.length) {
            return ui.message("Today's puzzles couldn't be loaded. Please check back later.");
          }
          if (!puzzles.length) {
            return ui.message("There's no daily puzzle today. Check back tomorrow!");
          }
          // land on the first unfinished puzzle (or the first one)
          const first = puzzles.findIndex((d) => !statusOf(d.id));
          goTo(first === -1 ? 0 : first);
        })
        .fail(function () {
          ui.message("Today's puzzles couldn't be loaded. Please check back later.");
        });
    }

    $("#dailyGuessForm").on("submit", function (e) {
      e.preventDefault();
      const item = puzzles[current];
      if (!item || statusOf(item.id)) return;
      const outcome = checkGuess(item.puzzle, $("#dailyGuessInput").val());
      if (outcome === "empty") return ui.result("warning", "Type your answer first.");
      if (outcome === "correct") finish("solved");
      else ui.result("danger", "Not quite — try again.");
    });

    $("#dailyHintBtn").on("click", function () {
      const item = puzzles[current];
      if (!item || statusOf(item.id)) return;
      hintsShown[item.id] = Math.min((hintsShown[item.id] || 0) + 1, item.hints.length);
      renderHints("daily", item.hints, hintsShown[item.id], false);
      if ($(this).hasClass("d-none")) $("#dailyGuessInput").trigger("focus");
    });

    // Reveal locks the puzzle: it's saved as "revealed", so a refresh
    // can't undo it and it never counts toward the streak.
    $("#dailyRevealBtn").on("click", function () {
      if (puzzles[current] && !statusOf(puzzles[current].id)) finish("revealed");
    });

    $("#dailyNextBtn").on("click", function () {
      const target = nextUnfinished(current);
      if (target !== -1) goTo(target);
    });
    $("#dailyPrevBtn").on("click", () => current > 0 && goTo(current - 1));
    $("#dailyNextArrowBtn").on("click", () => current < puzzles.length - 1 && goTo(current + 1));

    return { start };
  })();

  // ==========================================================
  // 3. Free Play
  // ==========================================================
  // Random puzzles that are unscheduled or from past days. Always open;
  // nothing here is saved or counts toward the daily streak.
  const Free = (function () {
    const ui = sections("free");
    const state = {
      queue: [],        // [{ id, puzzle }] not yet shown
      seen: new Set(),  // ids shown this visit (sent as ?exclude=)
      item: null,       // { id, puzzle } on screen
      status: null,     // null | "solved" | "revealed"
      hintsShown: 0,    // hints opened for the puzzle on screen
      solvedCount: 0,
      notice: "",       // one-off message shown with the next puzzle
    };

    function fetchBatch(exclude) {
      return $.ajax({
        url: "api/get_freeplay.php",
        method: "GET",
        dataType: "json",
        cache: false,
        data: exclude.length ? { exclude: exclude.join(",") } : {},
      }).then((res) => (res && res.success ? toItems(res.puzzles) : $.Deferred().reject()));
    }

    function render() {
      const { item, status } = state;
      item.puzzle.solved = !!status;
      renderWheel(item.puzzle, $("#freeWheel"));

      $("#freeGuessInput, #freeCheckBtn").prop("disabled", !!status);
      $("#freeRevealBtn").toggleClass("d-none", !!status);
      renderHints("free", item.hints, state.hintsShown, !!status);

      if (status === "solved") {
        ui.correct(displayAnswer(item.puzzle));
      } else if (status === "revealed") {
        ui.result("secondary", `Answer: ${displayAnswer(item.puzzle)}`);
      }

      $("#freeNextBtn")
        .text(status ? "Next puzzle →" : "Skip")
        .toggleClass("btn-primary", !!status)
        .toggleClass("btn-outline-primary", !status);
      $("#freeCounter").text(`Solved this visit: ${state.solvedCount}`);
      ui.show("play");
    }

    function show(item) {
      state.item = item;
      state.status = null;
      state.hintsShown = 0;
      state.seen.add(item.id);
      $("#freeGuessInput").val("");
      $("#freeResult").empty();
      render();
      if (state.notice) {
        ui.result("info", state.notice);
        state.notice = "";
      }
    }

    function next() {
      if (state.queue.length) return show(state.queue.shift());

      ui.show("loading");
      fetchBatch([...state.seen])
        .then(function (items) {
          if (items.length || !state.seen.size) return items;
          // Every puzzle has been played this visit: start over,
          // keeping the one just played away from the front.
          state.notice = "You've played them all — shuffling again!";
          const lastId = state.item && state.item.id;
          state.seen.clear();
          return fetchBatch([]).then(function (again) {
            if (again.length > 1 && again[0].id === lastId) again.push(again.shift());
            return again;
          });
        })
        .done(function (items) {
          if (!items.length) {
            return ui.message("There are no free play puzzles yet. Check back soon!");
          }
          state.queue = items;
          show(state.queue.shift());
        })
        .fail(function () {
          ui.message("Free play puzzles couldn't be loaded. Please try again later.");
        });
    }

    function finish(status) {
      state.status = status;
      if (status === "solved") state.solvedCount++;
      render();
      if (status === "solved") $("#freeNextBtn").trigger("focus");
    }

    $("#freeGuessForm").on("submit", function (e) {
      e.preventDefault();
      if (!state.item || state.status) return;
      const outcome = checkGuess(state.item.puzzle, $("#freeGuessInput").val());
      if (outcome === "empty") return ui.result("warning", "Type your answer first.");
      if (outcome === "correct") finish("solved");
      else ui.result("danger", "Not quite — try again.");
    });

    $("#freeHintBtn").on("click", function () {
      if (!state.item || state.status) return;
      state.hintsShown = Math.min(state.hintsShown + 1, state.item.hints.length);
      renderHints("free", state.item.hints, state.hintsShown, false);
      if ($(this).hasClass("d-none")) $("#freeGuessInput").trigger("focus");
    });

    $("#freeRevealBtn").on("click", function () {
      if (state.item && !state.status) finish("revealed");
    });

    $("#freeNextBtn").on("click", next);

    return { start: next };
  })();

  // ==========================================================
  // Start: open the tab named in the URL, else Daily
  // ==========================================================
  const startName = location.hash.slice(1);
  if (TABS.includes(startName) && startName !== "today") {
    showTab(startName); // its shown.bs.tab handler starts it
  } else {
    startTab("today");
  }
});
