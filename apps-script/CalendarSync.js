// ─── Calendar sync: put correct booking events on the calendar ──────────────
// ADDITIVE ONLY. It creates events (real bookings = green, upcoming plan visits =
// light green "(tentative)"), and for events the app already made correctly it
// only recolors/tags/lengthens them. It never deletes an event, never adds
// guests (so Google sends no invitations) and never sends a text or email.
// Every event it owns carries "[ATX-SYNC:<key>]" in its description so later
// syncs find it by tag instead of guessing from names.

var CS_LOG_SHEET = "CalendarSyncLog";
var CS_HORIZON_DAYS = 90;

// Automatic mode: the sync is the ONLY writer of client calendar events. It
// creates what is missing and removes only events it created itself (tagged),
// once their booking or expected visit is gone.
var CS_SYNC_ENABLED = true;
var CS_MAX_REMOVALS = 15;   // more than this in one run is held for review, not removed
var CS_MAX_CREATES = 60;    // bounded work per run; the rest follows on the next run
var CS_FULL_REFRESH_MS = 6 * 3600000;

// Old per-flow calendar code (signup 12-month series, move/cancel/skip/pause
// edits) is switched off when the sync owns the calendar. Those call sites all
// treat "no calendar" as "do nothing".
var CAL_LEGACY_EVENTS = false;
function legacyCalendar() { return CAL_LEGACY_EVENTS ? CalendarApp.getCalendarById(CALENDAR_ID) : null; }

function csTag(key) { return "[ATX-SYNC:" + key + "]"; }

function csKey(kind, date, time, name, make, model) {
  return [kind, date, avNormTime(time), caNorm(name), caNorm(make), caNorm(model)].join("|");
}

function csPackageLabel(pkg, vehicleType) {
  if (vehicleType === "boat") return "Boat Detail";
  var map = { lvisdFreeWash: "Free Wash (Event)", basic: "Basic Detail", premium: "Premium Detail", exterior: "Exterior Only - Basic", interior: "Interior Only - Basic", exteriorPremium: "Exterior Only - Premium", interiorPremium: "Interior Only - Premium" };
  return map[pkg] || "Detail";
}

// 3 hours by default, 4 for a full Premium Detail, 5 for boats. (Exterior/Interior
// Only - Premium are partial details, so they stay at 3.)
function csDurationHours(pkg, vehicleType) {
  if (String(pkg || "") === "lvisdFreeWash") return 0.75; // 45-minute event slots
  if (vehicleType === "boat") return 5;
  return String(pkg || "") === "premium" ? 4 : 3;
}

function csVehicleLabel(r) {
  var parts = String(r[10] || "") === "boat" ? [r[9], r[7], r[8]] : [r[6], r[7], r[8]];
  return parts.map(function(x) { return String(x || "").trim(); }).filter(Boolean).join(" ");
}

function csDescribe(r, tentative, tag) {
  var plan = String(r[26] || "") === "maintenance" ? "Maintenance (" + String(r[27] || "") + ")" : "One-Time Service";
  var svc = String(r[15] || "") === "mobile" ? "Mobile Service" : "Drop-Off Service";
  var addr = String(r[16] || "").trim();
  var lines = [
    "Client: " + String(r[1] || "").trim(),
    "Phone: " + String(r[2] || "").trim(),
    "Email: " + String(r[3] || "").trim(),
    "Vehicle: " + csVehicleLabel(r),
    "Package: " + csPackageLabel(String(r[11] || ""), String(r[10] || "")),
    "Service Plan: " + plan,
    "Service Type: " + svc
  ];
  if (addr) lines.push("Address: " + addr);
  var addOns = String(r[13] || "").trim();
  if (addOns && addOns !== "None") lines.push("Add-Ons: " + addOns);
  var notes = String(r[25] || "").trim();
  if (notes) lines.push("Notes: " + notes);
  if (tentative) lines.push("", "TENTATIVE: this plan visit is not booked yet. It is replaced by the real booking when the previous visit is completed.");
  lines.push("", tag);
  return lines.join("\n");
}

