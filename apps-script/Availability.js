// ─── Availability: weekly-schedule planner, applier and booking reconciler ───
// The Availability sheet is one row per (date, time) with an open/blocked flag.
// Everything here is plain sheet edits: it never sends a text or an email and
// never touches the calendar. Names are prefixed "av" (shared global scope).
//
// avPlan() is pure (rows in, plan out) so it can be dry-run and unit tested;
// avApply() performs a plan against the live sheet.

function avNormTime(t) {
  return String(t || "").trim().toUpperCase().replace(/\s+/g, " ").replace(/^(\d{1,2}:\d{2})(AM|PM)$/, "$1 $2");
}

function avParts(dateStr) {
  var p = String(dateStr || "").split("-");
  return p.length === 3 ? { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) } : null;
}

function avDow(dateStr) {
  var p = avParts(dateStr);
  return new Date(p.y, p.m - 1, p.d).getDay();
}

function avAddDays(dateStr, n) {
  var p = avParts(dateStr);
  var dt = new Date(p.y, p.m - 1, p.d + n);
  var mm = dt.getMonth() + 1, dd = dt.getDate();
  return dt.getFullYear() + "-" + (mm < 10 ? "0" : "") + mm + "-" + (dd < 10 ? "0" : "") + dd;
}

function avIsDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")); }

// availRows / bookingRows: getDisplayValues() output, header row first.
// opts: { today, end?, template? ({0..6: ["5:00 PM", ...]}), timeChanges? }
//   timeChanges: [{ name, date, from, to }] — applied to bookings before planning
// With no template this only blocks the slots of active bookings (reconcile mode).
function avPlan(availRows, bookingRows, opts) {
  var plan = { errors: [], timeChanges: [], block: [], deletes: [], adds: [], info: { blockedWithoutBooking: [], duplicates: [], skippedWithNotes: [] } };
  var today = opts.today;

  // 1. Booking time changes (matched exactly; already-applied is fine, ambiguity is not)
  var bookingTime = {}; // bookings row index -> time after changes
  for (var i = 1; i < bookingRows.length; i++) bookingTime[i] = avNormTime(bookingRows[i][5]);

  (opts.timeChanges || []).forEach(function(tc) {
    var hits = [], already = [];
    for (var i = 1; i < bookingRows.length; i++) {
      var r = bookingRows[i];
      if (String(r[1] || "").trim().toLowerCase() !== tc.name.toLowerCase()) continue;
      if (String(r[4] || "").trim() !== tc.date) continue;
      if (String(r[28] || "").trim() !== "Booked") continue;
      if (avNormTime(r[5]) === avNormTime(tc.from)) hits.push(i);
      else if (avNormTime(r[5]) === avNormTime(tc.to)) already.push(i);
    }
    if (hits.length === 1) {
      bookingTime[hits[0]] = avNormTime(tc.to);
      plan.timeChanges.push({ rowNumber: hits[0] + 1, name: tc.name, date: tc.date, from: avNormTime(tc.from), to: avNormTime(tc.to) });
    } else if (hits.length === 0 && already.length === 1) {
      // already moved on an earlier run
    } else {
      plan.errors.push("Time change for " + tc.name + " on " + tc.date + " (" + tc.from + " -> " + tc.to + ") matched " + hits.length + " booking(s); expected exactly 1.");
    }
  });

  // 2. Active bookings (Booked, today or later) occupy their exact slot
  var booked = {};
  var bookedList = [];
  for (var b = 1; b < bookingRows.length; b++) {
    var br = bookingRows[b];
    if (String(br[28] || "").trim() !== "Booked") continue;
    var bd = String(br[4] || "").trim();
    if (!avIsDate(bd) || bd < today) continue;
    var key = bd + "|" + bookingTime[b];
    if (!booked[key]) { booked[key] = true; bookedList.push({ date: bd, time: bookingTime[b], name: String(br[1] || "").trim() }); }
  }

  var tmpl = opts.template || null;
  var onTemplate = function(date, time) {
    if (!tmpl) return true; // reconcile mode: never delete anything
    return (tmpl[avDow(date)] || []).some(function(t) { return avNormTime(t) === time; });
  };

  // 3. Existing availability rows
  var existing = {};
  for (var a = 1; a < availRows.length; a++) {
    var ar = availRows[a];
    var date = String(ar[0] || "").trim();
    var time = avNormTime(ar[1]);
    if (!avIsDate(date) || !time) continue;
    var k = date + "|" + time;
    var open = String(ar[2] || "").trim().toUpperCase() === "TRUE";
    var notes = String(ar[3] || "").trim();
    if (existing[k]) plan.info.duplicates.push({ date: date, time: time, rowNumber: a + 1 });
    existing[k] = existing[k] || true;
    if (date < today) continue;
    if (notes) { plan.info.skippedWithNotes.push({ date: date, time: time, rowNumber: a + 1 }); continue; }

    if (booked[k]) {
      if (open) plan.block.push({ rowNumber: a + 1, date: date, time: time });
    } else if (open && !onTemplate(date, time)) {
      plan.deletes.push({ rowNumber: a + 1, date: date, time: time });
    } else if (!open) {
      plan.info.blockedWithoutBooking.push({ date: date, time: time, rowNumber: a + 1 });
    }
  }

  // 4. Rows to add: template slots with no row yet, then booked slots with no row
  var toAdd = [];
  if (tmpl && opts.end) {
    for (var d = today; d <= opts.end; d = avAddDays(d, 1)) {
      (tmpl[avDow(d)] || []).forEach(function(t) {
        var nt = avNormTime(t), kk = d + "|" + nt;
        if (!existing[kk]) { existing[kk] = true; toAdd.push({ date: d, time: nt, available: !booked[kk] }); }
      });
    }
  }
  bookedList.forEach(function(bk) {
    var kk = bk.date + "|" + bk.time;
    if (!existing[kk]) { existing[kk] = true; toAdd.push({ date: bk.date, time: bk.time, available: false }); }
  });
  toAdd.sort(function(x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : avTimeMinutes(x.time) - avTimeMinutes(y.time); });
  plan.adds = toAdd;

  return plan;
}

