/**
 * Cloudflare Pages Function — POST /api/assess
 * Receives the AI Opportunity Assessment payload from assets/js/assessment.js,
 * validates it, drops bots, and forwards it to the Google Apps Script web app
 * (which appends a row to the Sheet and sends the notification email).
 *
 * A failed hand-off is retried twice with a short backoff before the visitor
 * is told to try again, which covers an Apps Script cold start or a transient
 * network blip. A refusal from Apps Script itself (a wrong key, say) is not
 * retried — that cannot succeed on a second attempt.
 *
 * The visitor's IP is deliberately not forwarded. Country is enough to place a
 * submission, and the raw address would otherwise sit in the Sheet indefinitely.
 *
 * Environment variables (Pages → Settings → Variables and Secrets):
 *   SHEET_WEBHOOK_URL  — the Apps Script "Web app" URL (…/exec)
 *   SHEET_WEBHOOK_KEY  — shared secret; must match SECRET in Code.gs
 */

var ALLOWED_KEYS = [
  "intent", "sector", "organizationSize", "aiStage",
  "mainChallenge", "notes",
  "name", "email", "organization", "jobTitle",
  "preferredContact", "phone", "consent"
];

var REQUIRED = [
  "sector", "organizationSize", "aiStage", "mainChallenge",
  "name", "email", "organization"
];

var LIMITS = { notes: 2000 };

/* Pause before the second and third delivery attempt. */
var RETRY_DELAYS = [300, 900];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function isEmail(v) {
  return typeof v === "string" && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

/**
 * Hand the record to Apps Script. Returns null on success, or the message to
 * show the visitor once every attempt has been used up.
 */
async function deliver(env, record) {
  var body = JSON.stringify({ key: env.SHEET_WEBHOOK_KEY, record: record });
  var lastError = "Could not reach delivery service.";

  for (var attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    if (attempt) await sleep(RETRY_DELAYS[attempt - 1]);

    var upstream;
    try {
      upstream = await fetch(env.SHEET_WEBHOOK_URL, {
        method: "POST",
        redirect: "follow", // Apps Script answers with a 302 to the result
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: body
      });
    } catch (e) {
      lastError = "Could not reach delivery service.";
      continue;
    }

    var result = {};
    try { result = await upstream.json(); } catch (e) { /* non-JSON upstream */ }

    if (upstream.ok && result.ok) return null;

    if (upstream.ok) {
      // Apps Script answered and refused — a bad key, or a deployment that
      // is not public and served a sign-in page. Another attempt cannot help.
      return "Delivery service rejected the submission.";
    }

    lastError = "Delivery service rejected the submission.";
  }

  return lastError;
}

export async function onRequestPost(context) {
  var request = context.request;
  var env = context.env;

  if (!env.SHEET_WEBHOOK_URL || !env.SHEET_WEBHOOK_KEY) {
    return json({ ok: false, error: "Delivery is not configured." }, 500);
  }

  var raw;
  try {
    raw = await request.json();
  } catch (e) {
    return json({ ok: false, error: "Body must be JSON." }, 400);
  }
  if (!raw || typeof raw !== "object") {
    return json({ ok: false, error: "Body must be an object." }, 400);
  }

  // Honeypot: real visitors never fill this. Pretend success so bots move on.
  // The form drops these client-side too; this catches direct POSTs.
  if (raw.company_website) {
    return json({ ok: true });
  }

  // Whitelist + clamp
  var data = {};
  for (var i = 0; i < ALLOWED_KEYS.length; i++) {
    var key = ALLOWED_KEYS[i];
    var value = raw[key];
    if (value === undefined || value === null) continue;
    value = String(value).trim();
    var max = LIMITS[key] || 500;
    data[key] = value.slice(0, max);
  }

  var missing = REQUIRED.filter(function (k) { return !data[k]; });
  if (missing.length) {
    return json({ ok: false, error: "Missing required fields.", fields: missing }, 422);
  }
  if (!isEmail(data.email)) {
    return json({ ok: false, error: "Invalid email.", fields: ["email"] }, 422);
  }
  if (data.consent !== "true") {
    return json({ ok: false, error: "Consent is required.", fields: ["consent"] }, 422);
  }
  if (data.preferredContact === "Phone or video call" && !data.phone) {
    return json({ ok: false, error: "Phone is required for a call.", fields: ["phone"] }, 422);
  }

  var record = Object.assign({}, data, {
    submittedAt: new Date().toISOString(),
    country: request.headers.get("CF-IPCountry") || "",
    userAgent: (request.headers.get("User-Agent") || "").slice(0, 300)
  });

  var failure = await deliver(env, record);
  if (failure) return json({ ok: false, error: failure }, 502);

  return json({ ok: true });
}

// Anything but POST
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "Method not allowed." }, 405);
}
