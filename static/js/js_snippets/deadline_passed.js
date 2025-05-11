// Convert server time (UTC) to user's local time
const deadlineTime = new Date('{{ deadline.isoformat() }}');
const localDeadlineTime = new Date(deadlineTime);

// Update the displayed time to show local time
document.querySelector('.deadline-time').textContent =
    'Deadline was: ' + localDeadlineTime.toLocaleString() + ' (your local time)';