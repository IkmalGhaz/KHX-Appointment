import { db, collection, getDocs, doc, updateDoc, deleteDoc, addDoc, auth, signOut } from './firebase-config.js';

// --- State Management ---
let allPatients = [];
let filteredPatients = [];
let sortConfig = { key: 'fullName', direction: 'asc' };

// --- DOM Elements ---
const tableBody = document.getElementById('user-table-body');
const searchInput = document.getElementById('table-search');
const sidebar = document.getElementById('detail-sidebar');
const overlay = document.getElementById('sidebar-overlay');
const showingInfo = document.getElementById('showing-info');

// --- 1. Load Data ---
async function loadUsers() {
    tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12"><div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-cyan-100 border-t-cyan-500"></div><p class="text-xs text-slate-400 mt-2">Loading patients...</p></td></tr>`;
    
    try {
        const querySnapshot = await getDocs(collection(db, "Users"));
        allPatients = [];
        
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const role = (data.role || "").toLowerCase();
            
            // STRICT FILTER: Only Patients (or users with no role defined)
            if (role === 'patient' || role === '' || !data.role) {
                allPatients.push({ id: docSnap.id, ...data });
            }
        });
        
        applyFilters(); 
    } catch (error) {
        console.error("Error:", error);
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-red-500">Failed to load data.</td></tr>`;
    }
}

// --- 2. Filtering Logic ---
function applyFilters() {
    const term = searchInput.value.toLowerCase();

    // Search
    filteredPatients = allPatients.filter(user => {
        const name = (user.fullName || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        return name.includes(term) || email.includes(term);
    });

    // Sort
    filteredPatients.sort((a, b) => {
        const valA = (a[sortConfig.key] || "").toLowerCase();
        const valB = (b[sortConfig.key] || "").toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    renderTable();
}

// --- 3. Render Table ---
function renderTable() {
    if (filteredPatients.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5" class="text-center py-12 text-slate-400">No patients found.</td></tr>`;
        showingInfo.innerText = "Showing 0 patients";
        return;
    }

    tableBody.innerHTML = filteredPatients.map(user => {
        const status = (user.status || "Pending");
        const statusClass = status.toLowerCase() === 'active' ? 'status-active' : 'status-pending';
        const initials = getInitials(user.fullName);

        return `
            <tr class="user-row border-b border-slate-50 last:border-0 group">
                <td class="px-6 py-4">
                    <input type="checkbox" class="custom-checkbox row-checkbox" value="${user.id}">
                </td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3 cursor-pointer" onclick="openDetailSidebar('${user.id}')">
                        <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden shrink-0 border border-slate-200">
                            ${user.profilePictureUrl 
                                ? `<img src="${user.profilePictureUrl}" class="w-full h-full object-cover">` 
                                : `<span class="font-bold text-xs">${initials}</span>`}
                        </div>
                        <div>
                            <div class="font-bold text-slate-800 text-sm group-hover:text-cyan-600 transition-colors">${user.fullName || 'Unknown'}</div>
                            <div class="text-xs text-slate-400">${user.email || 'No Email'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm text-slate-500">
                    ${user.phone || '<span class="text-slate-300 italic">No Phone</span>'}
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-md text-[11px] font-bold ${statusClass} inline-flex items-center gap-1.5">
                        <span class="w-1.5 h-1.5 rounded-full bg-current ${status.toLowerCase() === 'active' ? 'animate-pulse' : ''}"></span>
                        ${status}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <div class="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onclick="openDetailSidebar('${user.id}')" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="View Profile">
                            <i data-lucide="eye" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteUser('${user.id}')" class="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors" title="Delete Account">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    showingInfo.innerText = `Showing ${filteredPatients.length} patients`;
    if(window.lucide) window.lucide.createIcons();
}

// --- 4. Sidebar Detail Logic ---
window.openDetailSidebar = (id) => {
    const user = allPatients.find(u => u.id === id);
    if (!user) return;

    // Populate Sidebar
    document.getElementById('detail-name').innerText = user.fullName || "Unknown";
    document.getElementById('detail-status').innerText = user.status || "Pending";
    document.getElementById('detail-email').innerText = user.email || "--";
    document.getElementById('detail-phone').innerText = user.phone || "--";
    document.getElementById('detail-address').innerText = user.mailingAddress || "No address provided";
    
    // Convert Firestore Timestamp to Date if available
    if(user.createdAt && user.createdAt.seconds) {
        document.getElementById('detail-joined').innerText = new Date(user.createdAt.seconds * 1000).toLocaleDateString();
    } else {
        document.getElementById('detail-joined').innerText = "--";
    }
    
    const imgEl = document.getElementById('detail-img');
    imgEl.src = user.profilePictureUrl || "assets/js/images/default-user.png";

    // Show
    sidebar.classList.add('open');
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.remove('opacity-0'), 10);
};

window.closeDetailSidebar = () => {
    sidebar.classList.remove('open');
    overlay.classList.add('opacity-0');
    setTimeout(() => overlay.classList.add('hidden'), 300);
};

// --- 5. Helper Functions ---
function getInitials(name) {
    if(!name) return "??";
    return name.split(" ").map(n => n[0]).join("").substring(0,2).toUpperCase();
}

window.sortTable = (key) => {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }
    applyFilters();
};

window.openUserModal = () => {
    document.getElementById('user-modal').classList.remove('hidden');
};

window.closeUserModal = () => {
    document.getElementById('user-modal').classList.add('hidden');
};

window.deleteUser = async (id) => {
    if(confirm("Are you sure you want to remove this patient? This action is irreversible.")) {
        try {
            await deleteDoc(doc(db, "Users", id));
            alert("Patient removed successfully.");
            loadUsers(); // Refresh
        } catch(e) {
            console.error(e);
            alert("Error deleting user.");
        }
    }
}

// --- 6. Logout Logic ---
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if (confirm("Are you sure you want to logout?")) {
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout Error:", error);
                alert("Failed to logout. Please try again.");
            }
        }
    });
}

// --- Event Listeners ---
searchInput.addEventListener('input', applyFilters);

// Initial Load
loadUsers();