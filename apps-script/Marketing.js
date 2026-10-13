// ─── Mass marketing (email + SMS) ───────────────────────────────────────────
// Every action here requires a Google ID token for the admin account — unlike
// the rest of this API, a mass send must never be callable by anyone who just
// knows the URL. All names are prefixed "mk" because this project shares one
// global scope with Code.js.

const MK_ADMIN_EMAIL = "atxprestigedetailing@gmail.com";
const MK_GOOGLE_CLIENT_ID = "447699234633-ivo2e1c2q843scj32k5323o2rkq6h7dp.apps.googleusercontent.com";
const MK_BUSINESS_NAME = "ATX Prestige Detailing";
const MK_LOG_SHEET = "MarketingLog";
const MK_OPTOUT_SHEET = "MarketingOptOuts";
const MK_LOG_HEADER = ["Timestamp", "CampaignId", "CampaignName", "Channel", "Status", "ClientKey", "Name", "Email", "Phone", "Detail", "Preview"];
const MK_OPTOUT_HEADER = ["Timestamp", "Email", "Source"];
const MK_MAX_BATCH = 25;

function mkJson(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function mkAuthFail() {
  return mkJson({ success: false, authError: true, error: "Please verify with Google again." });
}

// ── Auth ────────────────────────────────────────────────────────────────────

function mkVerifyAdminToken(idToken) {
  idToken = String(idToken || "");
  if (idToken.split(".").length !== 3) return false;
  var cache = CacheService.getScriptCache();
  var key = "mkauth_" + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken)).slice(0, 40);
  if (cache.get(key) === "1") return true;
  try {
    var res = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return false;
    var info = JSON.parse(res.getContentText());
    var expMs = Number(info.exp) * 1000;
    var ok = info.aud === MK_GOOGLE_CLIENT_ID &&
      String(info.email || "").toLowerCase() === MK_ADMIN_EMAIL &&
      String(info.email_verified) === "true" &&
      expMs > Date.now();
    if (ok) {
      var ttl = Math.min(300, Math.floor((expMs - Date.now()) / 1000));
      if (ttl > 0) cache.put(key, "1", ttl);
    }
    return ok;
  } catch (err) {
    Logger.log("mkVerifyAdminToken error: " + err);
    return false;
  }
}

// ── Small helpers ───────────────────────────────────────────────────────────

function mkPhoneKey(p) {
  var d = String(p || "").replace(/\D/g, "");
  return d.length > 10 ? d.slice(-10) : d;
}

function mkValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
}

function mkFirstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

function mkEscapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function mkGetOrCreateSheet(ss, name, header) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
  }
  return sheet;
}

function mkSecret() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty("MARKETING_HMAC_SECRET");
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("MARKETING_HMAC_SECRET", s);
  }
  return s;
}

function mkUnsubToken(email) {
  var sig = Utilities.computeHmacSha256Signature("unsub:" + String(email).toLowerCase().trim(), mkSecret());
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, "");
}

// baseUrl is the web-app URL the browser actually talks to (so the link always
// points at the live deployment); anything that isn't a script.google.com /exec
// URL is ignored in favour of the script's own URL.
function mkUnsubscribeUrl(email, baseUrl) {
  var base = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(String(baseUrl || "")) ? baseUrl : ScriptApp.getService().getUrl();
  return base + "?action=unsubscribeMarketing&e=" + encodeURIComponent(String(email).toLowerCase().trim()) + "&t=" + mkUnsubToken(email);
}

// ── Audience ────────────────────────────────────────────────────────────────
// One entry per client (keyed by phone, else email), built from the Bookings
// sheet. SMS eligibility is deliberately strict: only a marketing opt-in the
// client checked themselves ("self") counts, and a later explicit FALSE
// revokes it — admin-set or legacy values never grant it (see Code.js column
// notes on Consent Source).

function mkLoadOptOuts(ss) {
  var sheet = ss.getSheetByName(MK_OPTOUT_SHEET);
  var out = {};
  if (!sheet) return out;
  var rows = sheet.getDataRange().getDisplayValues();
  for (var i = 1; i < rows.length; i++) {
    var e = String(rows[i][1] || "").toLowerCase().trim();
    if (e) out[e] = true;
  }
  return out;
}

