// Load enums when page loads
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/enums');
        const enums = await response.json();

        // Populate role select
        const roleSelect = document.getElementById('role');
        roleSelect.innerHTML = '<option value="">Select a role</option>';
        enums.user_roles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role.charAt(0).toUpperCase() + role.slice(1);
            roleSelect.appendChild(option);
        });

        // Populate class group select
        const classGroupSelect = document.getElementById('class_group');
        classGroupSelect.innerHTML = '<option value="">Select a class group</option>';
        enums.class_groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group.replace(/_/g, ' ').toUpperCase();
            classGroupSelect.appendChild(option);
        });

        // Show/hide class group based on role
        document.getElementById('role').addEventListener('change', (e) => {
            const role = e.target.value;
            const classGroupContainer = document.getElementById('class_group_container');

            if (role === 'student' || role === 'staff') {
                classGroupContainer.style.display = 'block';
                document.getElementById('class_group').required = true;
            } else {
                classGroupContainer.style.display = 'none';
                document.getElementById('class_group').required = false;
            }
        });

    } catch (error) {
        console.error('Error fetching enums:', error);
    }
});

// Form submission
document.getElementById('createUserForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const class_group = document.getElementById('class_group').value;

    const data = {
        username,
        password,
        role
    };

    if (email.trim()) data.email = email;
    if (role === 'student' && class_group) data.class_group = class_group;

    fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(response => response.json())
        .then(() => {
            loadUsers();
            document.getElementById('createUserForm').reset();
            document.getElementById('errorMessage').textContent = '';
        })
        .catch(() => {
            document.getElementById('errorMessage').textContent = 'Something went wrong. Please try again.';
        });
});

// Role filter event listener
document.getElementById('roleFilter').addEventListener('change', loadUsers);

// Load users function
function loadUsers() {
    fetch('/api/users')
        .then(response => response.json())
        .then(users => {
            const userTableBody = document.querySelector('#userTable tbody');
            userTableBody.innerHTML = '';

            users.forEach(user => {
                let roleColor = user.role === "STUDENT" ? "#3498db" : user.role === "STAFF" ? "#e67e22" : "#95a5a6";
                let initials = user.username ? user.username.charAt(0).toUpperCase() : '?';

                const row = document.createElement('tr');
                row.innerHTML = `
                            <td>${user.id}</td>
                            <td style="display: flex; align-items: center; gap: 0.75rem;">
                                <div style="width: 40px; height: 40px; background-color: #ddd; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-weight: bold; font-size: 1rem; color: #555;">
                                    ${initials}
                                </div>
                                ${user.username}
                            </td>
                            <td>${user.email || 'N/A'}</td>
                            <td>
                                <span class="role-pill" style="background-color: ${roleColor};">
                                    ${user.role}
                                </span>
                            </td>
                            <td>${user.class_group || 'N/A'}</td>
                            <td>
                                <button onclick="deleteUser(${user.id})" class="delete-btn">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        `;
                userTableBody.appendChild(row);
            });
        });
}

// Delete user function
function deleteUser(userId) {
    fetch(`/api/users/${userId}`, { method: 'DELETE' })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to delete user');
            }
            return response.json();
        })
        .then(() => {
            loadUsers();
        })
        .catch(() => alert('Failed to delete user'));
}

// Initial load
loadUsers();