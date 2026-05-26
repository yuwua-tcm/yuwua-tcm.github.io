// 初始化 Firebase 設定
const firebaseConfig = {
  apiKey: "AIzaSyAHmIYGFaGwnLbyFsvzU0t0KXXFjW_kGjc",
  authDomain: "yuhua-clinic.firebaseapp.com",
  projectId: "yuhua-clinic",
  storageBucket: "yuhua-clinic.firebasestorage.app",
  messagingSenderId: "603459298697",
  appId: "1:603459298697:web:aca41e44a4f6f823dad58",
  databaseURL: "https://yuhua-clinic-default-rtdb.firebaseio.com" // 🔹請加上這行，確保能用 Realtime Database
};

// 初始化 Firebase
const app = firebase.initializeApp(firebaseConfig);

// 若有使用 Realtime Database，建立連線參考
const database = firebase.database();

// 若要使用 Authentication
const auth = firebase.auth();

// 你可以在主程式 main.js 中呼叫 database 或 auth，例如：
// database.ref("registrations").push({...});