function mkLoadLastContacted(ss) {
  var sheet = ss.getSheetByName(MK_LOG_SHEET);
  var out = {};
  if (!sheet) return out;
  var rows = sheet.getDataRange().getDisplayValues();
  var best = {};
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][4] !== "sent") continue;
    var key = rows[i][5];
    var ms = new Date(rows[i][0]).getTime();
    if (key && !isNaN(ms) && (best[key] === undefined || ms > best[key])) best[key] = ms;
  }
  Object.keys(best).forEach(function(k) { out[k] = new Date(best[k]).toISOString(); });
  return out;
}

function mkBuildAudience() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var rows = ss.getSheetByName(BOOKINGS_SHEET).getDataRange().getDisplayValues();
  var optOuts = mkLoadOptOuts(ss);
  var lastContacted = mkLoadLastContacted(ss);
  var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
  var map = {};
  var order = [];

  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var name = String(r[1] || "").trim();
    var phone = String(r[2] || "").trim();
    var email = String(r[3] || "").trim();
    var date = String(r[4] || "").trim();
    var clientType = String(r[26] || "").trim();
    var status = String(r[28] || "").trim();
    var mktConsent = String(r[38] || "").trim().toUpperCase();
    var event = String(r[40] || "").trim();
    var source = String(r[44] || "").trim().toLowerCase();

    var pk = mkPhoneKey(phone);
    var key = pk.length === 10 ? pk : email.toLowerCase();
    if (!key) continue;

    var c = map[key];
    if (!c) {
      c = map[key] = {
        key: key, name: "", email: "", phone: "", completedCount: 0, upcomingCount: 0, totalCount: 0,
        lastServiceDate: "", isMaintenance: false, eventRows: 0, nonEventRows: 0, smsConsentState: false
      };
      order.push(key);
    }
    if (name) c.name = name;
    if (phone) c.phone = phone;
    if (email) c.email = email;

    if (event) c.eventRows++; else c.nonEventRows++;
    if (status === "Completed") {
      c.completedCount++;
      if (date > c.lastServiceDate) c.lastServiceDate = date;
    }
    if (status === "Booked" && date >= today) c.upcomingCount++;
    if (status !== "Cancelled") c.totalCount++;
    if (clientType === "maintenance" && status !== "Cancelled") c.isMaintenance = true;

    if (mktConsent === "TRUE" && source === "self") c.smsConsentState = true;
    else if (mktConsent === "FALSE") c.smsConsentState = false;
  }

  var clients = order.map(function(key) {
    var c = map[key];
    var hasEmail = mkValidEmail(c.email);
    var optedOut = hasEmail && !!optOuts[c.email.toLowerCase()];
    var hasPhone = mkPhoneKey(c.phone).length === 10;
    return {
      key: c.key,
      name: c.name || "(no name)",
      email: c.email,
      phone: c.phone,
      completedCount: c.completedCount,
      upcomingCount: c.upcomingCount,
      totalCount: c.totalCount,
      lastServiceDate: c.lastServiceDate,
      isMaintenance: c.isMaintenance,
      eventOnly: c.eventRows > 0 && c.nonEventRows === 0,
      emailOk: hasEmail && !optedOut,
      emailReason: !hasEmail ? "No email on file" : (optedOut ? "Unsubscribed" : ""),
      smsOk: hasPhone && c.smsConsentState,
      smsReason: !hasPhone ? "No phone on file" : (!c.smsConsentState ? "No marketing text opt-in" : ""),
      lastContactedAt: lastContacted[c.key] || ""
    };
  });
  clients.sort(function(a, b) { return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  return clients;
}

function getMarketingAudiencePost(data) {
  if (!mkVerifyAdminToken(data.idToken)) return mkAuthFail();
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var optOutCount = Object.keys(mkLoadOptOuts(ss)).length;
    return mkJson({
      success: true,
      clients: mkBuildAudience(),
      emailQuotaRemaining: MailApp.getRemainingDailyQuota(),
      marketingNumberConfigured: !!PropertiesService.getScriptProperties().getProperty("TWILIO_MARKETING_FROM_NUMBER"),
      optOutCount: optOutCount
    });
  } catch (err) {
    Logger.log("getMarketingAudience error: " + err);
    return mkJson({ success: false, error: String(err) });
  }
}

