// ============================================================
// Word Wheel — Calendar tab (the teacher's home)
// ============================================================
// A month view of which days have daily puzzles:
//   * each day shows how many puzzles it has and their words
//   * upcoming days with no puzzle are highlighted, and a summary says
//     how many of the next 7 days are covered
//   * past days open view-only
// Clicking a day opens a pop-up to remove puzzles from it and tick more
// to add. Nothing changes until "Save changes", which sends everything
// through api/bulk_update.php. Clicking a puzzle's line (not its
// checkbox) shows its wheel and the shared hint editor (hint-editor.js);
// approving hints saves at once, separately from the schedule.
// "Manage puzzles for this day →" opens the Manage tab filtered to it.
// ============================================================

$(function () {
  const { toChars, playableFromApi, renderWheel, apiError } = window.WordWheel;

  const DIRECTION_LABELS = { random: "Random", cw: "Clockwise", ccw: "Anticlockwise" };
  const CANDIDATE_LIMIT = 200; // longest "Add puzzles" list drawn at once
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

  // ── State ──────────────────────────────────────────────────
  let puzzles = [];        // rows from get_all.php, plus .length and .hints
  let today = null;        // server date "YYYY-MM-DD"
  let hintsEnabled = false;
  let request = null;      // in-flight get_all request
  let view = null;         // month shown: { y, m } (m is 0–11)
  let day = null;          // open pop-up: { date, added, removed, openKey, search, showAll }
  let saving = false;

  const modalEl = document.getElementById("calDayModal");
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  // ── Dates ("YYYY-MM-DD" strings, worked out in UTC so no DST surprises)
  function ymd(y, m, d) {
    return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
  }
  function parts(s) {
    const [y, m, d] = s.split("-").map(Number);
    return { y, m: m - 1, d };
  }
  function utc(s) {
    const { y, m, d } = parts(s);
    return new Date(Date.UTC(y, m, d));
  }
  function addDays(s, n) {
    const t = utc(s);
    t.setUTCDate(t.getUTCDate() + n);
    return ymd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
  }
  function fmt(s, options) {
    return utc(s).toLocaleDateString(undefined, { timeZone: "UTC", ...options });
  }
  const longDate = (s) => fmt(s, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  const shortDate = (s) => fmt(s, { month: "short", day: "numeric" });

  function stateOf(date) {
    if (date === today) return "today";
    return date < today ? "past" : "upcoming";
  }

  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  function byId(id) {
    return puzzles.find((p) => p.id === id);
  }

  function onDate(date) {
    return puzzles.filter((p) => p.scheduled_date === date).sort((a, b) => a.id - b.id);
  }

  function alertBox(type, message) {
    return $('<div class="alert alert-dismissible py-2 mb-0"></div>')
      .addClass("alert-" + type)
      .text(message)
      .append('<button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="Close"></button>');
  }

  // ── Loading ────────────────────────────────────────────────
  function refresh() {
    if (request) request.abort();
    request = $.ajax({ url: "../api/get_all.php", method: "GET", dataType: "json", cache: false })
      .done(function (res) {
        if (!res || !res.success) {
          return $("#calStatus").html(alertBox("danger", (res && res.error) || "Could not load the calendar."));
        }
        today = res.today;
        hintsEnabled = !!res.hints_enabled;
        puzzles = (res.puzzles || []).map((p) => ({
          ...p,
          length: toChars(p.word).length,
          hints: Array.isArray(p.hints) ? p.hints : [],
        }));
        if (!view) {
          const t = parts(today);
          view = { y: t.y, m: t.m };
        }
        renderCalendar();
        if (day) renderDay();
      })
      .fail(function (xhr, textStatus) {
        if (textStatus === "abort") return;
        if (xhr.status === 403) {
          $("#calStatus").html(
            $('<div class="alert alert-warning py-2 mb-0"></div>').append(
              "Your admin session has expired. ",
              $('<a href="login.php">Log in again</a>'),
            ),
          );
          return;
        }
        $("#calStatus").html(alertBox("danger", apiError(xhr, "Could not load the calendar.")));
      })
      .always(function () { request = null; });
    return request;
  }

  // ── Month view ─────────────────────────────────────────────
  function renderSummary(byDate) {
    const next = Array.from({ length: 7 }, (_, i) => addDays(today, i));
    const empty = next.filter((d) => !(byDate.get(d) || []).length).length;
    $("#calSummary")
      .toggleClass("is-covered", empty === 0)
      .text(
        empty === 0
          ? "Next 7 days: every day has a puzzle"
          : `Next 7 days: ${7 - empty} covered · ${plural(empty, "day")} with no puzzle`,
      );
  }

  function dayCell(date, list, outside) {
    const state = stateOf(date);
    const n = list.length;
    const { d, m } = parts(date);
    const gap = !n && state !== "past";
    const label =
      `${longDate(date)}: ${n ? plural(n, "puzzle") : "no puzzle"}` + (state === "past" ? " (view only)" : "");

    const $cell = $('<button type="button" class="cal-day"></button>')
      .attr({ "data-date": date, "aria-label": label })
      .toggleClass("is-today", state === "today")
      .toggleClass("is-past", state === "past")
      .toggleClass("is-gap", gap)
      .toggleClass("is-outside", outside);

    $cell.append(
      $('<span class="cal-day-top"></span>').append(
        $('<span class="cal-day-num"></span>').append(
          d === 1 || outside ? $('<span class="cal-day-month"></span>').text(fmt(date, { month: "short" }) + " ") : null,
          String(d),
        ),
        state === "today" ? $('<span class="cal-day-today">Today</span>') : null,
      ),
    );

    if (n) {
      const words = list.slice(0, 2).map((p) => p.word).join(", ") + (n > 2 ? ` +${n - 2} more` : "");
      $cell.append(
        // on phones only the number shows
        $('<span class="cal-count"></span>').append(
          String(n),
          $('<span class="cal-count-label"></span>').text(n === 1 ? " puzzle" : " puzzles"),
        ),
        $('<span class="cal-words"></span>').text(words),
      );
    } else if (state === "past") {
      $cell.append($('<span class="cal-count cal-count-none"></span>').text("No puzzle"));
    } else {
      $cell.append(
        $('<span class="cal-gap-text">No puzzle yet</span>'),
        $('<span class="cal-add" aria-hidden="true">+ Add</span>'),
      );
    }
    return $cell;
  }

  function renderCalendar() {
    if (!today || !view) return;
    const byDate = new Map();
    puzzles.forEach(function (p) {
      if (!p.scheduled_date) return;
      if (!byDate.has(p.scheduled_date)) byDate.set(p.scheduled_date, []);
      byDate.get(p.scheduled_date).push(p);
    });
    byDate.forEach((list) => list.sort((a, b) => a.id - b.id));

    $("#calMonthLabel").text(
      new Date(Date.UTC(view.y, view.m, 1)).toLocaleDateString(undefined, { timeZone: "UTC", month: "long", year: "numeric" }),
    );
    renderSummary(byDate);

    // Whole weeks (Sunday to Saturday) covering the month
    const first = ymd(view.y, view.m, 1);
    const lastDay = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const last = ymd(view.y, view.m, lastDay);
    const start = addDays(first, -utc(first).getUTCDay());
    const end = addDays(last, 6 - utc(last).getUTCDay());

    const $grid = $("#calGrid").empty();
    for (let date = start; date <= end; date = addDays(date, 1)) {
      $grid.append(dayCell(date, byDate.get(date) || [], parts(date).m !== view.m));
    }
  }

  $("#calPrevBtn").on("click", function () {
    if (!view) return;
    view = view.m === 0 ? { y: view.y - 1, m: 11 } : { y: view.y, m: view.m - 1 };
    renderCalendar();
  });
  $("#calNextBtn").on("click", function () {
    if (!view) return;
    view = view.m === 11 ? { y: view.y + 1, m: 0 } : { y: view.y, m: view.m + 1 };
    renderCalendar();
  });
  $("#calTodayBtn").on("click", function () {
    if (!today) return;
    const t = parts(today);
    view = { y: t.y, m: t.m };
    renderCalendar();
  });

  $("#calGrid").on("click", ".cal-day", function () {
    openDay($(this).data("date"));
  });

  $("#calManageAllLink").on("click", function (e) {
    e.preventDefault();
    bootstrap.Tab.getOrCreateInstance(document.getElementById("tab-manage")).show();
  });

  $("#tab-calendar").on("shown.bs.tab", refresh); // fresh whenever it's opened

  // ── Day pop-up ─────────────────────────────────────────────
  const hintEditor = window.HintEditor.create({
    root: "#calDayModal",
    idPrefix: "cal",
    getPuzzle: byId,
    isEnabled: () => hintsEnabled,
    onChange: () => renderDay(),
    onSaved: function (p, message) {
      dayStatus("success", message);
      refresh();
      if (window.refreshManage) window.refreshManage();
    },
    onMessage: dayStatus,
  });

  function dayStatus(type, message) {
    $("#calDayStatus").html(alertBox(type, message));
  }

  function viewOnly() {
    return day && stateOf(day.date) === "past";
  }

  function changeCount() {
    return day ? day.added.size + day.removed.size : 0;
  }

  function openDay(date) {
    day = { date, added: new Set(), removed: new Set(), openKey: null, search: "", showAll: false };
    hintEditor.reset();
    renderDay();
    $("#calDayStatus").empty();
    modal.show();
  }

  // Where a puzzle is now, for the "Add puzzles" list
  function whereChip(p) {
    if (!p.scheduled_date) return { text: "free play", cls: "" };
    const state = stateOf(p.scheduled_date);
    if (state === "past") return { text: "past · " + shortDate(p.scheduled_date), cls: "" };
    if (state === "today") return { text: "today's puzzle · would move", cls: "cal-chip-move" };
    return { text: "on " + shortDate(p.scheduled_date) + " · would move", cls: "cal-chip-move" };
  }

  function summaryLine(p) {
    const parts = [
      DIRECTION_LABELS[p.direction] || p.direction,
      plural(p.hidden_count, "hidden letter"),
      p.center_letter ? "center letter" : "no center letter",
    ];
    return parts.join(" · ");
  }

  // One puzzle line: [checkbox] + a button that opens the preview.
  //   opts.list: "day" or "add" (a ticked puzzle is in both lists, and
  //     only the line that was clicked opens); opts.check: show the add
  //     checkbox; opts.chips: extra chips;
  //   opts.action: { cls, text, label } button at the end
  function puzzleRow(p, opts) {
    const key = opts.list + ":" + p.id;
    const open = day.openKey === key;
    const $row = $('<div class="cal-row"></div>')
      .toggleClass("is-open", open)
      .toggleClass("is-ticked", !!(opts.check && day.added.has(p.id)))
      .toggleClass("is-pending-add", !!opts.pendingAdd)
      .toggleClass("is-pending-remove", !!opts.pendingRemove);

    const $toggle = $('<button type="button" class="cal-row-toggle"></button>')
      .attr({ "data-id": p.id, "data-key": key, "aria-expanded": String(open) })
      .append(
        $('<span class="cal-row-word"></span>').text(p.word),
        $('<span class="cal-row-meta"></span>').text((p.name || "Unnamed") + " · " + plural(p.length, "letter")),
        p.hints.length ? $('<span class="cal-chip cal-chip-hints">Hints ✓</span>') : null,
        (opts.chips || []).map((c) => $('<span class="cal-chip"></span>').addClass(c.cls).text(c.text)),
        $('<span class="cal-caret" aria-hidden="true"></span>').text(open ? "▾" : "▸"),
      );

    const $head = $('<div class="cal-row-head"></div>');
    if (opts.check) {
      $head.append(
        $('<label class="cal-row-check"></label>').append(
          $('<input type="checkbox" class="form-check-input cal-add-check">')
            .attr({ "data-id": p.id, "aria-label": `Add ${p.word} to this day` })
            .prop("checked", day.added.has(p.id)),
        ),
      );
    }
    $head.append($toggle);
    if (opts.action) {
      $head.append(
        $('<button type="button" class="btn btn-sm cal-row-action"></button>')
          .addClass(opts.action.cls)
          .attr({ "data-id": p.id, "aria-label": opts.action.label })
          .text(opts.action.text),
      );
    }
    $row.append($head);

    if (open) {
      const built = playableFromApi(p);
      const $wheel = $('<div class="wheel"></div>');
      if (built) renderWheel(built, $wheel);
      $row.append(
        $('<div class="cal-row-detail"></div>').append(
          built ? $wheel : $('<p class="small text-muted mb-0"></p>').text("No preview: this puzzle has no letters saved."),
          $('<div class="cal-row-detail-info"></div>').append(
            $('<p class="small text-muted mb-2"></p>').text(summaryLine(p)),
            hintEditor.section(p),
          ),
        ),
      );
    }
    return $row;
  }

  function candidates() {
    const q = day.search.trim().normalize("NFC").toLocaleLowerCase();
    return puzzles
      .filter((p) => p.scheduled_date !== day.date)
      .filter((p) => day.showAll || !p.scheduled_date || day.added.has(p.id))
      .filter(function (p) {
        if (!q) return true;
        const name = (p.name || "").normalize("NFC").toLocaleLowerCase();
        return name.includes(q) || p.word.normalize("NFC").toLocaleLowerCase().includes(q);
      })
      .sort(function (a, b) {
        // unscheduled first, then A→Z
        const free = Number(!!a.scheduled_date) - Number(!!b.scheduled_date);
        return free || collator.compare(a.word, b.word);
      });
  }

  function renderCandidates() {
    const list = candidates();
    const $list = $("#calDayCandidates").empty();
    if (!list.length) {
      $list.append(
        $('<p class="small text-muted p-3 mb-0"></p>').text(
          day.search ? "No puzzles match your search." : day.showAll
            ? "No other puzzles to add."
            : "No unscheduled puzzles. Choose “Show all” to move one from another day.",
        ),
      );
      return;
    }
    list.slice(0, CANDIDATE_LIMIT).forEach(function (p) {
      $list.append(puzzleRow(p, { list: "add", check: true, chips: [whereChip(p)] }));
    });
    if (list.length > CANDIDATE_LIMIT) {
      $list.append(
        $('<p class="small text-muted p-3 mb-0"></p>').text(
          `Showing the first ${CANDIDATE_LIMIT} of ${list.length}. Search to narrow the list.`,
        ),
      );
    }
  }

  function renderDay() {
    if (!day || !today) return;
    const state = stateOf(day.date);
    const $body = $("#calDayBody");
    const scroll = $body.scrollTop();
    const searchFocused = document.activeElement && document.activeElement.id === "calDaySearch";

    $("#calDayTitle").text(longDate(day.date));
    $("#calDayBadge")
      .attr("class", "badge")
      .addClass(state === "past" ? "text-bg-secondary" : "text-bg-primary")
      .text(
        state === "past" ? "Past · view only"
          : state === "today" ? "Today · players see changes right away"
            : day.date === addDays(today, 1) ? "Upcoming · tomorrow" : "Upcoming",
      );

    const status = $("#calDayStatus").children().detach();
    $body.empty().append($('<div id="calDayStatus" class="mb-3" role="status" aria-live="polite"></div>').append(status));

    // Scheduled for this day (with pending additions and removals)
    const current = onDate(day.date);
    const adds = [...day.added].map(byId).filter(Boolean);
    const count = current.filter((p) => !day.removed.has(p.id)).length + adds.length;
    const $scheduled = $('<div class="cal-list mb-3"></div>');
    current.forEach(function (p) {
      const removing = day.removed.has(p.id);
      $scheduled.append(puzzleRow(p, {
        list: "day",
        pendingRemove: removing,
        chips: removing ? [{ text: "will be removed", cls: "cal-chip-remove" }] : [],
        action: viewOnly() ? null : removing
          ? { cls: "btn-outline-secondary cal-undo-remove-btn", text: "Undo", label: `Keep ${p.word} on this day` }
          : { cls: "btn-outline-danger cal-remove-btn", text: "✕ Remove", label: `Remove ${p.word} from this day` },
      }));
    });
    adds.forEach(function (p) {
      $scheduled.append(puzzleRow(p, {
        list: "day",
        pendingAdd: true,
        chips: [{ text: "will be added", cls: "cal-chip-add" }],
        action: { cls: "btn-outline-secondary cal-undo-add-btn", text: "Undo", label: `Don't add ${p.word}` },
      }));
    });
    if (!current.length && !adds.length) {
      $scheduled.append(
        $('<p class="small text-muted p-3 mb-0"></p>').text(
          viewOnly() ? "No puzzle was scheduled on this day." : "No puzzles yet. Tick some below to add them.",
        ),
      );
    }

    $body.append(
      $('<h3 class="h6 text-uppercase text-muted mb-2"></h3>').text(`Scheduled for this day (${count})`),
      $scheduled,
    );

    if (viewOnly()) {
      $body.append(
        $('<p class="small text-muted mb-0"></p>').text(
          "Past days can't be changed. To reuse one of these puzzles, open an upcoming day, choose “Show all”, and tick it.",
        ),
      );
    } else {
      $body.append(
        $('<h3 class="h6 text-uppercase text-muted mb-2 mt-4"></h3>').text("Add puzzles"),
        $('<div class="d-flex flex-wrap gap-2 align-items-center mb-2"></div>').append(
          $('<input type="search" id="calDaySearch" class="form-control" placeholder="Search name or word" autocomplete="off" spellcheck="false" style="flex: 1 1 200px">')
            .attr("aria-label", "Search puzzles")
            .val(day.search),
          $('<div class="btn-group" role="group" aria-label="Which puzzles to show"></div>').append(
            $('<button type="button" class="btn btn-sm cal-show-btn" data-all="0">Unscheduled only</button>')
              .addClass(day.showAll ? "btn-outline-secondary" : "btn-primary")
              .attr("aria-pressed", String(!day.showAll)),
            $('<button type="button" class="btn btn-sm cal-show-btn" data-all="1">Show all</button>')
              .addClass(day.showAll ? "btn-primary" : "btn-outline-secondary")
              .attr("aria-pressed", String(day.showAll)),
          ),
        ),
        $('<div id="calDayCandidates" class="cal-list"></div>'),
        $('<p class="small text-muted mt-2 mb-0"></p>').text(
          "Click a puzzle's line to see its wheel and hints; the checkbox only adds it. " +
          "A puzzle has one date: ticking one that's on another day moves it here, which is how past puzzles get reused. " +
          "Hints save as soon as you approve them; the schedule changes when you press Save changes.",
        ),
      );
      renderCandidates();
    }

    // Footer
    const n = changeCount();
    $("#calDayChanges").text(viewOnly() ? "" : n ? plural(n, "change") + " not saved" : "No changes");
    $("#calDaySaveBtn").toggleClass("d-none", viewOnly()).prop("disabled", !n || saving);
    $("#calDayCancelBtn").text(viewOnly() || !n ? "Close" : "Cancel");

    $body.scrollTop(scroll);
    if (searchFocused) {
      const input = document.getElementById("calDaySearch");
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }
  }

  // ── Pop-up events ──────────────────────────────────────────
  const $modal = $(modalEl);

  $modal.on("click", ".cal-row-toggle", function () {
    const key = $(this).data("key");
    day.openKey = day.openKey === key ? null : key;
    renderDay();
  });

  $modal.on("change", ".cal-add-check", function () {
    const id = $(this).data("id");
    if (this.checked) day.added.add(id);
    else day.added.delete(id);
    renderDay();
  });

  $modal.on("click", ".cal-remove-btn", function () {
    day.removed.add($(this).data("id"));
    renderDay();
  });
  $modal.on("click", ".cal-undo-remove-btn", function () {
    day.removed.delete($(this).data("id"));
    renderDay();
  });
  $modal.on("click", ".cal-undo-add-btn", function () {
    day.added.delete($(this).data("id"));
    renderDay();
  });

  $modal.on("input", "#calDaySearch", function () {
    day.search = this.value;
    renderCandidates();
  });

  $modal.on("click", ".cal-show-btn", function () {
    day.showAll = $(this).data("all") === 1;
    renderDay();
  });

  // Closing with unsaved changes asks first
  modalEl.addEventListener("hide.bs.modal", function (e) {
    if (saving || !day || !changeCount()) return;
    if (!confirm("Discard your changes to this day?")) e.preventDefault();
  });
  modalEl.addEventListener("hidden.bs.modal", function () {
    day = null;
    hintEditor.reset();
  });

  $("#calDayManageLink").on("click", function (e) {
    e.preventDefault();
    if (!day) return;
    const date = day.date;
    if (changeCount() && !confirm("Discard your changes to this day?")) return;
    day.added.clear();
    day.removed.clear();
    modal.hide();
    window.ManageTab.showDate(date);
  });

  function bulk(action, ids, date) {
    return $.ajax({
      url: "../api/bulk_update.php",
      method: "POST",
      contentType: "application/json",
      dataType: "json",
      data: JSON.stringify({ action, ids, date }),
    }).then((res) => (res && res.success ? res : $.Deferred().reject({ responseJSON: res })));
  }

  $("#calDaySaveBtn").on("click", function () {
    if (!day || saving || !changeCount()) return;
    const date = day.date;
    const adds = [...day.added];
    const removes = [...day.removed];

    if (stateOf(date) === "today" &&
        !confirm("This changes today's daily puzzles. Players see the change right away. Save?")) return;
    const fromToday = adds.filter((id) => { const p = byId(id); return p && p.scheduled_date === today; });
    if (date !== today && fromToday.length &&
        !confirm(`${plural(fromToday.length, "puzzle")} you ticked ${fromToday.length === 1 ? "is" : "are"} ` +
                 "today's daily puzzle. Moving it takes it away from players right away. Continue?")) return;

    saving = true;
    renderDay();
    const steps = $.when(adds.length ? bulk("schedule", adds, date) : null)
      .then(() => (removes.length ? bulk("unschedule", removes) : null));

    steps
      .done(function () {
        const done = [adds.length && `${adds.length} added`, removes.length && `${removes.length} removed`].filter(Boolean);
        $("#calStatus").html(alertBox("success", `Saved ${longDate(date)}: ${done.join(", ")}.`));
        saving = false;
        day.added.clear();
        day.removed.clear();
        modal.hide();
        refresh();
        if (window.refreshManage) window.refreshManage();
      })
      .fail(function (xhr) {
        saving = false;
        dayStatus("danger", apiError(xhr || {}, "Could not save the changes. Try again."));
        refresh(); // some changes may have gone through: show the real state
      });
  });

  // ── Start ──────────────────────────────────────────────────
  refresh();
});
