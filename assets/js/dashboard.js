import {
    auth, db, storage, onAuthStateChanged, collection, query, where, onSnapshot, doc, updateDoc, signOut, ref, uploadBytes, getDownloadURL, getDocs, addDoc
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

// Modal Visibility Helpers for Health/Mood
window.openHealthModal = () => document.getElementById('health-modal').classList.remove('hidden');
window.closeHealthModal = () => document.getElementById('health-modal').classList.add('hidden');
window.openMoodModal = () => document.getElementById('mood-modal').classList.remove('hidden');
window.closeMoodModal = () => document.getElementById('mood-modal').classList.add('hidden');

// --- SAVING LOGIC (Anytime update from Dashboard Modals) ---

// Health Save Logic
document.getElementById('save-health-btn-modal').onclick = async () => {
    const hInput = document.getElementById('height-input-modal');
    const wInput = document.getElementById('weight-input-modal');
    const h = parseFloat(hInput.value);
    const w = parseFloat(wInput.value);

    if (!h || !w) return alert("Please fill in both fields");

    try {
        await addDoc(collection(db, "HealthTracker"), {
            patientId: auth.currentUser.uid,
            height: h,
            weight: w,
            createdAt: new Date()
        });
        alert("Health stats updated!");
        closeHealthModal();
        hInput.value = "";
        wInput.value = "";
    } catch (e) {
        console.error("Error saving health:", e);
        alert("Error saving data.");
    }
};

// Mood Slider Logic
const moodSliderModal = document.getElementById('mood-slider-modal');
if (moodSliderModal) {
    moodSliderModal.oninput = function () {
        const val = parseInt(this.value);
        document.getElementById('mood-value-modal').innerText = val + "%";
        const ring = document.getElementById('mood-ring-modal');
        const desc = document.getElementById('mood-desc-modal');

        if (val <= 50) {
            ring.style.borderColor = "#FBBF24";
            desc.innerText = "Neutral";
            desc.style.color = "#D97706";
        } else {
            ring.style.borderColor = "#009688";
            desc.innerText = "Happy";
            desc.style.color = "#009688";
        }
    };
}

// Mood Save Logic
document.getElementById('save-mood-btn-modal').onclick = async () => {
    try {
        await addDoc(collection(db, "MoodTracker"), {
            patientId: auth.currentUser.uid,
            moodScore: parseInt(moodSliderModal.value),
            createdAt: new Date()
        });
        alert("Mood updated!");
        closeMoodModal();
    } catch (e) {
        console.error("Error saving mood:", e);
        alert("Error updating mood.");
    }
};

// --- PROFILE REAL-TIME SYNC ---
function setupProfileListener(uid) {
    const q = query(collection(db, "Users"), where("firebaseUid", "==", uid));
    onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const userDoc = snapshot.docs[0];
            currentUserDocId = userDoc.id;
            const data = userDoc.data();

            
            if (viewFullNameHeader) viewFullNameHeader.innerText = data.fullName || "User Name";
            if (viewFullName) viewFullName.innerText = data.fullName || "--";
            if (viewPhone) viewPhone.innerText = data.phone || "--";
            if (viewEmail) viewEmail.innerText = data.email || "--";
            if (viewAddress) viewAddress.innerText = data.mailingAddress || "No address provided";
            if (data.profilePictureUrl && viewImg) viewImg.src = data.profilePictureUrl;
            if (editNameInput) editNameInput.value = data.fullName || "";
            if (editPhoneInput) editPhoneInput.value = data.phone || "";
            if (editAddressInput) editAddressInput.value = data.mailingAddress || "";
            if (data.profilePictureUrl && editImgPreview) editImgPreview.src = data.profilePictureUrl;
            if (data.createdAt) {
                const joinedDate = data.createdAt.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);
                if (viewMemberSince) viewMemberSince.innerText = joinedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
                const diffDays = Math.ceil(Math.abs(new Date() - joinedDate) / (1000 * 60 * 60 * 24));
                if (viewDaysCount) viewDaysCount.innerText = `${diffDays} days with us`;
            }
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
    // 1. Health Sync
    const healthQ = query(collection(db, "HealthTracker"), where("patientId", "==", uid));
    onSnapshot(healthQ, (snapshot) => {
        if (!snapshot.empty) {
            // FIX: Robust Timestamp sorting
            const sortedDocs = snapshot.docs.sort((a, b) => {
                const timeA = a.data().createdAt?.seconds || 0;
                const timeB = b.data().createdAt?.seconds || 0;
                return timeB - timeA;
            });
            const latest = sortedDocs[0].data();
            
            // Ensure elements exist before updating
            const hEl = document.getElementById('dash-height');
            const wEl = document.getElementById('dash-weight');
            if (hEl) hEl.innerText = `${latest.height} cm`;
            if (wEl) wEl.innerText = `${latest.weight} kg`;

            if (latest.height > 0 && latest.weight > 0) {
                const bmi = (latest.weight / ((latest.height / 100) ** 2)).toFixed(1);
                const bmiValEl = document.getElementById('dash-bmi-val');
                if (bmiValEl) bmiValEl.innerText = `BMI: ${bmi}`;
            }
        }
    });

    // 2. Mood Sync
    const moodQ = query(collection(db, "MoodTracker"), where("patientId", "==", uid));
    onSnapshot(moodQ, (snapshot) => {
        if (!snapshot.empty) {
            // FIX: Robust Timestamp sorting
            const sortedDocs = snapshot.docs.sort((a, b) => {
                const timeA = a.data().createdAt?.seconds || 0;
                const timeB = b.data().createdAt?.seconds || 0;
                return timeB - timeA;
            });
            const latest = sortedDocs[0].data();
            const val = Number(latest.moodScore);

            const valText = document.getElementById('dash-mood-val');
            if (valText) valText.innerText = val + "%";

            const ringContainer = document.getElementById('dash-mood-ring-container');
            if (ringContainer) {
                const ringColor = val <= 50 ? "#facc15" : "#009688";
                ringContainer.style.background = `conic-gradient(${ringColor} ${val}%, #f3f4f6 ${val}%)`;
            }
        }
    });
}