function getMarketingLogPost(data) {
  if (!mkVerifyAdminToken(data.idToken)) return mkAuthFail();
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(MK_LOG_SHEET);
    var entries = [];
    if (sheet) {
      var rows = sheet.getDataRange().getDisplayValues();
      for (var i = rows.length - 1; i >= 1 && entries.length < 5000; i--) {
        var r = rows[i];
        entries.push({
          timestamp: r[0], campaignId: r[1], campaignName: r[2], channel: r[3], status: r[4],
          clientKey: r[5], name: r[6], email: r[7], phone: r[8], detail: r[9], preview: r[10]
        });
      }
    }
    return mkJson({ success: true, entries: entries });
  } catch (err) {
    Logger.log("getMarketingLog error: " + err);
    return mkJson({ success: false, error: String(err) });
  }
}

// ── Sending ─────────────────────────────────────────────────────────────────

function mkSubstitute(text, first, unsubUrl, forHtml) {
  var f = forHtml ? mkEscapeHtml(first) : first;
  var u = forHtml ? mkEscapeHtml(unsubUrl) : unsubUrl;
  return String(text)
    .replace(/\{\{firstName\}\}/g, function() { return f; })
    .replace(/\{\{unsubscribeUrl\}\}/g, function() { return u; });
}

function mkSendEmail(to, name, subject, html, plain, baseUrl) {
  var first = mkFirstName(name);
  var unsub = mkUnsubscribeUrl(to, baseUrl);
  try {
    GmailApp.sendEmail(
      to,
      mkSubstitute(subject, first, unsub, false),
      mkSubstitute(plain, first, unsub, false),
      {
        htmlBody: mkSubstitute(html, first, unsub, true),
        name: MK_BUSINESS_NAME,
        from: MK_ADMIN_EMAIL,
        charset: "UTF-8"
      }
    );
    return { ok: true, detail: "" };
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 200) };
  }
}

function mkEnsureStopLanguage(body) {
  body = String(body).trim();
  return /\bstop\b/i.test(body) ? body : body + " Reply STOP to opt out.";
}

function mkSendSms(phone, body) {
  var digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) digits = "1" + digits;
  if (digits.length !== 11) return { ok: false, detail: "Invalid phone number" };
  var from = PropertiesService.getScriptProperties().getProperty("TWILIO_MARKETING_FROM_NUMBER") || TWILIO_FROM_NUMBER;
  try {
    var res = UrlFetchApp.fetch("https://api.twilio.com/2010-04-01/Accounts/" + TWILIO_ACCOUNT_SID + "/Messages.json", {
      method: "post",
      payload: { To: "+" + digits, From: from, Body: body },
      headers: { Authorization: "Basic " + Utilities.base64Encode(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN) },
      muteHttpExceptions: true
    });
    var code = res.getResponseCode();
    if (code === 200 || code === 201) return { ok: true, detail: "" };
    var parsed = {};
    try { parsed = JSON.parse(res.getContentText()); } catch (e) { /* non-JSON error body */ }
    if (parsed.code === 21610) return { ok: false, blocked: true, detail: "Blocked — client replied STOP to this number" };
    return { ok: false, detail: String(parsed.message || ("HTTP " + code)).slice(0, 200) };
  } catch (err) {
    return { ok: false, detail: String(err).slice(0, 200) };
  }
}

function mkLogEntry(sheet, o) {
  sheet.appendRow([
    new Date().toISOString(), o.campaignId, o.campaignName, o.channel, o.status,
    o.clientKey, o.name, o.email || "", o.phone || "", o.detail || "", o.preview || ""
  ]);
}

