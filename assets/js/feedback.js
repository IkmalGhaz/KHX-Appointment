import { auth, db, onAuthStateChanged, collection, query, where, getDocs, addDoc, updateDoc, doc } from './firebase-config.js';

const container = document.getElementById('list-container');
const modal = document.getElementById('rating-modal');
let currentBookingId = null;
let currentRating = 0;

// 1. Auth Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        loadRateableAppointments(user.uid);
    } else {
        window.location.href = "index.html";
    }
});

// 2. Fetch Logic (Modified to handle past dates automatically)
async function loadRateableAppointments(uid) {
    container.innerHTML = '<div class="text-center py-10"><div class="animate-spin inline-block w-6 h-6 border-2 border-[#009688] border-t-transparent rounded-full"></div></div>';

    try {
        const q = query(collection(db, "bookings"), where("patientId", "==", uid));
        const snapshot = await getDocs(q);
        container.innerHTML = '';

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let hasItems = false;

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const aptDate = parseFriendlyDateToObj(data.date);
            const isPastDate = aptDate && aptDate < todayStart;
            const isCompleted = data.status === "Completed";

            // Only show if not rated yet and is either manually completed or date has passed
            if (!data.isRated && (isCompleted || isPastDate) && data.status !== "Cancelled") {
                hasItems = true;
                const card = document.createElement('div');
                card.className = "bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-4 flex justify-between items-center";
                card.innerHTML = `
                    <div>
                        <p class="text-[10px] font-bold text-[#009688] bg-teal-50 px-2 py-0.5 rounded-md w-fit mb-1 uppercase">Past Visit</p>
                        <h3 class="font-bold text-gray-800">${data.serviceName || 'Consultation'}</h3>
                        <p class="text-xs text-gray-500">${data.date} • ${data.doctorName}</p>
                    </div>
                    <button onclick="openRateModal('${docSnap.id}', '${data.serviceName}')" class="bg-[#009688] text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all">
                        Rate Now
                    </button>
                `;
                container.appendChild(card);
            }
        });

        if (!hasItems) {
            container.innerHTML = `<div class="text-center py-20 opacity-50"><p class="text-gray-500 font-medium">All past visits have been rated!</p></div>`;
        }
        if (window.lucide) window.lucide.createIcons();
    } catch (e) {
        console.error(e);
        container.innerHTML = `<p class="text-red-500 text-center py-10">Failed to load history.</p>`;
    }
}

// 3. Modal & Star Logic
window.openRateModal = (id, serviceName) => {
    currentBookingId = id;
    document.getElementById('modal-service-name').innerText = serviceName;
    currentRating = 0;
    renderStars(0);
    modal.classList.remove('hidden');
};

window.closeModal = () => {
    modal.classList.add('hidden');
    document.getElementById('feedback-comment').value = "";
};

function renderStars(rating) {
    currentRating = rating;
    const starContainer = document.getElementById('star-container');
    starContainer.innerHTML = '';

    for (let i = 1; i <= 5; i++) {
        const isFill = i <= rating;
        const star = document.createElement('div');
        // Custom interactive stars
        star.innerHTML = `<i data-lucide="star" class="w-8 h-8 cursor-pointer transition-all ${isFill ? 'fill-amber-400 text-amber-400 scale-110' : 'text-gray-200'}"></i>`;
        star.onclick = () => renderStars(i);
        starContainer.appendChild(star);
    }
    if (window.lucide) window.lucide.createIcons();
}

// 4. Submit to Firestore
window.submitFeedback = async () => {
    if (currentRating === 0) return alert("Please select a star rating.");

    const btn = document.getElementById('submit-btn');
    const comment = document.getElementById('feedback-comment').value.trim();

    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const user = auth.currentUser;

        // Push to feedback collection
        await addDoc(collection(db, "feedback"), {
            bookingId: currentBookingId,
            patientId: user.uid,
            rating: currentRating,
            comment: comment || "No comment provided",
            createdAt: new Date()
        });

        // Update booking status
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
        btn.innerText = "Confirm";
        btn.disabled = false;
    }
};

// Date Parser Helper
function parseFriendlyDateToObj(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(' ');
    const day = parseInt(parts[0]);
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const monthIndex = monthNames.indexOf(parts[1]);
    return new Date(parseInt(parts[2]), monthIndex, day);
}