// --- DEPENDENTS LOGIC ---
let dependentCount = 0;
window.openAddChildModal = () => {
    if (dependentCount >= 5) return alert("Maximum 5 child profiles allowed.");
    document.getElementById('add-child-modal').classList.remove('hidden');
};
window.closeAddChildModal = () => document.getElementById('add-child-modal').classList.add('hidden');

function setupDependentsListener(uid) {
    const q = query(collection(db, "Dependents"), where("parentId", "==", uid));
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('dependents-container');
        const countDisplay = document.getElementById('child-count');
        const trigger = document.getElementById('add-child-trigger');
        if (!container) return;
        container.querySelectorAll('.child-card').forEach(c => c.remove());
        dependentCount = snapshot.size;
        if (countDisplay) countDisplay.innerText = `${dependentCount}/5`;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const age = calculateAge(data.dateOfBirth);
            const card = document.createElement('div');
            card.className = "child-card scroll-item bg-white border border-pink-100 p-5 rounded-[2rem] flex flex-col items-center justify-center text-center shadow-sm relative";
            card.innerHTML = `
                <div class="w-12 h-12 bg-pink-50 text-pink-500 rounded-full flex items-center justify-center mb-2">
                    <i data-lucide="heart" class="w-6 h-6 fill-current"></i>
                </div>
                ${data.okuStatus ? '<span class="absolute top-4 right-4 bg-pink-500 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-sm">OKU</span>' : ''}
                <h4 class="text-sm font-black text-gray-800 truncate w-full">${data.fullName}</h4>
                <p class="text-[10px] text-pink-400 font-bold">${data.disabilityType}</p>
                <p class="text-[10px] text-gray-400">${age} years old</p>
                <button onclick="bookForChild('${data.fullName}', '${docSnap.id}')" class="mt-3 py-2 px-4 bg-pink-50 rounded-full text-[10px] font-black text-pink-500 flex items-center gap-1 hover:bg-pink-100">
                    Book Now <i data-lucide="chevron-right" class="w-3 h-3"></i>
                </button>`;
            container.insertBefore(card, trigger);
        });
        if (trigger) trigger.style.display = dependentCount >= 5 ? 'none' : 'flex';
        if (window.lucide) window.lucide.createIcons();
    });
}

const addChildForm = document.getElementById('add-child-form');
if (addChildForm) {
    addChildForm.onsubmit = async (e) => {
        e.preventDefault();
        const saveBtn = e.target.querySelector('button');
        saveBtn.innerText = "Saving...";
        saveBtn.disabled = true;
        try {
            await addDoc(collection(db, "Dependents"), {
                parentId: auth.currentUser.uid,
                fullName: document.getElementById('child-name').value.trim(),
                dateOfBirth: document.getElementById('child-dob').value,
                disabilityType: document.getElementById('child-disability').value,
                okuStatus: document.getElementById('child-oku-status').checked,
                specialInstructions: document.getElementById('child-notes').value.trim(),
                createdAt: new Date()
            });
            closeAddChildModal();
            e.target.reset();
        } catch (err) { console.error("Error adding child:", err); }
        finally { saveBtn.innerText = "Save Child Profile"; saveBtn.disabled = false; }
    };
}

window.bookForChild = (name, id) => {
    localStorage.setItem('bookingForDependent', 'true');
    localStorage.setItem('dependentName', name);
    localStorage.setItem('dependentId', id);
    window.location.href = 'booking.html';
};

