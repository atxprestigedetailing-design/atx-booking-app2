const SHEET_ID = "1WQF1MxmKHHeUbUlpjbpL2reoIRaZd2cMNVPmgM4bdpQ";
const BOOKINGS_SHEET = "Bookings";
const AVAILABILITY_SHEET = "Availability";
const CALENDAR_ID = "edwardestevez95@gmail.com";

// ─── Twilio SMS ───────────────────────────────────────────────────────────────
const PHOTOS_FOLDER_ID   = "1hZ6vqaMu3sLh7qaH8nSIyIrgM_LPcc0V";
const INVOICES_FOLDER_ID = "1z3J9hpduXhGp7d6Uzu6PU4f57uRXQ03E";

// ─── Twilio SMS ───────────────────────────────────────────────────────────────
// Credentials live in Script Properties (Project Settings → Script Properties in
// the Apps Script editor), not in source, so they never end up in git history.
const TWILIO_ACCOUNT_SID = PropertiesService.getScriptProperties().getProperty("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN   = PropertiesService.getScriptProperties().getProperty("TWILIO_AUTH_TOKEN");
const TWILIO_FROM_NUMBER  = PropertiesService.getScriptProperties().getProperty("TWILIO_FROM_NUMBER");
const CLIENT_NOTES_SHEET = "ClientNotes";
// ─── Square In-App Card Payments ──────────────────────────────────────────────
const SQUARE_LOCATION_ID = "LMZ2E4XRSJTMT";
const SQUARE_API_BASE = "https://connect.squareupsandbox.com"; // sandbox — swap to https://connect.squareup.com for production

function sendSMS(toPhone, message) {
  try {
    var digits = String(toPhone || "").replace(/\D/g, "");
    if (digits.length === 10) digits = "1" + digits;
    if (digits.length !== 11) { Logger.log("Invalid phone for SMS: " + toPhone); return; }
    var toE164 = "+" + digits;

    var url = "https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_ACCOUNT_SID + "/Messages.json";
    var payload = {
      To:   toE164,
      From: TWILIO_FROM_NUMBER,
      Body: message,
    };
    var options = {
      method: "post",
      payload: payload,
      headers: {
        Authorization: "Basic " + Utilities.base64Encode(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN),
      },
      muteHttpExceptions: true,
    };
    var response = UrlFetchApp.fetch(url, options);
    Logger.log("SMS sent to " + toE164 + ": " + response.getResponseCode());
  } catch (err) {
    Logger.log("SMS error: " + err);
  }
}

// ─── Column map (0-based) ─────────────────────────────────────────────────────
// A  Timestamp          B  Name             C  Phone
// D  Email              E  Date             F  Time
// G  Year               H  Make             I  Model
// J  Boat Size          K  Vehicle          L  Package Type
// M  Hourly Rate        N  Add-Ons          O  Add-On Estimate
// P  Service Type       Q  Address          R  Street
// S  City               T  State            U  Zip
// V  Place ID           W  Lat              X  Lng
// Y  Avg Time           Z  Notes
// AA Client Type        AB Recurring Freq   AC Status
// AD Invoice Amount     AE Invoice Status   AF Invoice Note
// AG Invoice Number     AH Photos Link      AI Before Photo URL
// AJ After Photo URL    AK Invoice Link     AL SMS Consent
// AM SMS Marketing Consent  AN Date Paid
// AO Event (e.g. "lvisd-aug-2026", blank for normal bookings)
// AP Eligibility Method (email | photo | attest)
// AQ Eligibility Proof URL (Drive link, when method === "photo")
// AR Coupon Code (e.g. "LVISD25", entered by customer at booking — discount is
//    applied manually by admin when the final invoice amount is set)
// AS Consent Source ("self" = client checked the box themselves on their own
//    booking, "admin" = value was set through the app by staff, blank/"unknown"
//    = predates this tracking. Only "self" counts as real marketing consent.
const EVENT_COL = 41; // AO — used to gate self-service edits for promo bookings
const COUPON_CODE_COL = 44; // AR
const CONSENT_SOURCE_COL = 45; // AS

function doGet(e) {
  var action = e.parameter.action;
  if (action === "getAvailability")    return getAvailability(e);
  if (action === "getAllAvailability") return getAllAvailability();
  if (action === "getBookingsByEmail") return getBookingsByEmail(e);
  if (action === "getAllBookings")     return getAllBookings();
  if (action === "getInventory")       return getInventory();
  if (action === "getClientNotes")     return getClientNotes(e);
  if (action === "getExpenses")        return getExpenses();
  return ContentService
    .createTextOutput(JSON.stringify({ error: "Invalid action" }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data   = JSON.parse(e.postData.contents || "{}");
    var action = data.action;
    if (action === "bookAppointment" || !action) return bookAppointment(data);
    if (action === "requestChange")              return requestChange(data);
    if (action === "updateBooking")              return updateBooking(data);
    if (action === "sendInvoiceEmail")           return sendInvoiceEmail(data);
    if (action === "sendPaymentConfirmedEmail")      return sendPaymentConfirmedEmail(data);
    if (action === "createNextMaintenanceBooking") return createNextMaintenanceBooking(data);
    if (action === "updateBookingFields")          return updateBookingFields(data);
    if (action === "squareInvoiceRequest")       return squareInvoiceRequest(data);
    if (action === "sendJobStartedSMS")          return sendJobStartedSMS(data);
    if (action === "sendJobCompletedSMS")        return sendJobCompletedSMS(data);
    if (action === "toggleAvailabilitySlot")     return toggleAvailabilitySlot(data);
    if (action === "cancelBooking")              return cancelBooking(data);
    if (action === "skipMaintenanceBooking")      return skipMaintenanceBooking(data);
    if (action === "pauseMaintenancePlan")        return pauseMaintenancePlan(data);
    if (action === "resumeMaintenancePlan")       return resumeMaintenancePlan(data);
    if (action === "updateMaintenanceTime")       return updateMaintenanceTime(data);
    if (action === "checkMaintenanceTimeConflicts") return checkMaintenanceTimeConflicts(data);
    if (action === "uploadJobPhoto")             return uploadJobPhoto(data);
    if (action === "addAvailabilitySlot")        return addAvailabilitySlot(data);
    if (action === "addInventoryItem")           return addInventoryItem(data);
    if (action === "updateInventoryQty")         return updateInventoryQty(data);
    if (action === "updateInventoryItem")        return updateInventoryItem(data);
    if (action === "updateInventoryThreshold")   return updateInventoryThreshold(data);
    if (action === "addClientNote")              return addClientNote(data);
    if (action === "chargeSquarePayment")        return chargeSquarePayment(data);
    if (action === "addExpense")                 return addExpense(data);
    if (action === "deleteExpense")              return deleteExpense(data);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: "Invalid action" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(error) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── getAllAvailability ───────────────────────────────────────────────────────

function getAllAvailability() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(AVAILABILITY_SHEET);
  var rows  = sheet.getDataRange().getDisplayValues();
  var slots = rows.slice(1)
    .map(function(row) {
      return {
        date:      String(row[0]).trim(),
        time:      String(row[1]).trim(),
        available: String(row[2]).trim().toUpperCase(),
        notes:     row[3] || "",
      };
    })
    .filter(function(slot) { return slot.available === "TRUE"; });
  return ContentService
    .createTextOutput(JSON.stringify({ slots: slots }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── getAvailability (by date) ────────────────────────────────────────────────

function getAvailability(e) {
  var ss         = SpreadsheetApp.openById(SHEET_ID);
  var sheet      = ss.getSheetByName(AVAILABILITY_SHEET);
  var rows       = sheet.getDataRange().getDisplayValues();
  var dateFilter = String(e.parameter.date || "").trim();
  var slots = rows.slice(1)
    .map(function(row) {
      return {
        date:      String(row[0]).trim(),
        time:      String(row[1]).trim(),
        available: String(row[2]).trim().toUpperCase(),
        notes:     row[3] || "",
      };
    })
    .filter(function(slot) {
      return slot.available === "TRUE" && slot.date === dateFilter;
    });
  return ContentService
    .createTextOutput(JSON.stringify({ requestedDate: dateFilter, slots: slots }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── getBookingsByEmail ───────────────────────────────────────────────────────

function getBookingsByEmail(e) {
  var emailFilter = String(e.parameter.email || "").trim().toLowerCase();
  if (!emailFilter) {
    return ContentService
      .createTextOutput(JSON.stringify({ bookings: [] }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  var rows  = sheet.getDataRange().getDisplayValues();
    var bookings = rows
    .slice(1)
    .map(function(row, index) { return { row: row, rowIndex: index + 2 }; })
    .filter(function(entry) {
      return String(entry.row[3]).trim().toLowerCase() === emailFilter;
    })
    .map(function(entry) {
      var row = entry.row;
      return {
        name:               String(row[1]  || "").trim(),
        phone:              String(row[2]  || "").trim(),
        email:              String(row[3]  || "").trim(),
        date:               String(row[4]  || "").trim(),
        time:               String(row[5]  || "").trim(),
        year:               String(row[6]  || "").trim(),
        make:               String(row[7]  || "").trim(),
        model:              String(row[8]  || "").trim(),
        boatSize:           String(row[9]  || "").trim(),
        vehicle:            String(row[10] || "").trim(),
        packageType:        String(row[11] || "").trim(),
        hourlyRate:         String(row[12] || "").trim(),
        addOns:             String(row[13] || "").trim(),
        addOnEstimate:      String(row[14] || "").trim(),
        serviceType:        String(row[15] || "").trim(),
        address:            String(row[16] || "").trim(),
        avgTime:            String(row[24] || "").trim(),
        notes:              String(row[25] || "").trim(),
        clientType:         String(row[26] || "").trim(),
        recurringFrequency: String(row[27] || "").trim(),
        status:             String(row[28] || "").trim(),
        invoiceAmount:      String(row[29] || "").trim(),
        invoiceStatus:      String(row[30] || "").trim(),
        invoiceNote:        String(row[31] || "").trim(),
        photosLink:         String(row[33] || "").trim(),
        beforePhotoUrl:     String(row[34] || "").trim(),
        afterPhotoUrl:      String(row[35] || "").trim(),
        invoiceLink:        String(row[36] || "").trim(),
        smsConsent:          String(row[37] || "").trim(),
                smsMarketingConsent: String(row[38] || "").trim(),
        event:               String(row[40] || "").trim(),
        eligibilityMethod:   String(row[41] || "").trim(),
        eligibilityProofUrl: String(row[42] || "").trim(),
        couponCode:          String(row[43] || "").trim(),
        consentSource:       String(row[44] || "").trim(),
        rowIndex:           entry.rowIndex,
      };
    });
  return ContentService
    .createTextOutput(JSON.stringify({ bookings: bookings }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── getAllBookings (admin) ───────────────────────────────────────────────────

function getAllBookings() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  var rows  = sheet.getDataRange().getDisplayValues();
  var bookings = rows.slice(1)
    .map(function(row, index) {
      return {
        rowIndex:           index + 2,
        name:               String(row[1]  || "").trim(),
        phone:              String(row[2]  || "").trim(),
        email:              String(row[3]  || "").trim(),
        date:               String(row[4]  || "").trim(),
        time:               String(row[5]  || "").trim(),
        year:               String(row[6]  || "").trim(),
        make:               String(row[7]  || "").trim(),
        model:              String(row[8]  || "").trim(),
        boatSize:           String(row[9]  || "").trim(),
        vehicle:            String(row[10] || "").trim(),
        packageType:        String(row[11] || "").trim(),
        hourlyRate:         String(row[12] || "").trim(),
        addOns:             String(row[13] || "").trim(),
        addOnEstimate:      String(row[14] || "").trim(),
        serviceType:        String(row[15] || "").trim(),
        address:            String(row[16] || "").trim(),
        avgTime:            String(row[24] || "").trim(),
        notes:              String(row[25] || "").trim(),
        clientType:         String(row[26] || "").trim(),
        recurringFrequency: String(row[27] || "").trim(),
        status:             String(row[28] || "").trim(),
        invoiceAmount:      String(row[29] || "").trim(),
        invoiceStatus:      String(row[30] || "").trim(),
        invoiceNote:        String(row[31] || "").trim(),
        photosLink:         String(row[33] || "").trim(),
        beforePhotoUrl:     String(row[34] || "").trim(),
        afterPhotoUrl:      String(row[35] || "").trim(),
        invoiceLink:        String(row[36] || "").trim(),
        smsConsent:          String(row[37] || "").trim(),
        smsMarketingConsent: String(row[38] || "").trim(),
        datePaid:            String(row[39] || "").trim(),
        event:               String(row[40] || "").trim(),
        eligibilityMethod:   String(row[41] || "").trim(),
        eligibilityProofUrl: String(row[42] || "").trim(),
        couponCode:          String(row[43] || "").trim(),
        consentSource:       String(row[44] || "").trim(),
      };
    })
    .filter(function(b) { return b.date !== ""; });
  return ContentService
    .createTextOutput(JSON.stringify({ bookings: bookings }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getClientNotes(e) {
  var emailFilter = String(e.parameter.email || "").trim().toLowerCase();
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(CLIENT_NOTES_SHEET);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ notes: [] })).setMimeType(ContentService.MimeType.JSON);
  }
  var rows = sheet.getDataRange().getDisplayValues();
  var notes = rows.slice(1)
    .map(function(row, index) {
      return {
        rowIndex:  index + 2,
        timestamp: String(row[0] || "").trim(),
        email:     String(row[1] || "").trim(),
        noteDate:  String(row[2] || "").trim(),
        note:      String(row[3] || "").trim(),
      };
    })
    .filter(function(n) { return n.email.toLowerCase() === emailFilter && n.note !== ""; })
    .sort(function(a, b) { return b.noteDate.localeCompare(a.noteDate); });
  return ContentService.createTextOutput(JSON.stringify({ notes: notes })).setMimeType(ContentService.MimeType.JSON);
}

function addClientNote(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(CLIENT_NOTES_SHEET);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "ClientNotes sheet not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow([
      new Date(),
      String(data.email    || "").trim(),
      String(data.noteDate || "").trim(),
      String(data.note     || "").trim(),
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}


// ─── Expenses (P&L) ───────────────────────────────────────────────────────────
const EXPENSES_SHEET = "Expenses";

function getExpenses() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(EXPENSES_SHEET);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({ expenses: [] })).setMimeType(ContentService.MimeType.JSON);
  }
  var rows = sheet.getDataRange().getDisplayValues();
  var expenses = rows.slice(1)
    .map(function(row, index) {
      return {
        rowIndex:    index + 2,
        date:        String(row[1] || "").trim(),
        category:    String(row[2] || "").trim(),
        amount:      String(row[3] || "").trim(),
        description: String(row[4] || "").trim(),
        recurring:   String(row[5] || "").trim().toUpperCase() === "TRUE",
        frequency:   String(row[6] || "").trim(),
      };
    })
    .filter(function(e) { return e.date !== "" && e.amount !== ""; });
  return ContentService.createTextOutput(JSON.stringify({ expenses: expenses })).setMimeType(ContentService.MimeType.JSON);
}

function addExpense(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EXPENSES_SHEET);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Expenses sheet not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow([
      new Date(),
      String(data.date        || "").trim(),
      String(data.category    || "").trim(),
      String(data.amount      || "").trim(),
      String(data.description || "").trim(),
      data.recurring ? "TRUE" : "FALSE",
      String(data.frequency   || "").trim(),
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("addExpense error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

function deleteExpense(data) {
  try {
    var row = parseInt(data.rowIndex);
    if (!row || row < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(EXPENSES_SHEET);
    sheet.deleteRow(row);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("deleteExpense error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
// ─── updateBookingFields ─────────────────────────────────────────────────────

function updateBookingFields(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(BOOKINGS_SHEET);
    var row   = parseInt(data.rowIndex);
    if (!row || row < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Invalid row" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Column map by field name (1-based)
    var cols = {
      name: 2, phone: 3, email: 4, date: 5, time: 6,
      year: 7, make: 8, model: 9, boatSize: 10, vehicle: 11,
      packageType: 12, hourlyRate: 13, addOns: 14,
      serviceType: 16, address: 17, notes: 26,
      clientType: 27, recurringFrequency: 28,
      timerHours: 29,
      couponCode: COUPON_CODE_COL,
      smsConsent: 38, smsMarketingConsent: 39,
    };

    var fields = data.fields || {};

    // SMS/marketing consent can only be changed by an admin edit, never a customer
    // self-service one — and doing so always marks the source as "admin" (not a
    // real opt-in signal), since only the client's own booking submission counts
    // as "self".
    var changingConsent = fields.smsConsent !== undefined || fields.smsMarketingConsent !== undefined;
    if (changingConsent && data.editedBy !== "admin") {
      delete fields.smsConsent;
      delete fields.smsMarketingConsent;
      changingConsent = false;
    }

    // Promo event bookings (e.g. LVISD free wash) can't be rescheduled or have
    // their package/service type changed through CUSTOMER self-service edits —
    // enforced here too, not just hidden in the UI, since this endpoint takes raw
    // field writes. Admin edits (editedBy === "admin") are exempt — staff still
    // need to be able to move a teacher between event slots.
    var isEventBooking = String(sheet.getRange(row, EVENT_COL).getValue() || "").trim() !== "";
    if (isEventBooking && data.editedBy !== "admin") {
      ["date", "time", "packageType", "serviceType", "addOns"].forEach(function(key) {
        delete fields[key];
      });
      data.scheduleChanged = false;
    }

    Object.keys(fields).forEach(function(key) {
      if (cols[key] !== undefined) {
        sheet.getRange(row, cols[key]).setValue(fields[key]);
      }
    });

    // Normalize consent to the same "TRUE"/"FALSE" string format bookAppointment
    // uses (regardless of what type the frontend sent), and record who set it.
    if (changingConsent) {
      if (fields.smsConsent !== undefined) {
        sheet.getRange(row, cols.smsConsent).setValue(fields.smsConsent ? "TRUE" : "FALSE");
      }
      if (fields.smsMarketingConsent !== undefined) {
        sheet.getRange(row, cols.smsMarketingConsent).setValue(fields.smsMarketingConsent ? "TRUE" : "FALSE");
      }
      sheet.getRange(row, CONSENT_SOURCE_COL).setValue("admin");
    }

    // ── If date/time changed: update calendar, availability, notify customer ──
    if (data.scheduleChanged) {
      var oldDate    = String(data.oldDate    || "").trim();
      var oldTime    = String(data.oldTime    || "").trim();
      var newDate    = String(fields.date || oldDate).trim();
      var newTime    = String(fields.time || oldTime).trim();
      var custName   = String(data.customerName  || "").trim();
      var custEmail  = String(data.customerEmail || "").trim();
      var custPhone  = String(data.customerPhone || "").trim();
      var vehicle    = String(data.vehicle       || "").trim();
      var pkgType    = String(data.packageType   || "").trim();
      var svcType    = String(data.serviceType   || "").trim();
      var address    = String(data.address       || "").trim();
      var eventLabel       = String(data.eventLabel       || "").trim();
      var eventAddress     = String(data.eventAddress     || "").trim();
      var eventRainPolicy  = String(data.eventRainPolicy  || "").trim();

      // 1. Update availability — unblock old slot, block new slot
      try {
        var availSheet = ss.getSheetByName(AVAILABILITY_SHEET);
        var availRows  = availSheet.getDataRange().getDisplayValues();
        for (var i = 1; i < availRows.length; i++) {
          var rd = String(availRows[i][0]).trim();
          var rt = String(availRows[i][1]).trim();
          if (rd === oldDate && rt === oldTime) availSheet.getRange(i + 1, 3).setValue(true);
          if (rd === newDate && rt === newTime) availSheet.getRange(i + 1, 3).setValue(false);
        }
      } catch (avErr) { Logger.log("Availability update error: " + avErr); }

      // 2. Update Google Calendar — delete old event, create new one
      try {
        var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
        if (calendar && oldDate) {
          var oldParts = oldDate.split("-");
          var oldStart = new Date(parseInt(oldParts[0]), parseInt(oldParts[1]) - 1, parseInt(oldParts[2]), 0, 0, 0);
          var oldEnd   = new Date(parseInt(oldParts[0]), parseInt(oldParts[1]) - 1, parseInt(oldParts[2]), 23, 59, 0);
          var oldEvents = calendar.getEvents(oldStart, oldEnd);
          oldEvents.forEach(function(ev) {
            if (ev.getTitle().indexOf(custName) !== -1) {
              ev.deleteEvent();
              Logger.log("Deleted old calendar event for " + custName + " on " + oldDate);
            }
          });
        }

        if (calendar && newDate) {
          var newParts = newDate.split("-");
          var yr2 = parseInt(newParts[0]);
          var mo2 = parseInt(newParts[1]) - 1;
          var dy2 = parseInt(newParts[2]);
          var startHour2 = 9; var startMin2 = 0;
          if (newTime) {
            var tl = newTime.toLowerCase();
            var tn = newTime.replace(/[^0-9:]/g, "").split(":");
            startHour2 = parseInt(tn[0]) || 9;
            startMin2  = parseInt(tn[1]) || 0;
            if (tl.indexOf("pm") !== -1 && startHour2 !== 12) startHour2 += 12;
            if (tl.indexOf("am") !== -1 && startHour2 === 12) startHour2 = 0;
          }
          var newStart = new Date(yr2, mo2, dy2, startHour2, startMin2, 0);
          var newEnd   = new Date(yr2, mo2, dy2, startHour2 + 3, startMin2, 0);
          var pkgLabel2 = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : pkgType === "lvisdFreeWash" ? "Free Wash (Event)" : "Detail";
          var evTitle = pkgLabel2 + " - " + custName + " (Rescheduled)";
          var evDesc  = "Client: " + custName + "\nVehicle: " + vehicle + "\nPackage: " + pkgLabel2 + "\nService: " + svcType + (address ? "\nAddress: " + address : "");
          calendar.createEvent(evTitle, newStart, newEnd, { description: evDesc, location: address });
          Logger.log("Created new calendar event for " + custName + " on " + newDate);
        }
      } catch (calErr) { Logger.log("Calendar update error: " + calErr); }

      // 3. Send reschedule notification to customer
      try {
        var oldDateLabel = friendlyDate(oldDate);
        var newDateLabel = friendlyDate(newDate);

        if (isEventBooking) {
          // ── Event booking reschedule — warm, event-specific copy ──
          if (custPhone) {
            var smsEventReschedule =
              "Hi " + custName + "! Your free wash has been moved to " +
              newDateLabel + " at " + newTime + ". Drop-off address: " + (eventAddress || "see your confirmation email") +
              ". Please be on time, appointments are back to back. Thank you for being a part of educating our future!";
            sendSMS(custPhone, smsEventReschedule);
          }

          if (custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
            var subjectEvent = (eventLabel || "Free Wash") + " Rescheduled | ATX Prestige Detailing";
            var plainMsgEvent =
              "Hi " + custName + ",\n\n" +
              "Your free wash has been rescheduled.\n\n" +
              "New appointment:\nDate: " + newDateLabel + "\nTime: " + newTime + "\n" +
              "(Previously " + oldDateLabel + " at " + oldTime + ")\n\n" +
              "Drop-off address: " + (eventAddress || "see your original confirmation email") + "\n\n" +
              "Since this is a home address, it works best if someone else drives you and either waits in another car or drops the vehicle and leaves, rather than waiting around at the property.\n\n" +
              "Please be on time, appointments are back to back with limited buffer between them.\n\n" +
              (eventRainPolicy || "If weather forces us to reschedule, we'll reach out directly.") + "\n\n" +
              "Thank you,\nATX Prestige Detailing";
            var htmlMsgEvent =
              "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
              "<div style='margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;color:#222;'>" +
              "<div style='max-width:640px;margin:0 auto;padding:32px 16px;'>" +
              "<div style='background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
              "<div style='background-color:#111;color:#fff;padding:24px 28px;'>" +
              "<div style='font-size:26px;font-weight:700;'>ATX Prestige Detailing</div>" +
              "<div style='font-size:14px;opacity:0.9;margin-top:6px;'>" + (eventLabel || "Free Wash") + " Rescheduled</div>" +
              "</div>" +
              "<div style='padding:28px;'>" +
              "<p style='margin:0 0 16px;font-size:16px;'>Hi " + custName + ",</p>" +
              "<p style='margin:0 0 20px;font-size:15px;color:#444;'>Your free wash has been rescheduled.</p>" +
              "<div style='margin-bottom:20px;'>" +
              "<div style='background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px 16px;margin-bottom:8px;'>" +
              "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;'>Previous Time</div>" +
              "<div style='font-size:15px;font-weight:700;color:#991b1b;text-decoration:line-through;'>" + oldDateLabel + " at " + oldTime + "</div>" +
              "</div>" +
              "<div style='background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;padding:14px 16px;'>" +
              "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;'>New Time</div>" +
              "<div style='font-size:18px;font-weight:800;color:#065f46;'>" + newDateLabel + "</div>" +
              "<div style='font-size:15px;color:#047857;margin-top:4px;'>" + newTime + "</div>" +
              "</div></div>" +
              "<div style='background:#f9f9f9;border:1px solid #e8e8e8;border-radius:12px;padding:16px 20px;margin-bottom:20px;'>" +
              "<table style='width:100%;border-collapse:collapse;font-size:14px;color:#333;'>" +
              "<tr><td style='padding:6px 0;font-weight:600;width:140px;'>Drop-off Address:</td><td style='padding:6px 0;'>" + (eventAddress || "See your original confirmation email") + "</td></tr>" +
              "</table></div>" +
              "<div style='background:#fff8e8;border:1px solid #f0dfae;border-radius:12px;padding:16px 18px;margin-bottom:16px;'>" +
              "<div style='font-size:14px;color:#5a4a1f;'>Since this is a home address, it works best if someone else drives you and either waits in another car or drops the vehicle and leaves, rather than waiting around at the property.</div>" +
              "</div>" +
              "<div style='background:#fff8e8;border:1px solid #f0dfae;border-radius:12px;padding:16px 18px;margin-bottom:16px;'>" +
              "<div style='font-size:14px;color:#5a4a1f;'>Please be on time, appointments are back to back with limited buffer between them.</div>" +
              "</div>" +
              "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:20px;'>" +
              "<div style='font-size:14px;color:#374151;'>" + (eventRainPolicy || "If weather forces us to reschedule, we'll reach out directly.") + "</div>" +
              "</div>" +
              "<p style='margin:0;font-size:15px;color:#444;'>Thank you,<br><strong>ATX Prestige Detailing</strong></p>" +
              "</div></div></div></div></body></html>";
            GmailApp.sendEmail(custEmail, subjectEvent, plainMsgEvent, {
              from: "atxprestigedetailing@gmail.com",
              name: "ATX Prestige Detailing",
              htmlBody: htmlMsgEvent,
              charset: "UTF-8",
            });
            Logger.log("Event reschedule email sent to " + custEmail);
          }
        } else {
          // ── Standard paid-booking reschedule ──
          if (custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
            var pkgLabelEmail = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : (pkgType || "Detail");
            var subject3 = "Appointment Rescheduled | ATX Prestige Detailing";
            var plainMsg =
              "Hi " + custName + ",\n\nYour appointment has been rescheduled.\n\n" +
              "Service: " + pkgLabelEmail + "\nVehicle: " + vehicle + "\n\n" +
              "Original: " + oldDateLabel + " at " + oldTime + "\nNew Date: " + newDateLabel + " at " + newTime + "\n\n" +
              "If you have any questions, please contact us.\n\nThank you,\nATX Prestige Detailing\nbook.atxprestigedetailing.com";
            var htmlMsg =
              "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
              "<div style='max-width:600px;margin:0 auto;padding:32px 16px;font-family:Arial,sans-serif;'>" +
              "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:24px 32px;'>" +
              "<div style='font-size:20px;font-weight:800;color:#fff;'>ATX Prestige Detailing</div>" +
              "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;'>Appointment Rescheduled</div>" +
              "</div>" +
              "<div style='background:#fff;padding:32px;border:1px solid #e5e7eb;'>" +
              "<p style='font-size:15px;color:#374151;margin:0 0 20px;'>Hi " + custName + ",</p>" +
              "<p style='font-size:15px;color:#374151;margin:0 0 24px;'>Your appointment has been rescheduled. Here are your updated details:</p>" +
              "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:20px;'>" +
              "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;'>Service Details</div>" +
              "<table style='width:100%;border-collapse:collapse;font-size:14px;'>" +
              "<tr><td style='padding:5px 0;color:#6b7280;width:120px;'>Service</td><td style='padding:5px 0;font-weight:600;color:#111;'>" + pkgLabelEmail + "</td></tr>" +
              "<tr style='border-top:1px solid #f3f4f6;'><td style='padding:5px 0;color:#6b7280;'>Vehicle</td><td style='padding:5px 0;font-weight:600;color:#111;'>" + vehicle + "</td></tr>" +
              (address ? "<tr style='border-top:1px solid #f3f4f6;'><td style='padding:5px 0;color:#6b7280;'>Location</td><td style='padding:5px 0;font-weight:600;color:#111;'>" + address + "</td></tr>" : "") +
              "</table></div>" +
              "<div style='margin-bottom:24px;'>" +
              "<div style='background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:14px 16px;margin-bottom:8px;'>" +
              "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;'>Original Appointment</div>" +
              "<div style='font-size:15px;font-weight:700;color:#991b1b;text-decoration:line-through;'>" + oldDateLabel + " at " + oldTime + "</div>" +
              "</div>" +
              "<div style='background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;padding:14px 16px;'>" +
              "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;'>New Appointment</div>" +
              "<div style='font-size:18px;font-weight:800;color:#065f46;'>" + newDateLabel + "</div>" +
              "<div style='font-size:15px;color:#047857;margin-top:4px;'>" + newTime + "</div>" +
              "</div></div>" +
              "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;'>View My Bookings</a>" +
              "</div>" +
              "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;'>" +
              "<p style='margin:0;font-size:11px;color:#9ca3af;'>ATX Prestige Detailing | Lago Vista, TX | atxprestigedetailing.com</p>" +
              "</div></div></body></html>";
            GmailApp.sendEmail(custEmail, subject3, plainMsg, {
              from: "atxprestigedetailing@gmail.com",
              name: "ATX Prestige Detailing",
              htmlBody: htmlMsg,
              charset: "UTF-8",
            });
            Logger.log("Reschedule email sent to " + custEmail);
          }

          if (custPhone) {
            var smsReschedule = "Hi " + custName + "! Your ATX Prestige Detailing appointment has been updated to " + newDateLabel + " at " + newTime + ". See you then!";
            sendSMS(custPhone, smsReschedule);
          }
        }
      } catch (notifyErr) { Logger.log("Reschedule notification error: " + notifyErr); }
    }

    // ── If non-schedule fields changed: send booking change email ──
    if (data.hasDetailChanges && !data.scheduleChanged) {
      try {
        var changeDetails = [];
        try { changeDetails = JSON.parse(data.changeDetails || "[]"); } catch(e) { changeDetails = []; }
        if (changeDetails.length > 0) {
          sendBookingChangeEmail({
            customerName:  String(data.customerName  || "").trim(),
            customerEmail: String(data.customerEmail || "").trim(),
            customerPhone: String(data.customerPhone || "").trim(),
            serviceDate:   String(data.serviceDate   || data.oldDate || "").trim(),
            vehicle:       String(data.vehicle       || "").trim(),
            changeDetails: changeDetails,
          });
if (data.editedBy === "client" && changeDetails.length > 0) {
  try {
    var adminChangeLines = changeDetails.map(function(c) { return c.field + ": " + c.from + " → " + c.to; }).join("\n");
    GmailApp.sendEmail(
      "atxprestigedetailing@gmail.com",
      "Client Updated Their Booking - " + (data.customerName || "") + " | ATX Prestige Detailing",
      "A client made changes to their own booking.\n\n" +
      "Client: " + (data.customerName || "") + "\n" +
      "Email: " + (data.customerEmail || "") + "\n" +
      "Service Date: " + (data.serviceDate || data.oldDate || "") + "\n\n" +
      "Changes:\n" + adminChangeLines,
      { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" }
    );
  } catch (adminNotifyErr) { Logger.log("Admin change notify error: " + adminNotifyErr); }
}

        }
      } catch (changeErr) { Logger.log("Booking change email error: " + changeErr); }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateBookingFields error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function chargeSquarePayment(data) {
  try {
    var row = parseInt(data.rowIndex);
    if (!row || row < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Invalid row" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var accessToken = PropertiesService.getScriptProperties().getProperty("SQUARE_ACCESS_TOKEN");
    if (!accessToken) {
      Logger.log("chargeSquarePayment error: SQUARE_ACCESS_TOKEN script property is not set");
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Payments are not configured yet. Please contact us to pay another way." }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var amount = parseFloat(data.amount || "0");
    if (!amount || amount <= 0) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Invalid amount" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var paymentPayload = {
      source_id: data.sourceId,
      idempotency_key: Utilities.getUuid(),
      amount_money: {
        amount: Math.round(amount * 100), // Square expects the amount in cents
        currency: "USD",
      },
      location_id: SQUARE_LOCATION_ID,
    };

    var response = UrlFetchApp.fetch(SQUARE_API_BASE + "/v2/payments", {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify(paymentPayload),
      muteHttpExceptions: true,
    });

    var result = JSON.parse(response.getContentText());
    var payment = result.payment;

    if (response.getResponseCode() === 200 && payment && (payment.status === "COMPLETED" || payment.status === "APPROVED")) {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(BOOKINGS_SHEET);
      sheet.getRange(row, 31).setValue("paid"); // AE — invoiceStatus

      data.invoiceAmount = amount;
      sendPaymentConfirmedEmail(data);

      Logger.log("Square payment completed for row " + row + ": " + payment.id);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, paymentId: payment.id }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var errMsg = (result.errors && result.errors[0] && (result.errors[0].detail || result.errors[0].code)) || "Payment was declined. Please try a different card.";
    Logger.log("chargeSquarePayment declined for row " + row + ": " + JSON.stringify(result));
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: errMsg }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("chargeSquarePayment error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: "Something went wrong processing your payment. Please try again." }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
// ─── sendBookingChangeEmail ───────────────────────────────────────────────────

function sendBookingChangeEmail(data) {
  try {
    var custName    = String(data.customerName  || "there").trim();
    var custEmail   = String(data.customerEmail || "").trim();
    var custPhone   = String(data.customerPhone || "").trim();
    var serviceDate = String(data.serviceDate   || "").trim();
    var vehicle     = String(data.vehicle       || "").trim();
    var changes     = data.changeDetails || [];

    if (!custEmail || !changes.length) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) return;

    var serviceDateLabel = serviceDate;
    if (serviceDate && serviceDate.indexOf("-") !== -1) {
      var sdp = serviceDate.split("-").map(Number);
      serviceDateLabel = new Date(sdp[0], sdp[1] - 1, sdp[2]).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      });
    }

    var subject = "Your Booking Has Been Updated | ATX Prestige Detailing";

    // ── Plain text ──
    var changeLines = changes.map(function(c) {
      return c.field + ": " + c.from + " → " + c.to;
    }).join("\n");

    var plain =
      "Hi " + custName + ",\n\n" +
      "Your booking for " + serviceDateLabel + " has been updated. Here's a summary of what changed:\n\n" +
      changeLines + "\n\n" +
      "If any of these changes don't look right or weren't what you expected, please don't hesitate to reach out to us right away and we'll get it sorted out.\n\n" +
      "You can view your full booking details at any time:\nhttps://book.atxprestigedetailing.com\n\n" +
      "Thank you,\nATX Prestige Detailing\natxprestigedetailing.com";

    // ── HTML email ──
    var changeRowsHtml = changes.map(function(c) {
      return (
        "<tr style='border-top:1px solid #f3f4f6;'>" +
        "<td style='padding:10px 0;color:#6b7280;font-size:13px;width:120px;vertical-align:top;'>" + c.field + "</td>" +
        "<td style='padding:10px 0;font-size:13px;'>" +
          "<span style='background:#fef2f2;color:#991b1b;border-radius:4px;padding:2px 7px;font-size:12px;text-decoration:line-through;'>" + c.from + "</span>" +
          "<span style='color:#9ca3af;margin:0 8px;font-size:13px;'>→</span>" +
          "<span style='background:#f0fdf4;color:#065f46;border-radius:4px;padding:2px 7px;font-size:12px;font-weight:700;'>" + c.to + "</span>" +
        "</td>" +
        "</tr>"
      );
    }).join("");

    var vehicleRow = vehicle ? "<tr><td style='padding:10px 0;color:#6b7280;font-size:13px;width:120px;'>Vehicle</td><td style='padding:10px 0;font-weight:600;color:#111;font-size:13px;'>" + vehicle + "</td></tr>" : "";
    var dateRow    = serviceDateLabel ? "<tr style='border-top:1px solid #f3f4f6;'><td style='padding:10px 0;color:#6b7280;font-size:13px;width:120px;'>Service Date</td><td style='padding:10px 0;font-weight:600;color:#111;font-size:13px;'>" + serviceDateLabel + "</td></tr>" : "";

    var html =
      "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
      "<div style='max-width:600px;margin:0 auto;padding:32px 16px;font-family:Arial,sans-serif;background:#f5f4f2;'>" +

      // Header
      "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:24px 32px;'>" +
      "<div style='font-size:20px;font-weight:800;color:#fff;'>ATX Prestige Detailing</div>" +
      "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;'>Booking Updated</div>" +
      "</div>" +

      // Body
      "<div style='background:#fff;padding:32px;border:1px solid #e5e7eb;'>" +
      "<p style='margin:0 0 20px;font-size:15px;color:#374151;'>Hi " + custName + ",</p>" +
      "<p style='margin:0 0 24px;font-size:15px;color:#374151;'>Your booking has been updated. Here's a summary of what changed:</p>" +

      // Booking context
      "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 20px;margin-bottom:20px;'>" +
      "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;'>Booking Info</div>" +
      "<table style='width:100%;border-collapse:collapse;'>" +
      vehicleRow + dateRow +
      "</table></div>" +

      // Changes table
      "<div style='background:#fff;border:1.5px solid #e0e7ff;border-radius:12px;padding:16px 20px;margin-bottom:24px;'>" +
      "<div style='font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:10px;'>What Changed</div>" +
      "<table style='width:100%;border-collapse:collapse;'>" +
      changeRowsHtml +
      "</table></div>" +

      // Disclaimer
      "<div style='background:#fffbeb;border:1px solid #fcd34d;border-radius:12px;padding:14px 18px;margin-bottom:24px;'>" +
      "<div style='font-size:13px;color:#92400e;line-height:1.6;'>" +
      "<strong>Something look off?</strong> If any of these changes don't look right or weren't what you expected, please reach out to us right away and we'll get it sorted out." +
      "</div></div>" +

      // CTA
      "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:24px;'>View My Bookings</a>" +

      "<hr style='border:none;border-top:1px solid #f0ede8;margin-bottom:20px;'>" +
      "<p style='margin:0;font-size:12px;color:#9ca3af;'>ATX Prestige Detailing &nbsp;|&nbsp; Lago Vista, TX &nbsp;|&nbsp; <a href='https://atxprestigedetailing.com' style='color:#9ca3af;'>atxprestigedetailing.com</a></p>" +
      "</div>" +

      // Footer
      "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;'>" +
      "<p style='margin:0;font-size:11px;color:#bbb;'>This is an automated notification from ATX Prestige Detailing.</p>" +
      "</div></div></body></html>";

    GmailApp.sendEmail(custEmail, subject, plain, {
      from: "atxprestigedetailing@gmail.com",
      name: "ATX Prestige Detailing",
      htmlBody: html,
      charset: "UTF-8",
    });

    // SMS: brief change notification
    if (custPhone) {
      var smsMsg = "Hi " + custName + "! Your ATX Prestige Detailing booking has been updated. View details at book.atxprestigedetailing.com. If anything looks off, please reach out!";
      sendSMS(custPhone, smsMsg);
    }

    Logger.log("Booking change email sent to " + custEmail);
  } catch (err) {
    Logger.log("sendBookingChangeEmail error: " + err);
  }
}

// ─── createNextMaintenanceBooking ────────────────────────────────────────────

// Appends a maintenance booking row for dateStr, unless one already exists
// (matched by email + date + vehicle type + make + model). Shared by
// createNextMaintenanceBooking and resumeMaintenancePlan so both create the
// next occurrence the same way.
function appendMaintenanceRow(data, dateStr) {
  var ss            = SpreadsheetApp.openById(SHEET_ID);
  var bookingsSheet = ss.getSheetByName(BOOKINGS_SHEET);

  var rows = bookingsSheet.getDataRange().getDisplayValues();
  for (var i = 1; i < rows.length; i++) {
    var rowEmail   = String(rows[i][3]).trim().toLowerCase();
    var rowDate    = String(rows[i][4]).trim();
    var rowVehicle = String(rows[i][10]).trim().toLowerCase();
    var rowMake    = String(rows[i][7]).trim().toLowerCase();
    var rowModel   = String(rows[i][8]).trim().toLowerCase();
    var rowStatus  = String(rows[i][28]).trim();
    var incomingVehicle = String(data.vehicle || "").trim().toLowerCase();
    var incomingMake    = String(data.make    || "").trim().toLowerCase();
    var incomingModel   = String(data.model   || "").trim().toLowerCase();
    // Match on email + date + vehicle type + make + model to allow same client with different cars
    var sameEmail   = rowEmail === String(data.email || "").trim().toLowerCase();
    var sameDate    = rowDate  === dateStr;
    var sameCar     = rowVehicle === incomingVehicle && rowMake === incomingMake && rowModel === incomingModel;
    var notCancelled = rowStatus !== "Cancelled" && rowStatus !== "Skipped";
    if (sameEmail && sameDate && sameCar && notCancelled) {
      return { skipped: true };
    }
  }

  bookingsSheet.appendRow([
    new Date(),
    data.name              || "",
    data.phone             || "",
    data.email             || "",
    dateStr,
    data.time              || "",
    data.year              || "",
    data.make              || "",
    data.model             || "",
    data.boatSize          || "",
    data.vehicle           || "",
    data.packageType       || "",
    data.hourlyRate        || "",
    data.addOns            || "",
    data.addOnEstimate     || "",
    data.serviceType       || "",
    data.address           || "",
    data.street            || "",
    data.city              || "",
    data.state             || "",
    data.zip               || "",
    data.placeId           || "",
    data.lat               || "",
    data.lng               || "",
    data.avgTime           || "",
    data.notes             || "",
    data.clientType        || "maintenance",
    data.recurringFrequency || "",
    "Booked",
    "",
    "",
    "",
  ]);

  return { skipped: false };
}

function createNextMaintenanceBooking(data) {
  try {
    var nextDate = String(data.date || "").trim();

    if (!nextDate) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "No date" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = appendMaintenanceRow(data, nextDate);
    if (result.skipped) {
      Logger.log("Next booking already exists for " + data.email + " on " + nextDate + " (" + data.make + " " + data.model + ")");
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, skipped: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log("Created next maintenance booking for " + data.email + " on " + nextDate);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("createNextMaintenanceBooking error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── updateBooking (admin) ────────────────────────────────────────────────────

function updateBooking(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(BOOKINGS_SHEET);
    var row   = parseInt(data.rowIndex);
    if (!row || row < 2) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "Invalid row" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    if (data.status        !== undefined) sheet.getRange(row, 29).setValue(data.status);
    if (data.invoiceAmount !== undefined) sheet.getRange(row, 30).setValue(data.invoiceAmount);
    if (data.invoiceStatus !== undefined) sheet.getRange(row, 31).setValue(data.invoiceStatus);
    if (data.invoiceNote   !== undefined) sheet.getRange(row, 32).setValue(data.invoiceNote);
    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateBooking error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── sendInvoiceEmail ────────────────────────────────────────────────────────

function sendInvoiceEmail(data) {
  try {
    var customerName  = data.customerName  || "there";
    var customerEmail = data.customerEmail || "";
    var amount        = data.invoiceAmount || "";
    var note          = data.invoiceNote   || "";
    var today = new Date();
    var serviceDate = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

    if (!customerEmail) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "No email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var subject = "You have a balance due | ATX Prestige Detailing";
    var amountNum   = parseFloat(amount) || 0;
    var squareTotal = (amountNum * 1.04).toFixed(2);

    var noteText = note ? "\nNote: " + note : "";
    var plainBody =
      "Hi " + customerName + ",\n\n" +
      "Your service has been completed. You have a balance due.\n\n" +
      "Service Date: " + serviceDate + "\n" +
      "Amount Due: $" + amount + " (Venmo/Cash App) | $" + squareTotal + " (Square/Card with 4% fee)" + noteText + "\n\n" +
      "Payment Options:\n\n" +
      "Venmo (no fee): https://venmo.com/u/emilio512\n" +
      "Cash App (no fee): https://cash.app/$Emiliofive12\n" +
      "Credit/Debit Card ($" + squareTotal + " with 4% fee): https://square.link/u/MOC2bNam\n\n" +
      "You can view your invoice in the booking app:\nhttps://book.atxprestigedetailing.com\n\n" +
      "Thank you,\nATX Prestige Detailing";

    var noteHtml = note ? "<div style='font-size:13px;color:#b45309;margin-top:6px;'>" + note + "</div>" : "";

    var headerHtml =
      "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
      "<div style='margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;color:#222;'>" +
      "<div style='max-width:640px;margin:0 auto;padding:32px 16px;'>" +
      "<div style='background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
      "<div style='background-color:#111;color:#fff;padding:24px 28px;'>" +
      "<div style='font-size:26px;font-weight:700;'>ATX Prestige Detailing</div>" +
      "<div style='font-size:14px;opacity:0.9;margin-top:6px;'>Balance Due</div>" +
      "</div>";

    var greetHtml =
      "<div style='padding:28px;'>" +
      "<p style='margin:0 0 16px;font-size:16px;'>Hi " + customerName + ",</p>" +
      "<p style='margin:0 0 20px;font-size:15px;color:#444;'>Your detail service has been completed. You have a balance due.</p>";

    var amountHtml =
      "<div style='background:#fefce8;border:2px solid #fde047;border-radius:12px;padding:20px;margin-bottom:24px;text-align:center;'>" +
      "<div style='font-size:14px;color:#92400e;margin-bottom:10px;'>Amount Due</div>" +
      "<div style='display:inline-flex;gap:24px;align-items:flex-end;margin-bottom:6px;'>" +
      "<div><div style='font-size:11px;color:#b45309;margin-bottom:2px;'>Venmo / Cash App</div>" +
      "<div style='font-size:2rem;font-weight:800;color:#92400e;'>$" + amount + "</div>" +
      "<div style='font-size:11px;color:#9ca3af;'>No fee</div></div>" +
      "<div style='color:#d1d5db;font-size:1.4rem;padding-bottom:8px;'>|</div>" +
      "<div><div style='font-size:11px;color:#b45309;margin-bottom:2px;'>Square / Card</div>" +
      "<div style='font-size:2rem;font-weight:800;color:#92400e;'>$" + squareTotal + "</div>" +
      "<div style='font-size:11px;color:#9ca3af;'>Includes 4% fee</div></div>" +
      "</div>" +
      noteHtml +
      "<div style='font-size:12px;color:#9ca3af;margin-top:6px;'>Service date: " + serviceDate + "</div>" +
      "</div>";

    var venmoBtn  = "<a href='https://venmo.com/u/emilio512' style='display:inline-block;background:#008CFF;color:#fff;border-radius:8px;padding:10px 18px;text-decoration:none;font-weight:700;font-size:14px;'>Pay with Venmo</a>";
    var cashBtn   = "<a href='https://cash.app/$Emiliofive12' style='display:inline-block;background:#00C244;color:#fff;border-radius:8px;padding:10px 18px;text-decoration:none;font-weight:700;font-size:14px;'>Pay with Cash App</a>";
    var squareBtn = "<a href='https://square.link/u/MOC2bNam' style='display:inline-block;background:#111827;color:#fff;border-radius:8px;padding:10px 18px;text-decoration:none;font-weight:700;font-size:14px;'>Pay by Card (Square)</a>";

    var paymentHtml =
      "<div style='font-size:16px;font-weight:700;color:#111827;margin-bottom:14px;'>Payment Options</div>" +
      "<table style='width:100%;border-collapse:collapse;margin-bottom:20px;'>" +
      "<tr><td style='padding:6px 0;'>" + venmoBtn  + "</td><td style='padding:6px 0;font-size:13px;color:#6b7280;'>$" + amount      + " &mdash; No fee</td></tr>" +
      "<tr><td style='padding:6px 0;'>" + cashBtn   + "</td><td style='padding:6px 0;font-size:13px;color:#6b7280;'>$" + amount      + " &mdash; No fee</td></tr>" +
      "<tr><td style='padding:6px 0;'>" + squareBtn + "</td><td style='padding:6px 0;font-size:13px;color:#6b7280;'>$" + squareTotal + " &mdash; Includes 4% fee</td></tr>" +
      "</table>";

    var appLink  = "<a href='https://book.atxprestigedetailing.com' style='color:#111;font-weight:600;'>booking app</a>";
    var siteLink = "<a href='https://atxprestigedetailing.com' style='color:#111;text-decoration:none;font-weight:500;'>Visit Our Website</a>";

    var instructHtml =
      "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:20px;font-size:13px;color:#374151;'>" +
      "To pay by card, enter <strong>$" + squareTotal + "</strong> on the Square payment page (includes 4% fee). " +
      "You can also view and manage your invoice in the " + appLink + "." +
      "</div>";

    var signoffHtml =
      "<p style='margin:0;font-size:15px;color:#444;'>" +
      "Thank you,<br><strong>ATX Prestige Detailing</strong><br>" +
      siteLink +
      "</p></div></div></div></div></body></html>";

    var htmlBody = headerHtml + greetHtml + amountHtml + paymentHtml + instructHtml + signoffHtml;

    GmailApp.sendEmail(customerEmail, subject, plainBody, {
      from: "atxprestigedetailing@gmail.com",
      name: "ATX Prestige Detailing",
      htmlBody: htmlBody,
      charset: "UTF-8",
    });

    var customerPhoneInv = data.customerPhone || "";
    if (customerPhoneInv) {
      var amtNum2 = parseFloat(amount) || 0;
      var squareAmt = (amtNum2 * 1.04).toFixed(2);
var smsInvoice = "Hi " + customerName + "! Your ATX Prestige Detailing service is complete. Balance due: $" + amtNum2.toFixed(2) + ".\n\nPay now:\nVenmo (no fee): https://venmo.com/u/emilio512\nCash App (no fee): https://cash.app/$Emiliofive12\nCard via Square ($" + squareAmt + " with 4% fee): https://square.link/u/MOC2bNam\n\nQuestions? book.atxprestigedetailing.com";
      sendSMS(customerPhoneInv, smsInvoice);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("sendInvoiceEmail error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── sendPaymentConfirmedEmail ───────────────────────────────────────────────

function sendPaymentConfirmedEmail(data) {
  try {
    var customerName   = data.customerName   || "there";
    var customerEmail  = data.customerEmail  || "";
    var customerPhone  = data.customerPhone  || "";
    var amount         = parseFloat(data.invoiceAmount || "0");
    var rawServiceDate = data.serviceDate    || "";
    var packageType    = data.packageType    || "";
    var vehicle        = data.vehicle        || "";
    var hourlyRate     = data.hourlyRate     || "";
    var addOns         = data.addOns         || "";
    var invoiceNote    = data.invoiceNote    || "";
    var rowIndex       = parseInt(data.rowIndex || "0");
    var photosLink     = data.photosLink     || "";
    var beforePhotoUrl = data.beforePhotoUrl || "";
    var afterPhotoUrl  = data.afterPhotoUrl  || "";
    var REVIEW_LINK    = "https://maps.app.goo.gl/5t4AFjuzbFoT9ujq8";

    if (!customerEmail) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "No email" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var serviceDateLabel = rawServiceDate;
    if (rawServiceDate && rawServiceDate.indexOf("-") !== -1) {
      var sdParts = rawServiceDate.split("-").map(Number);
      serviceDateLabel = new Date(sdParts[0], sdParts[1] - 1, sdParts[2]).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric", year: "numeric"
      });
    }

    var today2 = new Date();
    var paymentDate = today2.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
    var invoiceNumber = "INV-" + String(Date.now()).slice(-6);

    if (rowIndex && rowIndex >= 2) {
      try {
        var ss2 = SpreadsheetApp.openById(SHEET_ID);
        var sheet2 = ss2.getSheetByName(BOOKINGS_SHEET);
        sheet2.getRange(rowIndex, 33).setValue(invoiceNumber);
        sheet2.getRange(rowIndex, 40).setValue(new Date());
      } catch (sheetErr) { Logger.log("Invoice number save error: " + sheetErr); }
    }

    var subject = "Payment Receipt — ATX Prestige Detailing";

    var plainBody =
      "Hi " + customerName + ",\n\n" +
      "Thank you! Your payment of $" + amount.toFixed(2) + " has been received.\n\n" +
      "RECEIPT\n" +
      "Invoice: " + invoiceNumber + "\n" +
      "Service Date: " + serviceDateLabel + "\n" +
      "Payment Date: " + paymentDate + "\n" +
      "Amount Paid: $" + amount.toFixed(2) + "\n\n" +
      "Your balance is cleared. We appreciate your business!\n\n" +
"Loved your detail? We'd really appreciate a quick review — it helps other Austin-area drivers find us:\n" +
REVIEW_LINK + "\n\n" +
"If anything about your service wasn't up to your standards or something was missed, please reach out right away. We back every job with a 100% Satisfaction Guarantee and will make it right.\n\n" +
"ATX Prestige Detailing\natxprestigedetailing.com";

    var html =
      "<!DOCTYPE html><html><head><meta charset='UTF-8'>" +
      "<style>body{margin:0;padding:0;background:#f5f4f2;font-family:Arial,sans-serif;}</style>" +
      "</head><body>" +
      "<div style='max-width:600px;margin:0 auto;padding:32px 16px;'>" +
      "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:28px 32px;'>" +
      "<div style='font-size:22px;font-weight:800;color:#fff;letter-spacing:-0.5px;'>ATX Prestige Detailing</div>" +
      "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;font-style:italic;'>Defined by Detail, Driven by Standards</div>" +
      "</div>" +
      "<div style='background:#dcfce7;border-left:4px solid #16a34a;padding:18px 32px;'>" +
      "<div style='display:flex;align-items:center;gap:12px;'>" +
      "<div style='width:32px;height:32px;background:#16a34a;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;'>" +
      "<span style='color:#fff;font-size:18px;font-weight:700;'>&#10003;</span>" +
      "</div>" +
      "<div>" +
      "<div style='font-size:16px;font-weight:800;color:#166534;'>Payment Received</div>" +
      "<div style='font-size:13px;color:#166534;margin-top:2px;'>Paid on " + paymentDate + "</div>" +
      "</div></div></div>" +
      "<div style='background:#fff;padding:32px;'>" +
      "<p style='margin:0 0 24px;font-size:15px;color:#374151;'>Hi " + customerName + ", thank you for your payment. Here is your receipt.</p>" +
      "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;'>" +
      "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:14px;'>Receipt Details</div>" +
      "<table style='width:100%;border-collapse:collapse;font-size:14px;'>" +
      "<tr><td style='padding:7px 0;color:#6b7280;'>Invoice #</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + invoiceNumber + "</td></tr>" +
      "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Service Date</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + serviceDateLabel + "</td></tr>" +
      "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Payment Date</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + paymentDate + "</td></tr>" +
      "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Customer</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + customerName + "</td></tr>" +
      (vehicle ? "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Vehicle</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + vehicle + "</td></tr>" : "") +
      (packageType ? "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Service</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + packageType + "</td></tr>" : "") +
      (hourlyRate ? "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Rate</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>$" + hourlyRate + "/hr</td></tr>" : "") +
      (addOns && addOns !== "None" && addOns !== "" ? "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Add-Ons</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + addOns + "</td></tr>" : "") +
      (invoiceNote ? "<tr style='border-top:1px solid #f0f0f0;'><td style='padding:7px 0;color:#6b7280;'>Note</td><td style='padding:7px 0;font-weight:600;color:#111;text-align:right;'>" + invoiceNote + "</td></tr>" : "") +
      "<tr style='border-top:2px solid #e5e7eb;'><td style='padding:10px 0;font-weight:700;color:#111;font-size:15px;'>Amount Paid</td><td style='padding:10px 0;font-weight:900;color:#0f0f0f;font-size:18px;text-align:right;'>$" + amount.toFixed(2) + "</td></tr>" +
      "<tr><td colspan='2' style='padding:4px 0;text-align:right;'><span style='background:#dcfce7;color:#166534;font-size:11px;font-weight:700;border-radius:999px;padding:2px 10px;'>PAID IN FULL</span></td></tr>" +
      "</table></div>" +
      "<p style='margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;'>Your balance is now fully cleared. We appreciate your business and look forward to serving you again.</p>" +
      "<div style='background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:18px 20px;margin-bottom:20px;'>" +
"<div style='font-size:14px;font-weight:700;color:#92400e;margin-bottom:8px;'>Enjoyed your detail?</div>" +
"<div style='font-size:13px;color:#78350f;line-height:1.6;margin-bottom:12px;'>We'd really appreciate a quick review — it means a lot to us and helps other Austin-area drivers find us.</div>" +
"<a href='" + REVIEW_LINK + "' style='display:inline-block;background:#f59e0b;color:#fff;border-radius:8px;padding:9px 18px;font-size:13px;font-weight:700;text-decoration:none;'>Leave a Google Review</a>" +
"</div>" +
"<div style='background:#f0fdf4;border:1px solid #6ee7b7;border-radius:12px;padding:18px 20px;margin-bottom:20px;'>" +
"<div style='font-size:14px;font-weight:700;color:#065f46;margin-bottom:8px;'>100% Satisfaction Guarantee</div>" +
"<div style='font-size:13px;color:#166534;line-height:1.6;'>If anything about your service wasn't up to your standards, or something was missed, please reach out right away — we'll make it right.</div>" +
"</div>" +
      "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;margin-bottom:24px;'>View My Bookings</a>" +
      "<hr style='border:none;border-top:1px solid #f0ede8;margin-bottom:20px;'>" +
      "<p style='margin:0;font-size:12px;color:#9ca3af;line-height:1.6;'>ATX Prestige Detailing &nbsp;|&nbsp; Lago Vista, TX &nbsp;|&nbsp; <a href='https://atxprestigedetailing.com' style='color:#9ca3af;'>atxprestigedetailing.com</a></p>" +
      "</div>" +
      "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:16px 32px;text-align:center;'>" +
      "<p style='margin:0;font-size:11px;color:#bbb;'>This is an automated receipt. Please save for your records.</p>" +
      "</div></div></body></html>";

    var photosSection = "";
    if (beforePhotoUrl || afterPhotoUrl) {
      photosSection =
        "<div style='margin-bottom:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px;'>" +
        "<div style='font-size:14px;font-weight:800;color:#0369a1;margin-bottom:16px;'>Your Before &amp; After Photos</div>" +
        "<table style='width:100%;border-collapse:collapse;'><tr>" +
        "<td style='width:50%;padding-right:8px;vertical-align:top;'>" +
        "<div style='font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;'>BEFORE</div>" +
        (beforePhotoUrl
          ? beforePhotoUrl.split(",").map(function(url) { return "<img src='" + url.trim() + "' style='width:100%;border-radius:8px;border:2px solid #e5e7eb;display:block;margin-bottom:6px;' alt='Before' />"; }).join("")
          : "<div style='background:#f3f4f6;border-radius:10px;border:2px dashed #d1d5db;padding:20px;text-align:center;'><span style='color:#9ca3af;font-size:12px;'>No photo</span></div>") +
        "</td>" +
        "<td style='width:50%;padding-left:8px;vertical-align:top;'>" +
        "<div style='font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;'>AFTER</div>" +
        (afterPhotoUrl
          ? afterPhotoUrl.split(",").map(function(url) { return "<img src='" + url.trim() + "' style='width:100%;border-radius:8px;border:2px solid #059669;display:block;margin-bottom:6px;' alt='After' />"; }).join("")
          : "<div style='background:#f3f4f6;border-radius:10px;border:2px dashed #d1d5db;padding:20px;text-align:center;'><span style='color:#9ca3af;font-size:12px;'>No photo</span></div>") +
        "</td></tr></table>" +
        (photosLink ? "<div style='margin-top:14px;'><a href='" + photosLink + "' style='display:inline-block;background:#0369a1;color:#fff;border-radius:8px;padding:9px 16px;font-size:13px;font-weight:700;text-decoration:none;'>View Full Size on Google Drive</a></div>" : "") +
        "</div>";
    } else if (photosLink) {
      photosSection = "<div style='margin-bottom:24px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:16px 20px;'><div style='font-size:13px;font-weight:700;color:#0369a1;margin-bottom:6px;'>Before &amp; After Photos</div><a href='" + photosLink + "' style='display:inline-block;background:#0369a1;color:#fff;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:700;text-decoration:none;'>View Photos on Google Drive</a></div>";
    }

    var htmlEmail = html.replace(
      "<hr style='border:none;border-top:1px solid #f0ede8;margin-bottom:20px;'>",
      photosSection + "<hr style='border:none;border-top:1px solid #f0ede8;margin-bottom:20px;'>"
    );

    var pdfBlob = null;
    try {
      var htmlBlob = Utilities.newBlob(html, "text/html", "ATX_Receipt_" + invoiceNumber);
      var driveFile = DriveApp.createFile(htmlBlob);
      pdfBlob = driveFile.getAs("application/pdf");
      pdfBlob.setName("ATX_Receipt_" + invoiceNumber + ".pdf");
      driveFile.setTrashed(true);

      try {
        var invoicesFolder = DriveApp.getFolderById(INVOICES_FOLDER_ID);
        var safeName = (customerName || "Customer").replace(/[^a-zA-Z0-9 ]/g, "").trim().replace(/ /g, "_");
        var invoiceFileName = invoiceNumber + "_" + safeName + "_" + (rawServiceDate || "").replace(/-/g, "") + ".pdf";
        var invoiceCopy = invoicesFolder.createFile(pdfBlob.setName(invoiceFileName));
        var invoiceLink = invoiceCopy.getUrl();
        if (rowIndex && rowIndex >= 2) {
          var ssInv = SpreadsheetApp.openById(SHEET_ID);
          var sheetInv = ssInv.getSheetByName(BOOKINGS_SHEET);
          sheetInv.getRange(rowIndex, 37).setValue(invoiceLink);
        }
        Logger.log("Invoice saved to Drive: " + invoiceFileName);
      } catch (invErr) { Logger.log("Invoice Drive save error: " + invErr); }

    } catch (pdfErr) {
      Logger.log("PDF generation failed (email will still send without attachment): " + pdfErr);
      pdfBlob = null;
    }

    // Send email — with PDF attachment if available, without if PDF failed
    var emailOptions = {
      from: "atxprestigedetailing@gmail.com",
      name: "ATX Prestige Detailing",
      htmlBody: htmlEmail,
      charset: "UTF-8",
    };
    if (pdfBlob) emailOptions.attachments = [pdfBlob];

    GmailApp.sendEmail(customerEmail, subject, plainBody, emailOptions);

    // ── Send admin copy of the invoice ──
    try {
      var adminSubject = "Invoice Copy — " + customerName + " | " + invoiceNumber;
      var adminPlain =
        "Invoice copy for your records.\n\n" +
        "Client: " + customerName + "\n" +
        "Email: " + customerEmail + "\n" +
        "Phone: " + (customerPhone || "N/A") + "\n" +
        "Invoice #: " + invoiceNumber + "\n" +
        "Service Date: " + serviceDateLabel + "\n" +
        "Amount Paid: $" + amount.toFixed(2) + "\n" +
        (vehicle ? "Vehicle: " + vehicle + "\n" : "") +
        (packageType ? "Service: " + packageType + "\n" : "") +
        (invoiceNote ? "Note: " + invoiceNote + "\n" : "") +
        "\nThis is an automatic copy sent to you whenever a client pays.\n" +
        "Drive: " + (typeof invoiceLink !== "undefined" ? invoiceLink : "See Invoices folder");

      var adminEmailOptions = {
        from: "atxprestigedetailing@gmail.com",
        name: "ATX Prestige Detailing",
        htmlBody: htmlEmail,
        charset: "UTF-8",
      };
      if (pdfBlob) adminEmailOptions.attachments = [pdfBlob];
      GmailApp.sendEmail("atxprestigedetailing@gmail.com", adminSubject, adminPlain, adminEmailOptions);
      Logger.log("Admin invoice copy sent for " + invoiceNumber);
    } catch (adminCopyErr) { Logger.log("Admin invoice copy error: " + adminCopyErr); }

    if (customerPhone) {
  var smsPaid = "Hi " + customerName + "! Payment of $" + amount.toFixed(2) + " received. Invoice " + invoiceNumber + " — PAID IN FULL. Thank you for choosing ATX Prestige Detailing!\n\nLoved your detail? We'd really appreciate a quick review: " + REVIEW_LINK + "\n\nIf anything was missed or not up to your standards, just reply here — we back every job with a 100% Satisfaction Guarantee and will make it right.";
  sendSMS(customerPhone, smsPaid);
}

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("sendPaymentConfirmedEmail error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── sendJobStartedSMS ──────────────────────────────────────────────────────

function sendJobStartedSMS(data) {
  try {
    var customerName  = data.customerName  || "there";
    var customerPhone = data.customerPhone || "";
    if (!customerPhone) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No phone" })).setMimeType(ContentService.MimeType.JSON);
    }
    var msg = data.event
      ? "Hi " + customerName + "! We're starting your free wash now. We'll text you when it's done. Thank you for being a part of educating our future!"
      : "Hi " + customerName + "! Your ATX Prestige Detailing service has started. We will notify you when it is complete. Thank you for your patience!";
    sendSMS(customerPhone, msg);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("sendJobStartedSMS error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── sendJobCompletedSMS ─────────────────────────────────────────────────────

function sendJobCompletedSMS(data) {
  try {
    var customerName  = data.customerName  || "there";
    var customerPhone = data.customerPhone || "";
    if (!customerPhone) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No phone" })).setMimeType(ContentService.MimeType.JSON);
    }
    var msg = data.event
      ? "Hi " + customerName + "! Your free wash is complete. We're honored to help start your school year off with a clean car. Thank you for everything you do!"
      : "Hi " + customerName + "! Your ATX Prestige Detailing service is complete. Your invoice will be sent shortly. Thank you for choosing us!";
    sendSMS(customerPhone, msg);

    if (data.event && data.customerEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.customerEmail)) {
      try {
        var doneSubject = "Free Wash Complete | ATX Prestige Detailing";
        var doneBody =
          "Hi " + customerName + ",\n\n" +
          "Your free wash is complete! We're honored to help start your school year off with a clean car.\n\n" +
          "Thank you for everything you do for our students.\n\n" +
          "Thank you,\nATX Prestige Detailing";
        var doneHtml =
          "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
          "<div style='margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;color:#222;'>" +
          "<div style='max-width:640px;margin:0 auto;padding:32px 16px;'>" +
          "<div style='background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
          "<div style='background-color:#111;color:#fff;padding:24px 28px;'>" +
          "<div style='font-size:26px;font-weight:700;'>ATX Prestige Detailing</div>" +
          "<div style='font-size:14px;opacity:0.9;margin-top:6px;'>Free Wash Complete</div>" +
          "</div>" +
          "<div style='padding:28px;'>" +
          "<p style='margin:0 0 16px;font-size:16px;'>Hi " + customerName + ",</p>" +
          "<p style='margin:0 0 16px;font-size:15px;color:#444;'>Your free wash is complete! We're honored to help start your school year off with a clean car.</p>" +
          "<p style='margin:0;font-size:15px;color:#444;'>Thank you for everything you do for our students.</p>" +
          "</div>" +
          "<div style='padding:0 28px 28px;'>" +
          "<p style='margin:0;font-size:15px;color:#444;'>Thank you,<br><strong>ATX Prestige Detailing</strong></p>" +
          "</div></div></div></div></body></html>";
        GmailApp.sendEmail(data.customerEmail, doneSubject, doneBody, {
          from: "atxprestigedetailing@gmail.com",
          name: "ATX Prestige Detailing",
          htmlBody: doneHtml,
          charset: "UTF-8",
        });
      } catch (doneEmailErr) { Logger.log("Event job-done email failed: " + doneEmailErr); }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("sendJobCompletedSMS error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── squareInvoiceRequest ─────────────────────────────────────────────────────

function squareInvoiceRequest(data) {
  try {
    var customerName  = data.customerName  || "";
    var customerEmail = data.customerEmail || "";
    var serviceDate   = data.date          || "";
    var amount        = data.amount        || "";

    var subject = "Square Invoice Request - " + customerName + " | ATX Prestige Detailing";
    var body =
      "A client has requested to pay by Square (credit card).\n\n" +
      "Client: " + customerName + "\n" +
      "Email: " + customerEmail + "\n" +
      "Service Date: " + serviceDate + "\n" +
      "Amount: $" + amount + "\n\n" +
      "Please send them a Square invoice at: https://square.link/u/MOC2bNam";

    GmailApp.sendEmail(
      "atxprestigedetailing@gmail.com",
      subject,
      body,
      { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" }
    );

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("squareInvoiceRequest error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── bookAppointment ─────────────────────────────────────────────────────────

function bookAppointment(data) {
  var ss                = SpreadsheetApp.openById(SHEET_ID);
  var bookingsSheet     = ss.getSheetByName(BOOKINGS_SHEET);
  var availabilitySheet = ss.getSheetByName(AVAILABILITY_SHEET);

  var requestedDate = String(data.date || "").trim();
  var requestedTime = String(data.time || "").trim();
  var slotRow = -1;

  if (requestedDate && requestedTime) {
    var availRows = availabilitySheet.getDataRange().getDisplayValues();
    for (var i = 1; i < availRows.length; i++) {
      var rowDate     = String(availRows[i][0]).trim();
      var rowTime     = String(availRows[i][1]).trim();
      var isAvailable = String(availRows[i][2]).trim().toUpperCase() === "TRUE";
      if (rowDate === requestedDate && rowTime === requestedTime && isAvailable) {
        slotRow = i + 1;
        break;
      }
    }
    if (slotRow === -1) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: "That time slot is no longer available." }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  var clientType         = String(data.clientType         || "oneTime").trim();
  var recurringFrequency = String(data.recurringFrequency || "").trim();

  bookingsSheet.appendRow([
    new Date(),
    data.name        || "",
    data.phone       || "",
    data.email       || "",
    data.date        || "",
    data.time        || "",
    data.year        || "",
    data.make        || "",
    data.model       || "",
    data.boatSize    || "",
    data.vehicle     || "",
    data.packageType || "",
    data.hourlyRate  || "",
    data.addOns      || "",
    data.addOnEstimate || "",
    data.serviceType || "",
    data.address     || "",
    data.street      || "",
    data.city        || "",
    data.state       || "",
    data.zip         || "",
    data.placeId     || "",
    data.lat         || "",
    data.lng         || "",
    data.avgTime     || "",
    data.notes       || "",
    clientType,
    recurringFrequency,
    "Booked",
    "",
    "",
    "",
  ]);
    // Save SMS consent choices (columns AL/AM)
  var newRowIndex = bookingsSheet.getLastRow();
  bookingsSheet.getRange(newRowIndex, 38).setValue(data.smsConsent ? "TRUE" : "FALSE");
  bookingsSheet.getRange(newRowIndex, 39).setValue(data.smsMarketingConsent ? "TRUE" : "FALSE");
  // Consent source — "self" only when the client submitted this booking themselves
  // (main flow or an event flow); Quick Book (admin) explicitly flags bookedByAdmin.
  bookingsSheet.getRange(newRowIndex, CONSENT_SOURCE_COL).setValue(data.bookedByAdmin ? "admin" : "self");

  // Promo event tagging (e.g. LVISD free wash) — columns AO/AP/AQ
  var eventId = String(data.event || "").trim();
  if (eventId) {
    var eligibilityMethod = String(data.eligibilityMethod || "").trim();
    var eligibilityProofUrl = "";
    if (eligibilityMethod === "photo" && data.proofBase64) {
      try {
        var proofFolder = DriveApp.getFolderById(PHOTOS_FOLDER_ID)
          .createFolder(eventId + " — Eligibility Proof — " + (data.name || "Unknown") + " — " + newRowIndex);
        var proofMime = String(data.proofMimeType || "image/jpeg").trim();
        var proofExt  = proofMime === "image/png" ? ".png" : ".jpg";
        var proofBlob = Utilities.newBlob(Utilities.base64Decode(data.proofBase64), proofMime, "proof" + proofExt);
        var proofFile = proofFolder.createFile(proofBlob);
        proofFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        eligibilityProofUrl = proofFile.getUrl();
      } catch (proofErr) { Logger.log("Eligibility proof upload failed: " + proofErr); }
    }
    bookingsSheet.getRange(newRowIndex, 41).setValue(eventId);
    bookingsSheet.getRange(newRowIndex, 42).setValue(eligibilityMethod);
    bookingsSheet.getRange(newRowIndex, 43).setValue(eligibilityProofUrl);
  }

  // Coupon code (e.g. LVISD25) — stored as entered; discount is applied manually
  // by admin at invoicing time since services are billed hourly.
  var couponCode = String(data.couponCode || "").trim();
  if (couponCode) {
    bookingsSheet.getRange(newRowIndex, COUPON_CODE_COL).setValue(couponCode);
  }

  if (slotRow !== -1) {
    availabilitySheet.getRange(slotRow, 3).setValue(false);
  }

  if (clientType === "maintenance" && recurringFrequency && requestedDate && requestedTime) {
    blockRecurringSlots(availabilitySheet, requestedDate, requestedTime, recurringFrequency);
  }

  var customerName = data.name || "there";
  var vehicle = "";
  if (data.vehicle === "boat") {
    vehicle = [data.boatSize, data.make, data.model].filter(Boolean).join(" ");
  } else {
    vehicle = [data.year, data.make, data.model].filter(Boolean).join(" ");
  }

  var packageName = "Detail Package";
  if (data.packageType === "basic")            { packageName = "Basic Detail"; }
  else if (data.packageType === "premium")         { packageName = "Premium Detail"; }
  else if (data.packageType === "exterior")        { packageName = "Exterior Only - Basic"; }
  else if (data.packageType === "interior")        { packageName = "Interior Only - Basic"; }
  else if (data.packageType === "exteriorPremium") { packageName = "Exterior Only - Premium"; }
  else if (data.packageType === "interiorPremium") { packageName = "Interior Only - Premium"; }
  else if (data.packageType) { packageName = data.packageType; }

  var serviceTypeLabel = "";
  if (data.serviceType === "mobile")       { serviceTypeLabel = "Mobile Service"; }
  else if (data.serviceType === "dropoff") { serviceTypeLabel = "Drop-Off Service"; }
  else { serviceTypeLabel = data.serviceType || ""; }

  var addOnsText = data.addOns || "None";
  var notesText  = data.notes  || "None";

  var freqLabel = "";
  if (recurringFrequency === "biweekly")     { freqLabel = "Bi-Weekly"; }
  else if (recurringFrequency === "monthly") { freqLabel = "Monthly"; }
  else { freqLabel = recurringFrequency; }

  var clientTypeLabel = "";
  if (clientType === "maintenance") {
    clientTypeLabel = "Maintenance Plan (" + freqLabel + ")";
  } else {
    clientTypeLabel = "One-Time Service";
  }

  var customerEmail       = String(data.email || "").trim();
  var looksLikeValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);

  try {
    createCalendarEvent(data, vehicle, clientTypeLabel, serviceTypeLabel);
    // For maintenance clients, also create events for all upcoming recurring dates
    if (clientType === "maintenance" && recurringFrequency && requestedDate) {
      createRecurringCalendarEvents(data, vehicle, clientTypeLabel, serviceTypeLabel, recurringFrequency, requestedDate);
    }
  } catch (calErr) {
    Logger.log("Calendar event failed: " + calErr);
  }

  // Promo event bookings (e.g. LVISD free wash) get their own confirmation copy
  // and skip the standard paid-service email/SMS entirely.
  if (eventId) {
    return sendEventBookingConfirmation({
      eventId: eventId,
      customerName: customerName,
      customerEmail: customerEmail,
      looksLikeValidEmail: looksLikeValidEmail,
      phone: data.phone || "",
      vehicle: vehicle,
      requestedDate: requestedDate,
      requestedTime: requestedTime,
      eligibilityMethod: eligibilityMethod,
      eligibilityProofUrl: eligibilityProofUrl,
      eventLabel: data.eventLabel || "",
      eventAddress: data.eventAddress || "",
      eventRainPolicy: data.eventRainPolicy || "",
    });
  }

  if (data.phone) {
    var confirmSMS = "Hi " + customerName + "! Your ATX Prestige Detailing booking is confirmed for " + requestedDate + " at " + requestedTime + ". We look forward to serving you!";
    sendSMS(data.phone, confirmSMS);
  }

  try {
    var bizSubject = clientType === "maintenance"
      ? "New Booking - MAINTENANCE CLIENT | ATX Prestige Detailing"
      : "New Booking - One-Time | ATX Prestige Detailing";

    var scheduleText = "";
    if (clientType === "maintenance" && recurringFrequency && requestedDate) {
      scheduleText = "Schedule: " + getCadenceLabelGS(requestedDate, recurringFrequency) + "\n";
    }

    var bizBody =
      "A new booking was submitted.\n\n" +
      "Service Plan: " + clientTypeLabel + "\n" + scheduleText + "\n" +
      "Name: " + (data.name || "") + "\n" +
      "Phone: " + (data.phone || "") + "\n" +
      "Email: " + (customerEmail || "Not provided") + "\n" +
      "Date: " + (data.date || "") + "\n" +
      "Time: " + (data.time || "") + "\n" +
      "Vehicle: " + vehicle + "\n" +
      "Package: " + packageName + "\n" +
      "Add-Ons: " + addOnsText + "\n" +
      "Service Type: " + serviceTypeLabel + "\n" +
      "Address: " + (data.address || "") + "\n" +
      (data.boatSize ? "Boat Size: " + data.boatSize + "\n" : "") +
      "Avg Time: " + (data.avgTime || "") + "\n" +
      (couponCode ? "Coupon Code: " + couponCode + " (apply discount when setting final invoice amount)\n" : "") +
      "Notes: " + notesText;

    GmailApp.sendEmail(
      "atxprestigedetailing@gmail.com",
      bizSubject,
      bizBody,
      { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" }
    );
  } catch (notifyError) {
    Logger.log("Business notification failed: " + notifyError);
  }

  if (looksLikeValidEmail) {
    try {
      var subject = "Booking Confirmation | ATX Prestige Detailing";

      var scheduleSection = "";
      if (clientType === "maintenance" && recurringFrequency && requestedDate) {
        var recurDates = calcRecurringDatesGS(requestedDate, recurringFrequency, 6);
        var dateList = "  1. " + friendlyDate(requestedDate) + " (first service)";
        for (var di = 0; di < recurDates.length; di++) {
          dateList = dateList + "\n  " + (di + 2) + ". " + friendlyDate(recurDates[di]);
        }
        scheduleSection = "Schedule: " + getCadenceLabelGS(requestedDate, recurringFrequency) + "\nUpcoming dates:\n" + dateList + "\n\n";
      }

      var addrLine  = data.address  ? "Service Address: " + data.address  + "\n" : "";
      var boatLine2 = data.boatSize ? "Boat Size: "       + data.boatSize + "\n" : "";
      var noteLine  = data.notes    ? "Notes: "           + data.notes    + "\n" : "";
      var varyNote  = "Please note that average service time may vary depending on the condition of the vehicle.";

      var plainBody =
        "Hi " + customerName + ",\n\n" +
        "Thank you for booking with ATX Prestige Detailing.\n\n" +
        "Service Plan: " + clientTypeLabel + "\n" + scheduleSection +
        "Date: " + (data.date || "") + "\n" +
        "Time: " + (data.time || "") + "\n" +
        "Vehicle: " + vehicle + "\n" +
        "Package: " + packageName + "\n" +
        "Service Type: " + serviceTypeLabel + "\n" +
        "Add-Ons: " + addOnsText + "\n" +
        addrLine + boatLine2 + noteLine + "\n" +
        varyNote + "\n\n" +
        "Thank you,\nATX Prestige Detailing\nbook.atxprestigedetailing.com";

      var addrHtml  = data.address  ? "<tr><td style='padding:8px 0;font-weight:600;width:160px;'>Service Address:</td><td style='padding:8px 0;'>" + data.address  + "</td></tr>" : "";
      var boatHtml  = data.boatSize ? "<tr><td style='padding:8px 0;font-weight:600;width:160px;'>Boat Size:</td><td style='padding:8px 0;'>"       + data.boatSize + "</td></tr>" : "";
      var noteHtml2 = data.notes    ? "<tr><td style='padding:8px 0;font-weight:600;width:160px;'>Notes:</td><td style='padding:8px 0;'>"           + data.notes    + "</td></tr>" : "";

      var maintenanceBlockHtml = "";
      if (clientType === "maintenance" && recurringFrequency && requestedDate) {
        var rdates = calcRecurringDatesGS(requestedDate, recurringFrequency, 6);
        var dateRows = "<tr><td style='padding:4px 0;font-weight:600;'>1.</td><td style='padding:4px 0;'>" + friendlyDate(requestedDate) + " (first service)</td></tr>";
        for (var dj = 0; dj < rdates.length; dj++) {
          dateRows = dateRows + "<tr><td style='padding:4px 0;font-weight:600;'>" + (dj + 2) + ".</td><td style='padding:4px 0;'>" + friendlyDate(rdates[dj]) + "</td></tr>";
        }
        maintenanceBlockHtml =
          "<div style='background:#f0fdf4;border:1px solid #6ee7b7;border-radius:12px;padding:20px;margin-bottom:24px;'>" +
          "<div style='font-size:15px;font-weight:700;color:#065f46;margin-bottom:6px;'>Your Recurring Schedule</div>" +
          "<div style='font-size:14px;color:#047857;margin-bottom:12px;'>" + getCadenceLabelGS(requestedDate, recurringFrequency) + " starting " + friendlyDate(requestedDate) + "</div>" +
          "<table style='width:100%;border-collapse:collapse;font-size:13px;color:#374151;'>" + dateRows + "</table>" +
          "<div style='font-size:12px;color:#6b7280;margin-top:10px;'>These slots are held for you. Contact us to make any changes.</div>" +
          "</div>";
      }

      var htmlHead =
        "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
        "<div style='margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;color:#222;'>" +
        "<div style='max-width:640px;margin:0 auto;padding:32px 16px;'>" +
        "<div style='background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
        "<div style='background-color:#111;color:#fff;padding:24px 28px;'>" +
        "<div style='font-size:26px;font-weight:700;'>ATX Prestige Detailing</div>" +
        "<div style='font-size:14px;opacity:0.9;margin-top:6px;'>Booking Confirmation</div>" +
        "</div>";

      var htmlGreet =
        "<div style='padding:28px;'>" +
        "<p style='margin:0 0 16px;font-size:16px;'>Hi " + customerName + ",</p>" +
        "<p style='margin:0 0 20px;font-size:15px;color:#444;'>Thank you for booking with <strong>ATX Prestige Detailing</strong>. Your appointment request has been received.</p>";

      var htmlDetails =
        maintenanceBlockHtml +
        "<div style='background:#f9f9f9;border:1px solid #e8e8e8;border-radius:12px;padding:20px;margin-bottom:24px;'>" +
        "<div style='font-size:16px;font-weight:700;margin-bottom:14px;'>Booking Details</div>" +
        "<table style='width:100%;border-collapse:collapse;font-size:14px;color:#333;'>" +
        "<tr><td style='padding:8px 0;font-weight:600;width:160px;'>Service Plan:</td><td style='padding:8px 0;'>" + clientTypeLabel + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Date:</td><td style='padding:8px 0;'>"          + (data.date    || "") + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Time:</td><td style='padding:8px 0;'>"          + (data.time    || "") + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Vehicle:</td><td style='padding:8px 0;'>"       + vehicle             + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Package:</td><td style='padding:8px 0;'>"       + packageName         + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Service Type:</td><td style='padding:8px 0;'>"  + serviceTypeLabel    + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Add-Ons:</td><td style='padding:8px 0;'>"       + addOnsText          + "</td></tr>" +
        addrHtml + boatHtml + noteHtml2 +
        "</table></div>";

      var htmlVary =
        "<div style='background:#fff8e8;border:1px solid #f0dfae;border-radius:12px;padding:16px 18px;margin-bottom:24px;'>" +
        "<div style='font-size:14px;color:#5a4a1f;'>Please note that average service time may vary depending on the condition of the vehicle.</div>" +
        "</div>";

      var appLinkHtml  = "<a href='https://book.atxprestigedetailing.com' style='color:#111;text-decoration:none;font-weight:600;font-size:14px;'>Open Booking App</a>";
      var siteLinkHtml = "<a href='https://atxprestigedetailing.com' style='color:#111;text-decoration:none;font-weight:500;'>Visit Our Website</a>";

      var htmlPortal =
        "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:24px;'>" +
        "<div style='font-size:14px;color:#374151;margin-bottom:8px;'>You can view your past and upcoming appointments at any time in the booking app. Just sign in with your Google account and tap <strong>My Bookings</strong>.</div>" +
        appLinkHtml +
        "</div>";

      var htmlSignoff =
        "<p style='margin:0;font-size:15px;color:#444;'>" +
        "Thank you,<br><strong>ATX Prestige Detailing</strong><br>" +
        siteLinkHtml +
        "</p></div></div></div></div></body></html>";

      var htmlBody = htmlHead + htmlGreet + htmlDetails + htmlVary + htmlPortal + htmlSignoff;

      GmailApp.sendEmail(customerEmail, subject, plainBody, {
        from: "atxprestigedetailing@gmail.com",
        name: "ATX Prestige Detailing",
        htmlBody: htmlBody,
        charset: "UTF-8",
      });
    } catch (customerEmailError) {
      Logger.log("Customer confirmation failed: " + customerEmailError);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── sendEventBookingConfirmation ─────────────────────────────────────────────
// Confirmation copy for free promo/community-event bookings (e.g. LVISD staff
// wash) — distinct from the standard paid-service confirmation since there's
// no price, no invoice follow-up, and it needs to reveal a drop-off address
// that isn't shown anywhere earlier in that flow.

function sendEventBookingConfirmation(o) {
  var dateLabel = friendlyDate(o.requestedDate);

  if (o.phone) {
    var smsMsg =
      "Hi " + o.customerName + "! You're confirmed for the free wash " + dateLabel +
      " at " + o.requestedTime + ". Drop-off address: " + (o.eventAddress || "we'll follow up by email") + ". " +
      "Please be on time, appointments are back to back. Thank you for being a part of educating our future!";
    sendSMS(o.phone, smsMsg);
  }

  // Business notification
  try {
    var eligibilityLine = o.eligibilityMethod === "email" ? "Verified via school email"
      : o.eligibilityMethod === "photo" ? "Photo proof uploaded" + (o.eligibilityProofUrl ? ": " + o.eligibilityProofUrl : "")
      : o.eligibilityMethod === "attest" ? "Will bring proof of employment to the appointment"
      : "Not specified";

    var bizBody =
      "A new " + (o.eventLabel || o.eventId) + " booking was submitted.\n\n" +
      "Name: " + o.customerName + "\n" +
      "Phone: " + (o.phone || "") + "\n" +
      "Email: " + (o.customerEmail || "Not provided") + "\n" +
      "Date: " + o.requestedDate + "\n" +
      "Time: " + o.requestedTime + "\n" +
      "Vehicle: " + o.vehicle + "\n" +
      "Eligibility: " + eligibilityLine;

    GmailApp.sendEmail(
      "atxprestigedetailing@gmail.com",
      "New Event Booking - " + (o.eventLabel || o.eventId) + " | ATX Prestige Detailing",
      bizBody,
      { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" }
    );
  } catch (notifyError) {
    Logger.log("Event business notification failed: " + notifyError);
  }

  if (o.looksLikeValidEmail) {
    try {
      var subject = (o.eventLabel || "Free Wash") + " Booking Confirmed | ATX Prestige Detailing";

      var plainBody =
        "Hi " + o.customerName + ",\n\n" +
        "ATX Prestige Detailing appreciates our educators and school staff! Thank you for everything you do for Lago Vista ISD.\n\n" +
        "Your free exterior wash is confirmed:\n" +
        "Date: " + dateLabel + "\n" +
        "Time: " + o.requestedTime + "\n" +
        "Vehicle: " + o.vehicle + "\n\n" +
        "Drop-off address: " + (o.eventAddress || "we'll follow up with the address") + "\n\n" +
        "Since this is a home address, it works best if someone else drives you and either waits in another car or drops the vehicle and leaves, rather than waiting around at the property.\n\n" +
        "Please be on time, appointments are back to back with limited buffer between them.\n\n" +
        (o.eventRainPolicy || "If weather forces us to reschedule, we'll reach out directly.") + "\n\n" +
        "Thank you,\nATX Prestige Detailing";

      var htmlBody =
        "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
        "<div style='margin:0;padding:0;background-color:#f4f4f4;font-family:Arial,sans-serif;color:#222;'>" +
        "<div style='max-width:640px;margin:0 auto;padding:32px 16px;'>" +
        "<div style='background-color:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
        "<div style='background-color:#111;color:#fff;padding:24px 28px;'>" +
        "<div style='font-size:26px;font-weight:700;'>ATX Prestige Detailing</div>" +
        "<div style='font-size:14px;opacity:0.9;margin-top:6px;'>" + (o.eventLabel || "Free Wash") + " Confirmed</div>" +
        "</div>" +
        "<div style='padding:28px;'>" +
        "<p style='margin:0 0 16px;font-size:16px;'>Hi " + o.customerName + ",</p>" +
        "<p style='margin:0 0 20px;font-size:15px;color:#444;'>ATX Prestige Detailing appreciates our educators and school staff! Thank you for everything you do for Lago Vista ISD.</p>" +
        "<div style='background:#f9f9f9;border:1px solid #e8e8e8;border-radius:12px;padding:20px;margin-bottom:20px;'>" +
        "<table style='width:100%;border-collapse:collapse;font-size:14px;color:#333;'>" +
        "<tr><td style='padding:8px 0;font-weight:600;width:140px;'>Date:</td><td style='padding:8px 0;'>" + dateLabel + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Time:</td><td style='padding:8px 0;'>" + o.requestedTime + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Vehicle:</td><td style='padding:8px 0;'>" + o.vehicle + "</td></tr>" +
        "<tr><td style='padding:8px 0;font-weight:600;'>Drop-off Address:</td><td style='padding:8px 0;'>" + (o.eventAddress || "we'll follow up") + "</td></tr>" +
        "</table></div>" +
        "<div style='background:#fff8e8;border:1px solid #f0dfae;border-radius:12px;padding:16px 18px;margin-bottom:16px;'>" +
        "<div style='font-size:14px;color:#5a4a1f;'>Since this is a home address, it works best if someone else drives you and either waits in another car or drops the vehicle and leaves, rather than waiting around at the property.</div>" +
        "</div>" +
        "<div style='background:#fff8e8;border:1px solid #f0dfae;border-radius:12px;padding:16px 18px;margin-bottom:16px;'>" +
        "<div style='font-size:14px;color:#5a4a1f;'>Please be on time, appointments are back to back with limited buffer between them.</div>" +
        "</div>" +
        "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:20px;'>" +
        "<div style='font-size:14px;color:#374151;'>" + (o.eventRainPolicy || "If weather forces us to reschedule, we'll reach out directly.") + "</div>" +
        "</div>" +
        "<p style='margin:0;font-size:15px;color:#444;'>Thank you,<br><strong>ATX Prestige Detailing</strong></p>" +
        "</div></div></div></div></body></html>";

      GmailApp.sendEmail(o.customerEmail, subject, plainBody, {
        from: "atxprestigedetailing@gmail.com",
        name: "ATX Prestige Detailing",
        htmlBody: htmlBody,
        charset: "UTF-8",
      });
    } catch (customerEmailError) {
      Logger.log("Event customer confirmation failed: " + customerEmailError);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({ success: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── requestChange ────────────────────────────────────────────────────────────

function requestChange(data) {
  try {
    var customerName  = data.customerName  || "A customer";
    var customerEmail = data.customerEmail || "unknown";
    var bookingDate   = data.bookingDate   || "";
    var bookingTime   = data.bookingTime   || "";
    var vehicle       = data.vehicle       || "";
    var packageType   = data.packageType   || "";
    var changeNote    = data.changeNote    || "";

    var subject = "Change Request - " + customerName + " | ATX Prestige Detailing";
    var body =
      "A customer has requested a change to their booking.\n\n" +
      "Customer: " + customerName + "\nEmail: " + customerEmail + "\n\n" +
      "Booking:\nDate: " + bookingDate + "\nTime: " + bookingTime + "\nVehicle: " + vehicle + "\nPackage: " + packageType + "\n\n" +
      "Requested Change:\n" + changeNote;

    GmailApp.sendEmail(
      "atxprestigedetailing@gmail.com",
      subject,
      body,
      { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing", replyTo: customerEmail }
    );

    var looksLikeValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail);
    if (looksLikeValidEmail) {
      var confirmBody =
        "Hi " + customerName + ",\n\n" +
        "We received your request to change your appointment on " + bookingDate + " at " + bookingTime + ".\n\n" +
        "Your request:\n\"" + changeNote + "\"\n\n" +
        "Someone will reach out to confirm the changes shortly.\n\n" +
        "Thank you,\nATX Prestige Detailing";

      GmailApp.sendEmail(
        customerEmail,
        "Change Request Received | ATX Prestige Detailing",
        confirmBody,
        { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing", charset: "UTF-8" }
      );
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("requestChange failed: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── blockRecurringSlots ─────────────────────────────────────────────────────

function blockRecurringSlots(availabilitySheet, startDateStr, time, frequency) {
  try {
    var parts     = startDateStr.split("-");
    var startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayOfWeek = startDate.getDay();
    var weekOfMonth = Math.ceil(startDate.getDate() / 7);
    var nextOcc = new Date(startDate);
    nextOcc.setDate(startDate.getDate() + 7);
    var isLast = nextOcc.getMonth() !== startDate.getMonth();
    var endDate = new Date(startDate.getFullYear(), 11, 31);
    var recurringDates = [];

    if (frequency === "biweekly") {
      var nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + 14);
      while (nextDate <= endDate) {
        recurringDates.push(formatDateStr(nextDate));
        nextDate.setDate(nextDate.getDate() + 14);
      }
    } else if (frequency === "monthly") {
      var checkMonth = startDate.getMonth() + 1;
      var checkYear  = startDate.getFullYear();
      if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      while (checkYear <= endDate.getFullYear()) {
        var candidate = getNthWeekdayOfMonth(checkYear, checkMonth, dayOfWeek, weekOfMonth, isLast);
        if (candidate && candidate <= endDate) {
          recurringDates.push(formatDateStr(candidate));
        }
        checkMonth++;
        if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      }
    }

    if (recurringDates.length === 0) return;

    var availRows = availabilitySheet.getDataRange().getDisplayValues();
    for (var d = 0; d < recurringDates.length; d++) {
      var targetDate = recurringDates[d];
      for (var i = 1; i < availRows.length; i++) {
        var rowDate = String(availRows[i][0]).trim();
        var rowTime = String(availRows[i][1]).trim();
        if (rowDate === targetDate && rowTime === time) {
          availabilitySheet.getRange(i + 1, 3).setValue(false);
          break;
        }
      }
    }
    Logger.log("Blocked " + recurringDates.length + " recurring slots for " + frequency + " starting " + startDateStr);
  } catch (err) {
    Logger.log("blockRecurringSlots error: " + err);
  }
}

// ─── unblockRecurringSlots ───────────────────────────────────────────────────
// Reverses blockRecurringSlots — frees any recurring slots (from startDateStr
// through Dec 31 of that year, same window blockRecurringSlots used) that
// were pre-blocked at booking time but never consumed by an actual row.
// Used when pausing a maintenance plan.

function unblockRecurringSlots(availabilitySheet, startDateStr, time, frequency) {
  try {
    var parts     = startDateStr.split("-");
    var startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    var dayOfWeek = startDate.getDay();
    var weekOfMonth = Math.ceil(startDate.getDate() / 7);
    var nextOcc = new Date(startDate);
    nextOcc.setDate(startDate.getDate() + 7);
    var isLast = nextOcc.getMonth() !== startDate.getMonth();
    var endDate = new Date(startDate.getFullYear(), 11, 31);
    var recurringDates = [];

    if (frequency === "biweekly") {
      var nextDate = new Date(startDate);
      nextDate.setDate(nextDate.getDate() + 14);
      while (nextDate <= endDate) {
        recurringDates.push(formatDateStr(nextDate));
        nextDate.setDate(nextDate.getDate() + 14);
      }
    } else if (frequency === "monthly") {
      var checkMonth = startDate.getMonth() + 1;
      var checkYear  = startDate.getFullYear();
      if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      while (checkYear <= endDate.getFullYear()) {
        var candidate = getNthWeekdayOfMonth(checkYear, checkMonth, dayOfWeek, weekOfMonth, isLast);
        if (candidate && candidate <= endDate) {
          recurringDates.push(formatDateStr(candidate));
        }
        checkMonth++;
        if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      }
    }

    if (recurringDates.length === 0) return;

    var availRows = availabilitySheet.getDataRange().getDisplayValues();
    for (var d = 0; d < recurringDates.length; d++) {
      var targetDate = recurringDates[d];
      for (var i = 1; i < availRows.length; i++) {
        var rowDate = String(availRows[i][0]).trim();
        var rowTime = String(availRows[i][1]).trim();
        if (rowDate === targetDate && rowTime === time) {
          availabilitySheet.getRange(i + 1, 3).setValue(true);
          break;
        }
      }
    }
    Logger.log("Unblocked " + recurringDates.length + " recurring slots for " + frequency + " starting " + startDateStr);
  } catch (err) {
    Logger.log("unblockRecurringSlots error: " + err);
  }
}

// ─── createCalendarEvent ─────────────────────────────────────────────────────

function createCalendarEvent(data, vehicle, clientTypeLabel, serviceTypeLabel) {
  var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
  if (!calendar) {
    Logger.log("Calendar not found: " + CALENDAR_ID);
    return;
  }

  var bookingDate  = String(data.date || "").trim();
  var bookingTime  = String(data.time || "").trim();
  var customerName = data.name || "Client";
  var packageType = "Detail";
  if (data.packageType === "basic")            { packageType = "Basic Detail"; }
  else if (data.packageType === "premium")         { packageType = "Premium Detail"; }
  else if (data.packageType === "exterior")        { packageType = "Exterior Only - Basic"; }
  else if (data.packageType === "interior")        { packageType = "Interior Only - Basic"; }
  else if (data.packageType === "exteriorPremium") { packageType = "Exterior Only - Premium"; }
  else if (data.packageType === "interiorPremium") { packageType = "Interior Only - Premium"; }

  if (!bookingDate) { return; }

  var dateParts = bookingDate.split("-");
  var yr  = parseInt(dateParts[0]);
  var mo  = parseInt(dateParts[1]) - 1;
  var dy  = parseInt(dateParts[2]);

  var startHour = 9; var startMin = 0;
  if (bookingTime) {
    var timeLower = bookingTime.toLowerCase();
    var timeNums  = bookingTime.replace(/[^0-9:]/g, "");
    var timeParts = timeNums.split(":");
    startHour = parseInt(timeParts[0]) || 9;
    startMin  = parseInt(timeParts[1]) || 0;
    if (timeLower.indexOf("pm") !== -1 && startHour !== 12) { startHour += 12; }
    if (timeLower.indexOf("am") !== -1 && startHour === 12) { startHour = 0; }
  }

  var durationHours = 3;
  if (data.clientType === "maintenance") { durationHours = 2; }
  else if (data.vehicle === "boat")      { durationHours = 5; }

  var startTime = new Date(yr, mo, dy, startHour, startMin, 0);
  var endTime   = new Date(yr, mo, dy, startHour + durationHours, startMin, 0);

  var title = packageType + " - " + customerName;
  if (data.vehicle === "boat") { title = "Boat Detail - " + customerName; }

  var desc =
    "Client: " + customerName + "\n" +
    "Phone: " + (data.phone || "") + "\n" +
    "Email: " + (data.email || "") + "\n" +
    "Vehicle: " + vehicle + "\n" +
    "Package: " + packageType + "\n" +
    "Service Plan: " + clientTypeLabel + "\n" +
    "Service Type: " + serviceTypeLabel;
  if (data.address) { desc += "\nAddress: " + data.address; }
  if (data.addOns && data.addOns !== "None" && data.addOns !== "") { desc += "\nAdd-Ons: " + data.addOns; }
  if (data.notes)  { desc += "\nNotes: " + data.notes; }

  var location = "";
  if (data.serviceType === "mobile" && data.address)   { location = data.address; }
  else if (data.serviceType === "dropoff") { location = "Drop-Off Service"; }

  var event = calendar.createEvent(title, startTime, endTime, { description: desc, location: location });
  Logger.log("Calendar event created: " + event.getId() + " for " + customerName + " on " + bookingDate);
}

// ─── createRecurringCalendarEvents ───────────────────────────────────────────
// Creates calendar events for all future recurring maintenance dates (up to 1 year out)

function createRecurringCalendarEvents(data, vehicle, clientTypeLabel, serviceTypeLabel, frequency, startDateStr) {
  try {
    var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) { Logger.log("Calendar not found for recurring events"); return; }

    var bookingTime  = String(data.time || "").trim();
    var customerName = data.name || "Client";
    var packageType  = "Maintenance Detail";
    if (data.packageType === "basic")            { packageType = "Basic Detail"; }
    else if (data.packageType === "premium")         { packageType = "Premium Detail"; }
    else if (data.packageType === "exterior")        { packageType = "Exterior Only - Basic"; }
    else if (data.packageType === "interior")        { packageType = "Interior Only - Basic"; }
    else if (data.packageType === "exteriorPremium") { packageType = "Exterior Only - Premium"; }
    else if (data.packageType === "interiorPremium") { packageType = "Interior Only - Premium"; }

    // Parse the time once
    var startHour = 9; var startMin = 0;
    if (bookingTime) {
      var tl = bookingTime.toLowerCase();
      var tn = bookingTime.replace(/[^0-9:]/g, "").split(":");
      startHour = parseInt(tn[0]) || 9;
      startMin  = parseInt(tn[1]) || 0;
      if (tl.indexOf("pm") !== -1 && startHour !== 12) startHour += 12;
      if (tl.indexOf("am") !== -1 && startHour === 12) startHour = 0;
    }

    var location = "";
    if (data.serviceType === "mobile" && data.address) { location = data.address; }
    else if (data.serviceType === "dropoff") { location = "Drop-Off Service"; }

    var desc =
      "Client: " + customerName + "\n" +
      "Phone: " + (data.phone || "") + "\n" +
      "Email: " + (data.email || "") + "\n" +
      "Vehicle: " + vehicle + "\n" +
      "Package: " + packageType + "\n" +
      "Service Plan: " + clientTypeLabel + "\n" +
      "Service Type: " + serviceTypeLabel +
      (data.address ? "\nAddress: " + data.address : "") +
      (data.addOns && data.addOns !== "None" && data.addOns !== "" ? "\nAdd-Ons: " + data.addOns : "") +
      (data.notes ? "\nNotes: " + data.notes : "");

    // Generate all recurring dates for the next 12 months
    var oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    // Use calcRecurringDatesGS with a high count and filter to within 1 year
    var allDates = calcRecurringDatesGS(startDateStr, frequency, 52); // 52 = max biweekly in a year
    var created = 0;

    for (var i = 0; i < allDates.length; i++) {
      var dateStr = allDates[i];
      var parts   = dateStr.split("-");
      var yr  = parseInt(parts[0]);
      var mo  = parseInt(parts[1]) - 1;
      var dy  = parseInt(parts[2]);
      var eventDate = new Date(yr, mo, dy);

      if (eventDate > oneYearOut) break; // stop at 1 year out

      var evStart = new Date(yr, mo, dy, startHour, startMin, 0);
      var evEnd   = new Date(yr, mo, dy, startHour + 2, startMin, 0); // 2hr maintenance
      var title   = packageType + " - " + customerName + " (Maintenance)";

      calendar.createEvent(title, evStart, evEnd, { description: desc, location: location });
      created++;
    }

    Logger.log("Created " + created + " recurring calendar events for " + customerName + " (" + frequency + ")");
  } catch (err) {
    Logger.log("createRecurringCalendarEvents error: " + err);
  }
}

// ─── deleteRecurringCalendarEvents ───────────────────────────────────────────
// Reverses createRecurringCalendarEvents — deletes any pre-created future
// recurring events (from startDateStr through ~1yr out, same window
// createRecurringCalendarEvents used) that were never consumed by a skip/
// complete cycle. Used when pausing a maintenance plan.

function deleteRecurringCalendarEvents(customerName, startDateStr, frequency) {
  try {
    var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
    if (!calendar) { Logger.log("Calendar not found for deleteRecurringCalendarEvents"); return 0; }

    var oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    var allDates = calcRecurringDatesGS(startDateStr, frequency, 52);
    var deleted = 0;

    for (var i = 0; i < allDates.length; i++) {
      var dateStr = allDates[i];
      var parts   = dateStr.split("-");
      var yr = parseInt(parts[0]);
      var mo = parseInt(parts[1]) - 1;
      var dy = parseInt(parts[2]);
      var eventDate = new Date(yr, mo, dy);

      if (eventDate > oneYearOut) break;

      var dayStart = new Date(yr, mo, dy, 0, 0, 0);
      var dayEnd   = new Date(yr, mo, dy, 23, 59, 0);
      var events   = calendar.getEvents(dayStart, dayEnd);
      events.forEach(function(ev) {
        if (ev.getTitle().indexOf(customerName) !== -1) {
          ev.deleteEvent();
          deleted++;
        }
      });
    }

    Logger.log("Deleted " + deleted + " recurring calendar events for " + customerName + " (" + frequency + ")");
    return deleted;
  } catch (err) {
    Logger.log("deleteRecurringCalendarEvents error: " + err);
    return 0;
  }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDateStr(d) {
  var y   = d.getFullYear();
  var m   = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + day;
}

function getNthWeekdayOfMonth(year, month, dayOfWeek, n, isLast) {
  if (isLast) {
    var lastDay = new Date(year, month + 1, 0);
    while (lastDay.getDay() !== dayOfWeek) { lastDay.setDate(lastDay.getDate() - 1); }
    return lastDay;
  }
  var first = new Date(year, month, 1);
  var diff  = (dayOfWeek - first.getDay() + 7) % 7;
  var result = new Date(year, month, 1 + diff + (n - 1) * 7);
  if (result.getMonth() !== month) return null;
  return result;
}

function calcRecurringDatesGS(startDateStr, frequency, count) {
  count = count || 6;
  var parts = startDateStr.split("-");
  var start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var dates = [];

  if (frequency === "biweekly") {
    var next = new Date(start);
    next.setDate(next.getDate() + 14);
    while (dates.length < count) {
      dates.push(formatDateStr(next));
      next.setDate(next.getDate() + 14);
    }
  } else if (frequency === "monthly") {
    var dow     = start.getDay();
    var weekPos = Math.ceil(start.getDate() / 7);
    var testN   = new Date(start);
    testN.setDate(testN.getDate() + 7);
    var isLast     = testN.getMonth() !== start.getMonth();
    var checkMonth = start.getMonth() + 1;
    var checkYear  = start.getFullYear();
    if (checkMonth > 11) { checkMonth = 0; checkYear++; }
    while (dates.length < count) {
      var candidate = getNthWeekdayOfMonth(checkYear, checkMonth, dow, weekPos, isLast);
      if (candidate) { dates.push(formatDateStr(candidate)); }
      checkMonth++;
      if (checkMonth > 11) { checkMonth = 0; checkYear++; }
      if (checkYear > start.getFullYear() + 3) break;
    }
  }
  return dates;
}

// Steps forward from anchorDateStr using the plan's cadence until landing on
// (or past) notBeforeDate, preserving the cadence's phase (day-of-week for
// biweekly; day-of-week + week-position for monthly) rather than restarting
// it. Used by resumeMaintenancePlan so resuming lands on the next real slot
// on the existing schedule instead of wherever the old cadence would be by now.
function nextOccurrenceOnOrAfter(anchorDateStr, frequency, notBeforeDate) {
  var parts = anchorDateStr.split("-");
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

  var dow, weekPos, isLast;
  if (frequency === "monthly") {
    dow = d.getDay();
    weekPos = Math.ceil(d.getDate() / 7);
    var testN = new Date(d);
    testN.setDate(testN.getDate() + 7);
    isLast = testN.getMonth() !== d.getMonth();
  }

  var guard = 0;
  while (d < notBeforeDate && guard < 500) {
    if (frequency === "biweekly") {
      d.setDate(d.getDate() + 14);
    } else if (frequency === "monthly") {
      var nm = d.getMonth() + 1;
      var ny = d.getFullYear();
      if (nm > 11) { nm = 0; ny++; }
      var candidate = getNthWeekdayOfMonth(ny, nm, dow, weekPos, isLast);
      d = candidate || (function() { var f = new Date(d); f.setMonth(f.getMonth() + 1); return f; })();
    } else {
      break;
    }
    guard++;
  }

  return formatDateStr(d);
}

function getCadenceLabelGS(startDateStr, frequency) {
  var parts    = startDateStr.split("-");
  var start    = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  var dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var dayName  = dayNames[start.getDay()];
  if (frequency === "biweekly") return "Every other " + dayName;
  var weekPos = Math.ceil(start.getDate() / 7);
  var testN   = new Date(start);
  testN.setDate(testN.getDate() + 7);
  var isLast   = testN.getMonth() !== start.getMonth();
  var ordinals = ["", "1st", "2nd", "3rd", "4th", "5th"];
  return "Every " + (isLast ? "last" : ordinals[weekPos]) + " " + dayName + " of the month";
}

function friendlyDate(dateStr) {
  var parts = dateStr.split("-");
  var d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// ─── toggleAvailabilitySlot ───────────────────────────────────────────────────

function toggleAvailabilitySlot(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(AVAILABILITY_SHEET);
    var rows  = sheet.getDataRange().getDisplayValues();
    var date  = String(data.date || "").trim();
    var time  = String(data.time || "").trim();
    var avail = String(data.available || "TRUE").trim();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === date && String(rows[i][1]).trim() === time) {
        sheet.getRange(i + 1, 3).setValue(avail === "TRUE");
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Slot not found" })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("toggleAvailabilitySlot error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── addAvailabilitySlot ──────────────────────────────────────────────────────

function addAvailabilitySlot(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(AVAILABILITY_SHEET);
    var date  = String(data.date || "").trim();
    var time  = String(data.time || "").trim();
    if (!date || !time) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing date or time" })).setMimeType(ContentService.MimeType.JSON);
    }
    var rows = sheet.getDataRange().getDisplayValues();
    for (var i = 1; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === date && String(rows[i][1]).trim() === time) {
        sheet.getRange(i + 1, 3).setValue(true);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    sheet.appendRow([date, time, true, ""]);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("addAvailabilitySlot error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── setupLvisdAug2026 (run once manually from the Apps Script editor) ────────
// Sets header labels for the new Event/Eligibility columns (AO/AP/AQ) and
// seeds the 10 fixed appointment slots for the Aug 8, 2026 LVISD staff wash.
// Safe to re-run — addAvailabilitySlot() is idempotent per date+time.

function setupLvisdAug2026() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var bookingsSheet = ss.getSheetByName(BOOKINGS_SHEET);
  bookingsSheet.getRange(1, 41).setValue("Event");
  bookingsSheet.getRange(1, 42).setValue("Eligibility Method");
  bookingsSheet.getRange(1, 43).setValue("Eligibility Proof URL");

  var times = ["8:00 AM", "8:45 AM", "9:30 AM", "10:15 AM", "11:00 AM", "11:45 AM", "12:30 PM", "1:15 PM", "2:00 PM", "2:45 PM"];
  times.forEach(function(t) {
    addAvailabilitySlot({ date: "2026-08-08", time: t });
  });

  Logger.log("LVISD Aug 8 2026 setup complete: headers set, " + times.length + " slots seeded.");
}

// ─── backfillConsentSource (run once manually from the Apps Script editor) ────
// Tags every existing booking's SMS-consent source. Only these known bookings
// were genuinely submitted by the client themselves through the app; everything
// else with a consent value was entered by staff, and blanks predate the feature
// entirely. Safe to re-run.

function backfillConsentSource() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(BOOKINGS_SHEET);
  sheet.getRange(1, CONSENT_SOURCE_COL).setValue("Consent Source");

  var knownSelf = [
    { email: "krblake5@gmail.com",       date: "2026-08-01" }, // Ken Blake
    { email: "hwomack@lagovistaisd.net", date: "2026-08-08" }, // Heather Womack
    { email: "wnorman@lagovistaisd.net", date: "2026-08-08" }, // Wendy Norman
    { email: "gcervantes@lagovistaisd.net", date: "2026-08-08" }, // Gabriela Cervantes
    { email: "cvences@lagovistaisd.net", date: "2026-08-08" }, // Cynthia Joiner
  ];

  var rows = sheet.getDataRange().getDisplayValues();
  var selfCount = 0, adminCount = 0, unknownCount = 0;

  for (var i = 1; i < rows.length; i++) {
    var rDate = String(rows[i][4] || "").trim();
    if (!rDate) continue; // skip blank rows

    var rEmail = String(rows[i][3] || "").trim().toLowerCase();
    var rSheetRow = i + 1;

    var isKnownSelf = knownSelf.some(function(k) { return k.email === rEmail && k.date === rDate; });

    var smsVal = String(rows[i][37] || "").trim();
    var mktVal = String(rows[i][38] || "").trim();
    var hasConsentValue = smsVal !== "" || mktVal !== "";

    var source = isKnownSelf ? "self" : hasConsentValue ? "admin" : "unknown";
    sheet.getRange(rSheetRow, CONSENT_SOURCE_COL).setValue(source);

    if (source === "self") selfCount++;
    else if (source === "admin") adminCount++;
    else unknownCount++;
  }

  Logger.log("Consent source backfill complete: " + selfCount + " self, " + adminCount + " admin, " + unknownCount + " unknown.");
}

// ─── sendBookingReminders (run daily via time trigger) ────────────────────────

function sendBookingReminders() {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(BOOKINGS_SHEET);
    var rows  = sheet.getDataRange().getDisplayValues();

    var now       = new Date();
    var tomorrow  = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
    var tomorrowStr = formatDateStr(tomorrow);

    var oneHourDate = new Date(now); oneHourDate.setHours(oneHourDate.getHours() + 1);
    var oneHourStr  = formatDateStr(oneHourDate);
    var oneHourHour = oneHourDate.getHours();

    rows.slice(1).forEach(function(row) {
      var bookingDate = String(row[4] || "").trim();
      var bookingTime = String(row[5] || "").trim();
      var name        = String(row[1] || "").trim();
      var phone       = String(row[2] || "").trim();
      var status      = String(row[28] || "").trim();

      if (status === "Completed" || status === "Cancelled" || status === "Skipped" || status === "Paused" || !phone) return;

      if (bookingDate === tomorrowStr) {
        var msg24 = "Hi " + name + "! Reminder: your ATX Prestige Detailing appointment is tomorrow" + (bookingTime ? " at " + bookingTime : "") + ". We look forward to seeing you!";
        sendSMS(phone, msg24);
      }

      if (bookingDate === oneHourStr && bookingTime) {
        var timeLower = bookingTime.toLowerCase();
        var timeNums  = bookingTime.replace(/[^0-9:]/g, "");
        var parts2    = timeNums.split(":");
        var bHour     = parseInt(parts2[0]) || 0;
        if (timeLower.indexOf("pm") !== -1 && bHour !== 12) bHour += 12;
        if (timeLower.indexOf("am") !== -1 && bHour === 12) bHour = 0;
        if (bHour === oneHourHour) {
          var msg1 = "Hi " + name + "! Your ATX Prestige Detailing appointment is in about 1 hour. We will see you soon!";
          sendSMS(phone, msg1);
        }
      }
    });

    Logger.log("Booking reminders sent for " + tomorrowStr);
  } catch (err) {
    Logger.log("sendBookingReminders error: " + err);
  }
}

// ─── setupDailyReminderTrigger ────────────────────────────────────────────────

function setupDailyReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "sendBookingReminders") {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger("sendBookingReminders")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  Logger.log("Daily reminder trigger installed — runs at 8 AM daily");
}

// ─── uploadJobPhoto ───────────────────────────────────────────────────────────

function uploadJobPhoto(data) {
  try {
    var customerName = String(data.customerName || "Customer").trim().replace(/[^a-zA-Z0-9 ]/g, "");
    var serviceDate  = String(data.serviceDate  || "").trim();
    var photoType    = String(data.photoType    || "before").trim();
    var base64Data   = String(data.base64       || "").trim();
    var mimeType     = String(data.mimeType     || "image/jpeg").trim();
    var rowIndex     = parseInt(data.rowIndex   || "0");

    if (!base64Data) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "No image data" })).setMimeType(ContentService.MimeType.JSON);
    }

    var mainFolder   = DriveApp.getFolderById(PHOTOS_FOLDER_ID);
    var folderName   = customerName + (serviceDate ? " — " + serviceDate : "");
    var subFolders   = mainFolder.getFoldersByName(folderName);
    var jobFolder    = subFolders.hasNext() ? subFolders.next() : mainFolder.createFolder(folderName);

    var ext         = mimeType === "image/png" ? ".png" : ".jpg";
    var timestamp   = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    var fileName    = photoType + "_" + timestamp + ext;
    var decoded     = Utilities.base64Decode(base64Data);
    var blob        = Utilities.newBlob(decoded, mimeType, fileName);
    var file        = jobFolder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl    = file.getUrl();
    var folderUrl  = jobFolder.getUrl();

    if (rowIndex && rowIndex >= 2) {
      try {
        var ss2    = SpreadsheetApp.openById(SHEET_ID);
        var sheet2 = ss2.getSheetByName(BOOKINGS_SHEET);
        sheet2.getRange(rowIndex, 34).setValue(folderUrl);
        var thumbUrl = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w400";
        var col = photoType === "before" ? 35 : 36;
        var existing = sheet2.getRange(rowIndex, col).getValue();
        var updated = existing ? existing + "," + thumbUrl : thumbUrl;
        sheet2.getRange(rowIndex, col).setValue(updated);
      } catch (sheetErr) { Logger.log("Photo link save error: " + sheetErr); }
    }

    Logger.log("Photo uploaded: " + fileName + " for " + customerName);
    return ContentService.createTextOutput(JSON.stringify({ success: true, fileUrl: fileUrl, folderUrl: folderUrl })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("uploadJobPhoto error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── cancelBooking ────────────────────────────────────────────────────────────

function cancelBooking(data) {
  try {
    var ss          = SpreadsheetApp.openById(SHEET_ID);
    var sheet       = ss.getSheetByName(BOOKINGS_SHEET);
    var availSheet  = ss.getSheetByName(AVAILABILITY_SHEET);
    var rowIndex    = parseInt(data.rowIndex || "0");
    var custName    = String(data.customerName  || "").trim();
    var custEmail   = String(data.customerEmail || "").trim();
    var custPhone   = String(data.customerPhone || "").trim();
    var bookingDate = String(data.date          || "").trim();
    var bookingTime = String(data.time          || "").trim();
    var vehicle     = String(data.vehicle       || "").trim();
    var pkgType     = String(data.packageType   || "").trim();
    var address     = String(data.address       || "").trim();
    var clientType  = String(data.clientType    || "").trim();

    if (!rowIndex || rowIndex < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }

    var isMaintenance = clientType === "maintenance";

    // ── For maintenance clients: cancel ALL future bookings for this email ──
    if (isMaintenance) {
      var allRows   = sheet.getDataRange().getDisplayValues();
      var availRows = availSheet.getDataRange().getDisplayValues();
      var calendar  = CalendarApp.getCalendarById(CALENDAR_ID);
      var today     = new Date(); today.setHours(0, 0, 0, 0);
      var cancelledCount = 0;

      for (var r = 1; r < allRows.length; r++) {
        var rEmail  = String(allRows[r][3]).trim().toLowerCase();
        var rDate   = String(allRows[r][4]).trim();
        var rTime   = String(allRows[r][5]).trim();
        var rStatus = String(allRows[r][28]).trim();
        var rType   = String(allRows[r][26]).trim();

        if (rEmail !== custEmail.toLowerCase()) continue;
        if (rType  !== "maintenance")           continue;
        if (rStatus === "Cancelled" || rStatus === "Completed") continue;

        // Check if this booking is upcoming (today or future)
        var rParts = rDate.split("-");
        if (rParts.length !== 3) continue;
        var rDt = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]));
        if (rDt < today) continue;

        var sheetRow = r + 1; // allRows[r] is the (r+1)th sheet row (allRows[0] is the header)

        // Mark as Cancelled
        sheet.getRange(sheetRow, 29).setValue("Cancelled");
        cancelledCount++;

        // Reopen availability slot
        for (var a = 1; a < availRows.length; a++) {
          if (String(availRows[a][0]).trim() === rDate && String(availRows[a][1]).trim() === rTime) {
            availSheet.getRange(a + 1, 3).setValue(true);
            break;
          }
        }

        // Delete calendar event for this date
        if (calendar && rDate) {
          try {
            var evStart = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 0, 0, 0);
            var evEnd   = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 23, 59, 0);
            var evList  = calendar.getEvents(evStart, evEnd);
            evList.forEach(function(ev) {
              if (ev.getTitle().indexOf(custName) !== -1) ev.deleteEvent();
            });
          } catch (calErr2) { Logger.log("Cal delete error for " + rDate + ": " + calErr2); }
        }
      }
      Logger.log("Cancelled " + cancelledCount + " maintenance bookings for " + custEmail);

    } else {
      // ── Single booking cancel (non-maintenance) ──
      sheet.getRange(rowIndex, 29).setValue("Cancelled");

      // Reopen slot
      try {
        var singleAvailRows = availSheet.getDataRange().getDisplayValues();
        for (var i = 1; i < singleAvailRows.length; i++) {
          if (String(singleAvailRows[i][0]).trim() === bookingDate && String(singleAvailRows[i][1]).trim() === bookingTime) {
            availSheet.getRange(i + 1, 3).setValue(true);
            break;
          }
        }
      } catch (avErr) { Logger.log("Availability reopen error: " + avErr); }

      // Delete calendar event
      try {
        var cal2 = CalendarApp.getCalendarById(CALENDAR_ID);
        if (cal2 && bookingDate) {
          var p2 = bookingDate.split("-");
          var ds = new Date(parseInt(p2[0]), parseInt(p2[1]) - 1, parseInt(p2[2]), 0, 0, 0);
          var de = new Date(parseInt(p2[0]), parseInt(p2[1]) - 1, parseInt(p2[2]), 23, 59, 0);
          cal2.getEvents(ds, de).forEach(function(ev) {
            if (ev.getTitle().indexOf(custName) !== -1) ev.deleteEvent();
          });
        }
      } catch (calErr) { Logger.log("Calendar delete error: " + calErr); }
    }

    // ── Send cancellation email ──
    var pkgLabel  = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : pkgType === "lvisdFreeWash" ? "Free Wash (Event)" : (pkgType || "Detail");
    var dateLabel = friendlyDate(bookingDate);

    if (custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      var subject = isMaintenance
        ? "Maintenance Plan Cancelled | ATX Prestige Detailing"
        : "Appointment Cancelled | ATX Prestige Detailing";

      var maintenanceNote = isMaintenance
        ? "\n\nAll upcoming maintenance appointments have been cancelled and your slots have been released."
        : "";

      var plain =
        "Hi " + custName + ",\n\n" +
        (isMaintenance ? "Your maintenance plan has been cancelled." : "Your appointment has been cancelled.") +
        maintenanceNote + "\n\n" +
        "Cancelled" + (isMaintenance ? " (starting)" : "") + " Appointment:\n" +
        "Date: " + dateLabel + " at " + bookingTime + "\n" +
        "Service: " + pkgLabel + "\n" +
        "Vehicle: " + vehicle + "\n\n" +
        "If you would like to book again, visit:\nhttps://book.atxprestigedetailing.com\n\n" +
        "We hope to serve you again soon.\n\nATX Prestige Detailing";

      var mainBannerHtml = isMaintenance
        ? "<div style='background:#fef3c7;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e;'>All upcoming maintenance appointments have been cancelled and your time slots have been released.</div>"
        : "";

      var html =
        "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
        "<div style='max-width:600px;margin:0 auto;padding:32px 16px;font-family:Arial,sans-serif;'>" +
        "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:24px 32px;'>" +
        "<div style='font-size:20px;font-weight:800;color:#fff;'>ATX Prestige Detailing</div>" +
        "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;'>" + (isMaintenance ? "Maintenance Plan Cancelled" : "Appointment Cancelled") + "</div>" +
        "</div>" +
        "<div style='background:#fff;padding:32px;border:1px solid #e5e7eb;'>" +
        "<p style='font-size:15px;color:#374151;margin:0 0 16px;'>Hi " + custName + ",</p>" +
        "<p style='font-size:15px;color:#374151;margin:0 0 16px;'>" + (isMaintenance ? "Your maintenance plan has been cancelled." : "Your appointment has been cancelled.") + "</p>" +
        mainBannerHtml +
        "<div style='background:#fef2f2;border:1.5px solid #fca5a5;border-radius:12px;padding:20px;margin-bottom:24px;'>" +
        "<div style='font-size:18px;font-weight:800;color:#991b1b;margin-bottom:4px;'>" + dateLabel + "</div>" +
        "<div style='font-size:15px;color:#b91c1c;margin-bottom:14px;'>" + bookingTime + "</div>" +
        "<table style='width:100%;border-collapse:collapse;font-size:14px;'>" +
        "<tr><td style='padding:5px 0;color:#6b7280;width:120px;'>Service</td><td style='padding:5px 0;font-weight:600;color:#374151;'>" + pkgLabel + "</td></tr>" +
        "<tr style='border-top:1px solid #fee2e2;'><td style='padding:5px 0;color:#6b7280;'>Vehicle</td><td style='padding:5px 0;font-weight:600;color:#374151;'>" + vehicle + "</td></tr>" +
        (address ? "<tr style='border-top:1px solid #fee2e2;'><td style='padding:5px 0;color:#6b7280;'>Location</td><td style='padding:5px 0;font-weight:600;color:#374151;'>" + address + "</td></tr>" : "") +
        "</table></div>" +
        "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;'>Book a New Appointment</a>" +
        "</div>" +
        "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;'>" +
        "<p style='margin:0;font-size:11px;color:#9ca3af;'>ATX Prestige Detailing | Lago Vista, TX</p>" +
        "</div></div></body></html>";

      GmailApp.sendEmail(custEmail, subject, plain, {
        from: "atxprestigedetailing@gmail.com",
        name: "ATX Prestige Detailing",
        htmlBody: html,
        charset: "UTF-8",
      });
    }

    if (custPhone) {
      var smsMsg = isMaintenance
        ? "Hi " + custName + ", your ATX Prestige Detailing maintenance plan has been cancelled. All upcoming appointments have been removed. To rebook visit book.atxprestigedetailing.com"
        : "Hi " + custName + ", your ATX Prestige Detailing appointment on " + dateLabel + " at " + bookingTime + " has been cancelled. To rebook visit book.atxprestigedetailing.com";
      sendSMS(custPhone, smsMsg);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("cancelBooking error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── pauseMaintenancePlan ─────────────────────────────────────────────────────
// Pauses a maintenance client's plan indefinitely: marks their upcoming
// booking row "Paused" (instead of cancelling it), frees its slot/calendar
// event, and sweeps any further pre-blocked slots/events that were bulk-
// created at initial booking time (up to ~1yr out) but never consumed.
// Silent by default — SMS/email only fire if notifySms/notifyEmail are true.

function pauseMaintenancePlan(data) {
  try {
    var ss         = SpreadsheetApp.openById(SHEET_ID);
    var sheet      = ss.getSheetByName(BOOKINGS_SHEET);
    var availSheet = ss.getSheetByName(AVAILABILITY_SHEET);
    var calendar   = CalendarApp.getCalendarById(CALENDAR_ID);

    var custEmail = String(data.customerEmail || data.email || "").trim();
    var custName  = String(data.customerName  || data.name  || "").trim();
    var custPhone = String(data.customerPhone || data.phone || "").trim();
    var make      = String(data.make || "").trim().toLowerCase();
    var model     = String(data.model || "").trim().toLowerCase();
    var freq      = String(data.recurringFrequency || "").trim();

    if (!custEmail || !make || !model) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing email, make, or model" })).setMimeType(ContentService.MimeType.JSON);
    }

    var today      = new Date(); today.setHours(0, 0, 0, 0);
    var allRows    = sheet.getDataRange().getDisplayValues();
    var availRows  = availSheet.getDataRange().getDisplayValues();
    var pausedCount = 0;
    var lastPausedDate = "";
    var lastPausedTime = "";

    for (var r = 1; r < allRows.length; r++) {
      var rEmail  = String(allRows[r][3]).trim().toLowerCase();
      var rMake   = String(allRows[r][7]).trim().toLowerCase();
      var rModel  = String(allRows[r][8]).trim().toLowerCase();
      var rDate   = String(allRows[r][4]).trim();
      var rTime   = String(allRows[r][5]).trim();
      var rStatus = String(allRows[r][28]).trim();
      var rType   = String(allRows[r][26]).trim();

      if (rEmail !== custEmail.toLowerCase()) continue;
      if (rMake !== make || rModel !== model) continue;
      if (rType !== "maintenance") continue;
      if (rStatus === "Cancelled" || rStatus === "Completed" || rStatus === "Skipped" || rStatus === "Paused") continue;

      var rParts = rDate.split("-");
      if (rParts.length !== 3) continue;
      var rDt = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]));
      if (rDt < today) continue;

      var sheetRow = r + 1; // allRows[r] is the (r+1)th sheet row (allRows[0] is the header)

      sheet.getRange(sheetRow, 29).setValue("Paused");
      pausedCount++;
      if (!lastPausedDate || rDate > lastPausedDate) { lastPausedDate = rDate; lastPausedTime = rTime; }

      // Reopen this row's availability slot
      for (var a = 1; a < availRows.length; a++) {
        if (String(availRows[a][0]).trim() === rDate && String(availRows[a][1]).trim() === rTime) {
          availSheet.getRange(a + 1, 3).setValue(true);
          break;
        }
      }

      // Delete this row's calendar event
      if (calendar && rDate) {
        try {
          var evStart = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 0, 0, 0);
          var evEnd   = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 23, 59, 0);
          calendar.getEvents(evStart, evEnd).forEach(function(ev) {
            if (ev.getTitle().indexOf(custName) !== -1) ev.deleteEvent();
          });
        } catch (calErr) { Logger.log("Pause calendar delete error for " + rDate + ": " + calErr); }
      }
    }

    // Sweep any further pre-blocked slots/events (bulk-created ~1yr out at
    // initial booking) that don't have a materialized row yet.
    if (lastPausedDate && freq) {
      try { unblockRecurringSlots(availSheet, lastPausedDate, lastPausedTime, freq); } catch (e) { Logger.log("Pause sweep unblock error: " + e); }
      try { deleteRecurringCalendarEvents(custName, lastPausedDate, freq); } catch (e) { Logger.log("Pause sweep calendar error: " + e); }
    }

    Logger.log("Paused " + pausedCount + " maintenance booking(s) for " + custEmail);

    if (data.notifyEmail && custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      try {
        var subject = "Maintenance Plan Paused | ATX Prestige Detailing";
        var plain =
          "Hi " + custName + ",\n\n" +
          "Your maintenance plan has been paused. Your upcoming appointments have been removed and your time slots released.\n\n" +
          "Whenever you're ready to pick back up, just let us know and we'll get you on the next available date.\n\n" +
          "Thank you,\nATX Prestige Detailing";
        GmailApp.sendEmail(custEmail, subject, plain, { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" });
      } catch (emailErr) { Logger.log("Pause email error: " + emailErr); }
    }

    if (data.notifySms && custPhone) {
      try {
        sendSMS(custPhone, "Hi " + custName + ", your ATX Prestige Detailing maintenance plan has been paused. Just let us know when you're ready to pick back up!");
      } catch (smsErr) { Logger.log("Pause SMS error: " + smsErr); }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, pausedCount: pausedCount })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("pauseMaintenancePlan error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── updateInventoryThreshold ─────────────────────────────────────────────────

function updateInventoryThreshold(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Inventory");
    var row   = parseInt(data.rowIndex);
    if (!sheet || !row || row < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.getRange(row, 5).setValue(String(data.lowStockThreshold || "0").trim());
    Logger.log("Updated threshold row " + row + " to " + data.lowStockThreshold);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateInventoryThreshold error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── getInventory ─────────────────────────────────────────────────────────────

function getInventory() {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Inventory");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ items: [] })).setMimeType(ContentService.MimeType.JSON);
    }
    var rows = sheet.getDataRange().getDisplayValues();
    var items = rows.slice(1)
      .map(function(row, index) {
        return {
          rowIndex:          index + 2,
          item:              String(row[0] || "").trim(),
          category:          String(row[1] || "").trim(),
          quantity:          String(row[2] || "0").trim(),
          unit:              String(row[3] || "").trim(),
          lowStockThreshold: String(row[4] || "0").trim(),
          notes:             String(row[5] || "").trim(),
        };
      })
      .filter(function(i) { return i.item !== ""; });
    return ContentService.createTextOutput(JSON.stringify({ items: items })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("getInventory error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ items: [], error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── updateInventoryQty ───────────────────────────────────────────────────────

function updateInventoryQty(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Inventory");
    var row   = parseInt(data.rowIndex);
    if (!sheet || !row || row < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.getRange(row, 3).setValue(data.quantity);
    Logger.log("Updated inventory qty row " + row + " to " + data.quantity);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateInventoryQty error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── addInventoryItem ─────────────────────────────────────────────────────────

function addInventoryItem(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Inventory");
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Inventory sheet not found" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.appendRow([
      String(data.item              || "").trim(),
      String(data.category          || "").trim(),
      String(data.quantity          || "0").trim(),
      String(data.unit              || "").trim(),
      String(data.lowStockThreshold || "0").trim(),
      String(data.notes             || "").trim(),
    ]);
    Logger.log("Added inventory item: " + data.item);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("addInventoryItem error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── updateInventoryItem (full row edit) ─────────────────────────────────────

function updateInventoryItem(data) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName("Inventory");
    var row   = parseInt(data.rowIndex);
    if (!sheet || !row || row < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }
    sheet.getRange(row, 1).setValue(String(data.item              || "").trim());
    sheet.getRange(row, 2).setValue(String(data.category          || "").trim());
    sheet.getRange(row, 3).setValue(String(data.quantity          || "0").trim());
    sheet.getRange(row, 4).setValue(String(data.unit              || "").trim());
    sheet.getRange(row, 5).setValue(String(data.lowStockThreshold || "0").trim());
    sheet.getRange(row, 6).setValue(String(data.notes             || "").trim());
    Logger.log("Updated inventory item row " + row);
    return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateInventoryItem error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── skipMaintenanceBooking ───────────────────────────────────────────────────

function skipMaintenanceBooking(data) {
  try {
    var ss          = SpreadsheetApp.openById(SHEET_ID);
    var sheet       = ss.getSheetByName(BOOKINGS_SHEET);
    var availSheet  = ss.getSheetByName(AVAILABILITY_SHEET);
    var rowIndex    = parseInt(data.rowIndex || "0");
    var custName    = String(data.customerName    || "").trim();
    var custEmail   = String(data.customerEmail   || "").trim();
    var custPhone   = String(data.customerPhone   || "").trim();
    var skippedDate = String(data.date            || "").trim();
    var skippedTime = String(data.time            || "").trim();
    var freq        = String(data.recurringFrequency || "").trim();
    var vehicle     = String(data.vehicleLabel    || data.vehicle || "").trim();
    var pkgType     = String(data.packageType     || "").trim();

    if (!rowIndex || rowIndex < 2) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Invalid row" })).setMimeType(ContentService.MimeType.JSON);
    }

    // 1. Mark booking as Skipped
    sheet.getRange(rowIndex, 29).setValue("Skipped");

    // 2. Reopen the availability slot
    try {
      var availRows = availSheet.getDataRange().getDisplayValues();
      for (var i = 1; i < availRows.length; i++) {
        if (String(availRows[i][0]).trim() === skippedDate && String(availRows[i][1]).trim() === skippedTime) {
          availSheet.getRange(i + 1, 3).setValue(true);
          break;
        }
      }
    } catch (avErr) { Logger.log("Availability reopen error: " + avErr); }

    // 2b. Delete calendar event for the skipped date
    try {
      var cal = CalendarApp.getCalendarById(CALENDAR_ID);
      if (cal && skippedDate) {
        var sdParts  = skippedDate.split("-");
        var sdStart  = new Date(parseInt(sdParts[0]), parseInt(sdParts[1]) - 1, parseInt(sdParts[2]), 0, 0, 0);
        var sdEnd    = new Date(parseInt(sdParts[0]), parseInt(sdParts[1]) - 1, parseInt(sdParts[2]), 23, 59, 0);
        var sdEvents = cal.getEvents(sdStart, sdEnd);
        sdEvents.forEach(function(ev) {
          if (ev.getTitle().indexOf(custName) !== -1) {
            ev.deleteEvent();
            Logger.log("Deleted skipped calendar event for " + custName + " on " + skippedDate);
          }
        });
      }
    } catch (calErr) { Logger.log("Skip calendar delete error: " + calErr); }

    // 3. Calculate next recurring date from the skipped date
    var nextDateStr = "";
    var nextDate = null;
    try {
      var parts = skippedDate.split("-");
      var skippedDt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));

      if (freq === "biweekly") {
        nextDate = new Date(skippedDt);
        nextDate.setDate(nextDate.getDate() + 14);
      } else if (freq === "monthly") {
        var dow     = skippedDt.getDay();
        var weekPos = Math.ceil(skippedDt.getDate() / 7);
        var testN   = new Date(skippedDt);
        testN.setDate(testN.getDate() + 7);
        var isLast  = testN.getMonth() !== skippedDt.getMonth();
        var nm = skippedDt.getMonth() + 1;
        var ny = skippedDt.getFullYear();
        if (nm > 11) { nm = 0; ny++; }
        nextDate = getNthWeekdayOfMonth(ny, nm, dow, weekPos, isLast);
      }

      if (nextDate) nextDateStr = formatDateStr(nextDate);
    } catch (calcErr) { Logger.log("Next date calc error: " + calcErr); }

    // 4. Check if a booking already exists for next date (match email + date + make + model, ignore time)
    var nextBookingExists = false;
    var freshRows = sheet.getDataRange().getDisplayValues();

    // Also get the current time from the sheet for this client/vehicle
    // in case it was updated after the frontend loaded
    var currentTime = skippedTime;
    for (var fi = 1; fi < freshRows.length; fi++) {
      var fiEmail  = String(freshRows[fi][3] || "").trim().toLowerCase();
      var fiMake   = String(freshRows[fi][7] || "").trim().toLowerCase();
      var fiModel  = String(freshRows[fi][8] || "").trim().toLowerCase();
      var fiStatus = String(freshRows[fi][28] || "").trim();
      var fiType   = String(freshRows[fi][26] || "").trim();
      var fiTime   = String(freshRows[fi][5] || "").trim();
      if (fiEmail === custEmail.toLowerCase() &&
          fiMake  === String(data.make  || "").trim().toLowerCase() &&
          fiModel === String(data.model || "").trim().toLowerCase() &&
          fiType  === "maintenance" &&
          fiStatus !== "Cancelled" && fiStatus !== "Completed" && fiStatus !== "Skipped" &&
          fiTime) {
        currentTime = fiTime; // use the most up-to-date time from sheet
        break;
      }
    }

    if (nextDateStr) {
      for (var j = 1; j < freshRows.length; j++) {
        var rowEmail  = String(freshRows[j][3]).trim().toLowerCase();
        var rowDate   = String(freshRows[j][4]).trim();
        var rowMakeJ  = String(freshRows[j][7]).trim().toLowerCase();
        var rowModelJ = String(freshRows[j][8]).trim().toLowerCase();
        var rowStatus = String(freshRows[j][28]).trim();
        var sameEmail = rowEmail === custEmail.toLowerCase();
        var sameDate  = rowDate  === nextDateStr;
        var sameCar   = rowMakeJ === String(data.make  || "").trim().toLowerCase() &&
                        rowModelJ === String(data.model || "").trim().toLowerCase();
        var notDone   = rowStatus !== "Skipped" && rowStatus !== "Cancelled";
        if (sameEmail && sameDate && sameCar && notDone) {
          nextBookingExists = true;
          Logger.log("Next booking already exists for " + custEmail + " on " + nextDateStr + " (" + data.make + " " + data.model + ")");
          break;
        }
      }
    }

    // 5. Create next maintenance booking using the CURRENT time from sheet (not stale frontend time)
    if (nextDateStr && !nextBookingExists) {
      sheet.appendRow([
        new Date(),
        data.name         || "", data.phone        || "", data.email        || "",
        nextDateStr,              currentTime,      // ← always use freshest time
        data.year         || "", data.make         || "", data.model        || "",
        data.boatSize     || "", data.vehicle      || "", data.packageType  || "",
        data.hourlyRate   || "", data.addOns       || "", "",
        data.serviceType  || "", data.address      || "", "", "", "", "", "", "", "",
        data.avgTime      || "", data.notes        || "",
        "maintenance",    freq,  "Booked", "", "", "",
      ]);
      Logger.log("Created next maintenance booking on " + nextDateStr + " for " + custEmail);

      // Also create a calendar event for the next date — only if one doesn't already exist
      try {
        var calNext = CalendarApp.getCalendarById(CALENDAR_ID);
        if (calNext && nextDate) {
          var nParts = nextDateStr.split("-");
          var nHour = 9; var nMin = 0;
          if (currentTime) {
            var ntl = currentTime.toLowerCase();
            var ntn = currentTime.replace(/[^0-9:]/g, "").split(":");
            nHour = parseInt(ntn[0]) || 9;
            nMin  = parseInt(ntn[1]) || 0;
            if (ntl.indexOf("pm") !== -1 && nHour !== 12) nHour += 12;
            if (ntl.indexOf("am") !== -1 && nHour === 12) nHour = 0;
          }

          // Check if event already exists for this date and client (from backfill or initial booking)
          var nextDayStart = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), 0, 0, 0);
          var nextDayEnd   = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), 23, 59, 0);
          var nextExisting = calNext.getEvents(nextDayStart, nextDayEnd);
          var nextEventExists = nextExisting.some(function(ev) {
            return ev.getTitle().indexOf(custName) !== -1;
          });

          if (!nextEventExists) {
            var nStart = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), nHour, nMin, 0);
            var nEnd   = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), nHour + 2, nMin, 0);
            var nTitle = pkgLabel + " - " + custName + " (Maintenance)";
            var nDesc  =
              "Client: " + custName + "\n" +
              "Phone: " + String(data.phone || "").trim() + "\n" +
              "Email: " + custEmail + "\n" +
              "Vehicle: " + vehicle + "\n" +
              "Package: " + pkgLabel + "\n" +
              "Plan: Maintenance Plan (" + (freq === "biweekly" ? "Bi-Weekly" : "Monthly") + ")\n" +
              (String(data.address || "").trim() ? "Address: " + String(data.address || "").trim() : "");
            calNext.createEvent(nTitle, nStart, nEnd, { description: nDesc, location: String(data.address || "").trim() });
            Logger.log("Created calendar event for next maintenance date: " + nextDateStr);
          } else {
            Logger.log("Calendar event already exists for " + custName + " on " + nextDateStr + " — skipping creation");
          }
        }
      } catch (calNextErr) { Logger.log("Next date calendar error: " + calNextErr); }
    }

    // 6. Friendly labels (defined here so calendar block can use pkgLabel)
    var skippedDateLabel = friendlyDate(skippedDate);
    var nextDateLabel    = nextDateStr ? friendlyDate(nextDateStr) : "your next scheduled date";
    var displayTime      = currentTime || skippedTime; // use freshest time from sheet
    var pkgLabel = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : pkgType || "Maintenance Detail";

    // 6. Update Google Calendar — delete skipped event, create next one
    try {
      var calendar = CalendarApp.getCalendarById(CALENDAR_ID);
      if (calendar && skippedDate) {
        // Delete the skipped event
        var skipParts = skippedDate.split("-");
        var skipStart = new Date(parseInt(skipParts[0]), parseInt(skipParts[1]) - 1, parseInt(skipParts[2]), 0, 0, 0);
        var skipEnd   = new Date(parseInt(skipParts[0]), parseInt(skipParts[1]) - 1, parseInt(skipParts[2]), 23, 59, 0);
        var skipEvents = calendar.getEvents(skipStart, skipEnd);
        skipEvents.forEach(function(ev) {
          if (ev.getTitle().indexOf(custName) !== -1) {
            ev.deleteEvent();
            Logger.log("Deleted skipped calendar event for " + custName + " on " + skippedDate);
          }
        });

      }
    } catch (calErr) { Logger.log("Calendar update error in skip: " + calErr); }

    // 8. Send email to customer
    if (custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      var subject = "Maintenance Appointment Skipped | ATX Prestige Detailing";
      var plain =
        "Hi " + custName + ",\n\n" +
        "Your upcoming maintenance detail has been skipped.\n\n" +
        "Skipped: " + skippedDateLabel + (displayTime ? " at " + displayTime : "") + "\n" +
        "Service: " + pkgLabel + "\n" +
        "Vehicle: " + vehicle + "\n\n" +
        "Your next maintenance detail is scheduled for:\n" +
        nextDateLabel + (displayTime ? " at " + displayTime : "") + "\n\n" +
        "If you have any questions, please reach out.\n\n" +
        "Thank you,\nATX Prestige Detailing\nbook.atxprestigedetailing.com";

      var html =
        "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
        "<div style='max-width:600px;margin:0 auto;padding:32px 16px;font-family:Arial,sans-serif;background:#f5f4f2;'>" +
        "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:24px 32px;'>" +
        "<div style='font-size:20px;font-weight:800;color:#fff;'>ATX Prestige Detailing</div>" +
        "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;'>Maintenance Plan Update</div>" +
        "</div>" +
        "<div style='background:#fff;padding:32px;border:1px solid #e5e7eb;'>" +
        "<p style='margin:0 0 20px;font-size:15px;color:#374151;'>Hi " + custName + ",</p>" +
        "<p style='margin:0 0 24px;font-size:15px;color:#374151;'>Your upcoming maintenance detail has been skipped. Your plan continues on its regular schedule — here is your next appointment.</p>" +
        // Skipped box
        "<div style='background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:12px;padding:18px 20px;margin-bottom:14px;'>" +
        "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;'>Skipped Appointment</div>" +
        "<div style='font-size:16px;font-weight:700;color:#0369a1;text-decoration:line-through;opacity:0.7;'>" + skippedDateLabel + (displayTime ? " at " + displayTime : "") + "</div>" +
        "<div style='font-size:13px;color:#6b7280;margin-top:6px;'>" + pkgLabel + " &nbsp;&middot;&nbsp; " + vehicle + "</div>" +
        "</div>" +
        // Next appointment box
        "<div style='background:#f0fdf4;border:1.5px solid #6ee7b7;border-radius:12px;padding:18px 20px;margin-bottom:24px;'>" +
        "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;'>Your Next Maintenance Detail</div>" +
        "<div style='font-size:22px;font-weight:800;color:#065f46;'>" + nextDateLabel + "</div>" +
        (displayTime ? "<div style='font-size:16px;color:#047857;margin-top:4px;'>" + displayTime + "</div>" : "") +
        "<div style='font-size:13px;color:#6b7280;margin-top:8px;'>Your maintenance plan continues on its regular schedule.</div>" +
        "</div>" +
        "<div style='background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#374151;'>" +
        "If this doesn't look right or you have any questions about your schedule, please reach out to us right away." +
        "</div>" +
        "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;'>View My Bookings</a>" +
        "</div>" +
        "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;'>" +
        "<p style='margin:0;font-size:11px;color:#9ca3af;'>ATX Prestige Detailing | Lago Vista, TX | atxprestigedetailing.com</p>" +
        "</div></div></body></html>";

      GmailApp.sendEmail(custEmail, subject, plain, {
        from: "atxprestigedetailing@gmail.com",
        name: "ATX Prestige Detailing",
        htmlBody: html,
        charset: "UTF-8",
      });
    }

    // 9. SMS
    if (custPhone) {
      var smsMsg = "Hi " + custName + "! Your ATX Prestige Detailing maintenance on " + skippedDateLabel + " has been skipped. Your next detail is " + nextDateLabel + (displayTime ? " at " + displayTime : "") + ". See you then!";
      sendSMS(custPhone, smsMsg);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, nextDate: nextDateLabel }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("skipMaintenanceBooking error: " + err);
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── resumeMaintenancePlan ────────────────────────────────────────────────────
// Resumes a paused maintenance plan onto the next slot on its existing
// cadence, computed from today forward (not wherever the old schedule would
// have landed after months paused). Silent by default — SMS/email only fire
// if notifySms/notifyEmail are true.

function resumeMaintenancePlan(data) {
  try {
    var custEmail   = String(data.customerEmail || data.email || "").trim();
    var custName    = String(data.customerName  || data.name  || "").trim();
    var custPhone   = String(data.customerPhone || data.phone || "").trim();
    var freq        = String(data.recurringFrequency || "").trim();
    var pausedDate  = String(data.date || "").trim();
    var pkgType     = String(data.packageType || "").trim();
    var vehicleLbl  = String(data.vehicleLabel || data.vehicle || "").trim();

    if (!custEmail || !freq || !pausedDate) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing email, frequency, or date" })).setMimeType(ContentService.MimeType.JSON);
    }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var nextDateStr = nextOccurrenceOnOrAfter(pausedDate, freq, today);

    var appendResult = appendMaintenanceRow(data, nextDateStr);

    if (!appendResult.skipped) {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var availSheet = ss.getSheetByName(AVAILABILITY_SHEET);
      var timeToUse = String(data.time || "").trim();

      // Block the availability slot for the new date
      try {
        var availRows = availSheet.getDataRange().getDisplayValues();
        for (var i = 1; i < availRows.length; i++) {
          if (String(availRows[i][0]).trim() === nextDateStr && String(availRows[i][1]).trim() === timeToUse) {
            availSheet.getRange(i + 1, 3).setValue(false);
            break;
          }
        }
      } catch (avErr) { Logger.log("Resume availability block error: " + avErr); }

      // Create the calendar event for the new date
      try {
        var cal = CalendarApp.getCalendarById(CALENDAR_ID);
        if (cal && nextDateStr) {
          var nParts = nextDateStr.split("-");
          var nHour = 9, nMin = 0;
          if (timeToUse) {
            var tl = timeToUse.toLowerCase();
            var tn = timeToUse.replace(/[^0-9:]/g, "").split(":");
            nHour = parseInt(tn[0]) || 9;
            nMin  = parseInt(tn[1]) || 0;
            if (tl.indexOf("pm") !== -1 && nHour !== 12) nHour += 12;
            if (tl.indexOf("am") !== -1 && nHour === 12) nHour = 0;
          }
          var nStart = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), nHour, nMin, 0);
          var nEnd   = new Date(parseInt(nParts[0]), parseInt(nParts[1]) - 1, parseInt(nParts[2]), nHour + 2, nMin, 0);
          var pkgLabel = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : pkgType || "Maintenance Detail";
          var nTitle = pkgLabel + " - " + custName + " (Maintenance)";
          var nDesc  =
            "Client: " + custName + "\n" +
            "Phone: " + custPhone + "\n" +
            "Email: " + custEmail + "\n" +
            "Vehicle: " + vehicleLbl + "\n" +
            "Package: " + pkgLabel + "\n" +
            "Plan: Maintenance Plan (" + (freq === "biweekly" ? "Bi-Weekly" : "Monthly") + ")" +
            (String(data.address || "").trim() ? "\nAddress: " + String(data.address || "").trim() : "");
          cal.createEvent(nTitle, nStart, nEnd, { description: nDesc, location: String(data.address || "").trim() });
        }
      } catch (calErr) { Logger.log("Resume calendar create error: " + calErr); }
    }

    var nextDateLabel = friendlyDate(nextDateStr);
    Logger.log("Resumed maintenance plan for " + custEmail + " — next date " + nextDateStr);

    if (data.notifyEmail && custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      try {
        var subject = "Maintenance Plan Resumed | ATX Prestige Detailing";
        var plain =
          "Hi " + custName + ",\n\n" +
          "Your maintenance plan has been resumed. Your next appointment is scheduled for:\n\n" +
          nextDateLabel + (data.time ? " at " + data.time : "") + "\n\n" +
          "If you have any questions, please reach out.\n\nThank you,\nATX Prestige Detailing";
        GmailApp.sendEmail(custEmail, subject, plain, { from: "atxprestigedetailing@gmail.com", name: "ATX Prestige Detailing" });
      } catch (emailErr) { Logger.log("Resume email error: " + emailErr); }
    }

    if (data.notifySms && custPhone) {
      try {
        sendSMS(custPhone, "Hi " + custName + "! Your ATX Prestige Detailing maintenance plan has been resumed. Your next detail is " + nextDateLabel + (data.time ? " at " + data.time : "") + ".");
      } catch (smsErr) { Logger.log("Resume SMS error: " + smsErr); }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, nextDate: nextDateLabel })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("resumeMaintenancePlan error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── checkMaintenanceTimeConflicts ───────────────────────────────────────────
// Checks if a proposed new time for a maintenance schedule conflicts with
// any existing bookings across all future recurring dates

function checkMaintenanceTimeConflicts(data) {
  try {
    var ss        = SpreadsheetApp.openById(SHEET_ID);
    var sheet     = ss.getSheetByName(BOOKINGS_SHEET);
    var custEmail = String(data.customerEmail || "").trim().toLowerCase();
    var make      = String(data.make          || "").trim().toLowerCase();
    var model     = String(data.model         || "").trim().toLowerCase();
    var newTime   = String(data.newTime       || "").trim();
    var freq      = String(data.frequency     || "").trim();
    var refDate   = String(data.refDate       || "").trim();

    if (!newTime || !freq || !refDate) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing required fields" })).setMimeType(ContentService.MimeType.JSON);
    }

    var today      = new Date(); today.setHours(0, 0, 0, 0);
    var oneYearOut = new Date(); oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    var rows       = sheet.getDataRange().getDisplayValues();

    // Generate all future recurring dates for this schedule
    var futureDates = [refDate];
    var recurDates  = calcRecurringDatesGS(refDate, freq, 52);
    for (var i = 0; i < recurDates.length; i++) {
      var dp  = recurDates[i].split("-");
      var dt  = new Date(parseInt(dp[0]), parseInt(dp[1]) - 1, parseInt(dp[2]));
      if (dt >= today && dt <= oneYearOut) futureDates.push(recurDates[i]);
    }

    // Build a map of date+time -> bookings (excluding this client's own maintenance bookings)
    var conflicts = [];
    for (var r = 1; r < rows.length; r++) {
      var rEmail  = String(rows[r][3]  || "").trim().toLowerCase();
      var rDate   = String(rows[r][4]  || "").trim();
      var rTime   = String(rows[r][5]  || "").trim();
      var rStatus = String(rows[r][28] || "").trim();
      var rName   = String(rows[r][1]  || "").trim();
      var rMake   = String(rows[r][7]  || "").trim().toLowerCase();
      var rModel  = String(rows[r][8]  || "").trim().toLowerCase();
      var rType   = String(rows[r][26] || "").trim();

      if (rStatus === "Cancelled" || rStatus === "Completed" || rStatus === "Skipped") continue;
      if (!rDate || !rTime) continue;

      // Skip this client's own bookings for this vehicle
      if (rEmail === custEmail && rMake === make && rModel === model) continue;

      // Normalize time for comparison
      var rTimeNorm = rTime.trim().toUpperCase();
      var newTimeNorm = newTime.trim().toUpperCase();

      // Check if this booking falls on one of our future dates at the new time
      if (futureDates.indexOf(rDate) !== -1 && rTimeNorm === newTimeNorm) {
        conflicts.push({
          date:       rDate,
          dateLabel:  friendlyDate(rDate),
          time:       rTime,
          clientName: rName,
          clientType: rType,
          vehicle:    [String(rows[r][6] || "").trim(), String(rows[r][7] || "").trim(), String(rows[r][8] || "").trim()].filter(Boolean).join(" "),
        });
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success:    true,
      conflicts:  conflicts,
      datesChecked: futureDates.length,
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("checkMaintenanceTimeConflicts error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── updateMaintenanceTime ────────────────────────────────────────────────────
// Updates the time on ALL future maintenance bookings for a client/vehicle
// and updates all corresponding calendar events

function updateMaintenanceTime(data) {
  try {
    var ss         = SpreadsheetApp.openById(SHEET_ID);
    var sheet      = ss.getSheetByName(BOOKINGS_SHEET);
    var cal        = CalendarApp.getCalendarById(CALENDAR_ID);
    var custEmail  = String(data.customerEmail || "").trim().toLowerCase();
    var custName   = String(data.customerName  || "").trim();
    var custPhone  = String(data.customerPhone || "").trim();
    var make       = String(data.make          || "").trim().toLowerCase();
    var model      = String(data.model         || "").trim().toLowerCase();
    var newTime    = String(data.newTime       || "").trim();

    if (!custEmail || !newTime) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Missing email or time" })).setMimeType(ContentService.MimeType.JSON);
    }

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var rows  = sheet.getDataRange().getDisplayValues();

    // Parse new time
    var newHour = 9; var newMin = 0;
    var ntl = newTime.toLowerCase();
    var ntn = newTime.replace(/[^0-9:]/g, "").split(":");
    newHour = parseInt(ntn[0]) || 9;
    newMin  = parseInt(ntn[1]) || 0;
    if (ntl.indexOf("pm") !== -1 && newHour !== 12) newHour += 12;
    if (ntl.indexOf("am") !== -1 && newHour === 12) newHour = 0;

    var updatedRows = 0;
    var updatedCal  = 0;
    var oldTime     = ""; // capture before overwriting

    // 1. Update time in all future booking rows for this client + vehicle
    for (var r = 1; r < rows.length; r++) {
      var rEmail  = String(rows[r][3]  || "").trim().toLowerCase();
      var rMake   = String(rows[r][7]  || "").trim().toLowerCase();
      var rModel  = String(rows[r][8]  || "").trim().toLowerCase();
      var rDate   = String(rows[r][4]  || "").trim();
      var rStatus = String(rows[r][28] || "").trim();
      var rType   = String(rows[r][26] || "").trim();

      if (rEmail !== custEmail) continue;
      if (rMake  !== make || rModel !== model) continue;
      if (rType  !== "maintenance") continue;
      if (rStatus === "Cancelled" || rStatus === "Completed" || rStatus === "Skipped") continue;
      if (!rDate) continue;

      var rParts = rDate.split("-");
      var rDt = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]));
      if (rDt < today) continue;

      // Capture old time from the first matching row before overwriting
      if (!oldTime) oldTime = String(rows[r][5] || "").trim();

      // Update time column (col 6 = F)
      sheet.getRange(r + 1, 6).setValue(newTime);
      updatedRows++;

      // 2. Find and update the calendar event for this date
      if (cal) {
        try {
          var dayStart = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 0, 0, 0);
          var dayEnd   = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), 23, 59, 0);
          var events   = cal.getEvents(dayStart, dayEnd);
          events.forEach(function(ev) {
            if (ev.getTitle().indexOf(custName) !== -1) {
              // Delete old event and recreate at new time
              var desc     = ev.getDescription();
              var location = ev.getLocation();
              var title    = ev.getTitle();
              ev.deleteEvent();

              var newStart = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), newHour, newMin, 0);
              var newEnd   = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]), newHour + 2, newMin, 0);
              cal.createEvent(title, newStart, newEnd, { description: desc, location: location });
              updatedCal++;
            }
          });
        } catch (calErr) { Logger.log("Cal update error for " + rDate + ": " + calErr); }
        Utilities.sleep(100);
      }
    }

    // 3. Also update all future recurring dates that may only be in the calendar
    // (not yet in the sheet) — find them by scanning calendar events for this client
    // within the next 12 months and update any matching ones
    if (cal) {
      var oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      var scanStart = new Date(today);
      var allFutureEvents = cal.getEvents(scanStart, oneYearOut);
      allFutureEvents.forEach(function(ev) {
        if (ev.getTitle().indexOf(custName) === -1) return;
        var desc = ev.getDescription() || "";
        if (desc.indexOf(make) === -1 && desc.indexOf(model) === -1) return;
        // Check if this event time already matches the new time
        var evStart = ev.getStartTime();
        if (evStart.getHours() === newHour && evStart.getMinutes() === newMin) return;
        // Update it
        try {
          var oldStart   = ev.getStartTime();
          var oldEnd     = ev.getEndTime();
          var dur        = (oldEnd - oldStart) / 60000; // duration in minutes
          var newEvStart = new Date(oldStart.getFullYear(), oldStart.getMonth(), oldStart.getDate(), newHour, newMin, 0);
          var newEvEnd   = new Date(newEvStart.getTime() + dur * 60000);
          var evDesc     = ev.getDescription();
          var evLoc      = ev.getLocation();
          var evTitle    = ev.getTitle();
          ev.deleteEvent();
          cal.createEvent(evTitle, newEvStart, newEvEnd, { description: evDesc, location: evLoc });
          updatedCal++;
          Utilities.sleep(100);
        } catch (e) { Logger.log("Calendar time update error: " + e); }
      });
    }

    Logger.log("updateMaintenanceTime: updated " + updatedRows + " sheet rows and " + updatedCal + " calendar events for " + custEmail);

    // 4. Send notification email to client (unless the caller explicitly suppressed it)
    if (data.notify !== false && custEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(custEmail)) {
      try {
        var subject = "Your Maintenance Schedule Has Been Updated | ATX Prestige Detailing";
        var freqLabel = "recurring";
        // Get frequency from the first matching row
        for (var fr = 1; fr < rows.length; fr++) {
          if (String(rows[fr][3] || "").trim().toLowerCase() === custEmail &&
              String(rows[fr][7] || "").trim().toLowerCase() === make &&
              String(rows[fr][8] || "").trim().toLowerCase() === model &&
              String(rows[fr][26] || "").trim() === "maintenance") {
            var fq = String(rows[fr][27] || "").trim();
            freqLabel = fq === "biweekly" ? "Bi-Weekly" : fq === "monthly" ? "Monthly" : fq;
            break;
          }
        }

        var plain =
          "Hi " + custName + ",\n\n" +
          "Your maintenance detail schedule has been updated.\n\n" +
          "Your " + freqLabel + " maintenance appointments for your " + String(data.make || "").trim() + " " + String(data.model || "").trim() + " have been rescheduled:\n\n" +
          (oldTime ? "Previous Time: " + oldTime + "\n" : "") +
          "New Time: " + newTime + "\n\n" +
          "All upcoming appointments and calendar events have been updated to reflect this change.\n\n" +
          "If this doesn't look right, please reach out and we'll get it sorted out right away.\n\n" +
          "Thank you,\nATX Prestige Detailing\nbook.atxprestigedetailing.com";

        var vehicleDisplay = String(data.make || "").trim() + " " + String(data.model || "").trim();

        var html =
          "<!DOCTYPE html><html><head><meta charset='UTF-8'></head><body>" +
          "<div style='max-width:600px;margin:0 auto;padding:32px 16px;font-family:Arial,sans-serif;background:#f5f4f2;'>" +
          "<div style='background:#0f0f0f;border-radius:16px 16px 0 0;padding:24px 32px;'>" +
          "<div style='font-size:20px;font-weight:800;color:#fff;'>ATX Prestige Detailing</div>" +
          "<div style='font-size:12px;color:rgba(255,255,255,0.5);margin-top:4px;'>Maintenance Schedule Updated</div>" +
          "</div>" +
          "<div style='background:#fff;padding:32px;border:1px solid #e5e7eb;'>" +
          "<p style='margin:0 0 20px;font-size:15px;color:#374151;'>Hi " + custName + ",</p>" +
          "<p style='margin:0 0 24px;font-size:15px;color:#374151;'>Your maintenance detail schedule has been updated. Here's what changed:</p>" +

          // Change box
          "<div style='background:#f0f9ff;border:1.5px solid #7dd3fc;border-radius:12px;padding:20px;margin-bottom:20px;'>" +
          "<div style='font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:12px;'>Schedule Update</div>" +
          "<table style='width:100%;border-collapse:collapse;font-size:14px;'>" +
          "<tr><td style='padding:7px 0;color:#6b7280;width:140px;'>Vehicle</td><td style='padding:7px 0;font-weight:600;color:#111;'>" + vehicleDisplay + "</td></tr>" +
          "<tr style='border-top:1px solid #e0f2fe;'><td style='padding:7px 0;color:#6b7280;'>Plan</td><td style='padding:7px 0;font-weight:600;color:#111;'>" + freqLabel + " Maintenance</td></tr>" +
          (oldTime ? "<tr style='border-top:1px solid #e0f2fe;'><td style='padding:7px 0;color:#6b7280;'>Previous Time</td><td style='padding:7px 0;font-weight:600;color:#6b7280;text-decoration:line-through;'>" + oldTime + "</td></tr>" : "") +
          "<tr style='border-top:1px solid #e0f2fe;'><td style='padding:7px 0;color:#6b7280;'>New Time</td><td style='padding:7px 0;font-weight:800;color:#0369a1;font-size:16px;'>" + newTime + "</td></tr>" +
          "</table>" +
          "</div>" +

          "<div style='background:#f0fdf4;border:1px solid #6ee7b7;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#065f46;'>" +
          "All upcoming appointments and calendar events have been updated to reflect this new time." +
          "</div>" +

          "<div style='background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:12px 16px;margin-bottom:24px;font-size:13px;color:#92400e;'>" +
          "If this doesn't look right or wasn't what you expected, please reach out to us right away and we'll get it sorted out." +
          "</div>" +

          "<a href='https://book.atxprestigedetailing.com' style='display:inline-block;background:#0f0f0f;color:#fff;border-radius:10px;padding:12px 22px;font-size:14px;font-weight:700;text-decoration:none;'>View My Bookings</a>" +
          "</div>" +
          "<div style='background:#f5f4f2;border-radius:0 0 16px 16px;padding:14px 32px;text-align:center;'>" +
          "<p style='margin:0;font-size:11px;color:#9ca3af;'>ATX Prestige Detailing | Lago Vista, TX | atxprestigedetailing.com</p>" +
          "</div></div></body></html>";

        GmailApp.sendEmail(custEmail, subject, plain, {
          from: "atxprestigedetailing@gmail.com",
          name: "ATX Prestige Detailing",
          htmlBody: html,
          charset: "UTF-8",
        });
        Logger.log("Schedule time update email sent to " + custEmail);
      } catch (emailErr) { Logger.log("Time update email error: " + emailErr); }
    }

    // 5. SMS notification (unless the caller explicitly suppressed it)
    if (data.notify !== false && custPhone) {
      try {
        var vehicleSms = String(data.make || "").trim() + " " + String(data.model || "").trim();
        var smsMsg = "Hi " + custName + "! Your ATX Prestige Detailing maintenance schedule for your " + vehicleSms + " has been updated. All future appointments will now be at " + newTime + ". Questions? Just reach out!";
        sendSMS(custPhone, smsMsg);
      } catch (smsErr) { Logger.log("Time update SMS error: " + smsErr); }
    }

    return ContentService.createTextOutput(JSON.stringify({ success: true, updatedRows: updatedRows, updatedCal: updatedCal })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    Logger.log("updateMaintenanceTime error: " + err);
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ─── backfillMaintenanceCalendarEvents ───────────────────────────────────────
// Run this ONCE manually in the Apps Script editor to create calendar events
// for all existing maintenance clients who are missing them.

function backfillMaintenanceCalendarEvents() {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var sheet   = ss.getSheetByName(BOOKINGS_SHEET);
  var cal     = CalendarApp.getCalendarById(CALENDAR_ID);
  var rows    = sheet.getDataRange().getDisplayValues();
  var today   = new Date(); today.setHours(0, 0, 0, 0);

  if (!cal) { Logger.log("Calendar not found"); return; }

  var createdCount = 0;
  var skippedCount = 0;

  // Group by email + make + model so each vehicle gets its own schedule
  var schedules = {};
  for (var r = 1; r < rows.length; r++) {
    var rType   = String(rows[r][26] || "").trim();
    var rStatus = String(rows[r][28] || "").trim();
    var rEmail  = String(rows[r][3]  || "").trim().toLowerCase();
    var rDate   = String(rows[r][4]  || "").trim();
    var rFreq   = String(rows[r][27] || "").trim();
    var rMake   = String(rows[r][7]  || "").trim().toLowerCase();
    var rModel  = String(rows[r][8]  || "").trim().toLowerCase();

    if (rType !== "maintenance") continue;
    if (rStatus === "Cancelled" || rStatus === "Completed" || rStatus === "Skipped") continue;
    if (!rDate || !rFreq) continue;

    var rParts = rDate.split("-");
    if (rParts.length !== 3) continue;
    var rDt = new Date(parseInt(rParts[0]), parseInt(rParts[1]) - 1, parseInt(rParts[2]));
    if (rDt < today) continue;

    // Key = email + make + model — each vehicle gets its own entry
    var key = rEmail + "|" + rMake + "|" + rModel;
    if (!schedules[key]) {
      schedules[key] = { bookings: [] };
    }
    schedules[key].bookings.push({
      date: rDate,
      time: String(rows[r][5] || "").trim(),
      freq: rFreq,
      row:  rows[r]
    });
  }

  var oneYearOut = new Date();
  oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

  for (var key in schedules) {
    var schedule = schedules[key];
    var bookings = schedule.bookings.sort(function(a, b) { return a.date.localeCompare(b.date); });
    if (!bookings.length) continue;

    // Use the earliest upcoming booking as the reference for this vehicle
    var ref      = bookings[0];
    var refRow   = ref.row;
    var custName = String(refRow[1] || "").trim();
    var email    = String(refRow[3] || "").trim();
    var freq     = ref.freq;
    var bTime    = ref.time;  // ← time from THIS vehicle's booking, not mixed up
    var pkgType  = String(refRow[11] || "").trim();
    var address  = String(refRow[16] || "").trim();
    var svcType  = String(refRow[15] || "").trim();
    var addOns   = String(refRow[13] || "").trim();
    var notes    = String(refRow[25] || "").trim();

    var vehicle = "";
    if (String(refRow[10] || "").trim() === "boat") {
      vehicle = [refRow[9], refRow[7], refRow[8]].filter(Boolean).join(" ");
    } else {
      vehicle = [refRow[6], refRow[7], refRow[8]].filter(Boolean).join(" ");
    }

    var pkgLabel  = pkgType === "basic" ? "Basic Detail" : pkgType === "premium" ? "Premium Detail" : pkgType === "exterior" ? "Exterior Only - Basic" : pkgType === "exteriorPremium" ? "Exterior Only - Premium" : pkgType === "interior" ? "Interior Only - Basic" : pkgType === "interiorPremium" ? "Interior Only - Premium" : pkgType || "Maintenance Detail";
    var freqLabel = freq === "biweekly" ? "Bi-Weekly" : freq === "monthly" ? "Monthly" : freq;
    var location  = (svcType === "mobile" && address) ? address : (svcType === "dropoff" ? "Drop-Off Service" : "");

    // Parse this vehicle's specific booking time
    var startHour = 9; var startMin = 0;
    if (bTime) {
      var tl = bTime.toLowerCase();
      var tn = bTime.replace(/[^0-9:]/g, "").split(":");
      startHour = parseInt(tn[0]) || 9;
      startMin  = parseInt(tn[1]) || 0;
      if (tl.indexOf("pm") !== -1 && startHour !== 12) startHour += 12;
      if (tl.indexOf("am") !== -1 && startHour === 12) startHour = 0;
    }

    var eventTitle = pkgLabel + " - " + custName + " (Maintenance)";

    var desc =
      "Client: " + custName + "\n" +
      "Email: " + email + "\n" +
      "Phone: " + String(refRow[2] || "").trim() + "\n" +
      "Vehicle: " + vehicle + "\n" +
      "Package: " + pkgLabel + "\n" +
      "Plan: Maintenance Plan (" + freqLabel + ")\n" +
      "Service: " + (svcType === "mobile" ? "Mobile Service" : "Drop-Off Service") +
      (address ? "\nAddress: " + address : "") +
      (addOns && addOns !== "None" ? "\nAdd-Ons: " + addOns : "") +
      (notes ? "\nNotes: " + notes : "");

    // All dates for this vehicle: start from ref date, generate up to 1 year out
    var allDates = [ref.date];
    var recurDates = calcRecurringDatesGS(ref.date, freq, 52);
    for (var rd = 0; rd < recurDates.length; rd++) {
      var rdp = recurDates[rd].split("-");
      var rdt = new Date(parseInt(rdp[0]), parseInt(rdp[1]) - 1, parseInt(rdp[2]));
      if (rdt >= today && rdt <= oneYearOut) allDates.push(recurDates[rd]);
    }

    // Also include any already-booked dates not in the generated list
    bookings.forEach(function(b) {
      if (allDates.indexOf(b.date) === -1) allDates.push(b.date);
    });

    allDates.sort();

    Logger.log("Processing: " + custName + " / " + vehicle + " / " + freq + " / " + bTime + " — " + allDates.length + " dates");

    for (var di = 0; di < allDates.length; di++) {
      var dateStr = allDates[di];
      var dp2 = dateStr.split("-");
      var evDt = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]));
      if (evDt < today || evDt > oneYearOut) continue;

      // Check if an event already exists for this vehicle on this date
      var dayStart2 = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]), 0, 0, 0);
      var dayEnd2   = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]), 23, 59, 0);
      var existing  = cal.getEvents(dayStart2, dayEnd2);
      var alreadyExists = existing.some(function(ev) {
        var t = ev.getTitle();
        // Match on client name — if they have two cars on same day this will skip,
        // but that's handled by the two vehicles having separate allDates lists
        return t.indexOf(custName) !== -1 && ev.getDescription().indexOf(vehicle) !== -1;
      });

      if (alreadyExists) {
        skippedCount++;
        continue;
      }

      var evStart2 = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]), startHour, startMin, 0);
      var evEnd2   = new Date(parseInt(dp2[0]), parseInt(dp2[1]) - 1, parseInt(dp2[2]), startHour + 2, startMin, 0);

      try {
        cal.createEvent(eventTitle, evStart2, evEnd2, { description: desc, location: location });
        createdCount++;
        Utilities.sleep(150);
      } catch (evErr) {
        Logger.log("Error creating event for " + custName + " / " + vehicle + " on " + dateStr + ": " + evErr);
      }
    }
  }

  Logger.log("Backfill complete. Created: " + createdCount + " events. Skipped (already existed): " + skippedCount + ".");
}

// ─── seedInventory (run once manually to load all starting items) ─────────────

function seedInventory() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName("Inventory");
  if (!sheet) { Logger.log("Inventory sheet not found"); return; }

  // Clear existing data below header
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) sheet.getRange(2, 1, lastRow - 1, 6).clearContent();

  // Set header row
  sheet.getRange(1, 1, 1, 6).setValues([["Item", "Category", "Quantity", "Unit", "Low Stock Threshold", "Notes"]]);
  sheet.getRange(1, 1, 1, 6).setFontWeight("bold");

  var items = [
    // Microfiber & Towels
    ["Microfiber Yellow 360gsm 75/35 Edgeless", "Microfiber & Towels", "1", "pack", "1", "Pack of 10"],
    ["White All Purpose Microfiber Towel", "Microfiber & Towels", "1", "pack", "1", "Pack of 12"],
    ["Red Gauntlet Drying Microfiber Towel", "Microfiber & Towels", "2", "pack", "1", ""],
    ["Microfiber 300gsm Light Blue", "Microfiber & Towels", "1", "pack", "1", "10 pack"],
    ["Microfiber Waffle Weave Towel", "Microfiber & Towels", "1", "each", "1", ""],
    ["All Purpose Microfiber Towel Black", "Microfiber & Towels", "1", "pack", "1", "24 pack"],
    ["Blue/White Rag Company Wash Mitts", "Microfiber & Towels", "2", "each", "1", ""],
    ["Rags to Riches Microfiber Detergent", "Microfiber & Towels", "0", "bottle", "1", ""],

    // Polishing Pads
    ["Orange Lake Country Polishing Foam Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Twisted Loop Wool Pad", "Polishing Pads", "0", "each", "1", ""],
    ["Knitted Blend Wool Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Buff and Shine Dual Side Long Pile Wool Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Lake Country Microfiber Blue Foam Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Lake Country Microfiber Orange Foam Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Lake Country Blue Polishing Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Lake Country Black Polishing Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Rupes Blue Cutting Foam Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Rupes White Polishing Foam Pad", "Polishing Pads", "2", "each", "1", ""],
    ["Rupes Yellow Polishing Foam Pad", "Polishing Pads", "2", "each", "1", ""],
    ["Uro Fiber Black Microfiber Pad", "Polishing Pads", "1", "each", "1", ""],
    ["Foam Drill Pads", "Polishing Pads", "0", "each", "2", ""],

    // Compounds & Polishes
    ["3D Hybrid Compound and Polish", "Compounds & Polishes", "0.25", "bottle", "0.25", ""],
    ["Rupes Fine Polishing Compound", "Compounds & Polishes", "1", "bottle", "0.25", ""],
    ["Rupes Uno1 Ultra Fine Finishing Polish", "Compounds & Polishes", "1", "bottle", "0.25", ""],
    ["Rupes Coarse Cutting Compound", "Compounds & Polishes", "0.25", "bottle", "0.25", ""],
    ["Meguiars Marine Wax", "Compounds & Polishes", "1", "bottle", "1", ""],
    ["Turtle Wax Seal N Shine", "Compounds & Polishes", "1", "bottle", "0.25", ""],
    ["VRP Vinyl/Rubber/Plastic Dressing", "Compounds & Polishes", "1", "bottle", "0.25", ""],
    ["Carpro Descale", "Compounds & Polishes", "1", "bottle", "0.25", ""],

    // Ceramic Coatings
    ["Gtechniq 3-5 Year Ceramic Coating", "Ceramic Coatings", "1", "kit", "1", ""],
    ["Gtechniq Smart Glass Window Ceramic Coating", "Ceramic Coatings", "1", "kit", "1", ""],
    ["Ceramic Coating Applicators", "Ceramic Coatings", "4", "each", "2", ""],

    // Chemicals & Cleaners
    ["Texas Super Blue Tire Dressing", "Chemicals & Cleaners", "0.5", "gallon", "0.25", ""],
    ["Magnum Wheel Cleaner", "Chemicals & Cleaners", "0.25", "gallon", "0.25", ""],
    ["Power Clean Wheel Acid", "Chemicals & Cleaners", "1", "gallon", "0.25", ""],
    ["Blue Power Wash Soap", "Chemicals & Cleaners", "0.25", "gallon", "0.25", ""],
    ["Fleet Wash Pre Wash", "Chemicals & Cleaners", "0.5", "gallon", "0.25", ""],
    ["APC Cleaner", "Chemicals & Cleaners", "0.75", "gallon", "0.25", ""],
    ["Isopropyl Alcohol", "Chemicals & Cleaners", "0.75", "gallon", "0.25", ""],
    ["Bug Goo Bug Cleaner", "Chemicals & Cleaners", "0.75", "gallon", "0.25", ""],
    ["Invisible Glass Cleaner", "Chemicals & Cleaners", "1", "can", "1", ""],
    ["Distilled Water", "Chemicals & Cleaners", "1", "gallon", "0.5", ""],
    ["Purple Power Cleaner", "Chemicals & Cleaners", "0.25", "bottle", "0.25", ""],
    ["Star Brite Hull Cleaner", "Chemicals & Cleaners", "1", "bottle", "0.25", ""],
    ["3M Adhesive Remover", "Chemicals & Cleaners", "1", "can", "1", "Spray can"],

    // Sandpaper & Abrasives
    ["Trizact 3000 Grit Sandpaper", "Sandpaper & Abrasives", "1", "pack", "1", "Pack of 1"],
    ["2000 Grit Sandpaper", "Sandpaper & Abrasives", "1", "pack", "1", "Pack of 5"],
    ["1500 Grit Sandpaper", "Sandpaper & Abrasives", "1", "pack", "1", "Pack of 5"],
    ["3M Headlight Clear Coat", "Sandpaper & Abrasives", "35", "each", "10", ""],
    ["Plastic Razor Blades", "Sandpaper & Abrasives", "1", "pack", "1", "50 count"],

    // Tools & Equipment
    ["Makita Rotary Polisher", "Tools & Equipment", "1", "each", "1", ""],
    ["Rupes DA Polisher", "Tools & Equipment", "1", "each", "1", ""],
    ["Bissell Spot Cleaner Extractor", "Tools & Equipment", "1", "each", "1", ""],
    ["Foam Cannon", "Tools & Equipment", "1", "each", "1", ""],
    ["Vortex Tornador", "Tools & Equipment", "1", "each", "1", ""],
    ["Green Works 2000 PSI Power Washer", "Tools & Equipment", "1", "each", "1", "2000 PSI 1.2 GPM"],
    ["McCulloch Steamer", "Tools & Equipment", "1", "each", "1", ""],
    ["Vevor Air Compressor", "Tools & Equipment", "1", "each", "1", ""],
    ["IK Foam Sprayer", "Tools & Equipment", "1", "each", "1", ""],
    ["Chemical Guys Pump Sprayer", "Tools & Equipment", "1", "each", "1", ""],
    ["DeWalt Drill", "Tools & Equipment", "1", "each", "1", ""],
    ["DeWalt Drill Batteries", "Tools & Equipment", "2", "each", "2", ""],

    // Brushes & Applicators
    ["Boars Hair Detail Brushes", "Brushes & Applicators", "3", "each", "2", ""],
    ["Lilly Brush", "Brushes & Applicators", "1", "each", "1", ""],
    ["Large Drill Brush Flat", "Brushes & Applicators", "1", "each", "1", ""],
    ["Medium Drill Brush Flat", "Brushes & Applicators", "1", "each", "1", ""],
    ["Medium Drill Brush Cone", "Brushes & Applicators", "1", "each", "1", ""],
    ["Small Drill Brush Flat", "Brushes & Applicators", "1", "each", "1", ""],
    ["SPTA Carpet Brush", "Brushes & Applicators", "1", "each", "1", ""],
    ["Long Regular Tire Brush", "Brushes & Applicators", "1", "each", "1", "No handle"],
    ["Long Wheel Brush", "Brushes & Applicators", "1", "each", "1", "With handle"],
    ["Red Soft Wool Wheel Cleaner", "Brushes & Applicators", "1", "each", "1", ""],
    ["Small Tire Dressing Brush", "Brushes & Applicators", "1", "each", "1", ""],
    ["Pad Brush", "Brushes & Applicators", "1", "each", "1", ""],

    // Accessories & Misc
    ["Orange Air Hose", "Accessories & Misc", "1", "each", "1", ""],
    ["Wheel Caps", "Accessories & Misc", "8", "each", "4", ""],
    ["Blue Scotch Tape", "Accessories & Misc", "0.25", "roll", "0.25", ""],
    ["Nu Car Air Fresheners", "Accessories & Misc", "0.25", "bag", "0.25", ""],
    ["Chemical Guy Detail Bucket", "Accessories & Misc", "1", "each", "1", ""],
    ["Yellow 12 Gauge Extension Cord", "Accessories & Misc", "1", "each", "1", ""],
    ["Red/White Extension Cord", "Accessories & Misc", "1", "each", "1", ""],
    ["Orange 16 Gauge Long Extension Cord", "Accessories & Misc", "1", "each", "1", ""],
    ["Turbo Nozzle for Power Washer", "Accessories & Misc", "1", "each", "1", ""],
    ["Soap Nozzle for Pressure Washer", "Accessories & Misc", "1", "each", "1", ""],
    ["40 Degree Nozzle for Pressure Washer", "Accessories & Misc", "1", "each", "1", ""],
    ["25 Degree Nozzle for Pressure Washer", "Accessories & Misc", "1", "each", "1", ""],
  ];

  sheet.getRange(2, 1, items.length, 6).setValues(items);
  Logger.log("Inventory seeded with " + items.length + " items.");
}

// ─── testPaymentEmail ─────────────────────────────────────────────────────────

function testPaymentEmail() {
  var result = sendPaymentConfirmedEmail({
    customerName:  "Emilio Estevez",
    customerEmail: "edwardestevez95@gmail.com",
    invoiceAmount: "350.00",
    serviceDate:   "2026-04-25",
  });
  Logger.log("Result: " + result.getContent());
}

function testEmail() {
  GmailApp.sendEmail(
    "your-personal-email@gmail.com",
    "Test Email",
    "This is a test from Apps Script.",
    { name: "ATX Prestige Detailing" }
  );
}

