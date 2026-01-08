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

// Your Original Keys
const firebaseConfig = {
  apiKey: "AIzaSyDv7UqZfz9J3QtH3LmX58Tpw_fXsciigB4",
  authDomain: "khs-clinic-appointment.firebaseapp.com",
  projectId: "khs-clinic-appointment",
  storageBucket: "khs-clinic-appointment.firebasestorage.app",
  messagingSenderId: "1001118458502",
  appId: "1:1001118458502:web:5e8b2b95ee5098f3702707"
  
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Export all necessary functions
export { 
    auth, 
    db, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    doc, 
    getDoc, 
    setDoc 
};