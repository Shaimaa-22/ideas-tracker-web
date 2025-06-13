import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"
const firebaseConfig = {
  apiKey: "AIzaSyApIWE0azX2Ogv_cetKKFW6kIabfy870Ak",
  authDomain: "test1-25-4a213.firebaseapp.com",
  projectId: "test1-25-4a213",
  storageBucket: "test1-25-4a213.firebasestorage.app",
  messagingSenderId: "293717537488",
  appId: "1:293717537488:web:d0a0de173332ca8e61a4d5",
  measurementId: "G-417TQHFNTT",
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

export { auth, db }
