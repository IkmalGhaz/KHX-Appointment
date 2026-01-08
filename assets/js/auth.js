import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, db, setDoc, doc } from './firebase-config.js';

const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');

// LOGIN LOGIC
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert("Login Failed: " + error.message);
        }
    });
}

// REGISTER LOGIC
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('fullname').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            
            // Save extra details to Firestore Users collection
            await setDoc(doc(db, "Users", user.uid), {
                fullName: name,
                email: email,
                role: "patient"
            });

            alert("Account created!");
            window.location.href = 'dashboard.html';
        } catch (error) {
            alert("Error: " + error.message);
        }
    });
}