// ─── Calendar audit (READ-ONLY on the calendar) ─────────────────────────────
// Compares every future active booking with the Google Calendar and reports:
//   per booking:  MATCH / WRONG_TIME / MISSING / DUPLICATE
//   per leftover event ("orphan"): PROJECTED (tentative future visit, fine),
//                                  STALE (belongs to no booking or projected visit)
// It never creates, edits or deletes a calendar event and never sends anything;
// the only write is the "CalendarAudit" report tab in the spreadsheet.

var CA_REPORT_SHEET = "CalendarAudit";

function caNorm(s) { return String(s || "").trim().toLowerCase(); }

// An event is "ours" if the app created it: its description carries the
// "Client:" block, or its title follows the "<Package> - <Name>" pattern.
function caIsOurs(ev) {
  if (ev.allDay) return false;
  var d = String(ev.desc || "");
  if (/(^|\n)Client: /.test(d)) return true;
  return /\b(Detail|Maintenance)\b.* - /.test(ev.title) || /\((Maintenance|Rescheduled)\)$/.test(ev.title);
}

function caVehicleOk(booking, ev) {
  var make = caNorm(booking.make), model = caNorm(booking.model);
  var d = caNorm(ev.desc);
  if (!make && !model) return true;
  return (!make || d.indexOf(make) !== -1) && (!model || d.indexOf(model) !== -1);
}

// bookingRows: Bookings getDisplayValues(); events: [{id,title,desc,date,time,durationH,allDay}]
function caAudit(bookingRows, events, today, projections) {
  var bookings = [];
  for (var i = 1; i < bookingRows.length; i++) {
    var r = bookingRows[i];
    if (String(r[28] || "").trim() !== "Booked") continue;
    var date = String(r[4] || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
    bookings.push({ row: i + 1, name: String(r[1] || "").trim(), date: date, time: avNormTime(r[5]), make: r[7], model: r[8], type: String(r[26] || "").trim(), freq: String(r[27] || "").trim() });
  }

  var ours = events.filter(caIsOurs);
  var claimed = {};
  var findings = [];

  bookings.forEach(function(b) {
    var cands = ours.filter(function(ev) { return ev.date === b.date && caNorm(ev.title).indexOf(caNorm(b.name)) !== -1 && caVehicleOk(b, ev); });
    var exact = cands.filter(function(ev) { return avNormTime(ev.time) === b.time; });
    var f = { name: b.name, date: b.date, time: b.time, kind: b.type === "maintenance" ? "plan " + b.freq : "one-time", status: "", detail: "", eventTimes: cands.map(function(ev) { return avNormTime(ev.time) + " (" + ev.durationH + "h)"; }) };
    if (exact.length === 1) { f.status = "MATCH"; claimed[exact[0].id] = true; }
    else if (exact.length > 1) { f.status = "DUPLICATE"; exact.forEach(function(ev) { claimed[ev.id] = true; }); f.detail = exact.length + " events at the right time"; }
    else if (cands.length) { f.status = "WRONG_TIME"; cands.forEach(function(ev) { claimed[ev.id] = true; }); f.detail = "calendar says " + f.eventTimes.join(", "); }
    else { f.status = "MISSING"; f.detail = "no event for this booking"; }
    if (f.status === "MATCH" && exact[0].durationH < 3) f.detail = "only " + exact[0].durationH + "h on the calendar";
    findings.push(f);
  });

  var projSet = {};
  (projections || []).forEach(function(p) { p.dates.forEach(function(d) { projSet[caNorm(p.name) + "|" + d] = p; }); });

  var allBookingsByNameDate = {};
  for (var j = 1; j < bookingRows.length; j++) {
    var br = bookingRows[j];
    var k = caNorm(br[1]) + "|" + String(br[4] || "").trim();
    (allBookingsByNameDate[k] = allBookingsByNameDate[k] || []).push(String(br[28] || "").trim());
  }

  var orphans = [];
  ours.forEach(function(ev) {
    if (claimed[ev.id] || ev.date < today) return;
    var client = "";
    var names = {};
    for (var m = 1; m < bookingRows.length; m++) names[caNorm(bookingRows[m][1])] = String(bookingRows[m][1]).trim();
    Object.keys(names).forEach(function(n) { if (n && caNorm(ev.title).indexOf(n) !== -1) client = names[n]; });
    var o = { id: ev.id, date: ev.date, time: avNormTime(ev.time), durationH: ev.durationH, title: ev.title, client: client || "(unknown)", cls: "", why: "", action: "" };
    var other = allBookingsByNameDate[caNorm(client) + "|" + ev.date];
    var proj = projSet[caNorm(client) + "|" + ev.date];
    if (other && other.length && other.indexOf("Booked") === -1) {
      o.cls = "STALE"; o.why = "that booking is " + other[0]; o.action = "delete";
    } else if (proj && avNormTime(proj.time) === o.time) {
      o.cls = "PROJECTED"; o.why = "matches the next " + proj.freq + " visit (not booked yet)"; o.action = "keep (tentative)";
    } else if (proj) {
      o.cls = "STALE"; o.why = "a visit is expected that day but at " + proj.time + ", not " + o.time; o.action = "delete";
    } else {
      o.cls = "STALE"; o.why = "no booking or expected visit that day (old schedule)"; o.action = "delete";
    }
    orphans.push(o);
  });

  var count = function(list, key, val) { return list.filter(function(x) { return x[key] === val; }).length; };
  var byClient = {};
  orphans.forEach(function(o) { var c = byClient[o.client] = byClient[o.client] || { PROJECTED: 0, STALE: 0 }; c[o.cls]++; });
  return {
    bookings: findings, orphans: orphans,
    stats: {
      activeBookings: findings.length, match: count(findings, "status", "MATCH"), wrongTime: count(findings, "status", "WRONG_TIME"), missing: count(findings, "status", "MISSING"), duplicate: count(findings, "status", "DUPLICATE"),
      ourEvents: ours.length, otherEventsIgnored: events.length - ours.length,
      orphanProjected: count(orphans, "cls", "PROJECTED"), orphanStale: count(orphans, "cls", "STALE"), staleByClient: byClient,
      shortEvents: ours.filter(function(ev) { return ev.durationH < 3; }).length
    }
  };
}

// Reads the calendar (read-only) and the sheets, writes the report tab.
function caRunAudit() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tz = Session.getScriptTimeZone();
  var today = avToday();
  var cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) throw new Error("Calendar not found: " + CALENDAR_ID);

  var start = new Date(); start.setHours(0, 0, 0, 0);
  var end = new Date(start); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() + 45);
  var events = cal.getEvents(start, end).map(function(ev) {
    return {
      id: ev.getId(), title: ev.getTitle(), desc: ev.getDescription() || "", allDay: ev.isAllDayEvent(),
      date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"), time: Utilities.formatDate(ev.getStartTime(), tz, "h:mm a"),
      durationH: Math.round(((ev.getEndTime() - ev.getStartTime()) / 3600000) * 10) / 10
    };
  });

  var bookingRows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
  var projections = avProjectPlans(bookingRows, today, Utilities.formatDate(end, tz, "yyyy-MM-dd"));
  var result = caAudit(bookingRows, events, today, projections);
  caWriteReport(ss, result, today);
  return result;
}

