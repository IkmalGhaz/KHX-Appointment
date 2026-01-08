import { db, collection, getDocs, query, where, addDoc, auth } from './firebase-config.js';

let currentStep = 1;
let bookingData = { 
    serviceId: null, 
    serviceName: null,
    price: null,
    doctorId: null, 
    doctorName: null, 
    doctorRefId: null, 
    date: null, 
    time: null 
};

// --- DOM ELEMENTS ---
const steps = [1, 2, 3, 4].map(num => document.getElementById(`step-${num}`));
const indicators = [1, 2, 3, 4].map(num => document.getElementById(`ind-${num}`));
const progressLine = document.getElementById('progress-line');

// --- NAVIGATION ---
function showStep(step) {
    steps.forEach((el, idx) => el.classList.toggle('hidden', idx + 1 !== step));
    
    indicators.forEach((el, idx) => {
        if (idx + 1 <= step) {
            el.className = "w-10 h-10 rounded-full bg-blue-600 border-4 border-slate-950 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/50 transition-all";
        } else {
            el.className = "w-10 h-10 rounded-full bg-slate-800 border-4 border-slate-950 flex items-center justify-center font-bold text-slate-500 transition-all";
        }
    });

    if(progressLine) progressLine.style.width = `${((step - 1) / 3) * 100}%`;
    currentStep = step;
    if(window.lucide) window.lucide.createIcons();
}

document.addEventListener('prevStep', (e) => showStep(e.detail));

