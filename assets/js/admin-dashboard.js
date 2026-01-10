import { auth, db, onAuthStateChanged, signOut, collection, getDocs, doc, getDoc } from './firebase-config.js';

onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Load Profile Name
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        if (userDoc.exists()) {
            document.getElementById('admin-name').innerText = userDoc.data().fullName || "Admin";
        }
        // Load Real-time Stats
        await fetchStats();
    } else {
        window.location.href = "index.html";
    }
});

async function fetchStats() {
    try {
        const usersRef = collection(db, "Users");
        const snapshot = await getDocs(usersRef);
        
        let patientCount = 0;
        let pendingCount = 0;

        snapshot.forEach((doc) => {
            const data = doc.data();
            // Count Patients (matching Android logic)
            if (data.role && data.role.toLowerCase() === "patient") {
                patientCount++;
            }
            // Count Pending Approvals
            if (data.status && data.status.toLowerCase() === "pending") {
                pendingCount++;
            }
        });

        document.getElementById('total-patients').innerText = patientCount;
        document.getElementById('pending-approvals').innerText = pendingCount;
    } catch (error) {
        console.error("Stat fetch error:", error);
    }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
    if(confirm("Logout from Admin Panel?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
});