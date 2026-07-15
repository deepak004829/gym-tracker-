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
  };

  function firebaseReady() {
    return typeof firebase !== "undefined" && window.firebaseConfig && window.firebaseConfig.apiKey && window.firebaseConfig.apiKey !== "YOUR_API_KEY";
  }

  function readAuthError(error) {
    return AUTH_ERRORS[error.code] || "Something went wrong. Please try again.";
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

  return { firebaseReady, readAuthError, initAuth, signInWithPassword, signUpWithPassword, sendPasswordReset, signOutUser };
})();