// Returns { create: [...], adopt: [...], skip: [...] }.
// bookingRows: Bookings display values; events: [{id,title,desc,date,time,durationH,allDay}]
function csPlan(bookingRows, events, projections, today, horizonDays) {
  var horizon = avAddDays(today, horizonDays || CS_HORIZON_DAYS);
  var ours = events.filter(caIsOurs);
  var tagged = {};
  ours.forEach(function(ev) { var m = /\[ATX-SYNC:([^\]]+)\]/.exec(ev.desc || ""); if (m) tagged[m[1]] = ev; });

  var plan = { create: [], adopt: [], skip: [], remove: [] };
  var wanted = [];
  var desiredKeys = {};
  // A finished visit stays on the calendar as history: never remove the event of a
  // Completed booking (including one completed on the day of the job).
  for (var c = 1; c < bookingRows.length; c++) {
    var cr = bookingRows[c];
    var cd = String(cr[4] || "").trim();
    if (String(cr[28] || "").trim() === "Completed" && /^\d{4}-\d{2}-\d{2}$/.test(cd)) {
      desiredKeys[csKey("booking", cd, cr[5], String(cr[1] || "").trim(), cr[7], cr[8])] = true;
    }
  }

  // 1. real bookings
  var byRow = {};
  for (var i = 1; i < bookingRows.length; i++) {
    var r = bookingRows[i];
    if (String(r[28] || "").trim() !== "Booked") continue;
    var date = String(r[4] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
    byRow[i] = r;
    wanted.push({ kind: "booking", r: r, date: date, time: avNormTime(r[5]), name: String(r[1] || "").trim() });
  }

  // 2. tentative visits: next plan visits inside the horizon (projections come from the app's own rule)
  var anchorRows = {};
  Object.keys(byRow).forEach(function(i) {
    var r = byRow[i];
    if (String(r[26] || "").trim() !== "maintenance") return;
    var k = caNorm(r[3]) + "|" + caNorm(r[7]) + "|" + caNorm(r[8]);
    if (!anchorRows[k] || String(r[4]) > String(anchorRows[k][4])) anchorRows[k] = r;
  });
  (projections || []).forEach(function(p) {
    var anchor = null;
    Object.keys(anchorRows).forEach(function(k) { var r = anchorRows[k]; if (String(r[4]).trim() === p.anchor && caNorm(r[1]) === caNorm(p.name) && avNormTime(r[5]) === p.time) anchor = r; });
    if (!anchor) return;
    p.dates.filter(function(d) { return d <= horizon; }).forEach(function(d) {
      wanted.push({ kind: "tentative", r: anchor, date: d, time: p.time, name: p.name });
    });
  });

  wanted.forEach(function(w) {
    var r = w.r, key = csKey(w.kind, w.date, w.time, w.name, r[7], r[8]);
    desiredKeys[key] = true;
    var dur = csDurationHours(String(r[11] || ""), String(r[10] || ""));
    var pkg = csPackageLabel(String(r[11] || ""), String(r[10] || ""));
    var item = {
      key: key, kind: w.kind, name: w.name, date: w.date, time: w.time, durationH: dur,
      title: pkg + " - " + w.name + (w.kind === "tentative" ? " (Maintenance, tentative)" : String(r[26] || "") === "maintenance" ? " (Maintenance)" : ""),
      description: csDescribe(r, w.kind === "tentative", csTag(key)),
      location: String(r[15] || "") === "mobile" ? String(r[16] || "").trim() : "Drop-Off Service",
      color: w.kind === "tentative" ? "PALE_GREEN" : "GREEN"
    };
    if (tagged[key]) { plan.skip.push({ key: key, why: "already synced" }); return; }
    var existing = ours.filter(function(ev) {
      return ev.date === w.date && avNormTime(ev.time) === w.time && caNorm(ev.title).indexOf(caNorm(w.name)) !== -1 &&
        caVehicleOk({ make: r[7], model: r[8] }, ev) && !/\[ATX-SYNC:/.test(ev.desc || "");
    });
    if (existing.length >= 1) {
      if (w.kind === "booking") plan.adopt.push({ item: item, eventId: existing[0].id, currentDurationH: existing[0].durationH, oldDesc: existing[0].desc });
      else plan.skip.push({ key: key, why: "an event is already there" });
      return;
    }
    plan.create.push(item);
  });

  // Events this sync made (tagged) whose booking / expected visit no longer exists.
  // Never untagged events, never past events. (Guests / recurrence are re-checked at delete time.)
  Object.keys(tagged).forEach(function(k) {
    var ev = tagged[k];
    if (desiredKeys[k] || ev.date < today) return;
    plan.remove.push({ id: ev.id, client: (/^[a-z]+\|[0-9-]+\|[^|]*\|([^|]*)\|/.exec(k) || [])[1] || "", date: ev.date, time: avNormTime(ev.time), durationH: ev.durationH, title: ev.title,
      why: "its booking or expected visit is gone (" + k.split("|")[0] + ")", event: { desc: ev.desc || "", location: ev.location || "" }, key: k });
  });
  return plan;
}

function csLog(ss, rows) {
  if (!rows.length) return;
  var sheet = ss.getSheetByName(CS_LOG_SHEET) || ss.insertSheet(CS_LOG_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(["When", "Action", "Kind", "Client", "Date", "Time", "Hours", "Title", "Event ID", "Result"]);
  var start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, rows[0].length).setNumberFormat("@");
  sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
}

function csDates(item) {
  var p = avParts(item.date), m = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(item.time);
  var h = parseInt(m[1], 10) % 12 + (m[3] === "PM" ? 12 : 0);
  var start = new Date(p.y, p.m - 1, p.d, h, parseInt(m[2], 10), 0);
  return { start: start, end: new Date(start.getTime() + item.durationH * 3600000) };
}

function csApply(cal, ss, plan, colors) {
  var stamp = new Date().toISOString(), log = [], done = { created: 0, adopted: 0, failed: 0 };
  plan.create.forEach(function(item) {
    try {
      var d = csDates(item);
      var ev = cal.createEvent(item.title, d.start, d.end, { description: item.description, location: item.location });
      ev.setColor(colors[item.color]);
      done.created++;
      log.push([stamp, "created", item.kind, item.name, item.date, item.time, item.durationH, item.title, ev.getId(), "ok"]);
      Utilities.sleep(120);
    } catch (err) { done.failed++; log.push([stamp, "create", item.kind, item.name, item.date, item.time, item.durationH, item.title, "", "FAILED: " + String(err).slice(0, 150)]); }
  });
  plan.adopt.forEach(function(a) {
    var item = a.item;
    try {
      var ev = cal.getEventById(a.eventId);
      var d = csDates(item);
      ev.setColor(colors[item.color]);
      ev.setDescription(String(a.oldDesc || "").replace(/\s+$/, "") + "\n\n" + csTag(item.key));
      // Only fix the app's short 2-hour default; a length of 3h or more was set on purpose.
      if (a.currentDurationH < 3) ev.setTime(ev.getStartTime(), d.end);
      done.adopted++;
      log.push([stamp, "adopted (recolored, tagged, lengthened)", item.kind, item.name, item.date, item.time, item.durationH, item.title, a.eventId, "ok"]);
      Utilities.sleep(120);
    } catch (err) { done.failed++; log.push([stamp, "adopt", item.kind, item.name, item.date, item.time, item.durationH, item.title, a.eventId, "FAILED: " + String(err).slice(0, 150)]); }
  });
  csLog(ss, log);
  return done;
}

// Reads current state, plans, and (optionally) applies. Returns the plan + result.
function csRun(apply) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tz = Session.getScriptTimeZone();
  var today = avToday();
  var cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) throw new Error("Calendar not found: " + CALENDAR_ID);
  var start = new Date(); start.setHours(0, 0, 0, 0);
  var end = new Date(start); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() + 45);
  var events = cal.getEvents(start, end).map(function(ev) {
    return { id: ev.getId(), title: ev.getTitle(), desc: ev.getDescription() || "", allDay: ev.isAllDayEvent(), location: ev.getLocation() || "",
      date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"), time: Utilities.formatDate(ev.getStartTime(), tz, "h:mm a"),
      durationH: Math.round(((ev.getEndTime() - ev.getStartTime()) / 3600000) * 10) / 10 };
  });
  var bookingRows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
  var projections = avProjectPlans(bookingRows, today, avAddDays(today, CS_HORIZON_DAYS));
  var plan = csPlan(bookingRows, events, projections, today, CS_HORIZON_DAYS);
  var result = { plan: plan };
  if (apply) result.done = csApply(cal, ss, plan, { GREEN: CalendarApp.EventColor.GREEN, PALE_GREEN: CalendarApp.EventColor.PALE_GREEN });
  return result;
}


