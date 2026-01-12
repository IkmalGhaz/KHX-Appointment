import { db, collection, getDocs, query, where, addDoc, auth, onAuthStateChanged } from './firebase-config.js';

// HELPER: Normalize date for comparison (removes spaces, makes lowercase)
function normalizeDate(dateStr) {
    return dateStr.toLowerCase().replace(/\s+/g, '');
}
// --- STATE MANAGEMENT ---
let currentStep = 1;
let bookingData = { 
    serviceId: null, 
    serviceName: null, 
    price: null, 
    doctorId: null, 
    doctorName: null, 
    date: null, 
    time: null 
};
let doctorUnavailableDates = []; // NEW: Stores the blocked dates

// --- 1. NAVIGATION LOGIC ---
window.handleBack = () => {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    } else {
        window.location.href = 'dashboard.html';
    }
};

function showStep(step) {
    document.querySelectorAll('.step-content').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`step-${step}`);
    if(target) target.classList.remove('hidden');
    updateHeader(step);
    currentStep = step;
    if(window.lucide) window.lucide.createIcons();
}

function updateHeader(step) {
    const titles = ["Choose Service", "Choose Doctor", "Date & Time", "Payment", "Success"];
    const subs = ["Select care type", "Select specialist", "When to come?", "Review & Pay", "All done!"];
    
    document.getElementById('step-lbl').innerText = step;
    document.getElementById('page-title').innerText = titles[step-1] || "Booking";
    document.getElementById('page-subtitle').innerText = subs[step-1] || "";
    
    // Progress for 5 steps (20%, 40%, 60%, 80%, 100%)
    const percent = Math.min((step / 4) * 100, 100); 
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

// --- 2. LOAD SERVICES ---
async function loadServices() {
    const container = document.getElementById('service-list');
    
    // Skeleton Loader
    container.innerHTML = `
        <div class="animate-pulse bg-white p-5 rounded-2xl h-24 border border-gray-100 mb-3"></div>
        <div class="animate-pulse bg-white p-5 rounded-2xl h-24 border border-gray-100"></div>`;
    
    try {
        const q = query(collection(db, "Services"));
        const snapshot = await getDocs(q);
        
        container.innerHTML = ''; 

        // Fallback Mock Data
        let services = [];
        if (snapshot.empty) {
            console.log("No services in DB, using mock data.");
            services = [
                { id: "s1", specialization: "General Consultation", price: 150, duration: 30, desc: "General health check-up." },
                { id: "s2", specialization: "OB-GYN Consultation", price: 250, duration: 45, desc: "Comprehensive care for women." }
            ];
        } else {
            snapshot.forEach(doc => services.push({ id: doc.id, ...doc.data() }));
        }

        services.forEach(data => {
            const title = data.specialization || "Service";
            const price = data.price || 0;
            const time = data.duration || 30;
            const desc = data.desc || "General consultation service.";

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-2xl cursor-pointer border border-transparent hover:border-[#009688] transition-all shadow-sm mb-3 group";
            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-[#e0f2f1] flex items-center justify-center text-[#009688] shrink-0">
                        <i data-lucide="heart" class="w-6 h-6 fill-current"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold text-[#004d40] text-lg leading-tight mb-1">${title}</h3>
                        <p class="text-xs text-gray-500 leading-relaxed mb-3">${desc}</p>
                        <div class="flex items-center gap-4">
                            <span class="font-bold text-[#009688]">RM ${price}</span>
                            <div class="flex items-center gap-1 text-gray-400 text-xs">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                <span>${time} min</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                bookingData.serviceId = data.id;
                bookingData.serviceName = title;
                bookingData.price = price;
                loadDoctors();
                showStep(2);
            });
            container.appendChild(card);
        });
        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Service Load Error:", e);
        container.innerHTML = `<p class="text-red-500 text-center">Failed to load services.</p>`;
    }
}

// --- 3. LOAD DOCTORS ---
async function loadDoctors() {
    const container = document.getElementById('doctor-list');
    
    // Skeleton Loader
    container.innerHTML = `
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3"></div>
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3"></div>
    `;

    try {
        const snapshot = await getDocs(collection(db, "Doctors"));
        container.innerHTML = '';
        
        let doctors = [];
        const selectedId = String(bookingData.serviceId || "");

        if (snapshot.empty) {
            container.innerHTML = `<p class="text-center text-gray-400 py-8">No doctors found in database.</p>`;
            return;
        }

        // Filter Logic
        snapshot.forEach(doc => {
            const data = doc.data();
            const serviceStr = JSON.stringify(data.serviceId || data.serviceIds || "");
            
            if (serviceStr.includes(selectedId)) {
                doctors.push({
                    id: doc.id,
                    name: data.doctorName || data.name || "Dr. Unknown",
                    role: data.drSpecialization || data.specialization || "Specialist",
                    exp: data.yearOfExperience || data.experience || 5,
                    rating: data.rating || "5.0",
                });
            }
        });

        // Fallback for testing
        if (doctors.length === 0) {
            snapshot.forEach(doc => {
                const data = doc.data();
                doctors.push({
                    id: doc.id,
                    name: data.doctorName || "Dr. Unknown",
                    role: data.drSpecialization || "Specialist",
                    exp: data.yearOfExperience || 5,
                    rating: data.rating || "5.0",
                });
            });
        }

        doctors.forEach(data => {
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 cursor-pointer hover:border-[#009688] transition-all flex items-center gap-4 group";
            
            card.innerHTML = `
                <div class="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 shrink-0 group-hover:bg-[#e0f2f1] group-hover:text-[#009688] transition-colors">
                    <i data-lucide="user" class="w-7 h-7"></i>
                </div>
                <div class="flex-1">
                    <h3 class="font-bold text-[#004d40] text-lg leading-tight">${data.name}</h3>
                    <p class="text-xs font-bold text-[#009688] uppercase tracking-wide mb-1">${data.role}</p>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <div class="flex items-center gap-1 text-amber-500">
                            <i data-lucide="star" class="w-3 h-3 fill-current"></i>
                            <span class="font-bold">${data.rating} Rating</span>
                        </div>
                        <span>•</span>
                        <div>${data.exp} Years Exp.</div>
                    </div>
                </div>
                <i data-lucide="chevron-right" class="w-5 h-5 text-gray-300"></i>
            `;
            
            card.addEventListener('click', async () => {
                bookingData.doctorId = data.id;
                bookingData.doctorName = data.name;
                
                // --- NEW LOGIC START ---
                // Show loading text while checking schedule
                const originalContent = card.innerHTML;
                card.innerHTML = `<div class="w-full text-center text-sm text-[#009688] font-bold py-4">Checking Schedule...</div>`;
                
                await fetchDoctorSchedule(data.id);
                
                setupDate();
                showStep(3);
                // --- NEW LOGIC END ---
            });
            container.appendChild(card);
        });
        
        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Error loading doctors:", e);
        container.innerHTML = `<p class="text-center text-red-400 py-8">System Error.</p>`;
    }
}

// REPLACE THE EXISTING fetchDoctorSchedule AND setupDate FUNCTIONS WITH THESE:

// --- ROBUST HELPER: Fetch Blocked Dates ---
// --- ROBUST HELPER: Fetch Blocked Dates ---
async function fetchDoctorSchedule(doctorId) {
    doctorUnavailableDates = []; // Reset list
    console.log(`DEBUG: Fetching schedule for Doctor ID: ${doctorId}`);

    try {
        const q = query(collection(db, "TimeOff"), where("doctorId", "==", doctorId));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const rawDate = doc.data().date; // e.g., "14 January 2026"
            
            // FIX: Normalize the database date immediately!
            // This turns "14 January 2026" into "14january2026"
            const normalized = normalizeDate(rawDate); 
            
            doctorUnavailableDates.push(normalized);
        });

        console.log("DEBUG: Blocked Dates (Normalized):", doctorUnavailableDates);
    } catch (e) {
        console.error("DEBUG: Error fetching schedule:", e);
    }
}

// --- 4. DATE & TIME (TIMEZONE SAFE VERSION) ---
function setupDate() {
    const datePicker = document.getElementById('date-picker');
    const timeSlotContainer = document.getElementById('time-slots'); 
    
    // Set min date to today
    datePicker.min = new Date().toISOString().split("T")[0];
    datePicker.value = ''; // Reset on load
    timeSlotContainer.innerHTML = '<p class="text-gray-400 text-sm italic col-span-2">Select a date above to see times.</p>';

    // Remove old listeners to prevent duplicates
    const newPicker = datePicker.cloneNode(true);
    datePicker.parentNode.replaceChild(newPicker, datePicker);

    // Inside setupDate function...
newPicker.onchange = (e) => {
    const rawDate = e.target.value; 
    if (!rawDate) return;

    // ... (Your existing code to get dayNumber, monthIndex, year) ...
    const [year, month, day] = rawDate.split('-');
    const monthIndex = parseInt(month) - 1;
    const dayNumber = parseInt(day);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    // 1. Construct the pretty string
    const displayDate = `${dayNumber} ${monthNames[monthIndex]} ${year}`;
    
    // 2. Create the normalized version for checking
    const comparisonDate = normalizeDate(displayDate);

    console.log(`Checking: "${comparisonDate}" against list:`, doctorUnavailableDates);

    // 3. Compare the NORMALIZED versions
    if (doctorUnavailableDates.includes(comparisonDate)) {
        alert(`Dr. ${bookingData.doctorName} is unavailable on ${displayDate}.\nPlease choose another date.`);
        e.target.value = ''; 
        timeSlotContainer.innerHTML = '<p class="text-red-500 font-bold text-sm italic col-span-2">Date unavailable.</p>';
        return;
    }

    // If safe, proceed
    bookingData.date = rawDate; // Keep the YYYY-MM-DD for the database save
    renderTimeSlots();
};
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots');
    const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    container.innerHTML = '';
    
    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = "bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-[#009688] hover:text-white transition-all";
        btn.innerText = time;
        btn.onclick = (e) => {
             e.preventDefault(); 
    
    // Visual Highlight
    Array.from(container.children).forEach(c => c.classList.remove('bg-[#009688]', 'text-white'));
    btn.classList.add('bg-[#009688]', 'text-white');
    
    // STORE DATA & GO TO PAYMENT (Don't save to DB yet)
    bookingData.time = time;
    setTimeout(() => setupPaymentScreen(), 300); // Calls the new function
};
        container.appendChild(btn);
    });
}


