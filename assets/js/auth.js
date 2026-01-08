// Import the specific Firebase functions we need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Your KHS Clinic Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDv7UqZfz9J3QtH3LmX58Tpw_fXsciigB4",
  authDomain: "khx-appointment.firebaseapp.com",
  projectId: "khx-appointment",
  storageBucket: "khx-appointment.appspot.com",
  messagingSenderId: "1024325678901",
  appId: "1:1024325678901:web:a1b2c3d4e5f67890abcdef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export these variables so index.html can use them
export { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    collection, 
    addDoc 
};