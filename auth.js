// Thin wrapper around the Firebase compat auth SDK. Kept on the compat API
// (rather than modular v9) so the app can run straight from static files
// with no bundler — matching how this project is deployed (e.g. GitHub Pages).
window.GL = window.GL || {};

GL.authApi = (function () {
  const AUTH_ERRORS = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email.",
    "auth/weak-password": "Use at least six characters.",
    "auth/invalid-email": "Enter a valid email.",
    "auth/operation-not-allowed": "Google sign-in isn\u2019t turned on yet for this project (Firebase console \u2192 Authentication \u2192 Sign-in method \u2192 enable Google).",
    "auth/unauthorized-domain": "This site isn\u2019t on the allowed list yet (Firebase console \u2192 Authentication \u2192 Settings \u2192 Authorized domains).",
    "auth/account-exists-with-different-credential": "An account already exists for this email using a different sign-in method. Try signing in with email/password instead.",
    "auth/network-request-failed": "Network error \u2014 check your connection and try again.",
  };

  function firebaseReady() {
    return typeof firebase !== "undefined" && window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY";
  }

  function readAuthError(error) {
    console.error("[auth]", error.code, error.message);
    return AUTH_ERRORS[error.code] || `Something went wrong (${error.code || "unknown error"}). Please try again.`;
  }

  function initAuth(onUser, onSignedOut, onFatal) {
    if (!firebaseReady()) { onFatal("Firebase is not configured yet."); return; }
    try {
      if (!firebase.apps.length) firebase.initializeApp(window.firebaseConfig);
      firebase.auth().onAuthStateChanged((user) => (user ? onUser(user) : onSignedOut()));
    } catch (error) {
      console.error(error);
      onFatal("Couldn\u2019t connect to Firebase. Check your configuration.");
    }
  }

  async function signInWithPassword(email, password) {
    return firebase.auth().signInWithEmailAndPassword(email, password);
  }
  async function signUpWithPassword(email, password) {
    return firebase.auth().createUserWithEmailAndPassword(email, password);
  }
  async function sendPasswordReset(email) {
    return firebase.auth().sendPasswordResetEmail(email);
  }
  async function signOutUser() {
    return firebase.auth().signOut();
  }

  // Google sign-in. Popup is the happy path (desktop + most mobile browsers).
  // Standalone/installed PWAs often block popups, so on the specific errors
  // that indicate that, we fall back to a full-page redirect instead.
  const POPUP_FALLBACK_CODES = new Set([
    "auth/popup-blocked",
    "auth/cancelled-popup-request",
    "auth/operation-not-supported-in-this-environment",
  ]);

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      return await firebase.auth().signInWithPopup(provider);
    } catch (error) {
      if (POPUP_FALLBACK_CODES.has(error.code)) {
        await firebase.auth().signInWithRedirect(provider);
        return null; // page is navigating away; caller won't get a result here
      }
      throw error;
    }
  }

  // Call once on startup to pick up the result of a signInWithRedirect
  // fallback from a previous page load (no-op if there wasn't one).
  async function getGoogleRedirectResult() {
    if (!firebaseReady()) return null;
    try {
      const result = await firebase.auth().getRedirectResult();
      return result && result.user ? result : null;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  // Wipe all user-specific data from localStorage so the next person who
  // opens the app (or the same user on a shared device) starts clean.
  function clearLocalUserData() {
    const keysToRemove = [
      "gym-log-profile",
      "gym-log-logs",
      "gym-log-journal",
      "gym-log-plans",
      "gym-log-gamification",
    ];
    keysToRemove.forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  }

  return {
    firebaseReady, readAuthError, initAuth,
    signInWithPassword, signUpWithPassword, sendPasswordReset,
    signOutUser, clearLocalUserData,
    signInWithGoogle, getGoogleRedirectResult,
  };
})();
