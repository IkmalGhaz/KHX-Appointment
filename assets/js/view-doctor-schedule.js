import { auth, db, onAuthStateChanged, collection, query, where, getDocs, doc, getDoc, updateDoc } from './firebase-config.js';

const aptList = document.getElementById('apt-list');
const searchInput = document.getElementById('search-input');
const actionSheet = document.getElementById('action-sheet');
let allAppointments = [];
let selectedAptId = null;

// --- 1. Initialization ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("LOGGED IN AS DOCTOR:", user.uid);
        // We pass the trimmed UID to ensure no spaces break the match
        loadAppointments(user.uid.trim());
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. Data Fetching ---
async function loadAppointments(doctorId) {
    try {
        console.log(`Searching for bookings where doctorId == "${doctorId}"`);

        // 1. First, try to fetch ANY booking to test connection
        const testQ = query(collection(db, "bookings"), where("doctorId", "==", doctorId));
        const snapshot = await getDocs(testQ);
        
        console.log(`Found ${snapshot.size} appointments for this doctor.`);

        if (snapshot.empty) {
            renderEmptyState(`ID: ${doctorId}`);
            return;
        }

        // 2. Process Data
        const promises = snapshot.docs.map(async (bookingDoc) => {
            const data = bookingDoc.data();
            let patientName = "Unknown Patient";
            
            if (data.patientId) {
                try {
                    const patientSnap = await getDoc(doc(db, "Users", data.patientId));
                    if (patientSnap.exists()) {
                        patientName = patientSnap.data().fullName || "Unknown";
                    }
                } catch (e) { console.warn("Patient fetch error", e); }
            }

            return {
                id: bookingDoc.id,
                ...data,
                patientName
            };
        });

        allAppointments = await Promise.all(promises);
        
        // Sort by Date
        allAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderList(allAppointments);

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        
        let errorMsg = "Unable to load schedule.";
        if (error.code === 'permission-denied') {
            errorMsg = "Database Permission Denied. Please update Firestore Rules.";
        }
        
        aptList.innerHTML = `
            <div class="text-center pt-10 px-6">
                <p class="text-red-500 font-bold mb-2">Error Loading Data</p>
                <p class="text-xs text-gray-400 break-words">${errorMsg}</p>
                <p class="text-[10px] text-gray-300 mt-2 font-mono">Open Console (F12) for details</p>
            </div>`;
    }
}

// --- 3. Rendering ---
function renderList(data) {
    aptList.innerHTML = '';

    // Show Upcoming, Pending, and Pending Approval
    const active = data.filter(apt => 
        apt.status !== 'Cancelled' && 
        (
            apt.status === 'Upcoming' || 
            apt.status === 'Pending Approval' || 
            apt.status === 'Pending' || 
            apt.paymentStatus === 'Paid'
        )
    );

    if (active.length === 0) {
        renderEmptyState("No upcoming appointments");
        return;
    }

    active.forEach(apt => {
        // --- NEW: EXTRACT DAY & MONTH ---
        // Assumes apt.date format is "15 January 2026"
        let displayDay = "00";
        let displayMonth = "DEC";

        if (apt.date) {
            const parts = apt.date.split(' '); 
            if (parts.length >= 2) {
                displayDay = parts[0]; // "15"
                displayMonth = parts[1].substring(0, 3).toUpperCase(); // "JAN"
            }
        }
        // --------------------------------

        const formattedTime = formatTimeOnly(apt.time); // Helper to get "2:00 PM"

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-3xl shadow-sm border border-gray-100 flex items-center gap-4 transition-all hover:shadow-md mb-3";
        
        card.innerHTML = `
            <div class="w-16 h-16 rounded-2xl bg-[#e0f2f1] flex flex-col items-center justify-center text-[#009688] shrink-0 shadow-sm">
                <span class="text-xl font-bold leading-none">${displayDay}</span>
                <span class="text-[10px] font-bold mt-1 tracking-wider">${displayMonth}</span>
            </div>

            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1">
                    <h3 class="font-bold text-gray-900 truncate pr-2 text-base">${apt.patientName}</h3>
                    <button onclick="openMenu('${apt.id}')" class="text-gray-400 hover:text-gray-600 p-1">
                        <i data-lucide="more-vertical" class="w-5 h-5"></i>
                    </button>
                </div>
                
                <p class="text-sm text-gray-500 mb-1 truncate">${apt.serviceName || 'Consultation'}</p>
                
                <div class="flex items-center gap-3 mt-1">
                    <div class="flex items-center gap-1 text-xs text-gray-400 font-medium bg-gray-50 px-2 py-1 rounded-md">
                        <i data-lucide="clock" class="w-3 h-3"></i>
                        <span>${formattedTime}</span>
                    </div>
                    
                    ${apt.status ? 
                        `<span class="text-[10px] font-bold px-2 py-1 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase">${apt.status}</span>` 
                        : ''}
                </div>
            </div>
        `;
        
        aptList.appendChild(card);
    });
    
    if(window.lucide) window.lucide.createIcons();
}

// --- 4. Helpers & Search ---
function renderEmptyState(debugInfo = "") {
    aptList.innerHTML = `
        <div class="flex flex-col items-center justify-center pt-20 opacity-40">
            <i data-lucide="calendar-x" class="w-16 h-16 text-gray-300 mb-4"></i>
            <p class="text-sm font-bold text-gray-500">No appointments found</p>
            <p class="text-[10px] text-gray-400 mt-2 font-mono">${debugInfo}</p>
        </div>
    `;
    if(window.lucide) window.lucide.createIcons();
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allAppointments.filter(apt => 
        (apt.patientName && apt.patientName.toLowerCase().includes(term)) || 
        (apt.serviceName && apt.serviceName.toLowerCase().includes(term))
    );
    renderList(filtered);
});

// Helper to format just the time (e.g. "14:00" -> "2:00 PM")
function formatTimeOnly(timeString) {
    if(!timeString) return "--:--";
    try {
        const [hrs, mins] = timeString.split(':');
        let h = parseInt(hrs);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${mins} ${ampm}`;
    } catch(e) { return timeString; }
}

// --- 5. Action Sheet Logic ---
window.openMenu = (id) => {
    selectedAptId = id;
    actionSheet.classList.remove('hidden');
};

window.closeActionSheet = () => {
    actionSheet.classList.add('hidden');
    selectedAptId = null;
};

document.getElementById('btn-complete').onclick = () => updateStatus('Completed');
document.getElementById('btn-cancel').onclick = () => updateStatus('Cancelled');

async function updateStatus(status) {
    if(!selectedAptId) return;
    try {
        // Change button text to show loading
        const btnId = status === 'Completed' ? 'btn-complete' : 'btn-cancel';
        const btn = document.getElementById(btnId);
        const originalText = btn.innerText;
        btn.innerText = "Updating...";

        await updateDoc(doc(db, "bookings", selectedAptId), { status: status });
        
        // Update local data
        const idx = allAppointments.findIndex(a => a.id === selectedAptId);
        if(idx > -1) allAppointments[idx].status = status;
        
        closeActionSheet();
        renderList(allAppointments); 
        
        // Reset button text
        btn.innerText = originalText;
    } catch(e) {
        alert("Update failed: " + e.message);
    }
}

window.openMenu = window.openMenu;
window.closeActionSheet = window.closeActionSheet;