function mkValidateComposition(data, wantEmail, wantSms) {
  if (wantEmail) {
    var em = data.email || {};
    if (!String(em.subject || "").trim()) return "Email subject is required.";
    if (!String(em.html || "").trim()) return "Email body is empty.";
    if (String(em.html).indexOf("{{unsubscribeUrl}}") === -1) return "The email must include an unsubscribe link.";
    if (String(em.html).length > 400000) return "Email is too large.";
  }
  if (wantSms) {
    if (!String(data.sms || "").trim()) return "Text message is empty.";
    if (String(data.sms).length > 1000) return "Text message is too long.";
  }
  return "";
}

function sendMarketingTestPost(data) {
  if (!mkVerifyAdminToken(data.idToken)) return mkAuthFail();
  try {
    var wantEmail = (data.channels || []).indexOf("email") !== -1;
    var wantSms = (data.channels || []).indexOf("sms") !== -1;
    if (!wantEmail && !wantSms) return mkJson({ success: false, error: "Pick email, text, or both." });
    var problem = mkValidateComposition(data, wantEmail, wantSms);
    if (problem) return mkJson({ success: false, error: problem });

    var result = { success: true, email: null, sms: null };
    var sample = String(data.sampleName || "Alex");
    if (wantEmail) {
      var em = mkSendEmail(MK_ADMIN_EMAIL, sample, "[TEST] " + data.email.subject, data.email.html, data.email.plain || "", data.baseUrl);
      result.email = em.ok ? "Sent to " + MK_ADMIN_EMAIL : "Failed: " + em.detail;
    }
    if (wantSms) {
      var phone = String(data.testPhone || "");
      if (mkPhoneKey(phone).length !== 10) {
        result.sms = "Enter a valid 10-digit test phone number.";
      } else {
        var body = "[TEST] " + mkEnsureStopLanguage(mkSubstitute(data.sms, mkFirstName(sample), "", false));
        var sm = mkSendSms(phone, body);
        result.sms = sm.ok ? "Sent to " + phone : "Failed: " + sm.detail;
      }
    }
    return mkJson(result);
  } catch (err) {
    Logger.log("sendMarketingTest error: " + err);
    return mkJson({ success: false, error: String(err) });
  }
}

