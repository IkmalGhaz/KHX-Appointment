import { auth, db, signOut, onAuthStateChanged, collection, query, where, getDocs } from './firebase-config.js';

// DOM Elements
const userNameEl = document.getElementById('user-name');
const dateDisplay = document.getElementById('date-display');
const badgeCount = document.getElementById('badge-count');
const aptModal = document.getElementById('apt-modal');
const aptList = document.getElementById('appointments-list');
let chartInstance = null;

// Initialize Date
if (dateDisplay) {
    const options = { weekday: 'long', day: 'numeric', month: 'short' };
    dateDisplay.innerText = new Date().toLocaleDateString('en-US', options);
}

// 1. AUTH GUARD & DATA LOADING
onAuthStateChanged(auth, async (user) => {
    if (user) {
        await loadUserProfile(user.uid); // Pass UID to find document
        await loadDashboardData(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// 2. LOGOUT LOGIC
document.getElementById('logout-btn').addEventListener('click', async () => {
    if(confirm("Logout from KHX Clinic?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
});

// 3. LOAD USER PROFILE (The Fix for Random Document IDs)
async function loadUserProfile(uid) {
    try {
        // Query the Users collection where field 'firebaseUid' matches current user
        const q = query(collection(db, "Users"), where("firebaseUid", "==", uid));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Get the first matching document
            const userData = querySnapshot.docs[0].data();
            userNameEl.innerText = userData.fullName || userData.email;
        } else {
            userNameEl.innerText = "Valued Patient";
            console.warn("User document not found for UID:", uid);
        }
    } catch (e) {
        console.error("Profile Load Error:", e);
        userNameEl.innerText = "Welcome";
    }
}

// 4. LOAD DASHBOARD DATA (Graph & List)
async function loadDashboardData(uid) {
    try {
        const q = query(collection(db, "bookings"), where("userId", "==", uid));
        const snapshot = await getDocs(q);
        
        let active = 0, completed = 0, cancelled = 0;
        let htmlContent = "";

        snapshot.forEach(doc => {
            const data = doc.data();
            const status = data.status || "Upcoming";
            const isCancelled = data.isCancelled === true;

            // Stats Logic
            if (isCancelled || status === 'Cancelled') cancelled++;
            else if (status === 'Completed') completed++;
            else active++;

            // List Item Generation
            const statusColor = isCancelled ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700";
            const statusText = isCancelled ? "Cancelled" : status;
            
            htmlContent += `
                <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 flex justify-between items-center">
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded ${statusColor} uppercase">${statusText}</span>
                            <span class="text-xs text-gray-400">${data.date}</span>
                        </div>
                        <div class="font-bold text-gray-800">${data.serviceName || 'General'}</div>
                        <div class="text-xs text-gray-500">${data.doctorName || 'Dr. Assigned'}</div>
                    </div>
                    <div class="font-bold text-lg text-gray-700">${data.time}</div>
                </div>
            `;
        });

        // Update Badge
        if (active > 0) {
            badgeCount.innerText = active;
            badgeCount.classList.remove('hidden');
        }

        // Update Modal List
        aptList.innerHTML = htmlContent || '<div class="text-center py-10 text-gray-400">No appointments found.</div>';

        // Update Chart
        renderMiniChart(active, completed, cancelled);

    } catch (error) {
        console.error("Dashboard Data Error:", error);
    }
}

// 5. CHART RENDERER (Clean Mini Donut)
function renderMiniChart(active, completed, cancelled) {
    const ctx = document.getElementById('miniChart');
    if(!ctx) return;

    if (chartInstance) chartInstance.destroy();

    // If no data, show gray ring
    const noData = (active + completed + cancelled) === 0;

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Active', 'Done', 'Cancelled'],
            datasets: [{
                data: noData ? [1] : [active, completed, cancelled],
                backgroundColor: noData ? ['#e5e7eb'] : ['#dc2626', '#16a34a', '#94a3b8'],
                borderWidth: 0,
                hoverOffset: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { display: false }, tooltip: { enabled: !noData } }
        }
    });
}

// 6. MODAL HANDLERS
const viewBtn = document.getElementById('view-apt-btn');
const closeBtn = document.getElementById('close-modal');

if(viewBtn) viewBtn.onclick = () => { aptModal.classList.remove('hidden'); };
if(closeBtn) closeBtn.onclick = () => { aptModal.classList.add('hidden'); };