// --- STEP 1: LOAD SERVICES ---
async function loadServices() {
    const container = document.getElementById('service-list');
    
    // Skeleton Loader
    container.innerHTML = `
        <div class="col-span-2 space-y-4">
            <div class="animate-pulse h-24 bg-slate-800 rounded-xl"></div>
            <div class="animate-pulse h-24 bg-slate-800 rounded-xl"></div>
        </div>`;
    
    try {
        const q = query(collection(db, "Services"));
        const snapshot = await getDocs(q);

        container.innerHTML = '';
        
        if(snapshot.empty) {
            container.innerHTML = `<p class="text-slate-400 col-span-2 text-center">No services available.</p>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Handle ID mismatch (ServiceId vs ServiceIds vs Doc ID)
            const linkId = data.serviceId || data.serviceIds || docSnap.id; 
            
            const title = data.specialization || "Medical Service";
            const price = data.price || 0;
            const time = data.duration || "30 min";

            container.innerHTML += `
            <div class="selection-card cursor-pointer group relative overflow-hidden bg-slate-950 border border-slate-800 hover:border-blue-500 rounded-xl p-5 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10" 
                 data-id="${linkId}" 
                 data-name="${title}" 
                 data-price="${price}">
                
                <div class="flex justify-between items-start mb-3">
                    <div class="p-2 bg-slate-900 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors text-blue-500">
                        <i data-lucide="stethoscope" class="w-6 h-6"></i>
                    </div>
                    <span class="text-sm font-semibold text-slate-400 bg-slate-900 px-2 py-1 rounded-md border border-slate-800">RM ${price}</span>
                </div>
                
                <h3 class="font-bold text-lg text-white mb-1 pointer-events-none">${title}</h3>
                <p class="text-xs text-slate-500 pointer-events-none">${time} consultation</p>
            </div>`;
        });
        
        // Attach Listeners
        document.querySelectorAll('#service-list .selection-card').forEach(card => {
            card.addEventListener('click', () => {
                bookingData.serviceId = card.dataset.id;
                bookingData.serviceName = card.dataset.name;
                bookingData.price = parseFloat(card.dataset.price);
                loadDoctors();
                showStep(2);
            });
        });

        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Error loading services:", e);
        container.innerHTML = `<p class="text-red-400 col-span-2 text-center">Unable to load services.</p>`;
    }
}

// --- STEP 2: LOAD DOCTORS ---
async function loadDoctors() {
    const container = document.getElementById('doctor-list');
    container.innerHTML = '<p class="text-slate-400 animate-pulse">Searching for specialists...</p>';

    try {
        // Query Doctors who have the selected service ID
        const q = query(
            collection(db, "Doctors"), 
            where("serviceIds", "array-contains", bookingData.serviceId)
        );
        
        const snapshot = await getDocs(q);
        container.innerHTML = '';
        
        if (snapshot.empty) {
            container.innerHTML = `
                <div class="col-span-2 text-center py-8 bg-slate-900/50 rounded-xl border border-dashed border-slate-700">
                    <p class="text-slate-400">No specialists available for this service.</p>
                </div>`;
            return;
        }

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const internalDocId = data.doctorId || docSnap.id;

            container.innerHTML += `
            <div class="selection-card cursor-pointer group flex items-center gap-4 bg-slate-950 border border-slate-800 hover:border-blue-500 rounded-xl p-4 transition-all hover:shadow-lg hover:shadow-blue-500/10" 
                 data-id="${docSnap.id}" 
                 data-ref="${internalDocId}"
                 data-name="${data.doctorName}">
                <div class="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <i data-lucide="user-round" class="w-6 h-6"></i>
                </div>
                <div>
                    <h3 class="font-bold text-white group-hover:text-blue-400 transition-colors pointer-events-none">${data.doctorName}</h3>
                    <div class="flex items-center gap-1 text-xs text-yellow-500 pointer-events-none">
                        <i data-lucide="star" class="w-3 h-3 fill-current"></i>
                        <span>${data.rating || '5.0'} Rating</span>
                    </div>
                </div>
            </div>`;
        });
        
        document.querySelectorAll('#doctor-list .selection-card').forEach(card => {
            card.addEventListener('click', () => {
                bookingData.doctorId = card.dataset.id; 
                bookingData.doctorRefId = card.dataset.ref; 
                bookingData.doctorName = card.dataset.name;
                setupDate();
                showStep(3);
            });
        });
        if(window.lucide) window.lucide.createIcons();

    } catch (e) {
        console.error("Error loading doctors:", e);
        container.innerHTML = '<p class="text-red-400">Unable to load doctors.</p>';
    }
}

// --- STEP 3: DATE & TIME ---
function setupDate() {
    const datePicker = document.getElementById('date-picker');
    datePicker.min = new Date().toISOString().split("T")[0];
    
    datePicker.addEventListener('change', (e) => {
        bookingData.date = e.target.value; 
        renderTimeSlots();
    });
}

function renderTimeSlots() {
    const slots = ['09:00am', '10:00am', '11:00am', '02:00pm', '03:00pm', '04:00pm'];
    const container = document.getElementById('time-slots');
    container.innerHTML = '';
    
    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white transition-all font-medium text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none';
        btn.innerHTML = `<span class="flex items-center justify-center gap-2 pointer-events-none"><i data-lucide="clock" class="w-4 h-4"></i> ${time}</span>`;
        btn.onclick = () => confirmBooking(time);
        container.appendChild(btn);
    });
    if(window.lucide) window.lucide.createIcons();
}

// --- STEP 4: SAVE TO FIREBASE ---
async function confirmBooking(time) {
    bookingData.time = time;
    const user = auth.currentUser;
    
    if (!user) { 
        alert("Please login to confirm your appointment."); 
        // window.location.href = "login.html"; // Uncomment to redirect
        return; 
    }

    if(!confirm(`Confirm booking with ${bookingData.doctorName} on ${bookingData.date} at ${bookingData.time}?`)) return;

    // UI Loading state
    const container = document.getElementById('time-slots');
    container.classList.add('opacity-50', 'pointer-events-none');

    try {
        let patientName = "Guest"; 
        try { if(user.displayName) patientName = user.displayName; } catch(err) {}

        const payload = {
            cancellationReason: "",
            date: bookingData.date,
            doctorId: bookingData.doctorRefId, 
            doctorName: bookingData.doctorName,
            isCancelled: false,
            patientName: patientName,
            patientId: user.uid,
            price: bookingData.price,
            serviceId: bookingData.serviceId, 
            serviceName: bookingData.serviceName,
            status: "Upcoming",
            time: bookingData.time,
            timestamp: new Date()
        };

        await addDoc(collection(db, "bookings"), payload);
        showStep(4);

    } catch (e) {
        console.error("Booking Error:", e);
        alert("Failed to save booking. Please try again.");
        container.classList.remove('opacity-50', 'pointer-events-none');
    }
}

// --- INIT ---
// Start by loading services
loadServices();
showStep(1);