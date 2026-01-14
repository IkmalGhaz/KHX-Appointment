import {
    auth, db, storage, onAuthStateChanged, collection, query, where, onSnapshot, doc, updateDoc, signOut, ref, uploadBytes, getDownloadURL, getDocs
} from './firebase-config.js';

// --- UI Elements ---
const profileViewModal = document.getElementById('profile-view-modal');
const profileEditModal = document.getElementById('profile-edit-modal');
const profileIconBtn = document.getElementById('logout-btn');
const aptModal = document.getElementById('apt-modal');
const viewAptBtn = document.getElementById('view-apt-btn');
const closeAptModalBtn = document.getElementById('close-modal');

// --- Profile View IDs ---
const viewFullNameHeader = document.getElementById('view-full-name-header');
const viewFullName = document.getElementById('view-full-name');
const viewPhone = document.getElementById('view-phone');
const viewEmail = document.getElementById('view-email');
const viewAddress = document.getElementById('view-address');
const viewImg = document.getElementById('view-prof-img');
const viewMemberSince = document.getElementById('view-member-since');
const viewDaysCount = document.getElementById('view-days-count');

// --- Profile Edit Form IDs ---
const editForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-prof-name');
const editPhoneInput = document.getElementById('edit-prof-phone');
const editAddressInput = document.getElementById('edit-prof-address');
const editImgPreview = document.getElementById('edit-prof-img-preview');
const imgUploadInput = document.getElementById('img-upload');

let currentUserDocId = null;

// --- MODAL HANDLERS ---
if (profileIconBtn) profileIconBtn.onclick = () => profileViewModal.classList.remove('hidden');

window.closeViewProfile = () => profileViewModal.classList.add('hidden');

window.closeEditProfile = () => {
    profileEditModal.classList.add('hidden');
    profileViewModal.classList.remove('hidden');
};

document.getElementById('open-edit-btn').onclick = () => {
    profileViewModal.classList.add('hidden');
    profileEditModal.classList.remove('hidden');
};

if (viewAptBtn) {
    viewAptBtn.onclick = () => {
        aptModal.classList.remove('hidden');
        if (typeof window.switchTab === 'function') window.switchTab('Upcoming');
    };
}
if (closeAptModalBtn) { closeAptModalBtn.onclick = () => aptModal.classList.add('hidden'); }

// --- PROFILE REAL-TIME SYNC ---
function setupProfileListener(uid) {
    const q = query(collection(db, "Users"), where("firebaseUid", "==", uid));

    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            currentUserDocId = userDoc.id;
            const data = userDoc.data();

            // 1. Update View Personal Info Modal
            if (viewFullNameHeader) viewFullNameHeader.innerText = data.fullName || "User Name";
            if (viewFullName) viewFullName.innerText = data.fullName || "--";
            if (viewPhone) viewPhone.innerText = data.phone || "--";
            if (viewEmail) viewEmail.innerText = data.email || "--";
            if (viewAddress) viewAddress.innerText = data.mailingAddress || "No address provided";
            if (data.profilePictureUrl && viewImg) viewImg.src = data.profilePictureUrl;

            // 2. Pre-fill Edit Form
            if (editNameInput) editNameInput.value = data.fullName || "";
            if (editPhoneInput) editPhoneInput.value = data.phone || "";
            if (editAddressInput) editAddressInput.value = data.mailingAddress || "";
            if (data.profilePictureUrl && editImgPreview) editImgPreview.src = data.profilePictureUrl;

            // 3. Calculate Membership Duration
            if (data.createdAt) {
                const joinedDate = data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);
                if (viewMemberSince) viewMemberSince.innerText = joinedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const diffDays = Math.ceil(Math.abs(new Date() - joinedDate) / (1000 * 60 * 60 * 24));
                if (viewDaysCount) viewDaysCount.innerText = `${diffDays} days with us`;
            }

            // 4. Update Dashboard Greeting
            const dashUserName = document.getElementById('user-name');
            if (dashUserName) dashUserName.innerText = data.fullName || "Valued Patient";
        }
    });
}

