// ─── Calendar cleanup: delete STALE app-made events (owner-approved) ────────
// Deletes only events that the audit classifies STALE: made by this app, in the
// future, belonging to no booking and no expected plan visit. Every event is
// backed up in full to the "CalendarDeletedBackup" tab BEFORE any deletion, and
// anything with guests, recurrence, a sync tag, or a color is left alone.
// Sends nothing (no guests means Google sends no cancellation notices).

var CC_BACKUP_SHEET = "CalendarDeletedBackup";

// events: [{id,title,desc,date,time,durationH,allDay, guests, recurring, color, location, start, end}]
function ccPlan(bookingRows, events, projections, today) {
  var audit = caAudit(bookingRows, events, today, projections);
  var byId = {};
  events.forEach(function(ev) { byId[ev.id] = ev; });
  var plan = { delete: [], kept: [] };
  audit.orphans.forEach(function(o) {
    var ev = byId[o.id];
    var keep = function(why) { plan.kept.push({ id: o.id, title: o.title, date: o.date, why: why }); };
    if (o.cls !== "STALE") return keep("not stale (" + o.cls + ")");
    if (!ev) return keep("event not found");
    if (/\[ATX-SYNC:/.test(ev.desc || "")) return keep("tagged by the sync");
    if (ev.guests > 0) return keep("has guests");
    if (ev.recurring) return keep("recurring event");
    if (ev.color && ev.color !== "" && ev.color !== "0") return keep("has a color (" + ev.color + ")");
    if (ev.date < today) return keep("in the past");
    plan.delete.push({ id: o.id, client: o.client, date: o.date, time: o.time, durationH: o.durationH, title: o.title, why: o.why, event: ev });
  });
  plan.stats = audit.stats;
  return plan;
}

function ccBackup(ss, items) {
  var sheet = ss.getSheetByName(CC_BACKUP_SHEET) || ss.insertSheet(CC_BACKUP_SHEET);
  if (sheet.getLastRow() === 0) sheet.appendRow(["Backed up at", "Event ID", "Client", "Date", "Start", "Length (h)", "Title", "Location", "Description", "Why deleted"]);
  var stamp = new Date().toISOString();
  var rows = items.map(function(x) { return [stamp, x.id, x.client, x.date, x.time, x.durationH, x.title, x.event.location || "", x.event.desc || "", x.why]; });
  if (!rows.length) return 0;
  var start = sheet.getLastRow() + 1;
  sheet.getRange(start, 1, rows.length, rows[0].length).setNumberFormat("@");
  sheet.getRange(start, 1, rows.length, rows[0].length).setValues(rows);
  return rows.length;
}

// Backup is written for ALL items first; only then are events deleted one by one.
function ccApply(cal, ss, plan) {
  var done = { backedUp: ccBackup(ss, plan.delete), deleted: 0, failed: 0, failures: [] };
  plan.delete.forEach(function(x) {
    try {
      var ev = cal.getEventById(x.id);
      if (!ev) throw new Error("event not found");
      ev.deleteEvent();
      done.deleted++;
      Utilities.sleep(120);
    } catch (err) { done.failed++; done.failures.push(x.date + " " + x.title + ": " + String(err).slice(0, 100)); }
  });
  return done;
}

function ccRead() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tz = Session.getScriptTimeZone();
  var today = avToday();
  var cal = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!cal) throw new Error("Calendar not found: " + CALENDAR_ID);
  var start = new Date(); start.setHours(0, 0, 0, 0);
  var end = new Date(start); end.setFullYear(end.getFullYear() + 1); end.setDate(end.getDate() + 45);
  var events = cal.getEvents(start, end).map(function(ev) {
    var guests = 0; try { guests = ev.getGuestList(true).length; } catch (e) { guests = 99; }
    return {
      id: ev.getId(), title: ev.getTitle(), desc: ev.getDescription() || "", allDay: ev.isAllDayEvent(), location: ev.getLocation() || "",
      date: Utilities.formatDate(ev.getStartTime(), tz, "yyyy-MM-dd"), time: Utilities.formatDate(ev.getStartTime(), tz, "h:mm a"),
      durationH: Math.round(((ev.getEndTime() - ev.getStartTime()) / 3600000) * 10) / 10,
      guests: guests, recurring: ev.isRecurringEvent(), color: String(ev.getColor() || "")
    };
  });
  var bookingRows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
  var projections = avProjectPlans(bookingRows, today, avAddDays(today, 400));
  return { ss: ss, cal: cal, plan: ccPlan(bookingRows, events, projections, today) };
}
