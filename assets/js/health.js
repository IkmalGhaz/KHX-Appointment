import { auth, db, collection, addDoc } from './firebase-config.js';

const heightInput = document.getElementById('height-input');
const weightInput = document.getElementById('weight-input');
const saveBtn = document.getElementById('save-health-btn');

saveBtn.onclick = async () => {
    const h = parseFloat(heightInput.value);
    const w = parseFloat(weightInput.value);

    if (!h || !w) return alert("Please fill in both fields");

    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;

    try {
        await addDoc(collection(db, "HealthTracker"), {
            patientId: auth.currentUser.uid,
            height: h,
            weight: w,
            createdAt: new Date()
        });
        alert("Health stats updated!"); //
        window.location.href = 'dashboard.html';
    } catch (e) {
        console.error(e);
        saveBtn.innerText = "Save Statistics";
        saveBtn.disabled = false;
    }
};