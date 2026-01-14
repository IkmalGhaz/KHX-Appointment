import { db, collection, getDocs, doc, deleteDoc, auth, signOut } from './firebase-config.js';

let allStaff = [];
const tableBody = document.getElementById('user-table-body');
const searchInput = document.getElementById('table-search');
const sidebar = document.getElementById('detail-sidebar');
const overlay = document.getElementById('sidebar-overlay');

// --- 1. Load Data ---
async function loadStaff() {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-slate-400">Loading staff...</td></tr>`;
    
    try {
        const querySnapshot = await getDocs(collection(db, "Users"));
        allStaff = [];
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const role = (data.role || "").toLowerCase();
            
            // FILTER: Only show Doctors and Staff
            if (role === 'doctor' || role === 'staff') {
                allStaff.push({ id: docSnap.id, ...data });
            }
        });
        
        renderTable(allStaff);
    } catch (error) {
        console.error("Error:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-red-500">Failed to load data.</td></tr>`;
    }
}

// --- 2. Render Table ---
function renderTable(data) {
    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-slate-400">No staff found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = data.map(user => {
        const roleClass = user.role.toLowerCase() === 'doctor' ? 'role-doctor' : 'role-staff';
        const initials = user.fullName ? user.fullName.substring(0,2).toUpperCase() : "??";

        return `
            <tr class="user-row border-b border-slate-50 last:border-0 group">
                <td class="px-6 py-4"><input type="checkbox" class="custom-checkbox"></td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="openDetailSidebar('${user.id}')">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden shrink-0 border border-slate-200">
                             ${user.profilePictureUrl 
                                ? `<img src="${user.profilePictureUrl}" class="w-full h-full object-cover">` 
                                : `<span class="font-bold text-xs">${initials}</span>`}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 text-sm">${user.fullName || 'Unknown'}</div>
                            <div class="text-xs text-slate-400">${user.email || '--'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-md text-[11px] font-bold ${roleClass}">${user.role || 'Staff'}</span>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500">${user.phone || '--'}</td>
                <td class="px-6 py-4 text-right">
                     <button onclick="deleteUser('${user.id}')" class="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    if(window.lucide) window.lucide.createIcons();
}

// --- 3. Interaction Logic ---
window.openDetailSidebar = (id) => {
    const user = allStaff.find(u => u.id === id);
    if (!user) return;

    document.getElementById('detail-name').innerText = user.fullName || "Unknown";
    document.getElementById('detail-role').innerText = user.role || "Staff";
    document.getElementById('detail-email').innerText = user.email || "--";
    document.getElementById('detail-phone').innerText = user.phone || "--";
    
    // Styling role badge in sidebar
    const roleBadge = document.getElementById('detail-role');
    if(user.role.toLowerCase() === 'doctor') {
        roleBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-[#f5f3ff] text-[#7c3aed] border border-[#ddd6fe]";
    } else {
        roleBadge.className = "px-3 py-1 rounded-full text-xs font-bold bg-[#fff7ed] text-[#ea580c] border border-[#ffedd5]";
    }

    const imgEl = document.getElementById('detail-img');
    imgEl.src = user.profilePictureUrl || "assets/js/images/default-user.png";

    sidebar.classList.add('open');
    overlay.classList.remove('hidden');
};

window.closeDetailSidebar = () => {
    sidebar.classList.remove('open');
    overlay.classList.add('hidden');
};

// Search
searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase();
    const filtered = allStaff.filter(u => (u.fullName || "").toLowerCase().includes(term));
    renderTable(filtered);
});

// Modal Toggles
window.openUserModal = () => document.getElementById('user-modal').classList.remove('hidden');
window.closeUserModal = () => document.getElementById('user-modal').classList.add('hidden');

// Delete Logic
window.deleteUser = async (id) => {
    if(confirm("Delete this staff member?")) {
        try {
            await deleteDoc(doc(db, "Users", id));
            loadStaff();
        } catch(e) { alert("Error deleting: " + e.message); }
    }
}

// Logout Logic
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm("Logout?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}

loadStaff();