import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCNUwpXMXFDEGkwmqYgmnmO_DvldRroGns",
  authDomain: "taxilocalapp.firebaseapp.com",
  projectId: "taxilocalapp",
  storageBucket: "taxilocalapp.firebasestorage.app",
  messagingSenderId: "512363244134",
  appId: "1:512363244134:web:28b2106e0ea621d8a3dba7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
