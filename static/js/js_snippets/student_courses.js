// Global variable to store fetched courses
let coursesData = [];

// Fetch courses from API
async function fetchCourses() {
    try {
        console.log('Fetching courses...');
        // Make sure this URL matches your actual API endpoint
        const response = await fetch('/staff/courses');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        coursesData = await response.json();
        console.log('Fetched courses data:', coursesData);

        // Check if we received an array with data
        if (!Array.isArray(coursesData) || coursesData.length === 0) {
            console.error('API returned empty or invalid data format');
            document.getElementById('errorMessage').textContent = 'No courses available or invalid data received.';
            document.getElementById('errorMessage').style.display = 'block';
            return;
        }

        // After fetching data, render the courses
        renderRecentCourses();
        renderCourses();
    } catch (error) {
        console.error('Error fetching courses:', error);
        document.getElementById('errorMessage').textContent = 'Failed to load courses. Please try again later.';
        document.getElementById('errorMessage').style.display = 'block';
    }
}

// Render recently viewed courses
function renderRecentCourses() {
    console.log('Rendering recent courses...');
    const recentCourses = document.getElementById('recentCourses');

    if (!recentCourses) {
        console.error("Element with ID 'recentCourses' not found in the DOM");
        return;
    }

    // We'll show the first 3 courses
    recentCourses.innerHTML = coursesData
        .slice(0, 3)
        .map(course => `
            <div class="recent-course-card" onclick="showCourseDetails(${course.id})">
                <h3 class="recent-course-title">${course.title}</h3>
            </div>
        `).join('');

    console.log('Recent courses rendered');
}

// Render all courses
function renderCourses() {
    console.log('Rendering all courses...');
    const coursesGrid = document.getElementById('coursesGrid');

    if (!coursesGrid) {
        console.error("Element with ID 'coursesGrid' not found in the DOM");
        return;
    }

    coursesGrid.innerHTML = coursesData.map(course => `
        <div class="course-card" onclick="showCourseDetails(${course.id})">
            <div class="course-header">
                <h2 style="color:white;">${course.title}</h2>
            </div>
            <div class="course-content">
                <p class="course-description">${course.description || 'No description available'}</p>
                <div class="module-count">${course.modules.length} module${course.modules.length !== 1 ? 's' : ''}</div>
            </div>
        </div>
    `).join('');

    console.log('All courses rendered');
}

// Show course details in modal
async function showCourseDetails(courseId) {
    try {
        console.log(`Fetching details for course ID: ${courseId}`);

        const modal = document.getElementById('courseModal');
        const modalContent = document.getElementById('modalContent');

        if (!modal || !modalContent) {
            console.error("Modal elements not found in the DOM");
            alert('Error: Modal elements not found on the page.');
            return;
        }

        // Find the course from the coursesData
        const course = coursesData.find(c => c.id === courseId);

        if (!course) {
            console.error(`Course with ID ${courseId} not found in coursesData`);
            alert('Course not found. Please try again.');
            return;
        }

        // Begin updating modal with course details
        modalContent.innerHTML = `
            <h2>${course.title}</h2>
            <div style="margin: 1rem 0;">
                <p>${course.description || 'No description available'}</p>
            </div>
        `;

        // Check if the course has modules and render them
        if (course.modules && course.modules.length > 0) {
            modalContent.innerHTML += `
                <h3>Modules</h3>
                ${course.modules.map(module => `
                    <div style="margin: 1rem 0;">
                        <h4>${module.title}</h4>
                        <p>${module.description || 'No description available'}</p>
                        <ul class="file-list">
                            ${module.files && module.files.length > 0 ?
                    module.files.map(file => `
                                    <li class="file-item">
                                        <div class="file-info">
                                            <i class="fas fa-file-pdf"></i>
                                            <span>${file.filename}</span>
                                        </div>
                                        <a href="${file.file_path}" class="download-btn" target="_blank">
                                            <i class="fas fa-download"></i> Download
                                        </a>
                                    </li>
                                `).join('') :
                    '<li>No files available</li>'
                }
                        </ul>
                    </div>
                `).join('')}
            `;
        } else {
            modalContent.innerHTML += `<p>No modules available for this course</p>`;
        }

        // Display the modal
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error showing course details:', error);
        alert('Failed to display course details. Please try again later.');
    }
}

// Close modal
function closeModal() {
    const modal = document.getElementById('courseModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function (event) {
    const modal = document.getElementById('courseModal');
    if (modal && event.target === modal) {
        modal.style.display = 'none';
    }
}

// Add this to your HTML if it doesn't exist:
// <div id="errorMessage" style="display:none; color:red; padding:10px; margin:10px 0; background:#ffe6e6; border-radius:5px;"></div>

// Make sure your HTML has these elements:
// - div with id="recentCourses"
// - div with id="coursesGrid"
// - div with id="courseModal" containing a div with id="modalContent"

// Initialize by fetching courses data from API
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing course dashboard');

    // Create error message element if it doesn't exist
    if (!document.getElementById('errorMessage')) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'errorMessage';
        errorDiv.style.display = 'none';
        errorDiv.style.color = 'red';
        errorDiv.style.padding = '10px';
        errorDiv.style.margin = '10px 0';
        errorDiv.style.background = '#ffe6e6';
        errorDiv.style.borderRadius = '5px';

        // Insert at the top of the content area
        const contentArea = document.querySelector('.section') || document.body;
        contentArea.insertBefore(errorDiv, contentArea.firstChild);
    }

    fetchCourses();
});