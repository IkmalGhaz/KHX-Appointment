import { auth, db, onAuthStateChanged, signOut, collection, getDocs, doc, getDoc } from './firebase-config.js';

// --- Global State ---
let chartInstance = null;

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
        
        const statusCounts = { 'Upcoming': 0, 'Completed': 0, 'Cancelled': 0 };

        bookingsSnapshot.forEach(doc => {
            const data = doc.data();
            totalBookings++;
            
            // Calculate Revenue (Paid or Completed)
            if ((data.paymentStatus === 'Paid' || data.status === 'Completed') && data.price) {
                totalRevenue += Number(data.price);
            }

            // Count Pendings
            if (data.status === 'Pending' || data.status === 'Pending Approval') pendingCount++;
            
            // Normalize Status for Chart
            const normalizedStatus = data.status === 'Pending Approval' ? 'Upcoming' : data.status;
            if (statusCounts[normalizedStatus] !== undefined) {
                statusCounts[normalizedStatus]++;
            } else if (data.status === 'Upcoming') {
                statusCounts['Upcoming']++;
            }
        });

        // C. Update UI with Count Up Animation
        animateValue("total-revenue", 0, totalRevenue, 1500, "RM ");
        animateValue("total-patients", 0, patientCount, 1000, "");
        animateValue("total-bookings", 0, totalBookings, 1000, "");
        
        const pendingEl = document.getElementById('pending-count');
        if(pendingEl) pendingEl.innerText = pendingCount;

        // D. Render Charts & Activity
        renderChart(statusCounts);
        renderActivityFeed(bookingsSnapshot);

    } catch (error) {
        console.error("Dashboard Error:", error);
    }
}

// --- 3. Chart.js Configuration (Web Optimized) ---
function renderChart(dataObj) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    
    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Upcoming', 'Completed', 'Cancelled'],
            datasets: [{
                label: 'Appointments',
                data: [dataObj.Upcoming, dataObj.Completed, dataObj.Cancelled],
                backgroundColor: [
                    '#06b6d4', // Cyan (Brand Color)
                    '#10b981', // Emerald
                    '#ef4444'  // Red
                ],
                borderRadius: 6,
                barThickness: 50, // Thicker bars for desktop
                hoverBackgroundColor: [
                    '#0891b2', 
                    '#059669', 
                    '#dc2626'
                ]
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
                    titleFont: { family: 'Plus Jakarta Sans', size: 13 },
                    bodyFont: { family: 'Plus Jakarta Sans', size: 13 },
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { display: true, color: '#f1f5f9', borderDash: [5, 5] },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#64748b' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 12, weight: '600' }, color: '#475569' },
                    border: { display: false }
                }
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        }
    });
}

// --- 4. Recent Activity Feed ---
function renderActivityFeed(snapshot) {
    const container = document.getElementById('activity-list');
    container.innerHTML = '';

    let bookings = [];
    snapshot.forEach(doc => bookings.push({ id: doc.id, ...doc.data() }));
    
    // Sort descending by creation date
    bookings.sort((a, b) => {
        const dateA = a.createdAt ? a.createdAt.seconds : 0;
        const dateB = b.createdAt ? b.createdAt.seconds : 0;
        return dateB - dateA;
    });

    // Take top 6 for desktop view
    const recent = bookings.slice(0, 6);

    if (recent.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-slate-400">
            <i data-lucide="inbox" class="w-10 h-10 mb-2 opacity-50"></i>
            <p class="text-sm">No activity found</p>
        </div>`;
        return;
    }

    recent.forEach(apt => {
        let iconBg = 'bg-blue-50 text-blue-600';
        let icon = 'calendar';
        let statusColor = 'text-slate-500';
        
        if (apt.status === 'Cancelled') { 
            iconBg = 'bg-red-50 text-red-600'; 
            icon = 'x'; 
            statusColor = 'text-red-500';
        }
        if (apt.status === 'Completed') { 
            iconBg = 'bg-emerald-50 text-emerald-600'; 
            icon = 'check'; 
            statusColor = 'text-emerald-500';
        }

        const div = document.createElement('div');
        div.className = "flex items-center gap-4 p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group";
        div.innerHTML = `
            <div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center shrink-0 shadow-sm">
                <i data-lucide="${icon}" class="w-5 h-5"></i>
            </div>
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-bold text-slate-700 truncate group-hover:text-cyan-700 transition-colors">${apt.serviceName || 'Appointment'}</h4>
                    <span class="text-[10px] font-bold uppercase tracking-wider ${statusColor}">${apt.status}</span>
                </div>
                <p class="text-xs text-slate-400 truncate mt-0.5">${apt.doctorName} • <span class="text-slate-500 font-medium">${apt.date}</span></p>
            </div>
        `;
        container.appendChild(div);
    });

    if(window.lucide) window.lucide.createIcons();
}

// --- 5. Utilities ---
function animateValue(id, start, end, duration, prefix = "") {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? Math.ceil(range / (duration / 16)) : -1;
    const obj = document.getElementById(id);
    if (!obj) return;
    
    const timer = setInterval(function() {
        current += increment;
        if ((range > 0 && current >= end) || (range < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        obj.innerHTML = prefix + current.toLocaleString();
    }, 16);
}

// --- 6. Event Listeners ---
const logoutBtn = document.getElementById('logout-btn');
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if(confirm("Are you sure you want to logout?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}

