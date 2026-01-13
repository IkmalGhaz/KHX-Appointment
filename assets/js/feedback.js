import { auth, db, onAuthStateChanged, collection, query, where, getDocs, addDoc, updateDoc, doc } from './firebase-config.js';

const container = document.getElementById('list-container');
const modal = document.getElementById('rating-modal');
let currentBookingId = null;
let currentRating = 0;

// 1. Auth Guard & Load
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadRateableAppointments(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// 2. Fetch Completed Appointments
async function loadRateableAppointments(uid) {
    container.innerHTML = '';
    
    try {
        // Query: My appointments that are 'Completed' AND NOT yet rated
        // Note: Firestore doesn't support != queries easily, so we filter 'isRated' in JS or check status
        const q = query(
            collection(db, "bookings"), 
            where("patientId", "==", uid),
            where("status", "==", "Completed")
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="text-center py-20 opacity-50">
                    <i data-lucide="clipboard-list" class="w-16 h-16 mx-auto mb-4 text-gray-300"></i>
                    <p class="text-gray-500 font-medium">No completed appointments to rate.</p>
                </div>`;
            if(window.lucide) window.lucide.createIcons();
            return;
        }

        let hasItems = false;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            // Optional: You can add a field 'isRated' to bookings to hide them after rating
            if (data.isRated) return; 

            hasItems = true;
            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-4 flex justify-between items-center";
            card.innerHTML = `
                <div>
                    <p class="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-md w-fit mb-1">COMPLETED</p>
                    <h3 class="font-bold text-gray-800">${data.serviceName}</h3>
                    <p class="text-xs text-gray-500">${data.date} • ${data.doctorName}</p>
                </div>
                <button onclick="openRateModal('${docSnap.id}', '${data.serviceName}')" class="bg-[#009688] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95 transition-transform">
                    Rate
                </button>
            `;
            container.appendChild(card);
        });

        if (!hasItems) {
            container.innerHTML = `<p class="text-center text-gray-400 py-10">All appointments rated!</p>`;
        }

    } catch (e) {
        console.error("Error:", e);
        container.innerHTML = `<p class="text-red-500 text-center">Failed to load history.</p>`;
    }
}

// 3. Modal Functions
window.openRateModal = (id, serviceName) => {
    currentBookingId = id;
    document.getElementById('modal-service-name').innerText = serviceName;
    renderStars(0);
    modal.classList.remove('hidden');
};

window.closeModal = () => {
    modal.classList.add('hidden');
    currentBookingId = null;
    currentRating = 0;
    document.getElementById('feedback-comment').value = "";
};

// 4. Star Logic
function renderStars(rating) {
    currentRating = rating;
    const starContainer = document.getElementById('star-container');
    starContainer.innerHTML = '';
    
    for (let i = 1; i <= 5; i++) {
        const isFill = i <= rating;
        const star = document.createElement('div');
        star.innerHTML = `<i data-lucide="star" class="w-8 h-8 cursor-pointer transition-colors ${isFill ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}"></i>`;
        star.onclick = () => renderStars(i);
        starContainer.appendChild(star);
    }
    if(window.lucide) window.lucide.createIcons();
}

// 5. Submit Logic
window.submitFeedback = async () => {
    if (currentRating === 0) {
        alert("Please select a star rating.");
        return;
    }

    const btn = document.getElementById('submit-btn');
    const comment = document.getElementById('feedback-comment').value;
    const originalText = btn.innerText;
    
    btn.innerText = "Submitting...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;
        
        // A. Add to Feedback Collection
        await addDoc(collection(db, "feedback"), {
            bookingId: currentBookingId,
            userId: user.uid,
            rating: currentRating,
            comment: comment,
            createdAt: new Date(),
            userName: user.displayName || "Patient" // Helpful for Admin display
        });

        // B. Mark Booking as Rated (so it disappears from list)
        await updateDoc(doc(db, "bookings", currentBookingId), {
            isRated: true
        });

        alert("Thank you for your feedback!");
        closeModal();
        loadRateableAppointments(user.uid);

    } catch (e) {
        console.error(e);
        alert("Error submitting feedback.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
};