// Convert server time (UTC) to user's local time
const scheduledTime = new Date('{{ scheduled_at.isoformat() }}');
const localScheduledTime = new Date(scheduledTime);

// Update the displayed time to show local time
document.querySelector('.scheduled-time').textContent =
    localScheduledTime.toLocaleString() + ' (your local time)';

// Set up countdown timer
function updateCountdown() {
    const now = new Date();
    const timeLeft = scheduledTime - now;

    if (timeLeft <= 0) {
        // Time's up, refresh the page
        clearInterval(countdownInterval);
        document.getElementById('countdown').textContent = "Form is now available!";
        window.location.reload();
        return;
    }

    // Calculate remaining time
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Display countdown
    document.getElementById('countdown').textContent =
        `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

// Update countdown immediately and then every second
updateCountdown();
const countdownInterval = setInterval(updateCountdown, 1000);