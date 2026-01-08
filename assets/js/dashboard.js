import { auth, signOut, onAuthStateChanged, db, doc, getDoc } from './firebase-config.js';

// Check Auth & Load User Name
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "Users", user.uid));
        if (userDoc.exists()) {
            document.getElementById('welcomeMsg').innerText = `Welcome back, ${userDoc.data().fullName}`;
        }
    } else {
        window.location.href = 'index.html';
    }
});

// Logout
document.getElementById('logoutBtn').addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = 'index.html');
});

// Render Dummy Charts (Visual Only)
const ctx1 = document.getElementById('visitChart').getContext('2d');
new Chart(ctx1, {
    type: 'bar',
    data: {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        datasets: [{
            label: 'Visits',
            data: [12, 19, 3, 5, 2],
            backgroundColor: '#D32F2F'
        }]
    }
});

const ctx2 = document.getElementById('ageChart').getContext('2d');
new Chart(ctx2, {
    type: 'doughnut',
    data: {
        labels: ['Child', 'Adult', 'Senior'],
        datasets: [{
            data: [30, 50, 20],
            backgroundColor: ['#FFCDD2', '#E57373', '#B71C1C']
        }]
    }
});