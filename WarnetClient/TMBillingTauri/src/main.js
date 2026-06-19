// TMBilling Frontend Logic
document.addEventListener('DOMContentLoaded', () => {
    const loginBtn = document.getElementById('login-btn');
    const shutdownEl = document.getElementById('shutdown-time');
    const loadingText = document.getElementById('loading-text');

    // 1. Simple Countdown Simulation
    let minutesLeft = 15;
    let secondsLeft = 0;

    const updateTimer = () => {
        if (minutesLeft <= 0 && secondsLeft <= 0) return;

        if (secondsLeft === 0) {
            minutesLeft--;
            secondsLeft = 59;
        } else {
            secondsLeft--;
        }

        const m = minutesLeft.toString().padStart(2, '0');
        const s = secondsLeft.toString().padStart(2, '0');
        shutdownEl.textContent = `${m}:${s}`;
    };

    setInterval(updateTimer, 1000);

    // 2. Login Handler
    loginBtn.addEventListener('click', async () => {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        if (!username || !password) {
            loadingText.textContent = "Please enter credentials";
            return;
        }

        loadingText.textContent = "Authenticating...";
        loginBtn.disabled = true;
        loginBtn.style.opacity = "0.5";

        // Simulated Delay (We will replace this with Tauri Invoke later)
        setTimeout(() => {
            loadingText.textContent = "Access Denied / Not Connected";
            loginBtn.disabled = false;
            loginBtn.style.opacity = "1";
        }, 1500);
    });
});
