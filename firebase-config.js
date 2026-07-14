// ────────────────────────────────────────────────────────────────
// FIREBASE CONFIG — this is your existing "gym-tracker-4b3e5" project
// (the same keys you set up earlier). If you ever need to recreate it
// or move to a fresh project, here's the checklist:
//
// 1. https://console.firebase.google.com → your project → the "</>" (web)
//    icon → copy the config object it shows you into the object below.
// 2. Build → Authentication → Sign-in method → enable "Email/Password".
//    (This app no longer uses Anonymous auth — every real user signs in with
//    an email + password. "Continue as guest" never touches Firebase at all.)
// 3. Build → Firestore Database → Create database → Production mode.
// 4. Firestore → Rules tab → paste this and click Publish:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//          match /{document=**} {
//            allow read, write: if request.auth != null && request.auth.uid == userId;
//          }
//        }
//      }
//    }
//
// If sign-in fails or sync still shows "Local only" after this, the two
// most common causes are:
//   a) Email/Password isn't enabled yet (step 2 above) — you'll see
//      "auth/operation-not-allowed" in the console.
//   b) Authorized domains: Authentication → Settings → Authorized domains
//      → add your *.github.io (or custom) domain there. Firebase silently
//      refuses to sign in on domains it doesn't recognize.
// ────────────────────────────────────────────────────────────────

window.firebaseConfig = {
  apiKey: "AIzaSyDhAuCHD9hB-8AqkfZLOxg4w3UeId_5FdA",
  authDomain: "gym-tracker-4b3e5.firebaseapp.com",
  projectId: "gym-tracker-4b3e5",
  storageBucket: "gym-tracker-4b3e5.firebasestorage.app",
  messagingSenderId: "1061110905035",
  appId: "1:1061110905035:web:63f8da21292810d121834e"
};
