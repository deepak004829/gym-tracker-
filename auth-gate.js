window.GL = window.GL || {};

GL.authGate = (function () {
  const { $ } = GL.dom;
  const { getState } = GL.store;
  const { signInWithPassword, signUpWithPassword, sendPasswordReset, readAuthError } = GL.authApi;
  const { showToast } = GL.toast;

  function initAuthGate({ onGuestEnter }) {
    const state = getState();
    $("authTabSignin").onclick = () => setAuthMode("signin");
    $("authTabSignup").onclick = () => setAuthMode("signup");
    $("authForm").onsubmit = submitAuth;
    $("authForgotBtn").onclick = resetPassword;
    $("authGuestBtn").onclick = onGuestEnter;
    $("guestSignUpBtn").onclick = () => { state.auth.isGuest = false; setAuthMode("signup"); showGate(); };
  }

  function setAuthMode(mode) {
    const state = getState();
    state.auth.mode = mode;
    const signup = mode === "signup";
    $("authTabSignin").classList.toggle("active", !signup);
    $("authTabSignup").classList.toggle("active", signup);
    $("authConfirmLabel").classList.toggle("hidden", !signup);
    $("authPasswordConfirm").required = signup;
    $("authPasswordConfirm").value = "";
    $("authSubmitBtn").textContent = signup ? "Create account" : "Sign in";
    $("authSubcopy").textContent = signup ? "Create an account to sync every workout." : "Sign in to keep your workouts in sync.";
    clearAuthError();
  }

  function showAuthError(message) { const n = $("authError"); n.textContent = message; n.classList.remove("hidden"); }
  function clearAuthError() { const n = $("authError"); n.classList.add("hidden"); n.textContent = ""; }

  async function submitAuth(event) {
    event.preventDefault();
    clearAuthError();
    const state = getState();
    const email = $("authEmail").value.trim();
    const password = $("authPassword").value;
    if (state.auth.mode === "signup" && password !== $("authPasswordConfirm").value) { showAuthError("Passwords do not match."); return; }
    const btn = $("authSubmitBtn");
    try {
      btn.disabled = true;
      if (state.auth.mode === "signup") await signUpWithPassword(email, password);
      else await signInWithPassword(email, password);
    } catch (error) {
      showAuthError(readAuthError(error));
    } finally {
      btn.disabled = false;
    }
  }

  async function resetPassword() {
    const email = $("authEmail").value.trim();
    if (!email) { showAuthError("Enter your email first."); return; }
    try { await sendPasswordReset(email); showToast("Password reset email sent."); }
    catch (error) { showAuthError(readAuthError(error)); }
  }

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
