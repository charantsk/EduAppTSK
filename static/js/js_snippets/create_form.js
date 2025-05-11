function toggleScheduleTime() {
    const scheduleSection = document.getElementById('schedule-time-section');
    const scheduledCheckbox = document.getElementById('form-scheduled');
    if (scheduledCheckbox.checked) {
        scheduleSection.style.display = 'block';
    } else {
        scheduleSection.style.display = 'none';
    }
}

function toggleDeadline() {
    const deadlineSection = document.getElementById('deadline-section');
    const deadlineCheckbox = document.getElementById('form-deadline-checkbox');
    if (deadlineCheckbox.checked) {
        deadlineSection.style.display = 'block';
    } else {
        deadlineSection.style.display = 'none';
    }
}

function toggleImageUpload() {
    const imageUploadSection = document.getElementById('image-upload-section');
    const addImageCheckbox = document.getElementById('add-image');
    if (addImageCheckbox.checked) {
        imageUploadSection.style.display = 'block';
    } else {
        imageUploadSection.style.display = 'none';
    }
}
document.querySelectorAll('.question-type-btn').forEach(button => {
    button.addEventListener('click', () => {
        const selectedType = button.getAttribute('data-type');
        document.getElementById('question-type').value = selectedType;
        if (selectedType === 'MULTIPLE_CHOICE') {
            document.getElementById('choices-section').style.display = 'block';
            document.getElementById('keywords-section').style.display = 'none';
        } else if (selectedType === 'MULTI_WORD') {
            document.getElementById('choices-section').style.display = 'none';
            document.getElementById('keywords-section').style.display = 'block';
        } else {
            document.getElementById('choices-section').style.display = 'none';
            document.getElementById('keywords-section').style.display = 'none';
        }
    });
});
let choiceCount = 1;
function addChoice() {
    if (choiceCount < 4) {
        const container = document.getElementById('choices-container');
        const newChoice = document.createElement('div');
        newChoice.classList.add('choice');
        newChoice.innerHTML = `<input type="text" class="choice-input" placeholder="Enter choice">`;
        container.appendChild(newChoice);
        choiceCount++;
        if (choiceCount >= 4) {
            document.getElementById('add-choice-btn').disabled = true;
        }
    }
}
function removeChoice(element) {
    const container = document.getElementById('choices-container');
    container.removeChild(element);
    choiceCount--;
    document.getElementById('add-choice-btn').disabled = false;
}

