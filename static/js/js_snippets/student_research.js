// Store for papers and notes
const store = {
    papers: [
        {
            id: 1,
            title: "Machine Learning Research Paper",
            description: "Analysis of recent trends in ML and AI applications",
            tags: ["ML", "AI", "research"],
            created: "2025-02-09T10:00:00Z",
            lastModified: "2025-02-09T10:00:00Z"
        },
        {
            id: 2,
            title: "Climate Change Impact Study",
            description: "Comprehensive analysis of climate change effects on marine ecosystems",
            tags: ["climate", "environment", "research"],
            created: "2025-02-08T15:30:00Z",
            lastModified: "2025-02-08T15:30:00Z"
        }
    ],
    notes: [
        {
            id: 1,
            title: "Research Meeting Notes",
            description: "Key points from weekly research team meeting",
            tags: ["meeting", "team", "research"],
            created: "2025-02-09T14:00:00Z",
            lastModified: "2025-02-09T14:00:00Z"
        }
    ]
};

let currentType = null;

// Utility functions
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// UI functions
function showModal(type) {
    currentType = type;
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    modal.style.display = 'flex';
    modalTitle.textContent = `Create New ${type.charAt(0).toUpperCase() + type.slice(1)}`;
    document.getElementById('createForm').reset();
}

function hideModal() {
    document.getElementById('modal').style.display = 'none';
    currentType = null;
}

function createListItem(item) {
    return `
                <div class="item">
                    <div class="item-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                    </div>
                    <div class="item-content">
                        <h3 class="item-title">${item.title}</h3>
                        <p class="item-description">${item.description}</p>
                        <div class="item-meta">
                            <span>Created: ${formatDate(item.created)}</span>
                            <span>Tags: ${item.tags.join(', ')}</span>
                        </div>
                    </div>
                </div>
            `;
}

function updateLists() {
    const papersList = document.getElementById('papersList');
    const notesList = document.getElementById('notesList');
    const papersCount = document.getElementById('papersCount');
    const notesCount = document.getElementById('notesCount');

    papersList.innerHTML = store.papers.map(createListItem).join('');
    notesList.innerHTML = store.notes.map(createListItem).join('');

    papersCount.textContent = `${store.papers.length} Papers`;
    notesCount.textContent = `${store.notes.length} Notes`;
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const filteredPapers = store.papers.filter(paper =>
        paper.title.toLowerCase().includes(searchTerm) ||
        paper.description.toLowerCase().includes(searchTerm) ||
        paper.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
    const filteredNotes = store.notes.filter(note =>
        note.title.toLowerCase().includes(searchTerm) ||
        note.description.toLowerCase().includes(searchTerm) ||
        note.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );

    document.getElementById('papersList').innerHTML = filteredPapers.map(createListItem).join('');
    document.getElementById('notesList').innerHTML = filteredNotes.map(createListItem).join('');

    document.getElementById('papersCount').textContent = `${filteredPapers.length} Papers`;
    document.getElementById('notesCount').textContent = `${filteredNotes.length} Notes`;
});

// Form submission
document.getElementById('createForm').addEventListener('submit', (e) => {
    e.preventDefault();

    const newItem = {
        id: Date.now(),
        title: document.getElementById('titleInput').value,
        description: document.getElementById('descriptionInput').value,
        tags: document.getElementById('tagsInput').value.split(',').map(tag => tag.trim()).filter(Boolean),
        created: new Date().toISOString(),
        lastModified: new Date().toISOString()
    };

    if (currentType === 'paper') {
        store.papers.unshift(newItem);
    } else {
        store.notes.unshift(newItem);
    }

    updateLists();
    hideModal();
    showToast(`${currentType.charAt(0).toUpperCase() + currentType.slice(1)} created successfully!`);
});

// Initial render
updateLists();