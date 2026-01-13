import { db, collection, getDocs, query, where, onAuthStateChanged, auth } from './firebase-config.js';

// --- DOM Elements ---
const availableList = document.getElementById('available-list');
const unavailableList = document.getElementById('unavailable-list');
const dateDisplay = document.getElementById('current-date');

// --- Initialization ---
onAuthStateChanged(auth, (user) => {
    // Allow view even if not strictly logged in for dev/demo purposes, 
    // or wrap initDashboard() in 'if (user)' for security.
    initDashboard();
});

function initDashboard() {
    setDate();
    fetchDoctorStatus();
}

// --- 1. Set Header Date ---
function setDate() {
    const today = new Date();
    // Format: "Tuesday, 13 January 2026"
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    dateDisplay.innerText = today.toLocaleDateString('en-GB', options);
}

// --- 2. Fetch Logic ---
async function fetchDoctorStatus() {
    try {
        // A. Generate Today's Date String (Matches Booking Format: "13 January 2026")
        // Note: We strip the weekday for the DB query to match how bookings are saved.
        const todayObj = new Date();
        const day = todayObj.getDate();
        const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
        const month = monthNames[todayObj.getMonth()];
        const year = todayObj.getFullYear();
        const todayStr = `${day} ${month} ${year}`; // e.g., "13 January 2026"

        console.log("Fetching data for:", todayStr);

        // B. Run Queries in Parallel
        const [doctorsSnap, timeOffSnap, bookingsSnap] = await Promise.all([
            getDocs(collection(db, "Doctors")),
            getDocs(query(collection(db, "TimeOff"), where("date", "==", todayStr))),
            getDocs(query(collection(db, "bookings"), where("date", "==", todayStr)))
        ]);

        // C. Process Data
        const doctors = [];
        doctorsSnap.forEach(doc => doctors.push({ id: doc.id, ...doc.data() }));

        const unavailableDoctorIds = new Set();
        timeOffSnap.forEach(doc => unavailableDoctorIds.add(doc.data().doctorId));

        // D. Group Bookings by Doctor
        const doctorSchedule = {}; // { doctorId: ["09:00", "14:00"] }

        bookingsSnap.forEach(doc => {
            const data = doc.data();
            // Filter out cancelled bookings
            if (data.status !== 'Cancelled') {
                if (!doctorSchedule[data.doctorId]) {
                    doctorSchedule[data.doctorId] = [];
                }
                doctorSchedule[data.doctorId].push(data.time);
            }
        });

        // E. Sort Bookings for each doctor
        for (const docId in doctorSchedule) {
            doctorSchedule[docId].sort(); // Simple string sort works for 24h format or fixed length 09:00
        }

        // F. Separate Doctors into Lists
        const available = [];
        const unavailable = [];

        doctors.forEach(doc => {
            // Attach specific schedule to the doctor object
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
        availableList.innerHTML = `<p class="text-gray-400 text-sm italic">No doctors available today.</p>`;
    } else {
        available.forEach(doc => {
            const card = document.createElement('div');
            card.className = "doctor-card flex flex-col justify-between min-h-[140px]";
            
            // Logic to display appointment times
            let timeDisplayHtml = '';
            
            if (doc.appointments.length > 0) {
                // If they have appointments, list them nicely
                const times = doc.appointments.map(t => 
                    `<span class="bg-red-50 text-red-600 px-2 py-1 rounded text-xs font-bold border border-red-100">${t}</span>`
                ).join(" ");
                
                timeDisplayHtml = `
                    <div class="mt-2">
                        <p class="text-xs text-gray-500 font-bold mb-1">Busy at:</p>
                        <div class="flex flex-wrap gap-2">${times}</div>
                    </div>
                `;
            } else {
                // No appointments
                timeDisplayHtml = `
                    <div class="flex items-center gap-2 text-green-600 mt-1">
                        <i data-lucide="check-circle" class="w-4 h-4"></i>
                        <span class="text-sm font-bold">Free all day</span>
                    </div>
                `;
            }

            card.innerHTML = `
                <div>
                    <h3 class="text-lg font-bold text-gray-900">${doc.doctorName || doc.name || 'Dr. Unknown'}</h3>
                    <p class="text-xs text-gray-400 font-bold uppercase tracking-wide mt-0.5">${doc.drSpecialization || 'Specialist'}</p>
                </div>
                
                ${timeDisplayHtml}
            `;
            availableList.appendChild(card);
        });
    }

    // --- Render Unavailable Doctors ---
    if (unavailable.length === 0) {
        unavailableList.innerHTML = `<p class="text-gray-300 text-xs italic">All doctors are working today.</p>`;
    } else {
        unavailable.forEach(doc => {
            const card = document.createElement('div');
            card.className = "doctor-card opacity-60 bg-gray-50 border-dashed border-gray-300";
            
            card.innerHTML = `
                 <div class="flex justify-between items-center">
                    <div>
                        <h3 class="text-lg font-bold text-gray-600">${doc.doctorName || doc.name || 'Dr. Unknown'}</h3>
                        <p class="text-sm text-gray-400">${doc.drSpecialization || 'Specialist'}</p>
                    </div>
                    <span class="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-1 rounded uppercase">Off Duty</span>
                </div>
            `;
            unavailableList.appendChild(card);
        });
    }

    if(window.lucide) window.lucide.createIcons();
}