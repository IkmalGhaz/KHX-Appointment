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

// --- ANALYTICS CHARTS LOGIC ---
function initAnalyticsCharts() {
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { grid: { display: false }, beginAtZero: true } }
    };

    // 1. Top Doctors (Horizontal Bar)
    new Chart(document.getElementById('topDoctorsChart'), {
        type: 'bar',
        data: {
            labels: ['Dr. Sarah', 'Dr. Michael', 'Dr. Ali', 'Dr. Emma'],
            datasets: [{
                data: [45, 38, 32, 25],
                backgroundColor: ['#009688', '#4DB6AC', '#80CBC4', '#B2DFDB'],
                borderRadius: 8
            }]
        },
        options: { ...chartOptions, indexAxis: 'y' }
    });

    // 2. Age Analysis (Doughnut)
    new Chart(document.getElementById('ageAnalysisChart'), {
        type: 'doughnut',
        data: {
            labels: ['18-25', '26-40', '41-60', '60+'],
            datasets: [{
                data: [30, 45, 15, 10],
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                borderWidth: 0
            }]
        },
        options: {
            ...chartOptions,
            cutout: '70%',
            plugins: { legend: { display: true, position: 'right' } }
        }
    });

    // 3. Top Services (Vertical Bar)
    new Chart(document.getElementById('servicesChart'), {
        type: 'bar',
        data: {
            labels: ['Dental', 'Consult', 'Scan', 'Surgery'],
            datasets: [{
                data: [65, 50, 80, 40],
                backgroundColor: '#6200EE',
                borderRadius: 8
            }]
        },
        options: chartOptions
    });
}

// --- MAIN AUTH OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 1. Load User Profile
        await populateProfile(user.uid);

        // 2. Initialize Charts
        initAnalyticsCharts();

        // 3. Refresh Lucide Icons
        if (window.lucide) window.lucide.createIcons();
    } else {
        // Redirect to login if not authenticated
        window.location.href = "index.html";
    }
});