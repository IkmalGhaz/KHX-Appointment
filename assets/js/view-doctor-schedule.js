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
        // This helps us know if it's a Permission error or a Data Match error
        try {
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

        } catch (queryError) {
            console.error("QUERY ERROR:", queryError);
            throw queryError; // Pass to main catch
        }

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
        apt.status === 'Upcoming' || 
        apt.status === 'Pending Approval' || 
        apt.status === 'Pending' || 
        apt.paymentStatus === 'Paid' // Also show paid items even if status isn't updated yet
    );

    if (active.length === 0) {
        renderEmptyState("No upcoming appointments");
        return;
    }

    active.forEach(apt => {
        const dateStr = formatCustomDate(apt.date, apt.time);

        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] fade-in relative mb-3";
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-900 text-base tracking-tight">${apt.patientName}</h3>
                <button onclick="openMenu('${apt.id}')" class="text-gray-400 hover:text-gray-600 p-1 -mr-2">
                    <i data-lucide="more-horizontal" class="w-6 h-6"></i>
                </button>
            </div>
            
            <div class="space-y-2">
                <div class="flex items-center gap-3 text-gray-500">
                    <i data-lucide="clock" class="w-4 h-4 shrink-0"></i>
                    <span class="text-xs font-medium">${dateStr}</span>
                </div>
                
                <div class="flex items-center gap-3 text-gray-500">
                    <i data-lucide="heart" class="w-4 h-4 shrink-0"></i>
                    <span class="text-xs font-medium">${apt.serviceName || 'Consultation'}</span>
                </div>

                <div class="flex items-center gap-2 mt-2">
                     <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 uppercase">${apt.status}</span>
                     ${apt.paymentStatus === 'Paid' ? '<span class="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-600 border border-green-100 uppercase">PAID</span>' : ''}
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

function formatCustomDate(dateString, timeString) {
    if (!dateString || !timeString) return "Date pending";
    try {
        const dateParts = dateString.split(' '); 
        if(dateParts.length < 3) return dateString;
        
        const day = dateParts[0];
        const month = dateParts[1];
        const year = dateParts[2];
        const dateObj = new Date(`${month} ${day}, ${year}`);
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
        
        const [hrs, mins] = timeString.split(':');
        let h = parseInt(hrs);
        const ampm = h >= 12 ? 'pm' : 'am';
        const h12 = h % 12 || 12;
        let endH = h + 1;
        const endAmpm = endH >= 12 ? 'pm' : 'am';
        const endH12 = endH % 12 || 12;

        return `${h12}:${mins}${ampm} - ${endH12}:${mins}${endAmpm} (${day}th, ${weekday})`;
    } catch(e) { return `${dateString} ${timeString}`; }
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
        await updateDoc(doc(db, "bookings", selectedAptId), { status: status });
        const idx = allAppointments.findIndex(a => a.id === selectedAptId);
        if(idx > -1) allAppointments[idx].status = status;
        closeActionSheet();
        renderList(allAppointments); 
    } catch(e) {
        alert("Update failed: " + e.message);
    }
}

window.openMenu = window.openMenu;
window.closeActionSheet = window.closeActionSheet;