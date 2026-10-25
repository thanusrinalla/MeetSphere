/**
 * MeetBefore - Firebase Configuration & Initialization
 * 
 * ============================================================================
 * STEP 1: PASTE YOUR FIREBASE CONFIGURATION KEYS HERE:
 * (Get these from: Firebase Console > Project Settings > General > Your Apps > Web App)
 * ============================================================================
 */
const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ============================================================================
// DO NOT MODIFY BELOW UNLESS CUSTOMIZING
// ============================================================================

// Check if valid Firebase credentials have been supplied
function isFirebaseConfigured() {
  // Also check if user entered custom config via in-app UI
  const userCustomConfig = getCustomConfigFromStorage();
  const config = userCustomConfig || firebaseConfig;

  return (
    config &&
    config.apiKey &&
    config.apiKey !== "YOUR_API_KEY_HERE" &&
    config.projectId &&
    config.projectId !== "YOUR_PROJECT_ID"
  );
}

function getCustomConfigFromStorage() {
  try {
    const raw = localStorage.getItem("meetbefore_firebase_config");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

let firebaseApp = null;
let authInstance = null;
let firestoreInstance = null;
let isLiveFirebase = false;

// Initialize Firebase if configured and Firebase SDK is loaded
try {
  const activeConfig = getCustomConfigFromStorage() || firebaseConfig;

  if (isFirebaseConfigured() && typeof firebase !== "undefined") {
    if (!firebase.apps.length) {
      firebaseApp = firebase.initializeApp(activeConfig);
    } else {
      firebaseApp = firebase.app();
    }
    authInstance = firebase.auth();
    firestoreInstance = firebase.firestore();
    isLiveFirebase = true;
    console.log("🔥 MeetBefore connected to Live Firebase!");
  } else {
    console.log("⚡ MeetBefore running in Demo/Offline mode (No Firebase keys entered yet).");
  }
} catch (err) {
  console.warn("Firebase initialization note:", err.message);
  isLiveFirebase = false;
}

// Make accessible globally
window.MEETBEFORE_FIREBASE = {
  isConfigured: isFirebaseConfigured,
  isLive: () => isLiveFirebase,
  auth: () => authInstance,
  db: () => firestoreInstance,
  rawConfig: firebaseConfig,
  saveCustomConfig: (config) => {
    localStorage.setItem("meetbefore_firebase_config", JSON.stringify(config));
    window.location.reload();
  },
  clearCustomConfig: () => {
    localStorage.removeItem("meetbefore_firebase_config");
    window.location.reload();
  }
};