// One batch (≤ MK_MAX_BATCH clients) of a campaign. The browser sends batches
// one after another; eligibility is re-checked here from the live sheets, and a
// (campaignId, client, channel) that already shows as sent is never sent again,
// so a retried batch can't double-send.
function sendMarketingBatchPost(data) {
  if (!mkVerifyAdminToken(data.idToken)) return mkAuthFail();
  var lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(30000)) return mkJson({ success: false, error: "Another send is in progress. Try again in a moment." });

    var channels = data.channels || [];
    var wantEmail = channels.indexOf("email") !== -1;
    var wantSms = channels.indexOf("sms") !== -1;
    if (!wantEmail && !wantSms) return mkJson({ success: false, error: "Pick email, text, or both." });

    var campaignId = String(data.campaignId || "");
    if (!/^[A-Za-z0-9_-]{6,64}$/.test(campaignId)) return mkJson({ success: false, error: "Invalid campaign id." });
    var campaignName = String(data.campaignName || "").trim().slice(0, 120) || "Untitled campaign";

    var problem = mkValidateComposition(data, wantEmail, wantSms);
    if (problem) return mkJson({ success: false, error: problem });

    var keys = data.recipients || [];
    if (!keys.length || keys.length > MK_MAX_BATCH) return mkJson({ success: false, error: "Batch must have 1-" + MK_MAX_BATCH + " recipients." });

    var ss = SpreadsheetApp.openById(SHEET_ID);
    var logSheet = mkGetOrCreateSheet(ss, MK_LOG_SHEET, MK_LOG_HEADER);
    var audience = {};
    mkBuildAudience().forEach(function(c) { audience[c.key] = c; });

    var already = {};
    var logRows = logSheet.getDataRange().getDisplayValues();
    for (var i = 1; i < logRows.length; i++) {
      if (logRows[i][1] === campaignId && logRows[i][4] === "sent") already[logRows[i][5] + "|" + logRows[i][3]] = true;
    }

    var quota = wantEmail ? MailApp.getRemainingDailyQuota() : 0;
    var emailPreview = wantEmail ? String(data.email.subject).slice(0, 120) : "";
    var smsFinal = wantSms ? mkEnsureStopLanguage(data.sms) : "";
    var results = [];

    keys.forEach(function(key) {
      var c = audience[key];
      if (!c) { results.push({ key: key, channel: "-", status: "skipped", detail: "Client not found" }); return; }
      var base = { campaignId: campaignId, campaignName: campaignName, clientKey: key, name: c.name, email: c.email, phone: c.phone };

      if (wantEmail) {
        if (!c.emailOk) {
          results.push({ key: key, name: c.name, channel: "email", status: "skipped", detail: c.emailReason });
        } else if (already[key + "|email"]) {
          results.push({ key: key, name: c.name, channel: "email", status: "skipped", detail: "Already sent in this campaign" });
        } else if (quota <= 0) {
          results.push({ key: key, name: c.name, channel: "email", status: "skipped", detail: "Daily email limit reached" });
        } else {
          var e = mkSendEmail(c.email, c.name, data.email.subject, data.email.html, data.email.plain || "", data.baseUrl);
          quota--;
          var eStatus = e.ok ? "sent" : "failed";
          mkLogEntry(logSheet, Object.assign({}, base, { channel: "email", status: eStatus, detail: e.detail, preview: emailPreview }));
          results.push({ key: key, name: c.name, channel: "email", status: eStatus, detail: e.detail });
        }
      }

      if (wantSms) {
        if (!c.smsOk) {
          results.push({ key: key, name: c.name, channel: "sms", status: "skipped", detail: c.smsReason });
        } else if (already[key + "|sms"]) {
          results.push({ key: key, name: c.name, channel: "sms", status: "skipped", detail: "Already sent in this campaign" });
        } else {
          var body = mkSubstitute(smsFinal, mkFirstName(c.name), "", false);
          var s = mkSendSms(c.phone, body);
          var sStatus = s.ok ? "sent" : (s.blocked ? "blocked" : "failed");
          mkLogEntry(logSheet, Object.assign({}, base, { channel: "sms", status: sStatus, detail: s.detail, preview: body.slice(0, 120) }));
          results.push({ key: key, name: c.name, channel: "sms", status: sStatus, detail: s.detail });
          Utilities.sleep(1100);
        }
      }
    });

    return mkJson({ success: true, results: results, emailQuotaRemaining: wantEmail ? quota : null });
  } catch (err) {
    Logger.log("sendMarketingBatch error: " + err);
    return mkJson({ success: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e) { /* lock may not have been acquired */ }
  }
}

// ── Unsubscribe (public link inside every marketing email) ──────────────────

function mkResultPage(title, message) {
  var html =
    "<!DOCTYPE html><html><head><meta charset='UTF-8'><meta name='viewport' content='width=device-width, initial-scale=1'></head>" +
    "<body style='font-family:Arial,sans-serif;background:#f5f4f2;margin:0;padding:48px 20px;text-align:center;'>" +
    "<div style='max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 4px 14px rgba(0,0,0,0.08);'>" +
    "<h2 style='margin:0 0 12px;color:#111;'>" + mkEscapeHtml(title) + "</h2>" +
    "<p style='margin:0;color:#555;font-size:15px;line-height:1.6;'>" + mkEscapeHtml(message) + "</p>" +
    "</div></body></html>";
  return HtmlService.createHtmlOutput(html);
}

function mkUnsubscribeGet(e) {
  var email = String((e.parameter && e.parameter.e) || "").toLowerCase().trim();
  var token = String((e.parameter && e.parameter.t) || "");
  if (!email || !token || mkUnsubToken(email) !== token) {
    return mkResultPage("Link not valid", "This unsubscribe link is invalid or incomplete. Reply to any of our emails and we'll remove you by hand.");
  }
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = mkGetOrCreateSheet(ss, MK_OPTOUT_SHEET, MK_OPTOUT_HEADER);
  if (!mkLoadOptOuts(ss)[email]) sheet.appendRow([new Date().toISOString(), email, "email-link"]);
  return mkResultPage("You're unsubscribed", "You won't receive marketing emails from " + MK_BUSINESS_NAME + " anymore. Appointment confirmations and reminders aren't affected.");
}