// --- SUBMIT PROFILE UPDATES ---
if (editForm) {
    editForm.onsubmit = async (e) => {
        e.preventDefault();
        if (!currentUserDocId) return alert("User data not loaded yet.");

        const saveBtn = document.getElementById('save-edit-btn');
        const originalText = saveBtn.innerText;
        saveBtn.innerText = "Updating...";
        saveBtn.disabled = true;

        try {
            const userRef = doc(db, "Users", currentUserDocId);
            await updateDoc(userRef, {
                fullName: editNameInput.value.trim(),
                phone: editPhoneInput.value.trim(),
                mailingAddress: editAddressInput.value.trim()
            });

            alert("Profile updated successfully!");
            closeEditProfile();
        } catch (error) {
            console.error("Update Error:", error);
            alert("Failed to update profile: " + error.message);
        } finally {
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        }
    };
}

// --- LIVE STATS SYNC ---
function setupStatsListeners(uid) {
    // Health Tracker & Automatic BMI Calculation
    const healthQ = query(collection(db, "HealthTracker"), where("patientId", "==", uid));
    onSnapshot(healthQ, (snapshot) => {
        if (!snapshot.empty) {
            const sortedDocs = snapshot.docs.sort((a, b) => b.data().createdAt - a.data().createdAt);
            const latest = sortedDocs[0].data();
            const heightCm = latest.height;
            const weightKg = latest.weight;

            document.getElementById('dash-height').innerText = `${heightCm} cm`;
            document.getElementById('dash-weight').innerText = `${weightKg} kg`;

            if (heightCm > 0 && weightKg > 0) {
                const bmi = (weightKg / ((heightCm / 100) ** 2)).toFixed(1);
                document.getElementById('dash-bmi-val').innerText = `BMI: ${bmi}`;

                const bmiStatus = document.getElementById('dash-bmi-status');
                if (bmi < 18.5) bmiStatus.innerText = "Underweight";
                else if (bmi < 24.9) bmiStatus.innerText = "Normal";
                else if (bmi < 29.9) bmiStatus.innerText = "Overweight";
                else bmiStatus.innerText = "Obese";
            }
        }
    });

    // Mood Tracker & Ring Gradient Update
    const moodQ = query(collection(db, "MoodTracker"), where("patientId", "==", uid));
    onSnapshot(moodQ, (snapshot) => {
        if (!snapshot.empty) {
            const sortedDocs = snapshot.docs.sort((a, b) => b.data().createdAt - a.data().createdAt);
            const latest = sortedDocs[0].data();
            const val = latest.moodScore;

            document.getElementById('dash-mood-val').innerText = val + "%";
            const ringContainer = document.getElementById('dash-mood-ring-container');
            const ringColor = val <= 50 ? "#facc15" : "#22c55e"; // Yellow for neutral/low, Green for happy
            ringContainer.style.background = `conic-gradient(${ringColor} ${val}%, #f3f4f6 ${val}%)`;

            const statusText = document.getElementById('dash-mood-status');
            if (val <= 30) statusText.innerText = "Feeling Low";
            else if (val <= 60) statusText.innerText = "Neutral";
            else statusText.innerText = "Feeling Great";
        }
    });
}

// --- DOCTOR POPUP LOGIC ---
window.openDoctorPopup = async () => {
    const popup = document.getElementById('doctor-popup');
    const list = document.getElementById('doctor-popup-list');
    popup.classList.remove('hidden');
    list.innerHTML = '<div class="text-center py-10 animate-pulse">Loading Specialists...</div>';

    try {
        const snapshot = await getDocs(collection(db, "Doctors"));
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `
                <div class="bg-gray-50 p-4 rounded-[2rem] flex items-center gap-4 border border-gray-100 shadow-sm">
                    <div class="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-[#009688] shadow-sm"><i data-lucide="user" class="w-6 h-6"></i></div>
                    <div><h4 class="font-bold text-gray-800">${data.doctorName || data.name}</h4><p class="text-xs text-[#009688] font-bold uppercase">${data.drSpecialization}</p></div>
                </div>`;
        });
        lucide.createIcons();
    } catch (e) { list.innerHTML = '<p class="text-center text-red-500">Error loading specialists.</p>'; }
};

