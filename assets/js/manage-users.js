import { db, collection, getDocs, doc, updateDoc, deleteDoc } from './firebase-config.js';

let allUsers = [];
let currentFilter = 'All';
let selectedUserId = null;

// DOM Elements
const tableBody = document.getElementById('user-table-body');
const searchInput = document.getElementById('user-search');
const loadingState = document.getElementById('loading-state');
const actionModal = document.getElementById('action-modal');

// 1. Load Users Function
async function loadUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, "Users"));
        allUsers = [];
        querySnapshot.forEach((docSnap) => {
            // Combine doc ID with data
            allUsers.push({ id: docSnap.id, ...docSnap.data() });
        });
        
        renderTable();
        loadingState.classList.add('hidden'); // Hide spinner
    } catch (error) {
        console.error("Error loading users:", error);
        loadingState.innerHTML = `<p class="text-red-500">Error loading data. Please try again.</p>`;
    }
}

// 2. Render Table Function
function renderTable() {
    const searchTerm = searchInput.value.toLowerCase();
    
    // Filter Logic
    const filtered = allUsers.filter(user => {
        const name = (user.fullName || "").toLowerCase();
        const email = (user.email || "").toLowerCase();
        const role = (user.role || "").toLowerCase();
        const status = (user.status || "").toLowerCase();

        const matchesSearch = name.includes(searchTerm) || email.includes(searchTerm);
        
        let matchesFilter = true;
        if (currentFilter === 'Pending') matchesFilter = status === 'pending';
        if (currentFilter === 'Staff') matchesFilter = role === 'staff';
        if (currentFilter === 'Doctor') matchesFilter = role === 'doctor';
            
        return matchesSearch && matchesFilter;
    });

    // Generate HTML
    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center py-8 text-gray-400">No users found.</td></tr>`;
    } else {
        tableBody.innerHTML = filtered.map(user => `
            <tr class="hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0">
                <td class="px-6 py-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden shrink-0">
                            ${user.profilePictureUrl 
                                ? `<img src="${user.profilePictureUrl}" class="w-full h-full object-cover">` 
                                : `<i data-lucide="user" class="w-5 h-5"></i>`}
                        </div>
                        <div>
                            <div class="font-bold text-gray-800 text-sm">${user.fullName || 'Unknown User'}</div>
                            <div class="text-xs text-gray-400">${user.email || 'No Email'}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider badge-role">
                        ${user.role || 'Patient'}
                    </span>
                </td>
                <td class="px-6 py-4">
                    <span class="px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${ (user.status || "").toLowerCase() === 'active' ? 'badge-active' : 'badge-pending'}">
                        ${user.status || 'Pending'}
                    </span>
                </td>
                <td class="px-6 py-4 text-right">
                    <button onclick="openActions('${user.id}', '${user.fullName}')" class="p-2 hover:bg-gray-200 rounded-lg text-gray-400 transition-colors">
                        <i data-lucide="more-horizontal" class="w-5 h-5"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
    
    // Refresh Icons
    if (window.lucide) window.lucide.createIcons();
}

// 3. Modal & Action Handlers
// We attach these to 'window' so HTML onclick="" works with modules
window.openActions = (id, name) => {
    selectedUserId = id;
    const nameSpan = document.getElementById('modal-user-name');
    if(nameSpan) nameSpan.innerText = name;
    actionModal.classList.remove('hidden');
};

const closeModalBtn = document.getElementById('close-modal');
if(closeModalBtn) {
    closeModalBtn.onclick = () => actionModal.classList.add('hidden');
}

// 4. Handle Action Buttons (Verify, Promote, Delete)
document.querySelectorAll('.action-btn').forEach(btn => {
    btn.onclick = async () => {
        const action = btn.dataset.action;
        if (!selectedUserId) return;
        
        const userRef = doc(db, "Users", selectedUserId);
        const originalBtnContent = btn.innerHTML;
        btn.innerHTML = `<span class="animate-spin mr-2">⏳</span> Processing...`;

        try {
            if (action === 'Verify') {
                await updateDoc(userRef, { status: 'Active' });
            } else if (action === 'Staff') {
                await updateDoc(userRef, { role: 'Staff' });
            } else if (action === 'Doctor') {
                await updateDoc(userRef, { role: 'Doctor' });
            } else if (action === 'Delete') {
                if (confirm("Permanently delete this user? This cannot be undone.")) {
                    await deleteDoc(userRef);
                } else {
                    btn.innerHTML = originalBtnContent;
                    return; // Cancelled
                }
            }
            
            // Success: Close modal and reload table
            actionModal.classList.add('hidden');
            await loadUsers(); 

        } catch (err) {
            console.error(err);
            alert("Action failed: " + err.message);
        } finally {
            btn.innerHTML = originalBtnContent;
        }
    };
});

// 5. Filter Chip Logic
document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
        // Reset all chips
        document.querySelectorAll('.filter-chip').forEach(c => {
            c.classList.remove('active', 'bg-blue-50', 'text-blue-600', 'border-blue-100');
            c.classList.add('bg-gray-50', 'text-gray-500', 'border-gray-100');
        });
        
        // Activate clicked chip
        chip.classList.remove('bg-gray-50', 'text-gray-500', 'border-gray-100');
        chip.classList.add('active', 'bg-blue-50', 'text-blue-600', 'border-blue-100');
        
        currentFilter = chip.dataset.filter;
        renderTable();
    };
});

// 6. Search Listener
if(searchInput) {
    searchInput.oninput = renderTable;
}

// Initial Call
loadUsers();