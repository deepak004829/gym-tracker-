window.GL = window.GL || {};

GL.authGate = (function () {
  const { $, qs, qsa } = GL.dom;
  const { getState } = GL.store;
  const {
    signInWithPassword, signUpWithPassword, sendPasswordReset, readAuthError,
    signInWithGoogle, getGoogleRedirectResult,
  } = GL.authApi;
  const { showToast } = GL.toast;

  // Steps that show progress dots, in order, and only during account creation.
  const PROGRESS_STEPS = ["name", "stats", "goal"];
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  let mode = "signin";        // "signin" | "signup"
  let method = null;          // "email" | "google" | null (not chosen yet)
  let history = ["welcome"];  // stack of visited step ids, for the back button
  let draft = { name: "", age: null, weight: null, goalKg: null };
  let googleUser = null;      // set once a Google popup/redirect resolves

  function initAuthGate({ onGuestEnter }) {
    $("googleAuthBtn").onclick = handleGoogleClick;
    $("emailAuthBtn").onclick = () => { method = "email"; applyCredentialsCopy(); goToStep("credentials"); };
    $("authSwitchLink").onclick = () => setAuthMode(mode === "signin" ? "signup" : "signin");
    $("authGuestBtn").onclick = onGuestEnter;
    $("guestSignUpBtn").onclick = () => { getState().auth.isGuest = false; setAuthMode("signup"); showGate(); };

    $("authCredForm").onsubmit = submitCredentials;
    $("authNameForm").onsubmit = submitName;
    $("authStatsForm").onsubmit = submitStats;
    $("authGoalForm").onsubmit = submitGoal;
    $("authForgotBtn").onclick = resetPassword;

    qsa("[data-back]").forEach((btn) => (btn.onclick = goBack));

    initLiveValidation();
    initSteppers();

    // Pick up a signInWithRedirect() result from a previous page load, in
    // case signInWithPopup() had to fall back to redirect (e.g. installed
    // PWA blocking popups).
    getGoogleRedirectResult().then((result) => {
      if (result) handleGoogleResult(result);
    });
  }

  // ---- mode / step plumbing ----------------------------------------------

  function setAuthMode(nextMode) {
    mode = nextMode;
    method = null;
    googleUser = null;
    draft = { name: "", age: null, weight: null, goalKg: null };
    const signup = mode === "signup";
    $("authWelcomeCopy").textContent = signup
      ? "Tell us a bit about yourself to get started."
      : "Sign in to keep your workouts in sync.";
    $("googleAuthLabel").textContent = signup ? "Sign up with Google" : "Continue with Google";
    $("emailAuthBtn").textContent = signup ? "Sign up with email" : "Continue with email";
    $("authSwitchPrompt").textContent = signup ? "Already have an account?" : "Don\u2019t have an account?";
    $("authSwitchLink").textContent = signup ? "Sign in" : "Create one";
    applyCredentialsCopy();
    goToStep("welcome");
  }

  function applyCredentialsCopy() {
    const signup = mode === "signup";
    $("credEyebrow").textContent = signup ? "CREATE ACCOUNT" : "SIGN IN";
    $("credTitle").textContent = signup ? "First, your email." : "Welcome back.";
    $("credNextBtn").textContent = signup ? "Continue" : "Sign in";
    $("authConfirmLabel").classList.toggle("hidden", !signup);
    $("authPasswordConfirm").required = signup;
    $("authPasswordConfirm").value = "";
    $("authPassword").autocomplete = signup ? "new-password" : "current-password";
    resetFieldStatus("confirmStatus"); resetFieldStatus("passwordStatus"); resetFieldStatus("emailStatus");
  }

  function goToStep(stepId, direction = "forward") {
    if (history[history.length - 1] !== stepId) history.push(stepId);
    applyStep(stepId, direction);
  }

  function goBack() {
    if (history.length <= 1) return;
    history.pop();
    applyStep(history[history.length - 1], "back");
  }

  function applyStep(stepId, direction) {
    qsa(".auth-step").forEach((section) => {
      const isActive = section.dataset.step === stepId;
      section.classList.toggle("active", isActive);
      section.classList.toggle("leaving-back", !isActive && direction === "back");
    });
    updateProgress(stepId);
    clearAuthError();
    const firstInput = document.querySelector(`.auth-step[data-step="${stepId}"] input`);
    if (firstInput) setTimeout(() => firstInput.focus({ preventScroll: true }), 260);
  }

  function updateProgress(stepId) {
    const idx = PROGRESS_STEPS.indexOf(stepId);
    const bar = $("authProgress");
    if (idx === -1) { bar.classList.add("hidden"); return; }
    bar.classList.remove("hidden");
    bar.innerHTML = PROGRESS_STEPS.map((_, i) => {
      const cls = i < idx ? "done" : i === idx ? "current" : "";
      return `<span class="${cls}"></span>`;
    }).join("");
  }

  function showAuthError(message) { const n = $("authError"); n.textContent = message; n.classList.remove("hidden"); }
  function showStepError(id, message) { const n = $(id); n.textContent = message; n.classList.remove("hidden"); }
  function clearAuthError() {
    ["authError", "credError", "nameError", "statsError", "goalError"].forEach((id) => {
      const n = $(id); n.classList.add("hidden"); n.textContent = "";
    });
  }

  // ---- live field validation ---------------------------------------------

  function setFieldStatus(inputId, statusId, isValid) {
    const input = $(inputId), status = $(statusId);
    input.classList.toggle("valid", isValid === true);
    input.classList.toggle("invalid", isValid === false);
    if (status) { status.classList.toggle("valid", isValid === true); status.classList.toggle("invalid", isValid === false); }
  }
  function resetFieldStatus(statusId) {
    const status = $(statusId);
    if (status) status.classList.remove("valid", "invalid");
  }

  function initLiveValidation() {
    const email = $("authEmail");
    email.addEventListener("input", () => {
      const value = email.value.trim();
      const hint = $("emailHint");
      if (!value) { setFieldStatus("authEmail", "emailStatus", null); hint.classList.add("hidden"); return; }
      const valid = EMAIL_RE.test(value);
      setFieldStatus("authEmail", "emailStatus", valid);
      hint.classList.toggle("hidden", valid);
    });

    const password = $("authPassword");
    const syncConfirm = () => {
      const confirm = $("authPasswordConfirm");
      if (!$("authConfirmLabel").classList.contains("hidden") && confirm.value) {
        setFieldStatus("authPasswordConfirm", "confirmStatus", confirm.value === password.value);
      }
    };
    password.addEventListener("input", () => {
      setFieldStatus("authPassword", "passwordStatus", password.value ? password.value.length >= 6 : null);
      syncConfirm();
    });
    $("authPasswordConfirm").addEventListener("input", syncConfirm);
  }

  // ---- number steppers (no native spinner, no mouse-wheel surprises) -----

  function initSteppers() {
    qsa(".auth-stepper").forEach((wrap) => {
      const input = qs("input", wrap);
      const min = parseFloat(wrap.dataset.min);
      const max = parseFloat(wrap.dataset.max);
      const increment = parseFloat(wrap.dataset.increment) || 1;
      const decimals = increment < 1 ? 1 : 0;

      const clamp = (value) => Math.min(max, Math.max(min, value));
      const setValue = (value) => { input.value = clamp(value).toFixed(decimals).replace(/\.0$/, ""); };

      qsa(".stepper-btn", wrap).forEach((btn) => {
        btn.onclick = () => {
          const dir = parseFloat(btn.dataset.dir);
          const current = parseFloat(input.value) || min;
          setValue(current + dir * increment);
        };
      });

      // Native mouse-wheel-over-a-number-input scrubbing is easy to trigger
      // by accident while scrolling the page — turn it off.
      input.addEventListener("wheel", (e) => e.preventDefault(), { passive: false });
      input.addEventListener("blur", () => { if (input.value !== "") setValue(parseFloat(input.value) || min); });
    });
  }

  // ---- Google -------------------------------------------------------------

  const SILENT_CANCEL_CODES = new Set(["auth/popup-closed-by-user", "auth/cancelled-popup-request", "auth/user-cancelled"]);

  async function handleGoogleClick() {
    const btn = $("googleAuthBtn");
    btn.disabled = true;
    try {
      const result = await signInWithGoogle();
      if (result) handleGoogleResult(result); // null result means a redirect is in flight
    } catch (error) {
      if (!SILENT_CANCEL_CODES.has(error.code)) showAuthError(readAuthError(error));
      else console.info("[auth] Google popup closed by user");
    } finally {
      btn.disabled = false;
    }
  }

  function handleGoogleResult(result) {
    const isNewUser = !!(result.additionalUserInfo && result.additionalUserInfo.isNewUser);
    googleUser = result.user;
    method = "google";

    if (!isNewUser) return; // returning user: onAuthStateChanged already routes them into the app

    // New account: app.js's onAuthStateChanged will fire and show the app
    // shell almost immediately, but we still need name/age/weight/goal — so
    // pull the gate back up and continue the profile steps.
    mode = "signup";
    draft.name = (googleUser.displayName || "").split(" ")[0] || "";
    history = ["welcome"];
    showGate();
    goToStep("name");
    const nameInput = $("authName");
    if (nameInput) nameInput.value = draft.name;
  }

  // ---- step submissions -----------------------------------------------

  async function submitCredentials(event) {
    event.preventDefault();
    clearAuthError();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;

    if (!EMAIL_RE.test(email)) { showStepError("credError", "Enter a valid email address."); return; }
    if (mode === "signup" && password !== $("authPasswordConfirm").value) {
      showStepError("credError", "Passwords do not match.");
      return;
    }

    const btn = $("credNextBtn");
    btn.disabled = true;
    try {
      if (mode === "signup") {
        draft.email = email;
        draft.password = password;
        goToStep("name");
      } else {
        await signInWithPassword(email, password);
      }
    } catch (error) {
      showStepError("credError", readAuthError(error));
    } finally {
      btn.disabled = false;
    }
  }

  function submitName(event) {
    event.preventDefault();
    const name = $("authName").value.trim();
    if (!name) { showStepError("nameError", "Please enter your name."); return; }
    draft.name = name;
    goToStep("stats");
  }

  function submitStats(event) {
    event.preventDefault();
    const age = parseInt($("authAge").value || "0", 10);
    const weight = parseFloat($("authWeight").value || "0");
    if (!age || age < 10) { showStepError("statsError", "Please enter a valid age."); return; }
    if (!weight || weight < 30) { showStepError("statsError", "Please enter your current weight."); return; }
    draft.age = age;
    draft.weight = weight;
    goToStep("goal");
  }

  async function submitGoal(event) {
    event.preventDefault();
    const goalKg = parseFloat($("authGoalKg").value || "0");
    if (!goalKg || goalKg < 1) { showStepError("goalError", "Please enter how much weight you want to reduce."); return; }
    draft.goalKg = goalKg;

    const btn = $("finishSignupBtn");
    btn.disabled = true;
    try {
      saveProfile();
      if (method === "google") {
        // Already authenticated via Google; onAuthStateChanged has already
        // fired (or will, momentarily) and app.js takes it from there.
        showApp();
      } else {
        await signUpWithPassword(draft.email, draft.password);
      }
    } catch (error) {
      showStepError("goalError", readAuthError(error));
    } finally {
      btn.disabled = false;
    }
  }

  function saveProfile() {
    try {
      localStorage.setItem("gym-log-profile", JSON.stringify({
        name: draft.name, age: draft.age, weight: draft.weight, goalKg: draft.goalKg,
        createdAt: Date.now(),
      }));
    } catch {}
  }

  async function resetPassword() {
    const email = $("authEmail").value.trim();
    if (!email) { showStepError("credError", "Enter your email first."); return; }
    try { await sendPasswordReset(email); showToast("Password reset email sent."); }
    catch (error) { showStepError("credError", readAuthError(error)); }
  }

  // ---- gate visibility ------------------------------------------------

  function showGate() {
    $("appShell").classList.add("hidden");
    $("tabBar").classList.add("hidden");
    $("authGate").classList.remove("hidden");
  }
  function showApp() {
    const state = getState();
    $("authGate").classList.add("hidden");
    $("appShell").classList.remove("hidden");
    $("tabBar").classList.remove("hidden");
    $("guestBanner").classList.toggle("hidden", !state.auth.isGuest);
  }

  return { initAuthGate, setAuthMode, showAuthError, showGate, showApp };
})();
