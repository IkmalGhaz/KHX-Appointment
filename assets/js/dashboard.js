// Import updateDoc and doc from your config
import { auth, db, onAuthStateChanged, collection, query, where, getDocs, doc, updateDoc } from './firebase-config.js';

// DOM Elements
const profileModal = document.getElementById('profile-modal');
const profileIconBtn = document.getElementById('logout-btn'); // Top right icon
const closeProfileBtn = document.getElementById('close-profile');
const imgUpload = document.getElementById('img-upload');
const profilePreview = document.getElementById('profile-img-preview');
const profileForm = document.getElementById('profile-form');

let currentUserDocId = null;

// Open/Close Modal
profileIconBtn.onclick = () => profileModal.classList.remove('hidden');
closeProfileBtn.onclick = () => profileModal.classList.add('hidden');

// Load Data into Profile
async function populateProfile(uid) {
    try {
        const q = query(collection(db, "Users"), where("firebaseUid", "==", uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            currentUserDocId = userDoc.id; // Store Firestore document ID
            const data = userDoc.data();

            document.getElementById('prof-name').value = data.fullName || "";
            document.getElementById('prof-phone').value = data.phone || "";
            document.getElementById('prof-dob').value = data.dateOfBirth || "";
            document.getElementById('prof-address').value = data.mailingAddress || "";

            if (data.profilePictureUrl) {
                profilePreview.src = data.profilePictureUrl;
            }
        }
    } catch (e) {
        console.error("Profile fetch error:", e);
    }
}

// Handle Image Preview (Local)
imgUpload.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => profilePreview.src = reader.result;
        reader.readAsDataURL(file);
    }
};

// Update Logic
profileForm.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-profile');
    saveBtn.innerText = "Updating...";
    saveBtn.disabled = true;

    try {
        const updatedData = {
            fullName: document.getElementById('prof-name').value,
            phone: document.getElementById('prof-phone').value,
            mailingAddress: document.getElementById('prof-address').value,
            profilePictureUrl: profilePreview.src // Saving as Base64 string
        };

        const userRef = doc(db, "Users", currentUserDocId);
        await updateDoc(userRef, updatedData);

        alert("Profile updated successfully!");
        profileModal.classList.add('hidden');

        // Refresh dashboard name if changed
        document.getElementById('user-name').innerText = updatedData.fullName;
    } catch (error) {
        console.error("Update Error:", error);
        alert("Failed to update profile.");
    } finally {
        saveBtn.innerText = "Update Profile";
        saveBtn.disabled = false;
    }
};

// Call populate inside your existing Auth observer
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await populateProfile(user.uid);
        // ... rest of your existing loadDashboardData
    }
});