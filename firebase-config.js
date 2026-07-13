// ────────────────────────────────────────────────────────────────
// FIREBASE CONFIG — paste in your own project's values.
//
// How to get these (free tier is plenty for this app):
// 1. Go to https://console.firebase.google.com → "Add project" (name it
//    anything, e.g. "gym-tracker").
// 2. Once created, click the "</>" (web) icon to register a web app.
//    Firebase will show you an object exactly like the one below —
//    copy your real values into it here.
// 3. In the left sidebar go to Build → Authentication → Get started →
//    enable the "Anonymous" sign-in provider (Sign-in method tab).
// 4. In the left sidebar go to Build → Firestore Database → Create
//    database → start in "Production mode" (rules below handle security).
// 5. In Firestore → Rules, paste this and click Publish:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{userId} {
//          allow read, write: if request.auth != null && request.auth.uid == userId;
//        }
//      }
//    }
//
// That's it — reload the app and the cloud icon in the top bar should
// turn solid once it connects. Until you fill this in, the app just
// runs fully offline on local storage as before.
// ────────────────────────────────────────────────────────────────

window.firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
