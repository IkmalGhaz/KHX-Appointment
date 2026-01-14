import { auth, db, onAuthStateChanged, signOut, collection, getDocs, doc, getDoc } from './firebase-config.js';

// --- Global State ---
let chartInstance = null;
let statsData = { monthly: null, weekly: null }; // State to hold both chart datasets

// --- 1. Initialization ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Load Admin Name
        try {
            const userDoc = await getDoc(doc(db, "Users", user.uid));
            if (userDoc.exists()) {
                const name = userDoc.data().fullName || "Administrator";
                document.getElementById('admin-name').innerText = name;
            }
        } catch (e) {
            console.log("Error loading profile", e);
        }
        
        // Load Data
        await loadDashboardData();
    } else {
        window.location.href = "index.html";
    }
});

// --- 2. Data Fetching & UI Updates ---
async function loadDashboardData() {
    try {
        // A. Users Stats
        const usersSnapshot = await getDocs(collection(db, "Users"));
        let patientCount = 0;
        
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            const role = (data.role || "").toLowerCase();
            if (role === 'patient') patientCount++;
        });

        // B. Bookings Stats
        const bookingsSnapshot = await getDocs(collection(db, "bookings"));
        let totalRevenue = 0;
        let totalBookings = 0;
        let pendingCount = 0;
        
        const monthlyCounts = { 'Upcoming': 0, 'Completed': 0, 'Cancelled': 0 };
        const weeklyCounts = [0, 0, 0, 0, 0]; // Weekly buckets for current month

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        bookingsSnapshot.forEach(doc => {
            const data = doc.data();
            totalBookings++;
            
            // Calculate Revenue (Paid or Completed)
            if ((data.paymentStatus === 'Paid' || data.status === 'Completed') && data.price) {
                totalRevenue += Number(data.price);
            }

            // Count Pendings
            if (data.status === 'Pending' || data.status === 'Pending Approval') pendingCount++;
            
            // 1. Monthly Status Logic
            const normalizedStatus = data.status === 'Pending Approval' ? 'Upcoming' : data.status;
            if (monthlyCounts[normalizedStatus] !== undefined) {
                monthlyCounts[normalizedStatus]++;
            }

            // 2. Weekly grouping Logic (New)
            if (data.date) {
                const aptDate = new Date(data.date);
                // Only count for current month and year
                if (aptDate.getMonth() === currentMonth && aptDate.getFullYear() === currentYear) {
                    const weekNum = Math.ceil(aptDate.getDate() / 7);
                    if (weekNum >= 1 && weekNum <= 5) {
                        weeklyCounts[weekNum - 1]++;
                    }
                }
            }
        });

        // Store chart data in Global State for toggling
        statsData.monthly = {
            labels: ['Upcoming', 'Completed', 'Cancelled'],
            values: [monthlyCounts.Upcoming, monthlyCounts.Completed, monthlyCounts.Cancelled]
        };
        statsData.weekly = {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'],
            values: weeklyCounts
        };

        // C. Update UI with Count Up Animation
        animateValue("total-revenue", 0, totalRevenue, 1500, "RM ");
        animateValue("total-patients", 0, patientCount, 1000, "");
        animateValue("total-bookings", 0, totalBookings, 1000, "");
        
        const pendingEl = document.getElementById('pending-count');
        if(pendingEl) pendingEl.innerText = pendingCount;

        // D. Render Default View (Monthly)
        renderChart(statsData.monthly);
        renderActivityFeed(bookingsSnapshot);

    } catch (error) {
        console.error("Dashboard Error:", error);
    }
}

// --- 3. Chart Toggle Switching Logic (New) ---
window.toggleChartView = (type) => {
    const btnMonthly = document.getElementById('btn-monthly');
    const btnWeekly = document.getElementById('btn-weekly');

    if (type === 'monthly') {
        // Active Style
        btnMonthly.className = "px-4 py-1.5 bg-white shadow-sm rounded-md text-xs font-bold text-slate-800 transition-all";
        btnWeekly.className = "px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-md transition-all";
        renderChart(statsData.monthly);
    } else {
        // Active Style
        btnWeekly.className = "px-4 py-1.5 bg-white shadow-sm rounded-md text-xs font-bold text-slate-800 transition-all";
        btnMonthly.className = "px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-md transition-all";
        renderChart(statsData.weekly);
    }
};

// --- 4. Chart.js Configuration ---
function renderChart(dataObj) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: dataObj.labels,
            datasets: [{
                label: 'Appointments',
                data: dataObj.values,
                backgroundColor: [
                    '#06b6d4', // Cyan
                    '#10b981', // Emerald
                    '#ef4444', // Red
                    '#f59e0b', // Amber
                    '#6366f1'  // Indigo
                ],
                borderRadius: 6,
                barThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }, color: '#475569' }
                }
            }
        }
    });
}

// --- 5. Recent Activity Feed ---
function renderActivityFeed(snapshot) {
    const container = document.getElementById('activity-list');
    container.innerHTML = '';

    let bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    
    bookings.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const recent = bookings.slice(0, 6);

    if (recent.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400"><p class="text-sm">No activity found</p></div>`;
        return;
    }

    recent.forEach(apt => {
        const div = document.createElement('div');
        div.className = "flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group";
        div.innerHTML = `
            <div class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <i data-lucide="calendar" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-bold text-slate-700 truncate">${apt.serviceName || 'Appointment'}</h4>
                    <span class="text-[10px] font-bold uppercase text-slate-500">${apt.status}</span>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">${apt.doctorName} • ${apt.date}</p>
            </div>`;
        container.appendChild(div);
    });

    if(window.lucide) window.lucide.createIcons();
}

// --- 6. Utilities ---
function animateValue(id, start, end, duration, prefix = "") {
    const obj = document.getElementById(id);
    if (!obj || start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? Math.ceil(range / (duration / 16)) : -1;
    
    const timer = setInterval(() => {
        current += increment;
        if ((range > 0 && current >= end) || (range < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        obj.innerHTML = prefix + current.toLocaleString();
    }, 16);
}

// --- 7. Event Listeners ---

// Logout
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if(confirm("Are you sure you want to logout?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}

// Audit History Navigation (New)
const viewHistoryBtn = document.getElementById('view-full-history-btn');
if (viewHistoryBtn) {
    viewHistoryBtn.addEventListener('click', () => {
        window.location.href = 'audit-history.html';
    });
}

// Run Diagnostics Logic (New)
const diagBtn = document.getElementById('run-diagnostics-btn');
if (diagBtn) {
    diagBtn.addEventListener('click', async () => {
        const originalText = diagBtn.innerText;
        diagBtn.innerText = "Checking...";
        diagBtn.disabled = true;

        try {
            // 1. Check Database connection
            await getDocs(collection(db, "Users")); 
            
            // 2. Check Gateway reachability
            const PROXY_URL = 'https://corsproxy.io/?'; 
            const TOYYIB_URL = 'https://dev.toyyibpay.com/';
            const gatewayCheck = await fetch(PROXY_URL + encodeURIComponent(TOYYIB_URL), { method: 'HEAD' });

            document.getElementById('status-indicator').className = "w-2 h-2 bg-green-400 rounded-full animate-pulse";
            document.getElementById('status-text').innerText = "System Healthy";
            alert("Diagnostics Complete: Firestore and Payment Gateway are reachable.");
        } catch (error) {
            document.getElementById('status-text').innerText = "Issues Detected";
            alert("Diagnostics failed: Could not establish a secure connection.");
        } finally {
            diagBtn.innerText = originalText;
            diagBtn.disabled = false;
        }
    });
}