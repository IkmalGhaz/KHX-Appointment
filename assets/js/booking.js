import { db, collection, getDocs, query, where, addDoc, auth } from './firebase-config.js';

let currentStep = 1;
let bookingData = { serviceId: null, doctorId: null, date: null, time: null };

// --- DOM ELEMENTS ---
const steps = [1, 2, 3, 4].map(num => document.getElementById(`step-${num}`));
const indicators = [1, 2, 3, 4].map(num => document.getElementById(`ind-${num}`));

// --- NAVIGATION ---
function showStep(step) {
    steps.forEach((el, idx) => el.classList.toggle('hidden', idx + 1 !== step));
    indicators.forEach((el, idx) => el.classList.toggle('active', idx + 1 <= step));
    currentStep = step;
}

document.addEventListener('prevStep', (e) => showStep(e.detail));

// --- STEP 1: LOAD SERVICES ---
async function loadServices() {
    const q = query(collection(db, "Services"));
    const snapshot = await getDocs(q);
    const container = document.getElementById('service-list');
    
    // Fallback Mock Data if DB empty
    if(snapshot.empty) {
        container.innerHTML = `<div class="selection-card" data-id="s1"><h3>General Checkup</h3><p>RM 50</p></div>`;
        addClickListeners('service-list', 'serviceId', 2, loadDoctors);
        return;
    }

    container.innerHTML = '';
    snapshot.forEach(doc => {
        const data = doc.data();
        container.innerHTML += `
            <div class="selection-card" data-id="${doc.id}">
                <h3>${data.specialization}</h3>
                <p>RM ${data.price} • ${data.duration} mins</p>
            </div>`;
    });
    addClickListeners('service-list', 'serviceId', 2, loadDoctors);
}

// --- STEP 2: LOAD DOCTORS ---
async function loadDoctors() {
    const q = query(collection(db, "Doctors"), where("serviceIds", "array-contains", bookingData.serviceId));
    const snapshot = await getDocs(q);
    const container = document.getElementById('doctor-list');
    
    container.innerHTML = '';
    if (snapshot.empty) {
        container.innerHTML = '<p>No doctors available for this service.</p>';
        return;
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        container.innerHTML += `
            <div class="selection-card" data-id="${doc.id}">
                <h3>${data.doctorName}</h3>
                <p>Rating: ${data.rating} ⭐</p>
            </div>`;
    });
    addClickListeners('doctor-list', 'doctorId', 3, setupDate);
}

// --- STEP 3: DATE & TIME ---
function setupDate() {
    const datePicker = document.getElementById('date-picker');
    // Set min date to today
    datePicker.min = new Date().toISOString().split("T")[0];
    
    datePicker.addEventListener('change', (e) => {
        bookingData.date = e.target.value;
        renderTimeSlots();
    });
}

function renderTimeSlots() {
    const slots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']; // Static for demo
    const container = document.getElementById('time-slots');
    container.innerHTML = '';
    
    slots.forEach(time => {
        const div = document.createElement('div');
        div.className = 'time-slot';
        div.innerText = time;
        div.onclick = () => confirmBooking(time);
        container.appendChild(div);
    });
}

// --- STEP 4: SAVE & CONFIRM ---
async function confirmBooking(time) {
    bookingData.time = time;
    
    // Visual feedback
    if(!confirm(`Confirm booking on ${bookingData.date} at ${bookingData.time}?`)) return;

    try {
        const user = auth.currentUser;
        if (!user) { alert("Please login"); window.location.href = "index.html"; return; }

        await addDoc(collection(db, "Appointments"), {
            uid: user.uid,
            doctorId: bookingData.doctorId,
            serviceId: bookingData.serviceId,
            date: bookingData.date,
            time: bookingData.time,
            status: "Active",
            createdAt: new Date()
        });

        showStep(4);
    } catch (e) {
        console.error(e);
        alert("Booking failed");
    }
}

// Helper for card selection logic
function addClickListeners(containerId, dataKey, nextStepNum, nextCallback) {
    document.querySelectorAll(`#${containerId} .selection-card`).forEach(card => {
        card.addEventListener('click', () => {
            // Remove active class from others
            document.querySelectorAll(`#${containerId} .selection-card`).forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            // Set data and move next
            bookingData[dataKey] = card.dataset.id;
            if(nextCallback) nextCallback();
            showStep(nextStepNum);
        });
    });
}

// Init
auth.onAuthStateChanged(user => {
    if(user) loadServices();
    else window.location.href = "index.html";
});