let formId = null;
let questions = [];
let editingQuestionIndex = null;

// Load form data when page loads
document.addEventListener('DOMContentLoaded', function () {
    formId = new URLSearchParams(window.location.search).get('form_id');
    if (formId) {
        loadFormData();
        loadSubmissions();
    }
});

function loadFormData() {
    fetch(`/api/forms/${formId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('form-title').value = data.title;
            document.getElementById('form-description').value = data.description;
            const formTypeElement = document.getElementById('form-type');
            formTypeElement.value = data.type;  // Set the form-type value

            // Simulate a change event to ensure the selection is reflected
            const event = new Event('change');
            formTypeElement.dispatchEvent(event);

            questions = data.questions;
            renderQuestions();
        })
        .catch(error => {
            console.error('Error loading form:', error);
            alert('Error loading form data');
        });
}

function loadSubmissions() {
    fetch(`/api/forms/${formId}/submissions`)
        .then(response => response.json())
        .then(data => {
            renderSubmissions(data);
        })
        .catch(error => console.error('Error loading submissions:', error));
}

function renderResponses(responses, questions) {
    return Object.entries(responses)
        .map(([questionId, answer]) => {
            const question = questions[questionId];
            if (!question) return ''; // Skip if question not found

            // Check if correct answer is 'null' or if student answer matches correct answer
            const isCorrect = question.correct_answer === 'null' || question.correct_answer.toLowerCase() === String(answer).toLowerCase();

            return `
            <div class="response-item" style="margin: 0.8rem 0; padding: 1rem; background-color: #f8f9fa; border-radius: 8px; border-left: 4px solid ${isCorrect ? '#10B981' : '#EF4444'}">
                <div class="question-text" style="margin-bottom: 0.5rem;">
                    <strong>Question:</strong> ${question.text}
                    ${question.points ? `<span style="margin-left: 8px; color: #6B7280; font-size: 0.9em;">(${question.points} points)</span>` : ''}
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
                    <div class="answer-box" style="
                        padding: 0.75rem;
                        border-radius: 6px;
                        background-color: ${isCorrect ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}">
                        <div style=" scratching: 0.875rem; color: #374151; margin-bottom: 0.25rem;">Student's Answer:</div>
                        <div style="font-weight: 500;">${answer}</div>
                    </div>

                    <div class="answer-box" style="
                        padding: 0.75rem;
                        border-radius: 6px;
                        background-color: rgba(16, 185, 129, 0.1)">
                        <div style="font-size: 0.875rem; color: #374151; margin-bottom: 0.25rem;">Correct Answer:</div>
                        <div style="font-weight: 500;">${question.correct_answer}</div>
                    </div>
                </div>

                <div style="margin-top: 0.5rem; font-size: 0.875rem; color: ${isCorrect ? '#10B981' : '#EF4444'}">
                    ${isCorrect ? '<span>✓ Correct</span>' : '<span>✗ Incorrect</span>'}
                </div>

                ${question.type === 'multi_word' ? `
                    <button class="button"
                        data-question="${question.text.replace(/"/g, '&quot;')}"
                        data-answer="${answer.replace(/"/g, '&quot;')}"
                        onclick="handleEvaluateClick(this)"
                        style="margin-top: 0.5rem; background-color: #3B82F6; color: white;">
                        <i class="fas fa-robot"></i> AI Evaluate
                    </button>
                    <div class="ai-score" style="margin-top: 0.5rem; display: none;"></div>
                ` : ''}
            </div>
        `;
        }).join('');
}

function handleEvaluateClick(button) {
    const question = button.dataset.question;
    const answer = button.dataset.answer;
    evaluateAnswer(question, answer, button);
}

function evaluateAnswer(question, answer, buttonElement) {
    // Show loading state
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Evaluating...';
    buttonElement.disabled = true;

    // Call the evaluation API
    fetch('http://127.0.0.1:5001/evaluate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            question: question,
            answer: answer
        })
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Evaluation failed');
            }
            return response.json();
        })
        .then(data => {
            // Find the score display div (next sibling of the button)
            const scoreDiv = buttonElement.nextElementSibling;
            scoreDiv.textContent = `AI Evaluation Score: ${data.score}/10`;
            scoreDiv.style.display = 'block';
            scoreDiv.style.color = data.score >= 7 ? '#10B981' : data.score >= 5 ? '#F59E0B' : '#EF4444';
            scoreDiv.style.fontWeight = '500';

            // Reset button
            buttonElement.innerHTML = '<i class="fas fa-robot"></i> AI Evaluate';
            buttonElement.disabled = false;
        })
        .catch(error => {
            console.error('Evaluation error:', error);
            buttonElement.innerHTML = '<i class="fas fa-robot"></i> AI Evaluate';
            buttonElement.disabled = false;

            // Show error message
            const scoreDiv = buttonElement.nextElementSibling;
            scoreDiv.textContent = 'Evaluation failed. Please try again.';
            scoreDiv.style.display = 'block';
            scoreDiv.style.color = '#EF4444';
        });
}

function renderSubmissions(submissions) {
    const container = document.getElementById('submissions-container');
    const submissionsCard = container.closest('.card');

    if (submissions.length === 0) {
        submissionsCard.style.display = 'none';
        return;
    } else {
        submissionsCard.style.display = 'block';
    }

    container.innerHTML = submissions.map(sub => `
    <div class="submission-item card" style="margin-bottom: 1rem; padding: 1rem;">
        <div class="submission-header" style="display: flex; justify-content: space-between; align-items: center; cursor: pointer;">
            <div>
                <p><strong>User ID:</strong> ${sub.user_id}</p>
                ${sub.form_type === 'question_bank' ?
            `<p><strong>Score:</strong> <span style="color: ${sub.score >= 70 ? '#10B981' : '#EF4444'}">${sub.score}%</span></p>` :
            ''}
                <p><strong>Submitted:</strong> ${new Date(sub.submitted_at).toLocaleString()}</p>
            </div>
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button class="button button-danger" onclick="deleteSubmission(${sub.id}); event.stopPropagation();">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
                <button class="view-report-button" onclick="toggleResponses(${sub.id}); event.stopPropagation();">
                    <i class="fas fa-eye"></i> View Report
                </button>
                <button class="send-report-button" onclick="sendReport(${sub.id}); event.stopPropagation();">
                    <i class="fas fa-paper-plane"></i> Send Report
                </button>
            </div>
        </div>
        <div class="submission-responses" id="responses-${sub.id}" style="display: none; margin-top: 1rem;">
            ${renderResponses(sub.responses, sub.questions)}
        </div>
    </div>
    `).join('');
}

function toggleResponses(submissionId) {
    const responsesDiv = document.getElementById(`responses-${submissionId}`);
    const button = responsesDiv.parentElement.querySelector('.view-report-button');

    if (responsesDiv.style.display === 'none') {
        responsesDiv.style.display = 'block';
        button.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Report';
    } else {
        responsesDiv.style.display = 'none';
        button.innerHTML = '<i class="fas fa-eye"></i> View Report';
    }
}

function deleteSubmission(submissionId) {
    if (confirm('Are you sure you want to delete this submission?')) {
        fetch(`/api/forms/submissions/${submissionId}`, {
            method: 'DELETE'
        })
            .then(() => loadSubmissions())
            .catch(error => alert('Error deleting submission'));
    }
}

function sendReport(submissionId) {
    const responsesDiv = document.getElementById(`responses-${submissionId}`);
    const submissionData = {
        submissionId,
        report: responsesDiv.innerHTML
    };

    fetch('/api/send_report', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(submissionData)
    })
        .then(response => response.json())
        .then(data => {
            alert('Report sent successfully!');
        })
        .catch(error => {
            console.error('Error sending report:', error);
            alert('Failed to send the report.');
        });
}

function openQuestionModal(index = null) {
    editingQuestionIndex = index;
    const modal = document.getElementById('question-modal');

    if (index !== null) {
        const question = questions[index];
        document.getElementById('question-text').value = question.text;
        document.getElementById('question-type').value = question.type;
        document.getElementById('correct-answer').value = question.correct_answer;
        document.getElementById('points').value = question.points;
    } else {
        clearQuestionFields();
    }

    modal.style.display = 'flex';
}

function clearQuestionFields() {
    document.getElementById('question-text').value = '';
    document.getElementById('question-type').value = 'SINGLE_WORD';
    document.getElementById('correct-answer').value = '';
    document.getElementById('points').value = '1';
}

function closeModal() {
    document.getElementById('question-modal').style.display = 'none';
    editingQuestionIndex = null;
}

function saveQuestion() {
    const questionData = {
        text: document.getElementById('question-text').value,
        type: document.getElementById('question-type').value,
        correct_answer: document.getElementById('correct-answer').value,
        points: parseInt(document.getElementById('points').value)
    };

    if (editingQuestionIndex !== null) {
        questions[editingQuestionIndex] = questionData;
    } else {
        questions.push(questionData);
    }

    renderQuestions();
    closeModal();
}

function renderQuestions() {
    const questionsContainer = document.getElementById('questions-container');
    questionsContainer.innerHTML = '';

    questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.classList.add('question-item');

        let choicesHtml = '';
        if (question.type === 'MULTIPLE_CHOICE' && question.choices) {
            choicesHtml = `
                <p>Choices: ${question.choices.join(', ')}</p>
            `;
        }

        questionElement.innerHTML = `
            <div class="question-content">
                <strong>${question.text}</strong> 
                <p>Type: ${question.type}</p>
                ${choicesHtml}
                <p>Correct Answer: ${question.correct_answer}</p>
                <p>Points: ${question.points}</p>
            </div>
            <div class="question-actions">
                <button class="button" onclick="openQuestionModal(${index})">Edit</button>
                <button class="button button-danger" onclick="deleteQuestion(${index})">Delete</button>
            </div>
        `;
        questionsContainer.appendChild(questionElement);
    });
}

function deleteQuestion(index) {
    if (confirm('Are you sure you want to delete this question?')) {
        questions.splice(index, 1);
        renderQuestions();
    }
}

function saveForm() {
    const formData = {
        title: document.getElementById('form-title').value,
        description: document.getElementById('form-description').value,
        questions: questions.map(q => ({
            text: q.text,
            type: q.type,
            correct_answer: q.correct_answer,
            points: parseInt(q.points)
        }))
    };

    if (!formData.title) {
        alert('Please enter a form title');
        return;
    }

    if (formData.questions.length === 0) {
        alert('Please add at least one question');
        return;
    }

    fetch(`/api/forms/${formId}`, {
        method: 'PUT',
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
            alert('Form updated successfully!');
            window.location.href = '/dashboard';
        })
        .catch(error => {
            console.error('Error:', error);
            alert(`Error updating form: ${error.message}`);
        });
}