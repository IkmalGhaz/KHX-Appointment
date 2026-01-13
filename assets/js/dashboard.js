import { auth, db, onAuthStateChanged, collection, query, where, getDocs, doc, updateDoc, signOut } from './firebase-config.js';

// --- Modal Elements ---
const profileViewModal = document.getElementById('profile-view-modal');
const profileEditModal = document.getElementById('profile-edit-modal');
const profileIconBtn = document.getElementById('logout-btn');

// --- Appointment Modal Elements ---
const aptModal = document.getElementById('apt-modal');
const viewAptBtn = document.getElementById('view-apt-btn');
const closeAptModalBtn = document.getElementById('close-modal');

// --- View Profile Mode Elements ---
const viewFullName = document.getElementById('view-full-name');
const viewPhone = document.getElementById('view-phone');
const viewEmail = document.getElementById('view-email');
const viewAddress = document.getElementById('view-address');
const viewImg = document.getElementById('view-prof-img');

// --- Edit Profile Mode Elements ---
const editForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-prof-name');
const editPhoneInput = document.getElementById('edit-prof-phone');
const editAddressInput = document.getElementById('edit-prof-address');
const editImgPreview = document.getElementById('edit-prof-img-preview');
const imgUploadInput = document.getElementById('img-upload');

let currentUserDocId = null;

// --- PROFILE MODAL HANDLERS ---
profileIconBtn.onclick = () => profileViewModal.classList.remove('hidden');
window.closeViewProfile = () => profileViewModal.classList.add('hidden');

document.getElementById('open-edit-btn').onclick = () => {
    profileViewModal.classList.add('hidden');
    profileEditModal.classList.remove('hidden');
};

window.closeEditProfile = () => {
    profileEditModal.classList.add('hidden');
    profileViewModal.classList.remove('hidden');
};

// --- APPOINTMENT MODAL HANDLERS ---
if (viewAptBtn) {
    viewAptBtn.onclick = () => {
        aptModal.classList.remove('hidden');
        // Trigger the switchTab function defined in view-appointments.js
        if (typeof window.switchTab === 'function') {
            window.switchTab('Upcoming');
        }
    };
}

if (closeAptModalBtn) {
    closeAptModalBtn.onclick = () => aptModal.classList.add('hidden');
}

// --- DATA POPULATION (FETCHING USER DOC) ---
async function populateProfile(uid) {
    try {
        const q = query(collection(db, "Users"), where("firebaseUid", "==", uid));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            currentUserDocId = userDoc.id; // Store Firestore Document ID for updates
            const data = userDoc.data();

            // Populate View Mode
            document.getElementById('view-full-name-header').innerText = data.fullName || "Jane Smith";
            viewFullName.innerText = data.fullName || "--";
            viewPhone.innerText = data.phone || "--";
            viewEmail.innerText = data.email || "--";
            viewAddress.innerText = data.mailingAddress || "--";
            if (data.profilePictureUrl) viewImg.src = data.profilePictureUrl;

            // Populate Edit Form
            editNameInput.value = data.fullName || "";
            editPhoneInput.value = data.phone || "";
            editAddressInput.value = data.mailingAddress || "";
            if (data.profilePictureUrl) editImgPreview.src = data.profilePictureUrl;

            // Update Dashboard Header
            document.getElementById('user-name').innerText = data.fullName || "Valued Patient";
        }
    } catch (e) {
        console.error("Profile Load Error:", e);
    }
}

// --- EDIT PROFILE LOGIC ---
imgUploadInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => editImgPreview.src = reader.result;
        reader.readAsDataURL(file);
    }
};

editForm.onsubmit = async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('save-edit-btn');
    saveBtn.innerText = "Updating...";
    saveBtn.disabled = true;

    try {
        const updatedData = {
            fullName: editNameInput.value,
            phone: editPhoneInput.value,
            mailingAddress: editAddressInput.value,
            profilePictureUrl: editImgPreview.src // Saving as Base64
        };

        const userRef = doc(db, "Users", currentUserDocId);
        await updateDoc(userRef, updatedData);

        alert("Profile updated successfully!");
        await populateProfile(auth.currentUser.uid); // Refresh displayed data
        closeEditProfile();
    } catch (error) {
        console.error("Update Error:", error);
        alert("Failed to update profile.");
    } finally {
        saveBtn.innerText = "Save Changes";
        saveBtn.disabled = false;
    }
};

// --- LOGOUT LOGIC ---
document.getElementById('profile-logout-btn').onclick = async () => {
    if (confirm("Logout from KHX Clinic?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await populateProfile(user.uid);
        if (window.lucide) window.lucide.createIcons();
    }
});