// --- 6. PAYMENT LOGIC (NEW) ---
let selectedMethod = 'card';

function setupPaymentScreen() {
    // 1. Fill in the summary details
    document.getElementById('pay-service').innerText = bookingData.serviceName;
    document.getElementById('pay-doctor').innerText = bookingData.doctorName;
    document.getElementById('pay-date').innerText = `${bookingData.date} @ ${bookingData.time}`;
    document.getElementById('pay-price').innerText = `RM ${bookingData.price}`;
    
    document.getElementById('pay-btn-main').innerText = `Pay RM ${bookingData.price}`;

    // 2. Show Step 4
    showStep(4);
}

// User selects Card, FPX, or E-Wallet
window.selectPayment = (method) => {
    selectedMethod = method;
    // Reset all buttons to white
    document.querySelectorAll('.pay-btn').forEach(btn => {
        btn.className = "pay-btn flex-1 py-3 border border-gray-200 bg-white text-gray-500 rounded-xl text-sm font-bold";
    });
    // Highlight selected button to Teal
    document.getElementById(`btn-${method}`).className = "pay-btn flex-1 py-3 border border-[#009688] bg-[#e0f2f1] text-[#009688] rounded-xl text-sm font-bold shadow-sm";
};

// Final Save to Firebase
window.processPayment = async () => {
    const btn = document.getElementById('pay-btn-main');
    const originalText = btn.innerText;
    
    // Loading Animation
    btn.innerHTML = "Processing...";
    btn.disabled = true;

    // Fake delay to look like banking process
    setTimeout(async () => {
        try {
            const user = auth.currentUser;
            if (user) {
                // SAVE TO FIREBASE
                await addDoc(collection(db, "bookings"), {
                    patientId: user.uid,
                    doctorName: bookingData.doctorName,
                    doctorId: bookingData.doctorId,
                    serviceName: bookingData.serviceName,
                    price: bookingData.price,
                    date: bookingData.date,
                    time: bookingData.time,
                    
                    // New Payment Fields
                    paymentMethod: selectedMethod, // 'card', 'fpx', 'wallet'
                    paymentStatus: "Paid",
                    
                    status: "Upcoming",
                    createdAt: new Date()
                });
            }
            // Go to Success Screen (Step 5)
            showStep(5);
            
        } catch (e) {
            console.error("Booking failed", e);
            alert("Payment failed. Please try again.");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }, 1500); // 1.5 second delay
};

// --- INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        loadServices();
    }
});