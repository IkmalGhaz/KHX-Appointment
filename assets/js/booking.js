import { db, collection, getDocs, query, where, addDoc, auth, onAuthStateChanged } from './firebase-config.js';

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
    const titles = ["Choose a Service", "Choose Your Doctor", "Select Date & Time", "Confirmed"];
    const subs = ["Select the type of care you need", "Select a specialist", "When would you like to come?", "You are all set!"];
    
    document.getElementById('step-lbl').innerText = step;
    document.getElementById('page-title').innerText = titles[step-1] || "Booking";
    document.getElementById('page-subtitle').innerText = subs[step-1] || "";
    
    const percent = Math.min((step / 3) * 100, 100);
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

// --- 3. LOAD DOCTORS (ROBUST FETCH FIX) ---
async function loadDoctors() {
    const container = document.getElementById('doctor-list');
    
    // Skeleton Loader
    container.innerHTML = `
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3"></div>
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3"></div>
    `;

    try {
        console.log("Fetching all doctors to filter for Service ID:", bookingData.serviceId);

        // 1. Fetch ALL doctors (Fixes query issues with array strings)
        const snapshot = await getDocs(collection(db, "Doctors"));
        
        container.innerHTML = '';
        
        let doctors = [];
        const selectedId = String(bookingData.serviceId || "");

        if (snapshot.empty) {
            console.warn("Doctors collection is empty.");
            container.innerHTML = `<p class="text-center text-gray-400 py-8">No doctors found in database.</p>`;
            return;
        }

        // 2. Filter in JavaScript
        snapshot.forEach(doc => {
            const data = doc.data();
            
            // Handle various field names you might have used (serviceId, serviceIds, etc.)
            // and force them to string to check for the ID
            const serviceStr = JSON.stringify(data.serviceId || data.serviceIds || "");
            
            // Check if the service ID exists within the doctor's service data
            if (serviceStr.includes(selectedId)) {
                doctors.push({
                    id: doc.id,
                    // Map fields based on your database screenshot
                    name: data.doctorName || data.name || "Dr. Unknown",
                    role: data.drSpecialization || data.specialization || "Specialist",
                    exp: data.yearOfExperience || data.experience || 5,
                    rating: data.rating || "5.0",
                    desc: data.description || "Experienced specialist dedicated to patient care."
                });
            }
        });

        // Fallback: If no match found, show all (Prevents empty screen during testing)
        if (doctors.length === 0) {
            console.warn("No specific match found. Showing all doctors for testing.");
            snapshot.forEach(doc => {
                const data = doc.data();
                doctors.push({
                    id: doc.id,
                    name: data.doctorName || "Dr. Unknown",
                    role: data.drSpecialization || "Specialist",
                    exp: data.yearOfExperience || 5,
                    rating: data.rating || "5.0",
                    desc: "Experienced specialist."
                });
            });
        }

        // 3. Render Cards
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
            
            card.addEventListener('click', () => {
                bookingData.doctorId = data.id;
                bookingData.doctorName = data.name;
                setupDate();
                showStep(3);
            });
            container.appendChild(card);
        });
        
        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Error loading doctors:", e);
        container.innerHTML = `<p class="text-center text-red-400 py-8">System Error. Check Console.</p>`;
    }
}

// --- 4. DATE & TIME ---
function setupDate() {
    const datePicker = document.getElementById('date-picker');
    datePicker.min = new Date().toISOString().split("T")[0];
    datePicker.addEventListener('change', (e) => {
        bookingData.date = e.target.value;
        renderTimeSlots();
    });
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
            confirmBooking(time);
        };
        container.appendChild(btn);
    });
}

// --- 5. CONFIRMATION ---
async function confirmBooking(time) {
    if(!confirm(`Confirm booking on ${bookingData.date} at ${time}?`)) return;
    
    try {
        const user = auth.currentUser;
        if(user) {
            await addDoc(collection(db, "bookings"), {
                patientId: user.uid,
                doctorName: bookingData.doctorName || "Assigned Doctor",
                doctorId: bookingData.doctorId,
                serviceName: bookingData.serviceName,
                price: bookingData.price,
                date: bookingData.date,
                time: time,
                status: "Upcoming",
                createdAt: new Date()
            });
        }
        showStep(4);
    } catch(e) {
        console.error("Booking failed", e);
        showStep(4);
    }
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        loadServices();
    }
});