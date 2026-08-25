/* ==========================================================================
   ILORE — AI Opportunity Assessment
   Four-step guided form: state, conditional questions, validation, local
   progress restore and submission.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     Configuration

     SUBMIT_ENDPOINT: the URL responses are POSTed to as JSON. Leave empty and
     the form honestly reports that delivery is not connected rather than
     faking a confirmation.

     Never put API keys, tokens or other credentials in this file — it is
     served to every visitor. Point this at your own endpoint (or a form
     service) and keep secrets on the server side.
     ------------------------------------------------------------------------ */
  var SUBMIT_ENDPOINT = "/api/assess";

  var STORAGE_KEY = "ilore-assessment-v1";
  var LAST_SUBMISSION_KEY = "ilore-assessment-last-submission";
  var STEP_COUNT = 4;
  var STEP_NAMES = ["Your organization", "Your challenge", "About you", "Review & submit"];

  var INTENTS = {
    academy: "An Academy education program",
    transform: "An AI transformation project",
    discover: "Search & AI visibility",
    project: "A specific project"
  };

  var EARLY_STAGES = ["", "We haven't started", "Individuals are experimenting informally"];
  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  var form = document.getElementById("assessmentForm");
  if (!form) return;

  function $(id) {
    return document.getElementById(id);
  }

  /* ------------------------------------------------------------------------
     State
     ------------------------------------------------------------------------ */
  var state = {
    step: 0,
    intent: "",
    data: {
      industry: "",
      industryOther: "",
      size: "",
      stage: "",
      challenge: "",
      challengeDetail: "",
      name: "",
      email: "",
      organization: "",
      jobTitle: "",
      contactMethod: "",
      phone: "",
      consent: false
    }
  };

  var hasStarted = false;

  /* Which control each answer is bound to. */
  var RADIO_BINDINGS = {
    industry: "industry",
    size: "size",
    stage: "stage",
    challengeEarly: "challenge",
    challengeLate: "challenge",
    contact: "contactMethod"
  };

  var TEXT_BINDINGS = {
    industryOther: "industryOther",
    challengeDetail: "challengeDetail",
    fullName: "name",
    email: "email",
    organization: "organization",
    jobTitle: "jobTitle",
    phone: "phone"
  };

  /* Validation targets: the message element and the control focused when the
     answer is missing. */
  var VALIDATION = {
    industry: { errorId: "error-industry", focus: 'input[name="industry"]' },
    industryOther: { errorId: "error-industryOther", focus: "#industryOther" },
    size: { errorId: "error-size", focus: 'input[name="size"]' },
    stage: { errorId: "error-stage", focus: 'input[name="stage"]' },
    challenge: { errorId: "error-challenge", focus: ".option-grid.is-visible input" },
    name: { errorId: "error-name", focus: "#fullName" },
    email: { errorId: "error-email", focus: "#email" },
    organization: { errorId: "error-org", focus: "#organization" },
    phone: { errorId: "error-phone", focus: "#phone" },
    consent: { errorId: "error-consent", focus: "#consent" }
  };

  /* ------------------------------------------------------------------------
     Analytics
     ------------------------------------------------------------------------ */
  function track(eventName, detail) {
    window.dataLayer = window.dataLayer || [];
    var payload = { event: eventName };
    if (detail) {
      Object.keys(detail).forEach(function (key) {
        payload[key] = detail[key];
      });
    }
    window.dataLayer.push(payload);
  }

  function markStarted() {
    if (hasStarted) return;
    hasStarted = true;
    track("assessment_start");
  }

  /* ------------------------------------------------------------------------
     Persistence
     Only the answers already collected by this form are stored, and only on
     this device.
     ------------------------------------------------------------------------ */
  function loadAssessmentState() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
    if (!raw) return;

    var saved;
    try {
      saved = JSON.parse(raw);
    } catch (error) {
      // Corrupt entry — discard it and start clean.
      clearSavedState();
      return;
    }

    if (!saved || typeof saved !== "object" || typeof saved.data !== "object" || !saved.data) {
      clearSavedState();
      return;
    }

    var step = Number(saved.step);
    state.step = Number.isFinite(step) ? Math.min(Math.max(step, 0), STEP_COUNT - 1) : 0;

    Object.keys(state.data).forEach(function (key) {
      var value = saved.data[key];
      if (typeof state.data[key] === "boolean") {
        if (typeof value === "boolean") state.data[key] = value;
      } else if (typeof value === "string") {
        state.data[key] = value;
      }
    });
  }

  function saveAssessmentState() {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ step: state.step, data: state.data })
      );
    } catch (error) {
      /* Storage unavailable (private mode, quota) — the form still works. */
    }
  }

  function clearSavedState() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* nothing to do */
    }
  }

  function readIntentFromUrl() {
    try {
      var intent = new URLSearchParams(window.location.search).get("intent");
      if (intent && Object.prototype.hasOwnProperty.call(INTENTS, intent)) state.intent = intent;
    } catch (error) {
      /* Unsupported URL API — the assessment simply has no preset topic. */
    }
  }

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function isEarlyStage() {
    return EARLY_STAGES.indexOf(state.data.stage) !== -1;
  }

  function setRadioValue(name, value) {
    var inputs = form.querySelectorAll('input[name="' + name + '"]');
    Array.prototype.forEach.call(inputs, function (input) {
      input.checked = input.value === value;
    });
  }

  /* Mirror the checked state onto the label so browsers without :has()
     still show the selected treatment. */
  function syncOptionStates() {
    var options = form.querySelectorAll(".option");
    Array.prototype.forEach.call(options, function (option) {
      var input = option.querySelector("input");
      option.classList.toggle("is-selected", Boolean(input && input.checked));
    });
  }

  /* ------------------------------------------------------------------------
     Validation
     ------------------------------------------------------------------------ */
  function validateStep(step) {
    var data = state.data;
    var invalid = [];

    if (step === 0) {
      if (!data.industry) invalid.push("industry");
      if (data.industry === "Another industry" && !data.industryOther.trim()) {
        invalid.push("industryOther");
      }
      if (!data.size) invalid.push("size");
      if (!data.stage) invalid.push("stage");
    }

    if (step === 1 && !data.challenge) invalid.push("challenge");

    if (step === 2) {
      if (!data.name.trim()) invalid.push("name");
      if (!EMAIL_PATTERN.test(data.email.trim())) invalid.push("email");
      if (!data.organization.trim()) invalid.push("organization");
      if (data.contactMethod === "Phone or video call" && !data.phone.trim()) invalid.push("phone");
    }

    if (step === 3 && !data.consent) invalid.push("consent");

    return invalid;
  }

  function showErrors(invalid) {
    Object.keys(VALIDATION).forEach(function (key) {
      var isInvalid = invalid.indexOf(key) !== -1;
      var message = $(VALIDATION[key].errorId);
      if (message) message.classList.toggle("is-visible", isInvalid);

      var control = form.querySelector(VALIDATION[key].focus);
      if (control && control.type !== "radio" && control.type !== "checkbox") {
        if (isInvalid) {
          control.setAttribute("aria-invalid", "true");
        } else {
          control.removeAttribute("aria-invalid");
        }
      }
    });

    if (!invalid.length) return;

    var count = invalid.length;
    $("formStatus").textContent =
      count + (count > 1 ? " fields need" : " field needs") + " attention before you continue.";

    track("assessment_validation_error", {
      step: state.step + 1,
      fields: invalid.join(",")
    });

    // Send focus to the first thing that needs attention.
    var firstInvalid = form.querySelector(VALIDATION[invalid[0]].focus);
    if (firstInvalid) {
      firstInvalid.focus({ preventScroll: true });
      var anchor = firstInvalid.closest(".question-group, .field, .consent") || firstInvalid;
      anchor.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function clearErrors() {
    showErrors([]);
    $("formStatus").textContent = "";
  }

  /* ------------------------------------------------------------------------
     Rendering
     ------------------------------------------------------------------------ */
  function renderAssessment() {
    for (var index = 0; index < STEP_COUNT; index += 1) {
      var step = $("step" + index);
      var indicator = $("stepIndicator" + index);
      var isCurrent = index === state.step;

      step.classList.toggle("is-active", isCurrent);
      indicator.classList.toggle("is-current", isCurrent);
      indicator.classList.toggle("is-done", index < state.step);
      if (isCurrent) {
        indicator.setAttribute("aria-current", "step");
      } else {
        indicator.removeAttribute("aria-current");
      }
    }

    var human = state.step + 1;
    $("progressCount").textContent = "Step " + human + " / " + STEP_COUNT;
    $("progressFill").style.width = (human / STEP_COUNT) * 100 + "%";
    $("progressBar").setAttribute("aria-valuenow", String(human));
    $("progressBar").setAttribute("aria-valuetext", "Step " + human + " of " + STEP_COUNT + ": " + STEP_NAMES[state.step]);
    $("workspaceState").textContent = "Step " + human + " of " + STEP_COUNT;

    // Hidden but still occupying its slot, so the controls never reflow.
    $("backButton").classList.toggle("is-invisible", state.step === 0);
    $("saveNote").hidden = state.step !== 0;
    $("nextButton").hidden = state.step >= STEP_COUNT - 1;
    $("submitButton").hidden = state.step !== STEP_COUNT - 1;

    // Conditional questions
    $("industryOtherField").classList.toggle("is-visible", state.data.industry === "Another industry");
    $("phoneField").classList.toggle("is-visible", state.data.contactMethod === "Phone or video call");

    var early = isEarlyStage();
    $("challengeEarly").classList.toggle("is-visible", early);
    $("challengeLate").classList.toggle("is-visible", !early);
    $("challengeNote").textContent = early
      ? "Since you're early in the journey, these are the challenges we hear most."
      : "Since you already have AI activity underway, these are the challenges we hear most.";

    var chip = $("intentChip");
    chip.classList.toggle("is-visible", Boolean(state.intent));
    if (state.intent) $("intentLabel").textContent = INTENTS[state.intent];

    if (state.step === STEP_COUNT - 1) renderReview();
  }

  /* Built with DOM nodes and textContent so answers are never treated as
     markup. */
  function renderReview() {
    var data = state.data;
    var rows = [];

    if (state.intent) rows.push(["Topic", INTENTS[state.intent]]);

    rows.push([
      "Sector",
      data.industry === "Another industry" && data.industryOther
        ? data.industry + " — " + data.industryOther
        : data.industry
    ]);
    rows.push(["Size", data.size + " employees"]);
    rows.push(["Stage", data.stage]);
    rows.push(["Main challenge", data.challenge]);
    if (data.challengeDetail.trim()) rows.push(["Notes", data.challengeDetail]);
    rows.push([
      "Contact",
      [data.name, data.email, data.organization, data.jobTitle].filter(Boolean).join(" · ")
    ]);
    rows.push([
      "Follow-up",
      (data.contactMethod || "—") + (data.phone ? " · " + data.phone : "")
    ]);

    var review = $("reviewBox");
    review.textContent = "";

    rows.forEach(function (row) {
      var wrapper = document.createElement("div");
      wrapper.className = "review__row";

      var key = document.createElement("span");
      key.className = "review__key";
      key.textContent = row[0];

      var value = document.createElement("span");
      value.className = "review__value";
      value.textContent = row[1];

      wrapper.appendChild(key);
      wrapper.appendChild(value);
      review.appendChild(wrapper);
    });
  }

  function goToStep(index) {
    state.step = Math.min(Math.max(index, 0), STEP_COUNT - 1);
    saveAssessmentState();
    renderAssessment();

    var step = $("step" + state.step);
    step.focus({ preventScroll: true });
    $("formStatus").textContent =
      "Step " + (state.step + 1) + " of " + STEP_COUNT + ": " + STEP_NAMES[state.step];
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ------------------------------------------------------------------------
     Restoring saved answers into the form controls
     ------------------------------------------------------------------------ */
  function restoreControls() {
    setRadioValue("industry", state.data.industry);
    setRadioValue("size", state.data.size);
    setRadioValue("stage", state.data.stage);
    setRadioValue(isEarlyStage() ? "challengeEarly" : "challengeLate", state.data.challenge);
    setRadioValue("contact", state.data.contactMethod);

    Object.keys(TEXT_BINDINGS).forEach(function (id) {
      var control = $(id);
      if (control) control.value = state.data[TEXT_BINDINGS[id]];
    });

    $("consent").checked = state.data.consent;
    syncOptionStates();
  }

  /* ------------------------------------------------------------------------
     Submission
     ------------------------------------------------------------------------ */
  function buildPayload() {
    var data = state.data;
    return {
      submittedAt: new Date().toISOString(),
      intent: state.intent ? INTENTS[state.intent] : null,
      sector:
        data.industry === "Another industry"
          ? data.industry + " — " + data.industryOther
          : data.industry,
      organizationSize: data.size,
      aiStage: data.stage,
      mainChallenge: data.challenge,
      notes: data.challengeDetail || null,
      name: data.name,
      email: data.email,
      organization: data.organization,
      jobTitle: data.jobTitle || null,
      preferredContact: data.contactMethod || null,
      phone: data.phone || null,
      consent: data.consent
    };
  }

  /* The server validates with the payload's key names; map any rejected
     fields back to this form's validation keys and the step they live on. */
  var SERVER_FIELD_MAP = {
    sector: "industry",
    organizationSize: "size",
    aiStage: "stage",
    mainChallenge: "challenge",
    name: "name",
    email: "email",
    organization: "organization",
    phone: "phone",
    consent: "consent"
  };

  var FIELD_STEPS = {
    industry: 0,
    size: 0,
    stage: 0,
    challenge: 1,
    name: 2,
    email: 2,
    organization: 2,
    phone: 2,
    consent: 3
  };

  function surfaceServerFieldErrors(fields) {
    if (!Array.isArray(fields)) return false;

    var mapped = [];
    fields.forEach(function (field) {
      var key = SERVER_FIELD_MAP[field];
      if (key && mapped.indexOf(key) === -1) mapped.push(key);
    });
    if (!mapped.length) return false;

    var earliest = mapped.reduce(function (min, key) {
      return Math.min(min, FIELD_STEPS[key]);
    }, STEP_COUNT - 1);

    goToStep(earliest);
    showErrors(mapped.filter(function (key) {
      return FIELD_STEPS[key] === earliest;
    }));
    return true;
  }

  function showOutcome(panelId) {
    form.hidden = true;
    $(panelId).classList.add("is-visible");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetSubmitButton() {
    var button = $("submitButton");
    button.disabled = false;
    button.textContent = "Submit Assessment Request";
  }

  function submitAssessment(event) {
    event.preventDefault();

    var invalid = validateStep(STEP_COUNT - 1);
    if (invalid.length) {
      showErrors(invalid);
      return;
    }

    clearErrors();
    $("error-submit").classList.remove("is-visible");

    // Spam trap: a real visitor never sees or fills this field.
    if ($("companyWebsite").value) return;

    var button = $("submitButton");
    if (button.disabled) return; // guards against double submission
    button.disabled = true;
    button.textContent = "Submitting…";

    var payload = buildPayload();

    if (!SUBMIT_ENDPOINT) {
      // No delivery configured. Keep the answers and say so plainly.
      try {
        window.localStorage.setItem(LAST_SUBMISSION_KEY, JSON.stringify(payload));
      } catch (error) {
        /* Storage unavailable — the answers stay in memory for this session. */
      }
      console.info(
        "ILORE assessment request (submission not connected — configure SUBMIT_ENDPOINT):",
        payload
      );
      track("assessment_submit_pending");
      window.setTimeout(function () {
        resetSubmitButton();
        showOutcome("pendingPanel");
      }, 400);
      return;
    }

    window
      .fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
      .then(function (response) {
        if (response.ok) {
          track("assessment_submit_success");
          clearSavedState();
          showOutcome("successPanel");
          return;
        }
        if (response.status === 422) {
          // The server names the fields it rejected; take the visitor back
          // to them instead of a generic retry message when possible.
          return response
            .json()
            .then(
              function (body) { return body && body.fields; },
              function () { return null; }
            )
            .then(function (fields) {
              track("assessment_submit_error");
              resetSubmitButton();
              if (!surfaceServerFieldErrors(fields)) {
                $("error-submit").classList.add("is-visible");
                $("formStatus").textContent =
                  "We couldn't send your request. Your answers are still saved on this device.";
              }
            });
        }
        throw new Error("HTTP " + response.status);
      })
      .catch(function (error) {
        console.error("Assessment submission failed:", error);
        track("assessment_submit_error");
        resetSubmitButton();
        $("error-submit").classList.add("is-visible");
        $("formStatus").textContent =
          "We couldn't send your request. Your answers are still saved on this device.";
      });
  }

  /* ------------------------------------------------------------------------
     Events
     ------------------------------------------------------------------------ */
  function initAssessmentEvents() {
    form.addEventListener("change", function (event) {
      var target = event.target;

      if (target.name && RADIO_BINDINGS[target.name]) {
        markStarted();
        state.data[RADIO_BINDINGS[target.name]] = target.value;

        // Changing the AI stage swaps the challenge options, so any answer
        // from the other set no longer applies.
        if (target.name === "stage") {
          state.data.challenge = "";
          setRadioValue("challengeEarly", "");
          setRadioValue("challengeLate", "");
        }

        syncOptionStates();
        saveAssessmentState();
        clearErrors();
        renderAssessment();
        return;
      }

      if (target.id === "consent") {
        state.data.consent = target.checked;
        saveAssessmentState();
        clearErrors();
      }
    });

    form.addEventListener("input", function (event) {
      var binding = TEXT_BINDINGS[event.target.id];
      if (!binding) return;
      markStarted();
      state.data[binding] = event.target.value;
      saveAssessmentState();
    });

    $("nextButton").addEventListener("click", function () {
      var invalid = validateStep(state.step);
      if (invalid.length) {
        showErrors(invalid);
        return;
      }
      clearErrors();
      track("assessment_step_complete", { step: state.step + 1 });
      goToStep(state.step + 1);
    });

    $("backButton").addEventListener("click", function () {
      clearErrors();
      goToStep(state.step - 1);
    });

    $("intentClear").addEventListener("click", function () {
      state.intent = "";
      try {
        // replaceState keeps the visitor's history intact.
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
      } catch (error) {
        /* History API unavailable — the chip is still cleared visually. */
      }
      renderAssessment();
    });

    $("pendingEdit").addEventListener("click", function () {
      $("pendingPanel").classList.remove("is-visible");
      form.hidden = false;
      renderAssessment();
      $("step" + state.step).focus({ preventScroll: true });
    });

    form.addEventListener("submit", submitAssessment);
  }

  loadAssessmentState();
  readIntentFromUrl();
  restoreControls();
  renderAssessment();
  initAssessmentEvents();
})();
