// ─── Calendar sync: put correct booking events on the calendar ──────────────
// ADDITIVE ONLY. It creates events (real bookings = green, upcoming plan visits =
// light green "(tentative)"), and for events the app already made correctly it
// only recolors/tags/lengthens them. It never deletes an event, never adds
// guests (so Google sends no invitations) and never sends a text or email.
// Every event it owns carries "[ATX-SYNC:<key>]" in its description so later
// syncs find it by tag instead of guessing from names.

var CS_LOG_SHEET = "CalendarSyncLog";
var CS_HORIZON_DAYS = 90;

function csTag(key) { return "[ATX-SYNC:" + key + "]"; }

function csKey(kind, date, time, name, make, model) {
  return [kind, date, avNormTime(time), caNorm(name), caNorm(make), caNorm(model)].join("|");
}

function csPackageLabel(pkg, vehicleType) {
  if (vehicleType === "boat") return "Boat Detail";
  var map = { basic: "Basic Detail", premium: "Premium Detail", exterior: "Exterior Only - Basic", interior: "Interior Only - Basic", exteriorPremium: "Exterior Only - Premium", interiorPremium: "Interior Only - Premium" };
  return map[pkg] || "Detail";
}

// 3 hours by default, 4 for a full Premium Detail, 5 for boats. (Exterior/Interior
// Only - Premium are partial details, so they stay at 3.)
function csDurationHours(pkg, vehicleType) {
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

  var plan = { create: [], adopt: [], skip: [] };
  var wanted = [];

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
    return { id: ev.getId(), title: ev.getTitle(), desc: ev.getDescription() || "", allDay: ev.isAllDayEvent(),
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