let questions = [];
let currentQuestion = null;
function openQuestionModal() {
    document.getElementById('question-modal').style.display = 'flex';
}
function closeModal() {
    document.getElementById('question-modal').style.display = 'none';
    clearQuestionFields();
}
function clearQuestionFields() {
    document.getElementById('question-text').value = '';
    document.getElementById('question-type').value = 'SINGLE_WORD';
    document.getElementById('correct-answer').value = '';
    document.getElementById('points').value = '1';
    document.getElementById('keywords').value = '';
    const choicesContainer = document.getElementById('choices-container');
    choicesContainer.innerHTML = '<div class="choice"><input type="text" class="choice-input" placeholder="Enter choice"></div>';
    choiceCount = 1;
}
function addQuestion() {
    const text = document.getElementById('question-text').value;
    const type = document.getElementById('question-type').value;
    const correctAnswer = document.getElementById('correct-answer').value;
    const points = document.getElementById('points').value;
    const keywordsText = document.getElementById('keywords').value;
    let choices = [];
    if (type === 'MULTIPLE_CHOICE') {
        const choiceInputs = document.querySelectorAll('.choice-input');
        choices = Array.from(choiceInputs).map(input => input.value);
    }
    let keywords = [];
    if (type === 'MULTI_WORD' && keywordsText) {
        keywords = keywordsText.split(',').map(k => k.trim()).filter(k => k);
    }
    const question = {
        text,
        type,
        correctAnswer,
        points,
        choices,
        keywords
    };
    if (currentQuestion !== null) {
        questions[currentQuestion] = question;
        currentQuestion = null;
    } else {
        questions.push(question);
    }
    renderQuestions();
    closeModal();
}
function renderQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('question-item');
        questionElement.setAttribute('draggable', true);
        questionElement.setAttribute('data-index', index);
        questionElement.addEventListener('dragstart', handleDragStart);
        questionElement.addEventListener('dragover', handleDragOver);
        questionElement.addEventListener('drop', handleDrop);
        questionElement.innerHTML = `
          <span class="question-title">${question.text}</span>
          <div class="question-actions">
            <button class="button" onclick="editQuestion(${index})">Edit</button>
            <button class="button" onclick="deleteQuestion(${index})">Delete</button>
          </div>
        `;
        container.appendChild(questionElement);
    });
}
function editQuestion(index) {
    const question = questions[index];
    currentQuestion = index;
    document.getElementById('question-text').value = question.text;
    document.getElementById('question-type').value = question.type;
    document.getElementById('correct-answer').value = question.correctAnswer;
    document.getElementById('points').value = question.points;
    document.getElementById('keywords').value = question.keywords ? question.keywords.join(', ') : '';
    if (question.type === 'MULTIPLE_CHOICE') {
        const choicesContainer = document.getElementById('choices-container');
        choicesContainer.innerHTML = '';
        question.choices.forEach(choice => {
            const choiceDiv = document.createElement('div');
            choiceDiv.classList.add('choice');
            choiceDiv.innerHTML = `<input type="text" class="choice-input" value="${choice}" placeholder="Enter choice">`;
            choicesContainer.appendChild(choiceDiv);
        });
        choiceCount = question.choices.length;
        document.getElementById('choices-section').style.display = 'block';
        document.getElementById('add-choice-btn').disabled = choiceCount >= 4;
    } else if (question.type === 'MULTI_WORD') {
        document.getElementById('keywords-section').style.display = 'block';
    }
    openQuestionModal();
}
function deleteQuestion(index) {
    questions.splice(index, 1);
    renderQuestions();
}
function saveForm() {
    const formType = document.getElementById('form-type').value;
    const targetClassGroup = document.getElementById('target-class-group').value;
    if (!targetClassGroup) {
        alert('Please select a target class group');
        return;
    }
    const formData = {
        title: document.getElementById('form-title').value,
        description: document.getElementById('form-description').value,
        form_type: formType,
        target_class_group: targetClassGroup,
        questions: questions.map(q => ({
            text: q.text,
            type: q.type,
            correct_answer: q.correctAnswer,
            points: parseInt(q.points),
            choices: q.choices || [],
            keywords: q.keywords || []
        }))
    };
    if (document.getElementById('form-scheduled').checked) {
        const scheduleTime = document.getElementById('schedule-time').value;
        if (!scheduleTime) {
            alert('Please select a schedule time');
            return;
        }
        formData.scheduled_at = scheduleTime;
    }
    if (document.getElementById('form-deadline-checkbox').checked) {
        const deadlineTime = document.getElementById('deadline-time').value;
        if (!deadlineTime) {
            alert('Please select a deadline');
            return;
        }
        formData.deadline = deadlineTime;
    }
    if (formType === 'QUESTION_BANK') {
        const timerValue = document.getElementById('form-timer').value;
        if (!timerValue || timerValue < 1 || timerValue > 180) {
            alert('Please set a valid time limit between 1 and 180 minutes');
            return;
        }
        formData.time_limit = parseInt(timerValue);
    }
    if (!formData.title) {
        alert('Please enter a form title');
        return;
    }
    if (formType === 'QUESTION_BANK' && formData.questions.length === 0) {
        alert('Please add at least one question');
        return;
    }
    console.log('Sending form data:', formData);
    fetch('/api/forms/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
    })
        .then(response => {
            if (!response.ok) {
                return response.json().then(error => {
                    throw new Error(error.error || 'Unknown error occurred');
                });
            }
            return response.json();
        })
        .then(data => {
            alert('Form created successfully!');
            window.location.href = '/dashboard';
        })
        .catch(error => {
            console.error('Error:', error);
            alert(`Error creating form: ${error.message}`);
        });
}
let draggedItem = null;
function handleDragStart(event) {
    draggedItem = event.target;
    setTimeout(() => {
        draggedItem.classList.add('dragging');
    }, 0);
}
function handleDragOver(event) {
    event.preventDefault();
    const currentItem = event.target;
    if (currentItem.classList.contains('question-item') && draggedItem !== currentItem) {
        currentItem.style.border = '1px solid #2980b9';
    }
}
function handleDrop(event) {
    event.preventDefault();
    const target = event.target;
    target.style.border = 'none';
    if (target.classList.contains('question-item') && draggedItem !== target) {
        const draggedIndex = draggedItem.getAttribute('data-index');
        const targetIndex = target.getAttribute('data-index');
        const draggedQuestion = questions[draggedIndex];
        questions.splice(draggedIndex, 1);
        questions.splice(targetIndex, 0, draggedQuestion);
        renderQuestions();
    }
    draggedItem.classList.remove('dragging');
}
document.getElementById('form-type').addEventListener('change', function () {
    const questionSection = document.querySelector('.card:nth-child(2)');
    const timerSection = document.getElementById('timer-section');
    if (this.value === 'QUESTION_BANK') {
        questionSection.style.display = 'block';
        timerSection.style.display = 'block';
    } else {
        questionSection.style.display = 'none';
        timerSection.style.display = 'none';
    }
});
window.addEventListener('load', function () {
    const formType = document.getElementById('form-type').value;
    const questionSection = document.querySelector('.card:nth-child(2)');
    const timerSection = document.getElementById('timer-section');
    if (formType === 'QUESTION_BANK') {
        questionSection.style.display = 'block';
        timerSection.style.display = 'block';
    } else {
        questionSection.style.display = 'none';
        timerSection.style.display = 'none';
    }
});
document.getElementById("form-type").addEventListener("change", function () {
    let timerSection = document.getElementById("timer-section");
    if (this.value === "QUESTION_BANK") {
        timerSection.style.display = "block";
    } else {
        timerSection.style.display = "none";
    }
});
document.getElementById("form-type").dispatchEvent(new Event("change"));

