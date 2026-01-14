import { db, collection, getDocs, query, where, addDoc, doc, updateDoc, auth, onAuthStateChanged } from './firebase-config.js';

const TOYYIB_SECRET_KEY = 'o504fpag-2soa-wror-wz4j-t2zw35csf6ux'; 
const TOYYIB_CATEGORY_CODE = 'vqli37z5'; 
const PROXY_URL = 'https://corsproxy.io/?'; 

// --- HELPERS ---
function parseFriendlyDateToObj(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(' '); 
    if(parts.length !== 3) return null;
    const day = parseInt(parts[0]);
    const monthName = parts[1];
    const year = parseInt(parts[2]);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(monthName);
    if (monthIndex === -1) return null;
    return new Date(year, monthIndex, day);
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
let blockedDates = []; 

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
    
    const percent = Math.min((step / 4) * 100, 100); 
    document.getElementById('progress-bar').style.width = `${percent}%`;
}

// --- 2. LOAD SERVICES ---
async function loadServices() {
    const container = document.getElementById('service-list');
    if(!container) return;
    container.innerHTML = `<div class="animate-pulse bg-white p-5 rounded-2xl h-24 border border-gray-100 mb-3"></div>`;
    
    try {
        const q = query(collection(db, "Services"));
        const snapshot = await getDocs(q);
        container.innerHTML = ''; 

        let services = [];
        if (snapshot.empty) {
            services = [
                { id: "s1", specialization: "General Consultation", price: 150, duration: 30, desc: "General check-up." },
                { id: "s2", specialization: "OB-GYN Consultation", price: 250, duration: 45, desc: "Women's health." }
            ];
        } else {
            snapshot.forEach(doc => services.push({ id: doc.id, ...doc.data() }));
        }

        services.forEach(data => {
            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-2xl cursor-pointer border border-transparent hover:border-[#009688] transition-all shadow-sm mb-3 group";
            card.innerHTML = `
                <div class="flex items-start gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-[#e0f2f1] flex items-center justify-center text-[#009688] shrink-0">
                        <i data-lucide="heart" class="w-6 h-6 fill-current"></i>
                    </div>
                    <div class="flex-1">
                        <h3 class="font-bold text-[#004d40] text-lg leading-tight mb-1">${data.specialization || "Service"}</h3>
                        <p class="text-xs text-gray-500 leading-relaxed mb-3">${data.desc || "Description"}</p>
                        <div class="flex items-center gap-4">
                            <span class="font-bold text-[#009688]">RM ${data.price}</span>
                            <div class="flex items-center gap-1 text-gray-400 text-xs">
                                <i data-lucide="clock" class="w-3 h-3"></i>
                                <span>${data.duration || 30} min</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            card.addEventListener('click', () => {
                bookingData.serviceId = data.id;
                bookingData.serviceName = data.specialization;
                bookingData.price = data.price;
                loadDoctors();
                showStep(2);
            });
            container.appendChild(card);
        });
        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-red-500 text-center">Failed to load services.</p>`;
    }
}

// --- 3. LOAD DOCTORS ---
async function loadDoctors() {
    const container = document.getElementById('doctor-list');
    if(!container) return;
    container.innerHTML = `
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3 shadow-sm"></div>
        <div class="animate-pulse bg-white p-4 rounded-2xl h-24 border border-gray-100 mb-3 shadow-sm"></div>
    `;

    try {
        const snapshot = await getDocs(collection(db, "Doctors"));
        container.innerHTML = '';
        
        let doctors = [];
        const selectedId = String(bookingData.serviceId || "");

        snapshot.forEach(doc => {
            const data = doc.data();
            const serviceStr = JSON.stringify(data.serviceId || data.serviceIds || "");
            if (serviceStr.includes(selectedId) || snapshot.size < 5) {
                doctors.push({
                    id: doc.id,
                    name: data.doctorName || data.name || "Dr. Unknown",
                    role: data.drSpecialization || "Specialist",
                    exp: data.yearOfExperience || 5,
                    rating: data.rating || "5.0",
                    image: data.image || data.profilePic || null 
                });
            }
        });

        if (doctors.length === 0) {
            container.innerHTML = `<p class="text-center text-gray-400 py-8">No doctors found.</p>`;
            return;
        }

        doctors.forEach(data => {
            const card = document.createElement('div');
            card.className = "relative bg-white p-4 rounded-2xl border border-gray-100 shadow-sm mb-3 cursor-pointer hover:border-[#009688] hover:shadow-md transition-all flex items-center gap-4 group overflow-hidden";
            
            let profileHtml;
            if (data.image) {
                profileHtml = `<img src="${data.image}" class="w-14 h-14 rounded-full object-cover border border-gray-200 shrink-0" alt="${data.name}">`;
            } else {
                profileHtml = `
                <div class="w-14 h-14 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 shrink-0 group-hover:bg-[#e0f2f1] group-hover:text-[#009688] transition-colors">
                    <i data-lucide="user" class="w-7 h-7"></i>
                </div>`;
            }

            card.innerHTML = `
                ${profileHtml}  <div class="flex-1">
                    <h3 class="font-bold text-[#004d40] text-lg leading-tight">${data.name}</h3>
                    <p class="text-xs font-bold text-[#009688] uppercase tracking-wide mb-1">${data.role}</p>
                    <div class="flex items-center gap-3 text-xs text-gray-400">
                        <div class="flex items-center gap-1 text-amber-500">
                            <i data-lucide="star" class="w-3 h-3 fill-current"></i>
                            <span class="font-bold">${data.rating}</span>
                        </div>
                        <span>•</span>
                        <div>${data.exp} Years Exp.</div>
                    </div>
                </div>
                <div class="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-[#009688] group-hover:text-white transition-all">
                    <i data-lucide="chevron-right" class="w-5 h-5"></i>
                </div>
            `;
            
            card.addEventListener('click', async () => {
                bookingData.doctorId = data.id;
                bookingData.doctorName = data.name;
                await fetchDoctorSchedule(data.id);
                initFlatpickr(); 
                showStep(3);
            });
            container.appendChild(card);
        });
        
        if(window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-center text-red-400 py-8">System Error.</p>`;
    }
}

// --- 4. FETCH BLOCKED DATES ---
async function fetchDoctorSchedule(doctorId) {
    blockedDates = []; 
    try {
        const q = query(collection(db, "TimeOff"), where("doctorId", "==", doctorId));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
            const rawDate = doc.data().date; 
            const dateObj = parseFriendlyDateToObj(rawDate);
            if(dateObj) {
                blockedDates.push(dateObj);
            }
        });
    } catch (e) {
        console.error("Error fetching schedule:", e);
    }
}

// --- 5. INITIALIZE FLATPICKR ---
function initFlatpickr() {
    const timeSlotContainer = document.getElementById('time-slots');
    if(timeSlotContainer) timeSlotContainer.innerHTML = '<p class="text-gray-400 text-sm italic col-span-2">Select a date above to see times.</p>';

    const input = document.getElementById('date-picker');
    if(!input) return;

    if (input._flatpickr) {
        input._flatpickr.destroy();
    }

    flatpickr("#date-picker", {
        minDate: "today",
        maxDate: new Date().fp_incr(90), 
        disable: blockedDates, 
        dateFormat: "d F Y",   
        disableMobile: "true", 
        defaultDate: bookingData.date, 
        locale: { firstDayOfWeek: 1 },
        
        onChange: function(selectedDates, dateStr, instance) {
            bookingData.date = dateStr; 
            renderTimeSlots();
            input.classList.add('border-[#009688]', 'ring-1', 'ring-[#009688]');
        }
    });
}

function renderTimeSlots() {
    const container = document.getElementById('time-slots');
    if(!container) return;
    const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
    container.innerHTML = '';
    
    const now = new Date();
    const currentHour = now.getHours();
    const selectedDate = new Date(bookingData.date);
    
    const isToday = selectedDate.getDate() === now.getDate() &&
                    selectedDate.getMonth() === now.getMonth() &&
                    selectedDate.getFullYear() === now.getFullYear();

    slots.forEach(time => {
        const btn = document.createElement('button');
        btn.type = 'button';
        const slotHour = parseInt(time.substring(0, 2));
        let isExpired = isToday && (slotHour <= currentHour);

        if (isExpired) {
            btn.className = "bg-gray-50 border border-gray-100 text-gray-300 py-3 rounded-xl font-bold cursor-not-allowed";
            btn.innerText = time;
            btn.disabled = true;
        } else {
            btn.className = "bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-[#009688] hover:text-white transition-all shadow-sm";
            btn.innerText = time;
            
            btn.onclick = (e) => {
                e.preventDefault(); 
                Array.from(container.children).forEach(c => {
                    if (!c.disabled) {
                         c.className = "bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold hover:bg-[#009688] hover:text-white transition-all shadow-sm";
                    }
                });
                btn.className = "bg-[#009688] border border-[#009688] text-white py-3 rounded-xl font-bold shadow-md transform scale-105 transition-all";
                
                bookingData.time = time;
                setTimeout(() => setupPaymentScreen(), 200); 
            };
        }
        container.appendChild(btn);
    });
}

// --- 6. PAYMENT LOGIC ---
let selectedMethod = 'card';

function setupPaymentScreen() {
    document.getElementById('pay-service').innerText = bookingData.serviceName;
    document.getElementById('pay-doctor').innerText = bookingData.doctorName;
    document.getElementById('pay-date').innerText = `${bookingData.date} @ ${bookingData.time}`;
    document.getElementById('pay-price').innerText = `RM ${bookingData.price}`;
    document.getElementById('pay-btn-main').innerText = `Pay RM ${bookingData.price}`;
    showStep(4);
}

window.selectPayment = (method) => {
    selectedMethod = method;
    document.querySelectorAll('.pay-btn').forEach(btn => {
        btn.className = "pay-btn flex-1 py-3 border border-gray-200 bg-white text-gray-500 rounded-xl text-sm font-bold";
    });
    document.getElementById(`btn-${method}`).className = "pay-btn flex-1 py-3 border border-[#009688] bg-[#e0f2f1] text-[#009688] rounded-xl text-sm font-bold shadow-sm";
};

window.processPayment = async () => {
    const btn = document.getElementById('pay-btn-main');
    const originalText = btn.innerText;
    
    if (!auth.currentUser) return alert("Please login first.");

    btn.innerHTML = "Processing...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        
        const docRef = await addDoc(collection(db, "bookings"), {
            patientId: user.uid,
            doctorName: bookingData.doctorName,
            doctorId: bookingData.doctorId,
            serviceName: bookingData.serviceName,
            price: bookingData.price,
            date: bookingData.date, 
            time: bookingData.time,
            paymentMethod: selectedMethod,
            paymentStatus: "Pending",
            status: "Pending Approval",
            createdAt: new Date()
        });
        
        const bookingId = docRef.id;

        if (selectedMethod === 'fpx') {
            await initiateToyyibPay(bookingId, bookingData.price, user);
        } else {
            await updateDoc(doc(db, "bookings", bookingId), {
                paymentStatus: "Paid",
                status: "Upcoming"
            });
            showStep(5);
        }

    } catch (e) {
        console.error("Booking failed", e);
        alert("Error: " + e.message);
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

async function initiateToyyibPay(bookingId, price, user) {
    const amountInCents = Math.round(parseFloat(price) * 100);
    const returnUrl = `${window.location.origin}${window.location.pathname}?status=success&booking_id=${bookingId}`;

    let safeBillName = `Appt: ${bookingData.serviceName}`; 
    if (safeBillName.length > 30) safeBillName = safeBillName.substring(0, 30);

    let safeBillDesc = `Dr. ${bookingData.doctorName} on ${bookingData.date}`;
    if (safeBillDesc.length > 100) safeBillDesc = safeBillDesc.substring(0, 100);

    const params = new URLSearchParams();
    params.append('userSecretKey', TOYYIB_SECRET_KEY);
    params.append('categoryCode', TOYYIB_CATEGORY_CODE);
    params.append('billName', safeBillName);
    params.append('billDescription', safeBillDesc);
    params.append('billPriceSetting', 1);
    params.append('billPayorInfo', 1);
    params.append('billAmount', amountInCents);
    params.append('billReturnUrl', returnUrl);
    params.append('billCallbackUrl', 'https://reqres.in/api/users'); 
    params.append('billExternalReferenceNo', bookingId);
    params.append('billTo', user.displayName || 'Patient');
    params.append('billEmail', user.email);
    params.append('billPhone', '0123456789');

    try {
        const targetUrl = 'https://dev.toyyibpay.com/index.php/api/createBill';
        const response = await fetch(PROXY_URL + encodeURIComponent(targetUrl), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        const data = await response.json();

        if (data && data[0] && data[0].BillCode) {
            const billCode = data[0].BillCode;
            await updateDoc(doc(db, "bookings", bookingId), { billCode: billCode });
            window.location.href = `https://dev.toyyibpay.com/${billCode}`;
        } else {
            alert("Payment Gateway Error. Please try again.");
            resetPayButton();
        }
    } catch (error) {
        console.error("Payment Error:", error);
        alert("Could not connect to payment gateway.");
        resetPayButton();
    }
}

function resetPayButton() {
    const btn = document.getElementById('pay-btn-main');
    btn.disabled = false;
    btn.innerText = "Try Again";
}

async function checkPaymentReturn() {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    const bookingId = urlParams.get('booking_id');
    const billCode = urlParams.get('billcode');

    if (status === 'success' && bookingId) {
        document.body.innerHTML = `
            <div style="display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;gap:20px;font-family:sans-serif;">
                <div class="loader"></div>
                <h2 style="color:#004d40">Verifying Payment...</h2>
            </div>`;
        
        try {
            const bookingRef = doc(db, "bookings", bookingId);
            await updateDoc(bookingRef, {
                paymentStatus: "Paid",
                status: "Upcoming",
                billCode: billCode || 'unknown'
            });
            localStorage.setItem('paymentSuccess', 'true');
            window.history.replaceState({}, document.title, window.location.pathname);
            window.location.reload(); 
        } catch (error) {
            console.error("Update Error:", error);
            alert("Payment recorded, but status update failed.");
            window.location.href = 'dashboard.html';
        }
    }
}

// --- NEW FUNCTION: CHECK REBOOKING URL PARAMS ---
async function checkRebookParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('rebook') === 'true') {
        // 1. Populate Data
        bookingData.serviceName = urlParams.get('serviceName');
        bookingData.price = urlParams.get('price');
        bookingData.doctorId = urlParams.get('doctorId');
        bookingData.doctorName = urlParams.get('doctorName');

        // 2. Fetch Schedule for this doctor
        await fetchDoctorSchedule(bookingData.doctorId);

        // 3. Init Calendar
        initFlatpickr();

        // 4. Jump to Step 3
        showStep(3);
    }
}

// --- INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else {
        if (localStorage.getItem('paymentSuccess') === 'true') {
            localStorage.removeItem('paymentSuccess');
            loadServices().then(() => showStep(5));
        } else {
            checkPaymentReturn();
            loadServices();
            // Call rebook check
            checkRebookParams();
        }
    }
});