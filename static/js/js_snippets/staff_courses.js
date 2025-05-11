// Global variable to track current course being edited
let currentCourseId = null;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function () {
    fetchCourses();

    // Add CSRF token to all AJAX requests
    $.ajaxSetup({
        beforeSend: function (xhr, settings) {
            if (!/^(GET|HEAD|OPTIONS|TRACE)$/i.test(settings.type)) {
                const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
                if (csrfToken) {
                    xhr.setRequestHeader("X-CSRFToken", csrfToken);
                }
            }
        }
    });
});

// Fetch courses from the server
function fetchCourses() {
    fetch('/staff/courses')
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            console.log(data);
            renderCoursesTable(data);
        })
        .catch(error => {
            console.error('Error fetching courses:', error);
            showToast('Failed to load courses', 'error');
        });
}

// Render courses in the table
function renderCoursesTable(courses) {
    const tableBody = document.getElementById('coursesTableBody');
    tableBody.innerHTML = courses.map(course => {
        let formattedDate = 'Invalid Date';

        if (course.created_at) {
            let date = (typeof course.created_at === 'number') ? new Date(course.created_at) : new Date(course.created_at);
            if (date instanceof Date && !isNaN(date)) {
                formattedDate = date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        }

        return `
            <tr>
                <td>${course.title}</td>
                <td>${course.modules.length} modules</td>
                <td>${formattedDate}</td>
                <td class="action-buttons">
                    <button class="btn view-btn" onclick="editCourse(${course.id})">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn delete-btn" onclick="deleteCourse(${course.id})">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Show modal for creating a new course
function showCreateCourseModal() {
    currentCourseId = null;
    document.getElementById('modalTitle').textContent = 'Create New Course';
    document.getElementById('courseTitle').value = '';
    document.getElementById('modulesContainer').innerHTML = '';
    addModule();
    document.getElementById('courseModal').style.display = 'block';
}

// Add a new module field with multiple file uploads
function addModule(moduleTitle = '', moduleId = null, files = []) {
    const container = document.getElementById('modulesContainer');
    const moduleDiv = document.createElement('div');
    moduleDiv.className = 'module-container';

    const moduleIndex = document.querySelectorAll('.module-container').length;

    let existingFilesHTML = '';
    if (files && files.length > 0) {
        existingFilesHTML = `
            <div class="form-group">
                <label>Existing Files:</label>
                <div class="existing-files">
                    ${files.map(file => `
                        <div class="existing-file">
                            <a href="${file.file_path}" target="_blank">${file.filename}</a>
                            <button type="button" class="btn-remove-file" onclick="deleteFile(${file.id}, this)">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    moduleDiv.innerHTML = `
        <div class="form-group">
            <label>Module Title *</label>
            <input type="text" class="form-input module-title" value="${moduleTitle}" required>
            ${moduleId ? `<input type="hidden" class="module-id" value="${moduleId}">` : ''}
        </div>
        ${existingFilesHTML}
        <div class="form-group">
            <label>Upload New PDFs</label>
            <div class="file-uploads" id="fileUploads_${moduleIndex}">
                <div class="file-upload">
                    <input type="file" class="form-input module-file" name="file_${moduleIndex}_0" accept=".pdf">
                </div>
            </div>
            <button type="button" class="add-file-btn" onclick="addFileUpload(${moduleIndex})">
                <i class="fas fa-plus-circle"></i> Add Another File
            </button>
        </div>
        <button type="button" class="btn btn-secondary" 
                onclick="this.parentElement.remove()" 
                style="position: absolute; top: 0.5rem; right: 0.5rem; padding: 0.5rem;">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.appendChild(moduleDiv);
}

// Add another file upload field to a module
function addFileUpload(moduleIndex) {
    const fileUploadsContainer = document.getElementById(`fileUploads_${moduleIndex}`);
    const fileCount = fileUploadsContainer.querySelectorAll('.file-upload').length;

    const fileUploadDiv = document.createElement('div');
    fileUploadDiv.className = 'file-upload';
    fileUploadDiv.innerHTML = `
        <div class="file-input-group">
            <input type="file" class="form-input module-file" name="file_${moduleIndex}_${fileCount}" accept=".pdf">
            <button type="button" class="btn-remove-file" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    fileUploadsContainer.appendChild(fileUploadDiv);
}

// Delete a file
async function deleteFile(fileId, buttonElement) {
    if (!confirm('Are you sure you want to delete this file? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/staff/file/delete/${fileId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete file');
        }

        // Remove the file element from DOM
        const fileElement = buttonElement.closest('.existing-file');
        fileElement.remove();

        showToast('File deleted successfully');
    } catch (error) {
        console.error('Error deleting file:', error);
        showToast(error.message || 'Failed to delete file', 'error');
    }
}

// Handle the form submission for creating or updating a course
async function handleCourseSubmit(event) {
    event.preventDefault();

    const courseTitle = document.getElementById('courseTitle').value;
    const moduleContainers = document.querySelectorAll('.module-container');

    if (!courseTitle || moduleContainers.length === 0) {
        showToast('Please fill in all required fields', 'error');
        return;
    }

    const modules = Array.from(moduleContainers).map(container => {
        const moduleId = container.querySelector('.module-id')?.value || null;
        const moduleTitle = container.querySelector('.module-title').value;

        return {
            id: moduleId,
            title: moduleTitle,
            description: ""
        };
    });

    const staffClassGroup = document.querySelector('meta[name="staff-class-group"]')?.content || 'default_group';

    const courseData = {
        title: courseTitle,
        description: "",
        target_class_group: staffClassGroup,
        modules: modules
    };

    const formData = new FormData();
    formData.append('course', JSON.stringify(courseData));

    // Add all file inputs to the form data
    const fileInputs = document.querySelectorAll('.module-file');
    fileInputs.forEach(input => {
        if (input.files.length > 0) {
            formData.append(input.name, input.files[0]);
        }
    });

    try {
        let response;
        if (currentCourseId) {
            response = await fetch(`/staff/course/update/${currentCourseId}`, {
                method: 'PUT',
                body: formData
            });
        } else {
            response = await fetch('/staff/course/add', {
                method: 'POST',
                body: formData
            });
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to save course');
        }

        const result = await response.json();
        showToast(result.message || 'Course saved successfully');
        closeModal();
        fetchCourses();
    } catch (error) {
        console.error('Error saving course:', error);
        showToast(error.message || 'Failed to save course', 'error');
    }
}

// Fetch course details for editing
async function editCourse(courseId) {
    try {
        const response = await fetch(`/staff/courses`);
        if (!response.ok) throw new Error('Failed to fetch courses');

        const courses = await response.json();
        const course = courses.find(c => c.id === courseId);
        if (!course) throw new Error('Course not found');

        currentCourseId = course.id;

        document.getElementById('modalTitle').textContent = 'Edit Course';
        document.getElementById('courseTitle').value = course.title;

        const modulesContainer = document.getElementById('modulesContainer');
        modulesContainer.innerHTML = '';

        course.modules.forEach(module => {
            addModule(module.title, module.id, module.files);
        });

        document.getElementById('courseModal').style.display = 'block';
    } catch (error) {
        console.error('Error editing course:', error);
        showToast(error.message || 'Failed to load course for editing', 'error');
    }
}

// Delete a course
async function deleteCourse(courseId) {
    if (!confirm('Are you sure you want to delete this course? This action cannot be undone.')) return;

    try {
        const response = await fetch(`/staff/course/delete/${courseId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete course');
        }

        const result = await response.json();
        showToast(result.message || 'Course deleted successfully');
        fetchCourses();
    } catch (error) {
        console.error('Error deleting course:', error);
        showToast(error.message || 'Failed to delete course', 'error');
    }
}

// Close modal
function closeModal() {
    document.getElementById('courseModal').style.display = 'none';
}

// Toast notification function
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('courseModal');
    if (event.target === modal) {
        closeModal();
    }
};