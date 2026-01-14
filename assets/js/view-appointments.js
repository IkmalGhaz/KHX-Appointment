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
        window.loadAppointments(user.uid);
    }
});

// --- REBOOK LOGIC ---
window.rebookAppointment = (serviceName, price, doctorId, doctorName) => {
    const params = new URLSearchParams({
        rebook: 'true',
        serviceName: serviceName,
        price: price,
        doctorId: doctorId,
        doctorName: doctorName
    });
    window.location.href = `booking.html?${params.toString()}`;
};

// --- CANCELLATION MODAL LOGIC ---
window.cancelBooking = (id) => {
    appointmentToCancel = id;
    if(reasonInput) reasonInput.value = '';
    if(cancelModal) cancelModal.classList.remove('hidden');
};

window.closeCancelModal = () => {
    if(cancelModal) cancelModal.classList.add('hidden');
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
        finalConfirmBtn.innerText = "Processing...";
        finalConfirmBtn.disabled = true;

        setTimeout(async () => {
            try {
                const aptRef = doc(db, "bookings", appointmentToCancel);
                await updateDoc(aptRef, {
                    status: 'Cancelled',
                    cancellationReason: reason,
                    cancelledAt: new Date()
                });

                alert("Appointment cancelled.");
                document.getElementById('booking-confirm-modal').classList.add('hidden');
                finalConfirmBtn.innerText = "Yes, Confirm Now";
                finalConfirmBtn.disabled = false;
            } catch (error) {
                console.error("Cancellation Error:", error);
                alert("Failed to cancel: " + error.message);
                finalConfirmBtn.innerText = "Yes, Confirm Now";
                finalConfirmBtn.disabled = false;
            }
        }, 2000);
    };
}

window.closeConfirmModal = () => {
    document.getElementById('booking-confirm-modal').classList.add('hidden');
    cancelModal.classList.remove('hidden');
};

// --- APPOINTMENT LIST & TAB LOGIC ---
let allUserAppointments = [];

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-[#009688]', 'text-[#009688]');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    if (event && event.target) {
        event.target.classList.add('border-[#009688]', 'text-[#009688]');
        event.target.classList.remove('border-transparent', 'text-gray-400');
    }
    applyFiltersAndRender();
};

window.loadAppointments = (uid) => {
    if(!aptList) return;
    aptList.innerHTML = '<div class="text-center py-10"><div class="animate-spin inline-block w-6 h-6 border-2 border-[#009688] border-t-transparent rounded-full"></div></div>';
    
    const q = query(collection(db, "bookings"), where("patientId", "==", uid));

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
    allUserAppointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const filtered = allUserAppointments.filter(apt => {
        if (currentTab === 'Upcoming') return apt.status === 'Upcoming' || apt.status === 'Pending Approval';
        if (currentTab === 'Cancelled') return apt.status === 'Cancelled';
        if (currentTab === 'Past') return apt.status === 'Completed';
        return false;
    });

    renderList(filtered);
}

function renderList(list) {
    if (!aptList) return;
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

                ${(apt.status === 'Cancelled') ?
                `<button onclick="rebookAppointment('${apt.serviceName}', '${apt.price}', '${apt.doctorId}', '${apt.doctorName}')" class="flex items-center gap-1 text-xs font-bold text-white bg-[#009688] px-4 py-2 rounded-xl hover:bg-[#00796b] transition-colors shadow-sm">
                    <i data-lucide="refresh-cw" class="w-3 h-3"></i> Rebook
                </button>` : ''}
            </div>
        </div>
    `).join('');
    
    if (window.lucide) window.lucide.createIcons();
}

function getStatusStyle(status) {
    const s = status.toLowerCase();
    if (s === 'upcoming' || s === 'pending approval' || s === 'pending') return 'bg-green-100 text-green-700 border border-green-200';
    if (s === 'cancelled') return 'bg-red-100 text-red-700 border border-red-200';
    return 'bg-slate-800 text-white border border-slate-900';
}