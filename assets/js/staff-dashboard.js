import { db, collection, getDocs, query, where, onAuthStateChanged, auth, signOut } from './firebase-config.js';

// --- DOM Elements ---
const availableList = document.getElementById('available-list');
const unavailableList = document.getElementById('unavailable-list');
const dateDisplay = document.getElementById('current-date');
const logoutBtn = document.getElementById('logout-btn');

// --- Initialization ---
onAuthStateChanged(auth, (user) => {
    // FIX: Only load the dashboard if the user is logged in
    if (user) {
        initDashboard();
    } else {
        // If not logged in, redirect to login page
        console.log("No user detected, redirecting...");
        window.location.href = "index.html";
    }
});

function initDashboard() {
    setDate();
    fetchDoctorStatus();
}

// --- 1. Set Header Date ---
function setDate() {
    const today = new Date();
    // Format: "Tuesday, 13 Jan 2026"
    const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    if(dateDisplay) dateDisplay.innerText = today.toLocaleDateString('en-GB', options);
}

// --- 2. Fetch Logic ---
async function fetchDoctorStatus() {
    try {
        const todayObj = new Date();
        const day = todayObj.getDate();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = monthNames[todayObj.getMonth()];
        const year = todayObj.getFullYear();
        const todayStr = `${day} ${month} ${year}`; 

        console.log("Fetching data for:", todayStr);

        const [doctorsSnap, timeOffSnap, bookingsSnap] = await Promise.all([
            getDocs(collection(db, "Doctors")),
            getDocs(query(collection(db, "TimeOff"), where("date", "==", todayStr))),
            getDocs(query(collection(db, "bookings"), where("date", "==", todayStr)))
        ]);

        const doctors = [];
        doctorsSnap.forEach(doc => doctors.push({ id: doc.id, ...doc.data() }));

        const unavailableDoctorIds = new Set();
        timeOffSnap.forEach(doc => unavailableDoctorIds.add(doc.data().doctorId));

        const doctorSchedule = {}; 

        bookingsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status !== 'Cancelled') {
                if (!doctorSchedule[data.doctorId]) {
                    doctorSchedule[data.doctorId] = [];
                }
                doctorSchedule[data.doctorId].push(data.time);
            }
        });

        for (const docId in doctorSchedule) {
            doctorSchedule[docId].sort(); 
        }

        const available = [];
        const unavailable = [];

        doctors.forEach(doc => {
            doc.appointments = doctorSchedule[doc.id] || [];
            if (unavailableDoctorIds.has(doc.id)) {
                unavailable.push(doc);
            } else {
                available.push(doc);
            }
        });

        renderLists(available, unavailable);

    } catch (error) {
        console.error("Error loading dashboard:", error);
        availableList.innerHTML = `<p class="text-red-500 text-sm">System Error: Could not load data.</p>`;
    }
}

// --- 3. Render Functions ---
function renderLists(available, unavailable) {
    availableList.innerHTML = '';
    unavailableList.innerHTML = '';

    // --- Render Available Doctors ---
    if (available.length === 0) {
        availableList.innerHTML = `<div class="text-center py-8 opacity-50"><i data-lucide="coffee" class="w-8 h-8 mx-auto mb-2 text-[#009688]"></i><p class="text-gray-500 text-sm font-medium">No doctors available.</p></div>`;
    } else {
        available.forEach(doc => {
            const card = document.createElement('div');
            // Added border-l-4 border-[#009688] for the teal accent
            card.className = "doctor-card border-l-4 border-[#009688] flex flex-col justify-between min-h-[120px]";
            
            let timeDisplayHtml = '';
            
            if (doc.appointments.length > 0) {
                const times = doc.appointments.map(t => 
                    `<span class="bg-gray-100 text-gray-600 px-2 py-1 rounded text-[10px] font-bold border border-gray-200">${t}</span>`
                ).join(" ");
                
                timeDisplayHtml = `
                    <div class="mt-3 pt-3 border-t border-gray-50">
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Booked Slots</p>
                        <div class="flex flex-wrap gap-2">${times}</div>
                    </div>
                `;
            } else {
                timeDisplayHtml = `
                    <div class="mt-3 pt-3 border-t border-gray-50 flex items-center gap-2 text-[#009688]">
                        <div class="w-2 h-2 rounded-full bg-[#009688]"></div>
                        <span class="text-xs font-bold">Free all day</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div class="flex items-start justify-between">
                    <div>
                        <h3 class="text-lg font-bold text-gray-900">${doc.doctorName || doc.name || 'Dr. Unknown'}</h3>
                        <p class="text-xs text-[#009688] font-bold uppercase tracking-wide mt-0.5">${doc.drSpecialization || 'Specialist'}</p>
                    </div>
                    <div class="bg-[#e0f2f1] p-2 rounded-xl text-[#009688]">
                        <i data-lucide="stethoscope" class="w-5 h-5"></i>
                    </div>
                </div>
                ${timeDisplayHtml}
            `;
            availableList.appendChild(card);
        });
    }

    // --- Render Unavailable Doctors ---
    if (unavailable.length === 0) {
        unavailableList.innerHTML = `<p class="text-gray-300 text-xs italic text-center py-4">All doctors are active today.</p>`;
    } else {
        unavailable.forEach(doc => {
            const card = document.createElement('div');
            card.className = "doctor-card opacity-60 bg-gray-50 border-dashed border-gray-300";
            
            card.innerHTML = `
                 <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-base font-bold text-gray-600">${doc.doctorName || doc.name || 'Dr. Unknown'}</h3>
                        <p class="text-xs text-gray-400">${doc.drSpecialization || 'Specialist'}</p>
                    </div>
                    <span class="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded uppercase">Off Duty</span>
                </div>
            `;
            unavailableList.appendChild(card);
        });
    }

    if(window.lucide) window.lucide.createIcons();
}

// --- 4. Logout Logic ---
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        if (confirm("Are you sure you want to log out?")) {
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout Error:", error);
                alert("Failed to logout.");
            }
        }
    };
}