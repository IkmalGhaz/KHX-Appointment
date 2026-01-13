import { auth, db, onAuthStateChanged, collection, query, where, getDocs, updateDoc, doc } from './firebase-config.js';

let currentTab = 'Upcoming';
let appointmentToCancel = null;
const aptList = document.getElementById('appointments-list');

// Elemen Modal
const cancelModal = document.getElementById('cancel-confirm-modal');
const reasonInput = document.getElementById('cancel-reason-input');
const confirmBtn = document.getElementById('confirm-cancel-btn'); // Butang di modal sebab
const finalConfirmBtn = document.getElementById('final-confirm-btn'); // Butang di modal merah

onAuthStateChanged(auth, (user) => {
    if (user) {
        loadAppointments(user.uid);
    }
});

// --- LOGIK MODAL PEMBATALAN ---

// 1. Papar Modal Sebab bila klik butang Cancel di kad appointment
window.cancelBooking = (id) => {
    appointmentToCancel = id;
    reasonInput.value = '';
    cancelModal.classList.remove('hidden');
};

window.closeCancelModal = () => {
    cancelModal.classList.add('hidden');
    appointmentToCancel = null;
};

// 2. Bila klik "Confirm" di Modal Sebab -> Papar Modal Merah
if (confirmBtn) {
    confirmBtn.onclick = () => {
        const reason = reasonInput.value.trim();
        if (!reason) {
            alert("Please enter a reason for cancellation.");
            return;
        }
        // Sembunyikan modal sebab, tunjuk modal merah
        cancelModal.classList.add('hidden');
        document.getElementById('booking-confirm-modal').classList.remove('hidden');
    };
}

// 3. Bila klik "Yes, Confirm Now" di Modal Merah -> Update Firestore
if (finalConfirmBtn) {
    finalConfirmBtn.onclick = async () => {
        const reason = reasonInput.value.trim();

        finalConfirmBtn.innerText = "Processing...";
        finalConfirmBtn.disabled = true;

        try {
            const aptRef = doc(db, "bookings", appointmentToCancel);
            await updateDoc(aptRef, {
                status: 'Cancelled',
                cancellationReason: reason,
                cancelledAt: new Date()
            });

            alert("Appointment successfully cancelled.");

            // Tutup modal merah dan refresh
            document.getElementById('booking-confirm-modal').classList.add('hidden');
            location.reload();
        } catch (error) {
            console.error("Cancellation Error:", error);
            alert("Failed to cancel: " + error.message);
        } finally {
            finalConfirmBtn.innerText = "Yes, Confirm Now";
            finalConfirmBtn.disabled = false;
        }
    };
}

// Helper untuk tutup modal merah
window.closeConfirmModal = () => {
    document.getElementById('booking-confirm-modal').classList.add('hidden');
    // Jika user klik "Back" di modal merah, buka semula modal sebab
    cancelModal.classList.remove('hidden');
};

// --- LOGIK PAPARAN SENARAI (Sedia Ada) ---

window.switchTab = (tab) => {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('border-[#009688]', 'text-[#009688]');
        btn.classList.add('border-transparent', 'text-gray-400');
    });
    event.target.classList.add('border-[#009688]', 'text-[#009688]');
    event.target.classList.remove('border-transparent', 'text-gray-400');

    const user = auth.currentUser;
    if (user) loadAppointments(user.uid);
};

async function loadAppointments(uid) {
    aptList.innerHTML = '<div class="text-center py-10"><div class="animate-spin inline-block w-6 h-6 border-2 border-[#009688] border-t-transparent rounded-full"></div></div>';

    try {
        const q = query(collection(db, "bookings"), where("patientId", "==", uid));
        const snapshot = await getDocs(q);
        const appointments = [];

        snapshot.forEach(doc => appointments.push({ id: doc.id, ...doc.data() }));

        const filtered = appointments.filter(apt => {
            if (currentTab === 'Upcoming') return apt.status === 'Upcoming';
            if (currentTab === 'Cancelled') return apt.status === 'Cancelled';
            if (currentTab === 'Past') return apt.status === 'Completed';
            return false;
        });

        renderList(filtered);
    } catch (error) {
        console.error("Fetch error:", error);
        aptList.innerHTML = '<p class="text-red-500 text-center">Error loading appointments.</p>';
    }
}

function renderList(list) {
    if (list.length === 0) {
        aptList.innerHTML = `<div class="text-center py-10 text-gray-400 text-sm">No ${currentTab.toLowerCase()} appointments.</div>`;
        return;
    }

    aptList.innerHTML = list.map(apt => `
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3">
            <div class="flex justify-between items-start mb-2">
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusStyle(apt.status)} uppercase">${apt.status}</span>
                <span class="text-xs font-bold text-gray-400">${apt.date}</span>
            </div>
            <h4 class="font-bold text-[#004d40]">${apt.serviceName}</h4>
            <p class="text-xs text-gray-500 mb-3">${apt.doctorName}</p>
            <div class="flex justify-between items-center pt-3 border-t border-gray-50">
                <span class="text-lg font-bold text-gray-700">${apt.time}</span>
                ${apt.status === 'Upcoming' ? `<button onclick="cancelBooking('${apt.id}')" class="text-xs font-bold text-red-500 hover:underline">Cancel</button>` : ''}
            </div>
        </div>
    `).join('');
}

function getStatusStyle(status) {
    if (status === 'Upcoming') return 'bg-teal-50 text-teal-600';
    if (status === 'Cancelled') return 'bg-red-50 text-red-600';
    return 'bg-gray-50 text-gray-600';
}