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
        loadAppointments(user.uid.trim());
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. Data Fetching ---
async function loadAppointments(doctorId) {
    try {
        console.log(`Searching for bookings where doctorId == "${doctorId}"`);

        const q = query(collection(db, "bookings"), where("doctorId", "==", doctorId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            renderEmptyState(`ID: ${doctorId}`);
            return;
        }

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
        
        // --- IMPROVED SORTING ---
        // This fixes the "Split January" issue by handling invalid dates safely
        allAppointments.sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            
            // If date is invalid (NaN), push it to the end of the list
            if (isNaN(dateA)) return 1;
            if (isNaN(dateB)) return -1;
            
            return dateA - dateB;
        });
        
        renderList(allAppointments);

    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        aptList.innerHTML = `<p class="text-center pt-10 text-red-500">Error loading schedule.</p>`;
    }
}

// --- 3. Rendering ---
function renderList(data) {
    aptList.innerHTML = '';

    // FIX: Filter out Cancelled items so they don't appear in the view
    const active = data.filter(apt => 
        apt.status !== 'Cancelled' && 
        apt.status !== 'Archived'
    );

    if (active.length === 0) {
        renderEmptyState("No upcoming appointments");
        return;
    }

    let lastMonthYear = ""; 

    active.forEach(apt => {
        let displayDay = "00";
        let displayMonth = "DEC";
        let fullMonthYear = "Unknown Date";

        if (apt.date) {
            const parts = apt.date.split(' '); 
            if (parts.length >= 3) {
                displayDay = parts[0]; 
                displayMonth = parts[1].substring(0, 3).toUpperCase(); 
                fullMonthYear = `${parts[1]} ${parts[2]}`;
            }
        }

        // Header Logic
        if (fullMonthYear !== lastMonthYear) {
            const header = document.createElement('div');
            header.className = "sticky top-0 z-10 bg-[#f8fafc]/95 backdrop-blur-sm py-3 mb-2 mt-4 first:mt-0 flex items-center gap-2 border-b border-gray-200/50";
            header.innerHTML = `
                <div class="h-2 w-2 rounded-full bg-[#009688]"></div>
                <h2 class="text-xs font-bold text-gray-500 uppercase tracking-widest">${fullMonthYear}</h2>
            `;
            aptList.appendChild(header);
            lastMonthYear = fullMonthYear;
        }

        const formattedTime = formatTimeOnly(apt.time);
        
        // Badge Colors
        let badgeClass = "bg-blue-50 text-blue-600 border-blue-100";
        if (apt.status === 'Completed') badgeClass = "bg-green-50 text-green-600 border-green-100";
        if (apt.status === 'Pending Approval') badgeClass = "bg-orange-50 text-orange-600 border-orange-100";

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
                        `<span class="text-[10px] font-bold px-2 py-1 rounded border uppercase ${badgeClass}">${apt.status}</span>` 
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

if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = allAppointments.filter(apt => 
            (apt.patientName && apt.patientName.toLowerCase().includes(term)) || 
            (apt.serviceName && apt.serviceName.toLowerCase().includes(term))
        );
        renderList(filtered);
    });
}

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
    if (actionSheet) actionSheet.classList.remove('hidden');
};

window.closeActionSheet = () => {
    if (actionSheet) actionSheet.classList.add('hidden');
    selectedAptId = null;
};

// FIX 3: Safety check before assigning onclick
const btnComplete = document.getElementById('btn-complete');
const btnCancel = document.getElementById('btn-cancel');

if (btnComplete) btnComplete.onclick = () => updateStatus('Completed');
if (btnCancel) btnCancel.onclick = () => updateStatus('Cancelled');

async function updateStatus(status) {
    if(!selectedAptId) return;
    try {
        // Find which button was clicked for UX feedback
        const btnId = status === 'Completed' ? 'btn-complete' : 'btn-cancel';
        const btn = document.getElementById(btnId);
        let originalText = "";
        
        if (btn) {
            originalText = btn.innerText;
            btn.innerText = "Updating...";
            btn.disabled = true;
        }

        // 1. Update Firebase
        await updateDoc(doc(db, "bookings", selectedAptId), { status: status });
        
        // 2. Update Local Array (so we don't need to re-fetch)
        const idx = allAppointments.findIndex(a => a.id === selectedAptId);
        if(idx > -1) allAppointments[idx].status = status;
        
        // 3. Reset UI
        closeActionSheet();
        renderList(allAppointments); // Re-render to show changes
        
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }

    } catch(e) {
        alert("Update failed: " + e.message);
        const btnId = status === 'Completed' ? 'btn-complete' : 'btn-cancel';
        const btn = document.getElementById(btnId);
        if (btn) btn.disabled = false;
    }
}

// Global exposure
window.openMenu = window.openMenu;
window.closeActionSheet = window.closeActionSheet;