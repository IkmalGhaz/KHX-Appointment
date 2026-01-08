// Import necessary tools from your existing auth.js
import { 
    auth, 
    db, 
    onAuthStateChanged, 
    signOut, 
    collection, 
    addDoc, 
    query, 
    where, 
    getDocs 
} from './auth.js';

// DOM Elements
const userEmailSpan = document.getElementById('user-email');
const logoutBtn = document.getElementById('logout-btn');
const bookingForm = document.getElementById('booking-form');
const appointmentsList = document.getElementById('appointments-list');

let currentUser = null;

// 1. AUTH GUARD: Check if user is logged in
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // User is logged in
        currentUser = user;
        userEmailSpan.innerText = user.email;
        console.log("User ID:", user.uid);
        
        // Load their data
        await loadAppointments(user.uid);
    } else {
        // User is NOT logged in, kick them back to login page
        window.location.href = "index.html";
    }
});

// 2. LOGOUT FUNCTION
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        alert("Logged out successfully");
        window.location.href = "index.html";
    } catch (error) {
        console.error("Logout Error:", error);
    }
});

// 3. BOOK APPOINTMENT (Save to Firestore)
bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Stop page refresh

    const date = document.getElementById('app-date').value;
    const time = document.getElementById('app-time').value;
    const reason = document.getElementById('app-reason').value;

    if(!currentUser) return;

    try {
        const btn = bookingForm.querySelector('button');
        btn.innerText = "Booking...";
        btn.disabled = true;

        // Add document to "appointments" collection
        await addDoc(collection(db, "appointments"), {
            userId: currentUser.uid,      // Link appt to specific user
            userEmail: currentUser.email, // Store email for reference
            date: date,
            time: time,
            reason: reason,
            status: "pending",            // Default status
            createdAt: new Date()
        });

        alert("Appointment Booked Successfully!");
        bookingForm.reset();
        
        // Refresh the list
        await loadAppointments(currentUser.uid);

    } catch (error) {
        console.error("Error booking:", error);
        alert("Failed to book. See console for details.");
    } finally {
        const btn = bookingForm.querySelector('button');
        btn.innerText = "Confirm Booking";
        btn.disabled = false;
    }
});

// 4. LOAD APPOINTMENTS (Read from Firestore)
async function loadAppointments(userId) {
    appointmentsList.innerHTML = '<p style="color:#777">Checking records...</p>';
    
    try {
        // Create a query against the collection
        const q = query(
            collection(db, "appointments"), 
            where("userId", "==", userId)
        );

        const querySnapshot = await getDocs(q);
        
        appointmentsList.innerHTML = ""; // Clear loading text

        if (querySnapshot.empty) {
            appointmentsList.innerHTML = "<p>No upcoming appointments found.</p>";
            return;
        }

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Create HTML for each item
            const item = document.createElement('div');
            item.className = 'appointment-item';
            item.innerHTML = `
                <div>
                    <div class="app-date">${data.date} at ${data.time}</div>
                    <div style="font-size: 0.9rem; color: #555;">${data.reason}</div>
                </div>
                <span class="app-status status-${data.status}">${data.status}</span>
            `;
            appointmentsList.appendChild(item);
        });

    } catch (error) {
        console.error("Error loading data:", error);
        appointmentsList.innerHTML = "<p style='color:red'>Error loading appointments.</p>";
    }
}