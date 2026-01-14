import { db, collection, getDocs, doc, updateDoc, query, orderBy } from './firebase-config.js';

const tableBody = document.getElementById('appointment-table-body');
const searchInput = document.getElementById('apt-search');
let allAppointments = [];

// --- 1. Load All Bookings ---
async function loadAppointments() {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-20 text-slate-400">Syncing Master Schedule...</td></tr>`;
    
    try {
        const q = query(collection(db, "bookings"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        allAppointments = [];
        
        snapshot.forEach(docSnap => {
            allAppointments.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        renderTable(allAppointments);
    } catch (e) {
        console.error(e);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-10 text-red-500">Error loading schedule.</td></tr>`;
    }
}

// --- 2. Render Table ---
function renderTable(data) {
    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-slate-400">No appointments found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.map(apt => {
        let statusColor = "bg-gray-100 text-gray-600";
        if (apt.status === "Completed") statusColor = "bg-green-100 text-green-600";
        if (apt.status === "Pending Approval") statusColor = "bg-amber-100 text-amber-600";
        if (apt.status === "Cancelled") statusColor = "bg-red-100 text-red-600";

        return `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4">
                    <div class="font-bold text-slate-800 text-sm">${apt.serviceName || 'Consultation'}</div>
                    <div class="text-[10px] text-slate-400">${apt.date} • ${apt.time || 'N/A'}</div>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-slate-600">${apt.patientName || 'Guest'}</td>
                <td class="px-6 py-4 text-sm text-slate-500 font-semibold">${apt.doctorName || '--'}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-md font-bold text-[10px] ${statusColor}">${apt.status}</span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex justify-end gap-2">
                        ${apt.status !== 'Completed' ? `
                            <button onclick="updateStatus('${apt.id}', 'Completed')" class="p-2 hover:bg-green-50 text-green-600 rounded-lg transition-colors" title="Mark Completed">
                                <i data-lucide="check-circle" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                        ${apt.status !== 'Cancelled' ? `
                            <button onclick="updateStatus('${apt.id}', 'Cancelled')" class="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors" title="Cancel">
                                <i data-lucide="x-circle" class="w-4 h-4"></i>
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    if(window.lucide) window.lucide.createIcons();
}

// --- 3. Update Status Logic ---
window.updateStatus = async (id, newStatus) => {
    if (confirm(`Change appointment status to ${newStatus}?`)) {
        try {
            const docRef = doc(db, "bookings", id);
            await updateDoc(docRef, { status: newStatus });
            alert(`Appointment marked as ${newStatus}`);
            loadAppointments(); // Refresh list
        } catch (e) {
            alert("Error updating status: " + e.message);
        }
    }
};

// Search Filter
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allAppointments.filter(apt => 
        (apt.patientName || "").toLowerCase().includes(term) || 
        (apt.doctorName || "").toLowerCase().includes(term)
    );
    renderTable(filtered);
});

loadAppointments();