document.getElementById('form-type').addEventListener('change', function () {
    let questionsCard = document.querySelector('.questions-list').closest('.card');
    if (this.value === 'NOTIFICATION') {
        questionsCard.style.display = 'none';
    } else {
        questionsCard.style.display = 'block';
    }
});
document.getElementById('form-type').dispatchEvent(new Event('change'));

document.addEventListener('DOMContentLoaded', function () {
    const formTypeOptions = document.querySelectorAll('.form-type-option');
    const formTypeInput = document.getElementById('form-type');
    const initialOption = document.querySelector(`[data-value="${formTypeInput.value}"]`);
    if (initialOption) {
        initialOption.classList.add('active');
    }
    formTypeOptions.forEach(option => {
        option.addEventListener('click', function () {
            formTypeOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
            formTypeInput.value = this.dataset.value;
            const event = new Event('change');
            formTypeInput.dispatchEvent(event);
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const formTypeInput = document.getElementById('form-type');
    function updateUIText() {
        const isSurveyType = formTypeInput.value === 'SURVEY';
        const addButton = document.querySelector('.button-primary[onclick="openQuestionModal()"]');
        if (addButton) {
            addButton.textContent = isSurveyType ? 'Add Field' : 'Add Question';
        }
        const modalTitle = document.querySelector('#question-modal .modal-header h2');
        if (modalTitle) {
            modalTitle.textContent = isSurveyType ? 'Add Field' : 'Add Question';
        }
        const typeLabel = document.querySelector('#question-modal label[for="question-type"]');
        if (typeLabel) {
            typeLabel.textContent = isSurveyType ? 'Field Type' : 'Question Type';
        }
        const textLabel = document.querySelector('label[for="question-text"]');
        if (textLabel) {
            textLabel.textContent = isSurveyType ? 'Field Name' : 'Question Text';
        }
    }
    formTypeInput.addEventListener('change', updateUIText);
    updateUIText();
});
async function generateQuestions() {
    const topic = prompt('Enter a topic for the questions:');
    if (!topic) return;
    const num_questions = parseInt(prompt('Enter the number of questions to generate:'), 10) || 1;
    try {
        const response = await fetch('http://127.0.0.1:5001/generate_questions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ topic: topic, num_questions: num_questions }),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.questions && data.questions.length > 0) {
            questions = questions.concat(data.questions);
            renderQuestions();
        }
    } catch (error) {
        console.error('Failed to generate questions:', error);
        alert('Failed to generate questions. See console for details.');
    }
}