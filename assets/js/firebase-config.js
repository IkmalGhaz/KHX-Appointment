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
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot // Required for real-time updates
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Add Firebase Storage imports to fix the "Failed to update profile" error
import {
    getStorage,
    ref,
    uploadBytes,
    getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

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
const storage = getStorage(app); // Initialize Storage instance

// Export all necessary functions
export {
    auth,
    db,
    storage, // Export storage for use in dashboard.js
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
    setDoc,
    updateDoc,
    deleteDoc,
    onSnapshot, // Export for real-time syncing
    ref, // Export for Storage references
    uploadBytes, // Export for file uploads
    getDownloadURL // Export to retrieve public image links
};