// Removes tagged events that no longer match anything. Everything is backed up first;
// an event that has guests or recurrence (never made by this sync) is left alone.
function csApplyRemovals(cal, ss, removals) {
  var stamp = new Date().toISOString(), log = [], safe = [], done = { removed: 0, kept: 0, failed: 0 };
  removals.forEach(function(x) {
    try {
      var ev = cal.getEventById(x.id);
      if (!ev) return;
      var guests = 0; try { guests = ev.getGuestList(true).length; } catch (e) { guests = 99; }
      if (guests > 0 || ev.isRecurringEvent()) { done.kept++; log.push([stamp, "kept (has guests or recurrence)", "", x.client, x.date, x.time, x.durationH, x.title, x.id, ""]); return; }
      safe.push(x);
    } catch (err) { done.failed++; }
  });
  ccBackup(ss, safe);
  safe.forEach(function(x) {
    try {
      cal.getEventById(x.id).deleteEvent();
      done.removed++;
      log.push([stamp, "removed (booking or visit gone)", x.key.split("|")[0], x.client, x.date, x.time, x.durationH, x.title, x.id, "ok; backed up in CalendarDeletedBackup"]);
      Utilities.sleep(120);
    } catch (err) { done.failed++; log.push([stamp, "remove", "", x.client, x.date, x.time, x.durationH, x.title, x.id, "FAILED: " + String(err).slice(0, 150)]); }
  });
  csLog(ss, log);
  return done;
}