function caWriteReport(ss, result, today) {
  var sheet = ss.getSheetByName(CA_REPORT_SHEET) || ss.insertSheet(CA_REPORT_SHEET);
  sheet.clear();
  var s = result.stats, rows = [];
  rows.push(["Calendar audit — " + today + " (read-only; nothing on the calendar was changed)"]);
  rows.push(["Active bookings", s.activeBookings, "On calendar correctly", s.match, "Wrong time", s.wrongTime, "Missing", s.missing, "Duplicate", s.duplicate]);
  rows.push(["Leftover events", result.orphans.length, "Tentative (fine)", s.orphanProjected, "Stale (delete)", s.orphanStale, "Events shorter than 3h", s.shortEvents, "Other events ignored", s.otherEventsIgnored]);
  rows.push([]);
  rows.push(["BOOKINGS vs CALENDAR"]);
  rows.push(["Client", "Date", "Day", "Booking time", "Kind", "Result", "Detail"]);
  result.bookings.sort(function(a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; }).forEach(function(f) {
    rows.push([f.name, f.date, ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][avDow(f.date)], f.time, f.kind, f.status, f.detail]);
  });
  rows.push([]);
  rows.push(["LEFTOVER CALENDAR EVENTS (not tied to a booking)"]);
  rows.push(["Client", "Date", "Day", "Calendar time", "Length (h)", "Title", "Type", "Why", "Suggestion"]);
  result.orphans.sort(function(a, b) { return a.cls === b.cls ? (a.date < b.date ? -1 : 1) : (a.cls < b.cls ? 1 : -1); }).forEach(function(o) {
    rows.push([o.client, o.date, ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][avDow(o.date)], o.time, o.durationH, o.title, o.cls, o.why, o.action]);
  });
  var width = rows.reduce(function(m, r) { return Math.max(m, r.length); }, 1);
  var padded = rows.map(function(r) { var c = r.slice(); while (c.length < width) c.push(""); return c; });
  sheet.getRange(1, 1, padded.length, width).setNumberFormat("@");
  sheet.getRange(1, 1, padded.length, width).setValues(padded);
  sheet.getRange(1, 1).setFontWeight("bold");
}