function avTimeMinutes(t) {
  var m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(avNormTime(t));
  if (!m) return 0;
  var h = parseInt(m[1], 10) % 12 + (m[3] === "PM" ? 12 : 0);
  return h * 60 + parseInt(m[2], 10);
}

function avPlanIsEmpty(plan) {
  return !plan.timeChanges.length && !plan.block.length && !plan.deletes.length && !plan.adds.length;
}

function avToday() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function avSummary(plan) {
  var byKind = function(list) {
    var out = {};
    list.forEach(function(x) { var k = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][avDow(x.date)] + " " + x.time; out[k] = (out[k] || 0) + 1; });
    return out;
  };
  return {
    errors: plan.errors,
    timeChanges: plan.timeChanges,
    blockExistingOpenSlots: plan.block.map(function(x) { return x.date + " " + x.time; }),
    deleteOpenRows: { total: plan.deletes.length, byDayAndTime: byKind(plan.deletes) },
    addRows: { total: plan.adds.length, openRows: plan.adds.filter(function(x) { return x.available; }).length, blockedRows: plan.adds.filter(function(x) { return !x.available; }).map(function(x) { return x.date + " " + x.time; }), byDayAndTime: byKind(plan.adds), firstDate: plan.adds.length ? plan.adds[0].date : null, lastDate: plan.adds.length ? plan.adds[plan.adds.length - 1].date : null },
    info: { blockedWithoutBookingCount: plan.info.blockedWithoutBooking.length, blockedWithoutBooking: plan.info.blockedWithoutBooking.slice(0, 40).map(function(x) { return x.date + " " + x.time; }), duplicates: plan.info.duplicates, skippedWithNotes: plan.info.skippedWithNotes }
  };
}

// Sheet cells here are real date/time values (not text), so values are written
// with the same number formats as existing rows and then READ BACK: every new
// cell must display exactly the intended string, or the write is rewritten with
// proper Date values, or (if still wrong) rolled back and the run aborts.
function avTimeDate(timeStr) {
  var m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(avNormTime(timeStr));
  var h = parseInt(m[1], 10) % 12 + (m[3] === "PM" ? 12 : 0);
  return new Date(1899, 11, 30, h, parseInt(m[2], 10), 0);
}