// --- DOCTOR POPUP LOGIC ---
window.openDoctorPopup = async () => {
    const popup = document.getElementById('doctor-popup');
    const list = document.getElementById('doctor-popup-list');
    if (!popup || !list) return;
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
function calculateAge(dobString) {
    if (!dobString) return null;
    let parts;
    if (dobString.includes('/')) {
        parts = dobString.split('/').map(Number);
        const birthDate = new Date(parts[2], parts[1] - 1, parts[0]);
        return new Date().getFullYear() - birthDate.getFullYear();
    } else {
        const birthDate = new Date(dobString);
        return new Date().getFullYear() - birthDate.getFullYear();
    }
}

async function loadAnalyticalReport() {
    try {
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
        const bookingsSnap = await getDocs(collection(db, "bookings"));
        let weeklyVisits = 0; let monthlyVisits = 0; let doctorCounts = {};
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        bookingsSnap.forEach(doc => {
            const data = doc.data();
            const createdDate = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date(data.createdAt);
            if (data.status === "Completed" || data.status === "Upcoming") {
                if (createdDate >= oneWeekAgo) weeklyVisits++;
                if (createdDate >= oneMonthAgo) monthlyVisits++;
                if (data.doctorName) doctorCounts[data.doctorName] = (doctorCounts[data.doctorName] || 0) + 1;
            }
        });
        const weeklyCountEl = document.getElementById('weekly-count');
        const monthlyCountEl = document.getElementById('monthly-count');
        if (weeklyCountEl) weeklyCountEl.innerText = weeklyVisits;
        if (monthlyCountEl) monthlyCountEl.innerText = monthlyVisits;
        renderCharts(ageGroups, doctorCounts);
    } catch (error) { console.error("Analytical Report Error:", error); }
}

function renderCharts(ageData, doctorData) {
    const ageCtx = document.getElementById('ageAnalysisChart');
    if (ageCtx) {
        const existing = Chart.getChart(ageCtx); if (existing) existing.destroy();
        new Chart(ageCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(ageData),
                datasets: [{ data: Object.values(ageData), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right' } } }
        });
    }
    const docCtx = document.getElementById('topDoctorsChart');
    if (docCtx) {
        const sorted = Object.entries(doctorData).sort(([, a], [, b]) => b - a).slice(0, 4);
        const existing = Chart.getChart(docCtx); if (existing) existing.destroy();
        new Chart(docCtx, {
            type: 'bar',
            data: { labels: sorted.map(d => d[0]), datasets: [{ data: sorted.map(d => d[1]), backgroundColor: '#009688', borderRadius: 8 }] },
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

// ============================================
// NEW: CANCELLATION NOTIFICATION LOGIC
// ============================================

window.closeCancelNotification = () => {
    document.getElementById('cancel-notification-modal').classList.add('hidden');
};

async function checkCancelledAppointments(patientId) {
    try {
        const q = query(collection(db, "bookings"), where("patientId", "==", patientId));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((doc) => {
            const booking = doc.data();
            const bookingId = doc.id;

            if (booking.status === 'Cancelled') {
                const storageKey = 'seen_cancellation_' + bookingId;
                const hasSeen = localStorage.getItem(storageKey);

                if (!hasSeen) {
                    const docName = booking.doctorName || "The Doctor";
                    const serviceName = booking.serviceName || "Appointment";
                    const date = booking.date || "";

                    const msgElement = document.getElementById('cancel-msg-body');
                    if (msgElement) {
                        msgElement.innerHTML = `
                        We are really sorry, but <span class="font-bold text-gray-900">${docName}</span> 
                        had to cancel your <span class="font-bold">${serviceName}</span> 
                        on ${date}.
                    `;
                    }

                    const waMsg = `Hi Admin, my appointment (Date: ${date}) with ${docName} was cancelled. I would like to request a refund.`;
                    const waLink = `https://wa.me/60194116487?text=${encodeURIComponent(waMsg)}`;
                    const linkBtn = document.getElementById('whatsapp-refund-link');
                    if (linkBtn) linkBtn.href = waLink;

                    const modal = document.getElementById('cancel-notification-modal');
                    if (modal) modal.classList.remove('hidden');
                    
                    if (window.lucide) window.lucide.createIcons();

                    localStorage.setItem(storageKey, 'true');
                }
            }
        });
    } catch (error) {
        console.error("Error checking cancellations:", error);
    }
}

// ============================================
// AUTH OBSERVER (Triggers everything)
// ============================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Ensure dashboard content is visible immediately
        const dashboardContent = document.querySelector('.flex-1');
        if (dashboardContent) dashboardContent.classList.remove('hidden');

        // 
        // Initialize Listeners
        setupProfileListener(user.uid);
        setupStatsListeners(user.uid);
        setupDependentsListener(user.uid);

        // Run Checks
        await loadAnalyticalReport();
        await checkCancelledAppointments(user.uid); // <--- ADDED HERE

        if (typeof window.loadAppointments === 'function') window.loadAppointments(user.uid);
        if (window.lucide) window.lucide.createIcons();
    } else {
        window.location.href = "index.html";
    }
});