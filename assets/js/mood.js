import { auth, db, collection, addDoc } from './firebase-config.js';

const slider = document.getElementById('mood-slider');
const ring = document.getElementById('mood-ring');
const valText = document.getElementById('mood-value');
const descText = document.getElementById('mood-desc');
const saveBtn = document.getElementById('save-mood-btn');

slider.oninput = function () {
    const val = parseInt(this.value);
    valText.innerText = val + "%";

    if (val <= 50) {
        ring.style.borderColor = "#FBBF24"; // Yellow
        descText.innerText = "Neutral";
        descText.style.color = "#D97706";
    } else {
        ring.style.borderColor = "#009688"; // Teal
        descText.innerText = "Happy";
        descText.style.color = "#009688";
    }
};

saveBtn.onclick = async () => {
    saveBtn.innerText = "Saving...";
    saveBtn.disabled = true;
    try {
        await addDoc(collection(db, "MoodTracker"), {
            userId: auth.currentUser.uid,
            moodScore: parseInt(slider.value),
            createdAt: new Date()
        });
        alert("Mood updated!");
        window.location.href = 'dashboard.html';
    } catch (e) {
        console.error(e);
        saveBtn.innerText = "Update Mood";
        saveBtn.disabled = false;
    }
};