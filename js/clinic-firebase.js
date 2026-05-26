(function () {
  const config = window.firebaseConfig || {};
  const required = ["apiKey", "authDomain", "projectId", "appId"];
  const missing = required.filter((key) => !config[key] || String(config[key]).startsWith("PASTE_"));

  window.clinicFirebaseReady = false;

  if (missing.length) {
    window.clinicFirebaseError = "Firebase 尚未設定：" + missing.join(", ");
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(config);
  }

  window.clinicFirebaseReady = true;
  window.clinicDb = firebase.firestore();
  window.clinicAuth = firebase.auth();
  firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch(function () {
    // Persistence is optional. Some private browsers block it.
  });
})();
