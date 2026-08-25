/**
 * ILORE — assessment intake (Google Apps Script, bound to the Sheet)
 *
 * Setup:
 *   1. Create a Google Sheet named "ILORE Assessments". Extensions → Apps Script.
 *   2. Paste this file. Set SECRET and NOTIFY_TO below.
 *   3. Deploy → New deployment → Type: Web app.
 *      Execute as: Me. Who has access: Anyone.
 *   4. Copy the Web app URL into Cloudflare as SHEET_WEBHOOK_URL,
 *      and SECRET into SHEET_WEBHOOK_KEY.
 *   Re-deploy (new version) after any edit to this file.
 */

var SECRET = "change-me-to-a-long-random-string";
var NOTIFY_TO = "parvaneh.pouladzadeh@gmail.com";  // TEST ADDRESS — change to the
                                                   // ILORE inbox once the pipeline
                                                   // is proven. This is the only
                                                   // line that needs to change.
var SHEET_NAME = "Submissions";

var COLUMNS = [
  "submittedAt", "name", "email", "organization", "jobTitle",
  "preferredContact", "phone",
  "sector", "organizationSize", "aiStage",
  "mainChallenge", "notes",
  "intent", "consent", "country", "userAgent"
];

function doPost(e) {
  var payload;
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    return respond({ ok: false, error: "Bad JSON" });
  }
  if (!payload || payload.key !== SECRET) {
    return respond({ ok: false, error: "Unauthorized" });
  }
  var record = payload.record || {};

  var sheet = getSheet();
  var row = COLUMNS.map(function (c) { return record[c] || ""; });
  sheet.appendRow(row);

  try { notify(record); } catch (err) { /* sheet row already saved; don't fail */ }

  return respond({ ok: true });
}

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUMNS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function notify(r) {
  var subject = "New AI Opportunity Assessment — " + (r.sector || "unknown sector") + " · " + (r.aiStage || "");
  var lines = [
    "A new assessment was submitted.",
    "",
    "Name:           " + r.name + (r.jobTitle ? "  ·  " + r.jobTitle : ""),
    "Organization:   " + r.organization,
    "Contact:        " + r.email + (r.phone ? "  /  " + r.phone : ""),
    r.preferredContact ? "Preferred:      " + r.preferredContact : null,
    "Sector:         " + r.sector,
    "Org size:       " + r.organizationSize,
    "AI stage:       " + r.aiStage,
    "Challenge:      " + r.mainChallenge,
    r.notes ? "Notes:          " + r.notes : null,
    r.intent ? "Came from:      " + r.intent : null,
    "",
    "Submitted " + r.submittedAt + " · " + (r.country || ""),
    "Sheet: " + SpreadsheetApp.getActiveSpreadsheet().getUrl()
  ].filter(function (l) { return l !== null; });

  MailApp.sendEmail({
    to: NOTIFY_TO,
    replyTo: r.email,
    subject: subject,
    body: lines.join("\n")
  });
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