function avDateDate(dateStr) {
  var p = avParts(dateStr);
  return new Date(p.y, p.m - 1, p.d);
}

function avWriteTimeCell(cell, timeStr) {
  var original = cell.getValue();
  cell.setValue(timeStr);
  if (avNormTime(cell.getDisplayValue()) === avNormTime(timeStr)) return;
  cell.setValue(avTimeDate(timeStr));
  if (avNormTime(cell.getDisplayValue()) === avNormTime(timeStr)) return;
  cell.setValue(original);
  throw new Error("Could not write time " + timeStr + " so that it displays correctly; original value restored.");
}

function avAppendRows(sheet, rows) {
  var lastRow = sheet.getLastRow();
  var start = lastRow + 1;
  var n = rows.length;
  var dateFmt = sheet.getRange(lastRow, 1).getNumberFormat() || "yyyy-mm-dd";
  var timeFmt = sheet.getRange(lastRow, 2).getNumberFormat() || "h:mm am/pm";
  sheet.getRange(start, 1, n, 1).setNumberFormat(dateFmt);
  sheet.getRange(start, 2, n, 1).setNumberFormat(timeFmt);

  var verify = function() {
    var disp = sheet.getRange(start, 1, n, 3).getDisplayValues();
    for (var i = 0; i < n; i++) {
      if (String(disp[i][0]).trim() !== rows[i].date) return false;
      if (avNormTime(disp[i][1]) !== rows[i].time) return false;
      if (String(disp[i][2]).trim().toUpperCase() !== (rows[i].available ? "TRUE" : "FALSE")) return false;
    }
    return true;
  };

  sheet.getRange(start, 1, n, 4).setValues(rows.map(function(x) { return [x.date, x.time, x.available, ""]; }));
  if (verify()) return n;

  sheet.getRange(start, 1, n, 2).setValues(rows.map(function(x) { return [avDateDate(x.date), avTimeDate(x.time)]; }));
  if (verify()) return n;

  sheet.deleteRows(start, n);
  throw new Error("New availability rows did not display as intended; the " + n + " added rows were removed. No other changes were made after this point.");
}

// Performs a plan. Order: backup, booking times, block + add, then delete
// (bottom-up so row numbers stay valid). Returns what was done.
function avApply(plan, opts) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(AVAILABILITY_SHEET);
  var done = { backup: null, timeChanges: 0, blocked: 0, added: 0, deleted: 0 };

  if (opts && opts.backup) {
    var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd_HHmm");
    var copy = sheet.copyTo(ss);
    copy.setName("Availability_backup_" + stamp);
    done.backup = copy.getName();
  }

  if (plan.timeChanges.length) {
    var bookings = ss.getSheetByName(BOOKINGS_SHEET);
    plan.timeChanges.forEach(function(tc) {
      avWriteTimeCell(bookings.getRange(tc.rowNumber, 6), tc.to);
      done.timeChanges++;
    });
  }

  plan.block.forEach(function(x) { sheet.getRange(x.rowNumber, 3).setValue(false); done.blocked++; });

  if (plan.adds.length) done.added = avAppendRows(sheet, plan.adds);

  plan.deletes.slice().sort(function(x, y) { return y.rowNumber - x.rowNumber; }).forEach(function(x) {
    sheet.deleteRow(x.rowNumber);
    done.deleted++;
  });

  return done;
}

// Block-only reconcile: every active future booking's exact slot must not be
// offered to the public. It can only close slots, never open or delete any, so
// it is safe to run often. Never throws (runs after real operations).
function avReconcile() {
  try {
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return 0;
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var availRows = ss.getSheetByName(AVAILABILITY_SHEET).getDataRange().getDisplayValues();
      var bookingRows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
      var plan = avPlan(availRows, bookingRows, { today: avToday() });
      if (!plan.block.length) return 0;
      var done = avApply({ timeChanges: [], block: plan.block, adds: [], deletes: [] }, { backup: false });
      Logger.log("avReconcile: blocked " + done.blocked + " slot(s)");
      return done.blocked;
    } finally { lock.releaseLock(); }
  } catch (err) {
    Logger.log("avReconcile error: " + err);
    return 0;
  }
}
