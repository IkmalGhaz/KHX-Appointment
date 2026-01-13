import { auth, db, onAuthStateChanged, collection, query, where, getDocs, doc, getDoc, updateDoc } from './firebase-config.js';

const aptList = document.getElementById('apt-list');
const searchInput = document.getElementById('search-input');
const actionSheet = document.getElementById('action-sheet');
let allAppointments = [];
let selectedAptId = null;

// Initialization
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadAppointments(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

async function loadAppointments(doctorId) {
    try {
        const q = query(collection(db, "bookings"), where("doctorId", "==", doctorId));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            renderEmptyState();
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
                } catch (e) { console.error(e); }
            }

            return {
                id: bookingDoc.id,
                ...data,
                patientName
            };
        });

        allAppointments = await Promise.all(promises);
        allAppointments.sort((a, b) => new Date(a.date) - new Date(b.date));
        renderList(allAppointments);

    } catch (error) {
        console.error("Fetch Error:", error);
        aptList.innerHTML = `<p class="text-center text-gray-400 mt-10">Unable to load schedule.</p>`;
    }
}

function renderList(data) {
    aptList.innerHTML = '';
    const active = data.filter(apt => apt.status === 'Upcoming' || apt.status === 'Pending Approval' || apt.status === 'Pending');

    if (active.length === 0) {
        renderEmptyState();
        return;
    }

    active.forEach(apt => {
        const dateStr = formatCustomDate(apt.date, apt.time);

        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] fade-in relative";
        
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
            </div>
        `;
        
        aptList.appendChild(card);
    });
    
    if(window.lucide) window.lucide.createIcons();
}

searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allAppointments.filter(apt => 
        apt.patientName.toLowerCase().includes(term) || 
        apt.serviceName.toLowerCase().includes(term)
    );
    renderList(filtered);
});

function formatCustomDate(dateString, timeString) {
    if (!dateString || !timeString) return "Date pending";

    const dateParts = dateString.split(' '); 
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
}

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
        console.error(e);
        alert("Action failed.");
    }
}

function renderEmptyState() {
    aptList.innerHTML = `
        <div class="flex flex-col items-center justify-center pt-20 opacity-40">
            <i data-lucide="calendar" class="w-16 h-16 text-gray-300 mb-4"></i>
            <p class="text-sm font-bold text-gray-500">No appointments found</p>
        </div>
    `;
    if(window.lucide) window.lucide.createIcons();
}

window.openMenu = window.openMenu;
window.closeActionSheet = window.closeActionSheet;