// One automatic reconcile pass. Returns { ok, ... }; ok=false means "try again next tick".
function csRunAuto() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { ok: false, why: "busy" };
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var tz = Session.getScriptTimeZone();
    var today = avToday();
    var bookingRows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
    if (bookingRows.length < 2) return { ok: false, why: "bookings sheet read empty; nothing touched" };
    var cal = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!cal) return { ok: false, why: "calendar not found" };
    var start = new Date(); start.setHours(0, 0, 0, 0);
    var end = new Date(start); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() + 45);
    var events = cal.getEvents(start, end).map(function(ev) {
      return { id: ev.getId(), title: ev.getTitle(), desc: ev.getDescription() || "", allDay: ev.isAllDayEvent(), location: ev.getLocation() || "",
        date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"), time: Utilities.formatDate(ev.getStartTime(), tz, "h:mm a"),
        durationH: Math.round(((ev.getEndTime() - ev.getStartTime()) / 3600000) * 10) / 10 };
    });
    var projections = avProjectPlans(bookingRows, today, avAddDays(today, CS_HORIZON_DAYS));
    var plan = csPlan(bookingRows, events, projections, today, CS_HORIZON_DAYS);

    var result = { ok: true, created: 0, adopted: 0, removed: 0, held: 0 };
    var colors = { GREEN: CalendarApp.EventColor.GREEN, PALE_GREEN: CalendarApp.EventColor.PALE_GREEN };
    var work = { create: plan.create.slice(0, CS_MAX_CREATES), adopt: plan.adopt };
    if (plan.create.length > CS_MAX_CREATES) result.ok = false;
    if (work.create.length || work.adopt.length) { var d = csApply(cal, ss, work, colors); result.created = d.created; result.adopted = d.adopted; }

    if (plan.remove.length > CS_MAX_REMOVALS) {
      result.held = plan.remove.length;
      csLog(ss, [[new Date().toISOString(), "HELD for review", "", "", "", "", "", plan.remove.length + " tagged events want removing (limit " + CS_MAX_REMOVALS + "); none were removed", "", ""]]);
    } else if (plan.remove.length) {
      result.removed = csApplyRemovals(cal, ss, plan.remove).removed;
    }
    return result;
  } finally { try { lock.releaseLock(); } catch (e) { /* not held */ } }
}

// Cheap fingerprint of everything that decides what the calendar should show.
function csFingerprint(bookingRows, today) {
  var parts = [];
  for (var i = 1; i < bookingRows.length; i++) {
    var r = bookingRows[i], d = String(r[4] || "").trim();
    if (d < today) continue;
    parts.push([r[28], d, avNormTime(r[5]), r[1], r[7], r[8], r[26], r[27], r[11], r[10]].join("~"));
  }
  parts.sort();
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, today + "|" + parts.join("\n"));
  return bytes.map(function(b) { return ((b < 0 ? b + 256 : b) + 256).toString(16).slice(1); }).join("");
}

// Runs from the 15-minute job: syncs only when bookings changed or ~6 hours passed.
function calendarSyncTick() {
  if (!CS_SYNC_ENABLED) return "off";
  var props = PropertiesService.getScriptProperties();
  var bookingRows = SpreadsheetApp.openById(SHEET_ID).getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
  var fp = csFingerprint(bookingRows, avToday());
  var last = props.getProperty("CAL_SYNC_FP"), lastAt = Number(props.getProperty("CAL_SYNC_AT") || 0);
  if (fp === last && Date.now() - lastAt < CS_FULL_REFRESH_MS) return "unchanged";
  var res = csRunAuto();
  if (res.ok) { props.setProperty("CAL_SYNC_FP", fp); props.setProperty("CAL_SYNC_AT", String(Date.now())); }
  return res.ok ? "synced" : "retry";
}

// Never lets a calendar problem affect the job that calls it.
function calendarSyncSafe() {
  try { return calendarSyncTick(); } catch (err) { Logger.log("calendarSyncSafe: " + err); return "error"; }
}
