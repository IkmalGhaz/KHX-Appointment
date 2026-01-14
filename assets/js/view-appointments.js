import { auth, db, onAuthStateChanged, collection, query, where, onSnapshot, updateDoc, doc } from './firebase-config.js';

let currentTab = 'Upcoming';
let appointmentToCancel = null;
const aptList = document.getElementById('appointments-list');

// Modal Elements
const cancelModal = document.getElementById('cancel-confirm-modal');
const reasonInput = document.getElementById('cancel-reason-input');
const confirmBtn = document.getElementById('confirm-cancel-btn');
const finalConfirmBtn = document.getElementById('final-confirm-btn');

// 1. Auth Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Initialize the real-time listener
        window.loadAppointments(user.uid);
    }
});

// --- CANCELLATION MODAL LOGIC ---

window.cancelBooking = (id) => {
    appointmentToCancel = id;
    reasonInput.value = '';
    cancelModal.classList.remove('hidden');
};

window.closeCancelModal = () => {
    cancelModal.classList.add('hidden');
    appointmentToCancel = null;
};

if (confirmBtn) {
    confirmBtn.onclick = () => {
        const reason = reasonInput.value.trim();
        if (!reason) {
            alert("Please enter a reason for cancellation.");
            return;
        }
        cancelModal.classList.add('hidden');
        document.getElementById('booking-confirm-modal').classList.remove('hidden');
    };
}

if (finalConfirmBtn) {
    finalConfirmBtn.onclick = async () => {
        const reason = reasonInput.value.trim();
        finalConfirmBtn.innerText = "Confirming in 3s...";
        finalConfirmBtn.disabled = true;

        // 3-second delay before processing
        setTimeout(async () => {
            try {
                finalConfirmBtn.innerText = "Processing...";
                const aptRef = doc(db, "bookings", appointmentToCancel);

                await updateDoc(aptRef, {
                    status: 'Cancelled',
                    cancellationReason: reason,
                    cancelledAt: new Date()
                });

                alert("Appointment successfully cancelled.");
                document.getElementById('booking-confirm-modal').classList.add('hidden');

                // NOTE: No location.reload() needed because onSnapshot updates the UI automatically!
            } catch (error) {
                console.error("Cancellation Error:", error);
                alert("Failed to cancel: " + error.message);
                finalConfirmBtn.innerText = "Yes, Confirm Now";
                finalConfirmBtn.disabled = false;
            }
        }, 3000);
    };
}

window.closeConfirmModal = () => {
    document.getElementById('booking-confirm-modal').classList.add('hidden');
    cancelModal.classList.remove('hidden');
};

// --- APPOINTMENT LIST & TAB LOGIC (OPTIMIZED) ---

// Global state to hold all fetched appointments for easy filtering
let allUserAppointments = [];

window.switchTab = (tab) => {
    currentTab = tab;

    // Update UI Tab Buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-[#009688]', 'text-[#009688]');
        btn.classList.add('border-transparent', 'text-gray-400');
    });

    // Set active tab style
    if (event && event.target) {
        event.target.classList.add('border-[#009688]', 'text-[#009688]');
        event.target.classList.remove('border-transparent', 'text-gray-400');
    }

    // Re-render the list based on the new tab selection
    applyFiltersAndRender();
};

// Main Fetching Function using onSnapshot
window.loadAppointments = (uid) => {
    aptList.innerHTML = '<div class="text-center py-10"><div class="animate-spin inline-block w-6 h-6 border-2 border-[#009688] border-t-transparent rounded-full"></div></div>';

    const q = query(collection(db, "bookings"), where("patientId", "==", uid));

    // Real-time listener: this stays active and updates the UI whenever Firestore data changes
    onSnapshot(q, (snapshot) => {
        allUserAppointments = [];
        snapshot.forEach(doc => {
            allUserAppointments.push({ id: doc.id, ...doc.data() });
        });

        applyFiltersAndRender();
    }, (error) => {
        console.error("Fetch error:", error);
        aptList.innerHTML = '<p class="text-red-500 text-center">Error loading appointments.</p>';
    });
};

function applyFiltersAndRender() {
    const filtered = allUserAppointments.filter(apt => {
        if (currentTab === 'Upcoming') return apt.status === 'Upcoming' || apt.status === 'Pending Approval';
        if (currentTab === 'Cancelled') return apt.status === 'Cancelled';
        if (currentTab === 'Past') return apt.status === 'Completed';
        return false;
    });

    renderList(filtered);
}

function renderList(list) {
    if (list.length === 0) {
        aptList.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">No ${currentTab.toLowerCase()} appointments.</div>`;
        return;
    }

    aptList.innerHTML = list.map(apt => `
        <div class="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm mb-4 transition-all hover:shadow-md">
            <div class="flex justify-between items-start mb-3">
                <span class="text-[10px] font-black px-3 py-1 rounded-full ${getStatusStyle(apt.status)} uppercase tracking-wider">
                    ${apt.status}
                </span>
                <div class="text-right">
                    <p class="text-xs font-bold text-gray-900">${apt.date}</p>
                    <p class="text-[10px] font-medium text-gray-400">${apt.time}</p>
                </div>
            </div>
            
            <div class="flex items-center gap-4 mb-4">
                <div class="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-[#009688]">
                    <i data-lucide="calendar" class="w-6 h-6"></i>
                </div>
                <div>
                    <h4 class="font-bold text-gray-800 leading-tight">${apt.serviceName}</h4>
                    <p class="text-xs text-gray-500">${apt.doctorName}</p>
                </div>
            </div>

            <div class="flex justify-between items-center pt-4 border-t border-gray-50">
                <span class="text-base font-black text-[#009688]">RM ${apt.price || '--'}</span>
                
                ${(apt.status === 'Upcoming' || apt.status === 'Pending Approval') ?
            `<button onclick="cancelBooking('${apt.id}')" class="flex items-center gap-1 text-xs font-bold text-red-500 bg-red-50 px-4 py-2 rounded-xl hover:bg-red-100 transition-colors">
                    <i data-lucide="x" class="w-3 h-3"></i> Cancel
                </button>` : ''}
            </div>
        </div>
    `).join('');
    // Re-initialize icons
    if (window.lucide) window.lucide.createIcons();

}

function getStatusStyle(status) {
    const s = status.toLowerCase();

    // Upcoming / Pending -> Green
    if (s === 'upcoming' || s === 'pending approval' || s === 'pending') {
        return 'bg-green-100 text-green-700 border border-green-200';
    }

    // Cancelled -> Red
    if (s === 'cancelled') {
        return 'bg-red-100 text-red-700 border border-red-200';
    }

    // Past / Completed -> Dark Grey
    return 'bg-slate-800 text-white border border-slate-900';
}