window.closeDoctorPopup = () => document.getElementById('doctor-popup').classList.add('hidden');

// --- ANALYTICS LOGIC ---

// --- 1. HELPERS FOR ANALYTICS ---
function calculateAge(dobString) {
    if (!dobString) return null;
    const [day, month, year] = dobString.split('/').map(Number);
    const birthDate = new Date(year, month - 1, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) { age--; }
    return age;
}

// --- 2. MAIN ANALYTICS FETCHING FUNCTION ---
async function loadAnalyticalReport() {
    try {
        // A. Fetch Total Patients & Age Groups
        const usersSnap = await getDocs(collection(db, "Users"));
        let ageGroups = { '18-25': 0, '26-40': 0, '41-60': 0, '60+': 0 };

        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.role === "Patient" && data.dateOfBirth) {
                const age = calculateAge(data.dateOfBirth);
                if (age >= 18 && age <= 25) ageGroups['18-25']++;
                else if (age >= 26 && age <= 40) ageGroups['26-40']++;
                else if (age >= 41 && age <= 60) ageGroups['41-60']++;
                else if (age > 60) ageGroups['60+']++;
            }
        });

        // B. Fetch Weekly/Monthly Visits & Top Doctors
        const bookingsSnap = await getDocs(collection(db, "bookings"));
        let weeklyVisits = 0;
        let monthlyVisits = 0;
        let doctorCounts = {};

        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

        bookingsSnap.forEach(doc => {
            const data = doc.data();
            const createdDate = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);

            if (data.status === "Completed" || data.status === "Upcoming") {
                if (createdDate >= oneWeekAgo) weeklyVisits++;
                if (createdDate >= oneMonthAgo) monthlyVisits++;
                if (data.doctorName) {
                    doctorCounts[data.doctorName] = (doctorCounts[data.doctorName] || 0) + 1;
                }
            }
        });

        // C. Update Text Elements
        document.getElementById('weekly-count').innerText = weeklyVisits;
        document.getElementById('monthly-count').innerText = monthlyVisits;

        // D. Initialize the actual Charts with this data
        renderCharts(ageGroups, doctorCounts);

    } catch (error) {
        console.error("Analytical Report Error:", error);
    }
}

// --- 3. CHART RENDERING ---
function renderCharts(ageData, doctorData) {
    // Age Analysis Chart
    const ageCtx = document.getElementById('ageAnalysisChart');
    if (ageCtx) {
        const existing = Chart.getChart(ageCtx);
        if (existing) existing.destroy();
        new Chart(ageCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(ageData),
                datasets: [{
                    data: Object.values(ageData),
                    backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });
    }

    // Top Doctors Chart
    const docCtx = document.getElementById('topDoctorsChart');
    if (docCtx) {
        const sorted = Object.entries(doctorData).sort(([, a], [, b]) => b - a).slice(0, 4);
        const existing = Chart.getChart(docCtx);
        if (existing) existing.destroy();
        new Chart(docCtx, {
            type: 'bar',
            data: {
                labels: sorted.map(d => d[0]),
                datasets: [{
                    data: sorted.map(d => d[1]),
                    backgroundColor: '#009688',
                    borderRadius: 8
                }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// --- LOGOUT LOGIC ---
const profileLogoutBtn = document.getElementById('profile-logout-btn');
if (profileLogoutBtn) {
    profileLogoutBtn.onclick = async () => {
        if (confirm("Logout from KHS Clinic?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    };
}

// --- AUTH OBSERVER ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        setupProfileListener(user.uid);
        setupStatsListeners(user.uid);

        // IMPORTANT: Call the new analytics function
        await loadAnalyticalReport();

        if (typeof window.loadAppointments === 'function') window.loadAppointments(user.uid);
        lucide.createIcons();
    } else {
        window.location.href = "index.html";
    }
});