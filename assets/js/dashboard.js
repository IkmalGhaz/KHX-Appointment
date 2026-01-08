import { 
    auth, 
    db, 
    signOut, 
    onAuthStateChanged, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
} from './firebase-config.js';

// DOM Elements
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const bookingForm = document.getElementById('booking-form');
const appointmentsList = document.getElementById('appointments-list');

let currentUser = null;

// 1. AUTH GUARD: Check if user is logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        // Update UI with user info
        if(userEmailSpan) userEmailSpan.innerText = user.email;
        
        // Load their data
        await loadAppointments(user.uid);
    } else {
        // Redirect to login if not logged in
        window.location.href = "index.html";
    }
});

// 2. LOGOUT FUNCTION
if(logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
        if(confirm("Are you sure you want to logout?")) {
            try {
                await signOut(auth);
                window.location.href = "index.html";
            } catch (error) {
                console.error("Logout Error:", error);
            }
        }
    });
}

// 3. BOOK APPOINTMENT
if(bookingForm) {
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Stop page refresh
        if(!currentUser) return;

        const btn = bookingForm.querySelector('button');
        const originalText = btn.innerText;

        // UI Loading State
        btn.innerText = "Booking...";
        btn.disabled = true;
        btn.classList.add('opacity-75');

        try {
            const date = document.getElementById('app-date').value;
            const time = document.getElementById('app-time').value;
            const reason = document.getElementById('app-reason').value;

            // Add to Firestore
            await addDoc(collection(db, "appointments"), {
                userId: currentUser.uid,
                userEmail: currentUser.email,
                date: date,
                time: time,
                reason: reason,
                status: "pending", 
                createdAt: new Date()
            });

            alert("Appointment Booked Successfully!");
            bookingForm.reset();
            
            // Refresh the list immediately
            await loadAppointments(currentUser.uid);

        } catch (error) {
            console.error("Error booking:", error);
            alert("Failed to book. Please try again.");
        } finally {
            // Reset Button
            btn.innerText = originalText;
            btn.disabled = false;
            btn.classList.remove('opacity-75');
        }
    });
}

// 4. LOAD APPOINTMENTS (With Tailwind Styling)
async function loadAppointments(userId) {
    if(!appointmentsList) return;
    
    appointmentsList.innerHTML = '<p class="text-center py-8 text-gray-400 text-sm">Loading records...</p>';
    
    try {
        const q = query(
            collection(db, "appointments"), 
            where("userId", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        
        appointmentsList.innerHTML = ""; // Clear loading text

        if (querySnapshot.empty) {
            appointmentsList.innerHTML = `
                <div class="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                    <p class="text-gray-400 text-sm">No upcoming appointments.</p>
                </div>`;
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Status Logic (Tailwind Colors)
            let statusBadge = "bg-yellow-100 text-yellow-700"; // Pending
            if(data.status === 'confirmed') statusBadge = "bg-green-100 text-green-700";
            if(data.status === 'cancelled') statusBadge = "bg-red-100 text-red-700";

            // Create HTML Item
            const item = document.createElement('div');
            item.className = "bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center animate-fade-in";
            item.innerHTML = `
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${statusBadge} uppercase tracking-wide">${data.status}</span>
                        <span class="text-xs text-gray-400">${data.date}</span>
                    </div>
                    <div class="font-bold text-gray-800 text-lg">${data.time}</div>
                    <div class="text-sm text-gray-500 font-medium">${data.reason}</div>
                </div>
                <div class="h-10 w-10 bg-gray-50 rounded-full flex items-center justify-center text-gray-400">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                </div>
            `;
            appointmentsList.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading data:", error);
        appointmentsList.innerHTML = "<p class='text-red-500 text-center text-sm'>Error loading appointments.</p>";
    }
}