let formData = null;
let isSubmitting = false;
let isSurveyForm = false;
let resizeTimeout = null;
let timer = null;

// Get the form ID from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const formId = urlParams.get('form_id');

if (!formId) {
    alert('No form ID provided');
    window.location.href = '/dashboard';
}

function startTimer(minutes) {
    const endTime = Date.now() + minutes * 60 * 1000;
    const timerElement = document.querySelector('.time-limit');
    
    timer = setInterval(() => {
        const timeLeft = endTime - Date.now();
        if (timeLeft <= 0) {
            clearInterval(timer);
            handleAutoSubmit();
            return;
        }
        
        const minutesLeft = Math.floor(timeLeft / 60000);
        const secondsLeft = Math.floor((timeLeft % 60000) / 1000);
        timerElement.textContent = `Time Remaining: ${minutesLeft}:${secondsLeft.toString().padStart(2, '0')}`;
    }, 1000);
}

function collectResponses() {
    const responses = {};
    if (formData && formData.questions) {
        formData.questions.forEach(question => {
            const inputElement = document.querySelector(`[name="question_${question.id}"]`);
            if (inputElement) {
                if (question.type === 'checkbox') {
                    responses[question.id] = inputElement.checked;
                } else {
                    responses[question.id] = inputElement.value;
                }
            }
        });
    }
    return responses;
}

async function submitForm(responses) {
    if (isSubmitting) return;
    isSubmitting = true;

    try {
        const response = await fetch(`/api/forms/${formId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'same-origin',
            body: JSON.stringify({ responses }),
        });

        if (!response.ok) {
            throw new Error('Form submission failed');
        }

        const data = await response.json();
        
        if (!isSurveyForm) {
            alert(`Form submitted successfully! Your score: ${data.score}%`);
        } else {
            alert('Survey submitted successfully!');
        }
        
        window.location.href = '/dashboard';
    } catch (error) {
        console.error('Form submission error:', error);
        alert('Error submitting the form: ' + error.message);
    } finally {
        isSubmitting = false;
    }
}

function handleAutoSubmit() {
    if (!isSurveyForm && formData && formData.questions) {
        const responses = collectResponses();
        if (Object.keys(responses).length > 0) {
            if (timer) clearInterval(timer);
            submitForm(responses);
        }
    }
}

function handleResize() {
    if (!isSurveyForm) {
        if (resizeTimeout) {
            clearTimeout(resizeTimeout);
        }
        resizeTimeout = setTimeout(() => {
            handleAutoSubmit();
        }, 1000);
    }
}

function renderForm(form) {
    if (!form || !form.questions) {
        console.error('Invalid form data:', form);
        return;
    }

    const formElement = document.getElementById('form-submit');
    formElement.innerHTML = '';

    console.log(form);

    // Check if there is a time limit and display it
    if (form.time_limit) {
        const timeLimitElement = document.createElement('div');
        timeLimitElement.className = 'time-limit';
        formElement.appendChild(timeLimitElement);
        startTimer(form.time_limit);
    }

    form.questions.forEach(question => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.htmlFor = `question_${question.id}`;

        if (isSurveyForm) {
            label.textContent = question.text;
        } else {
            label.innerHTML = `${question.text} <span class="points">(${question.points} point${question.points > 1 ? 's' : ''})</span>`;
        }
        formGroup.appendChild(label);

        let input;
        switch(question.type) {
            case 'single_word':
                input = document.createElement('input');
                input.type = 'text';
                break;
            case 'multi_word':
                input = document.createElement('textarea');
                break;
            case 'true_false':
                input = document.createElement('select');
                const optionYes = document.createElement('option');
                optionYes.value = 'true';
                optionYes.textContent = 'true';
                const optionNo = document.createElement('option');
                optionNo.value = 'false';
                optionNo.textContent = 'false';
                input.appendChild(optionYes);
                input.appendChild(optionNo);
                break;
            case 'attachment':
                input = document.createElement('input');
                input.type = 'file';
                input.addEventListener('change', function(event) {
                    const file = event.target.files[0];
                    if (file && file.size > 50 * 1024 * 1024) {
                        alert('File size should be less than 50MB.');
                        event.target.value = '';
                    }
                });
                break;
            case 'link':
                input = document.createElement('input');
                input.type = 'url';
                input.pattern = 'https?://.*';
                input.placeholder = 'https://example.com';
                break;
            case 'number':
                input = document.createElement('input');
                input.type = 'number';
                break;
            case 'date':
                input = document.createElement('input');
                input.type = 'date';
                break;
            case 'multiple_choice':
                input = document.createElement('select');
                input.classList.add('form-select');
                
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = 'Select an answer';
                defaultOption.selected = true;
                defaultOption.disabled = true;
                input.appendChild(defaultOption);
                
                if (question.choices && Array.isArray(question.choices)) {
                    question.choices.forEach(choice => {
                        const option = document.createElement('option');
                        option.value = choice;
                        option.textContent = choice;
                        input.appendChild(option);
                    });
                }
                break;
            case 'checkbox':
                const checkboxWrapper = document.createElement('div');
                checkboxWrapper.className = 'checkbox-wrapper';
                
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = false;
                
                const checkboxLabel = document.createElement('span');
                checkboxLabel.className = 'checkbox-label';
                checkboxLabel.textContent = question.label || '';
                
                checkboxWrapper.appendChild(input);
                checkboxWrapper.appendChild(checkboxLabel);
                break;
            default:
                input = document.createElement('input');
                input.type = 'text';
        }

        input.id = `question_${question.id}`;
        input.name = `question_${question.id}`;
        input.required = true;
        input.className = question.type === 'checkbox' ? 'form-control checkbox' : 'form-control';

        if (question.type === 'checkbox') {
            formGroup.appendChild(input.parentElement);
        } else {
            formGroup.appendChild(input);
        }
        formElement.appendChild(formGroup);
    });

    const submitGroup = document.createElement('div');
    submitGroup.className = 'form-group';

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.className = 'button';
    submitButton.textContent = 'Submit';

    submitGroup.appendChild(submitButton);
    formElement.appendChild(submitGroup);
}

// Initialize form
fetch(`/api/forms/${formId}`, {
    method: 'GET',
    headers: {
        'Content-Type': 'application/json',
    },
    credentials: 'same-origin'
})
.then(response => {
    if (!response.ok) {
        throw new Error('Failed to fetch form details');
    }
    return response.json();
})
.then(data => {
    if (!data || !data.questions) {
        throw new Error('Invalid form data received');
    }
    
    formData = data;
    isSurveyForm = data.form_type === 'survey';
    
    if (isSurveyForm) {
        document.querySelector('.container').style.backgroundColor = '#fffff0';
    }
    
    document.getElementById('form-title').textContent = data.title;
    document.getElementById('form-description').textContent = data.description;

    if (!isSurveyForm) {
        const totalPoints = data.questions.reduce((sum, question) => sum + question.points, 0);
        document.getElementById('total-points').textContent = `Total Maximum Points: ${totalPoints}`;
    } else {
        document.getElementById('total-points').style.display = 'none';
    }

    renderForm(data);

    document.getElementById('form-submit').addEventListener('submit', function(event) {
        event.preventDefault();
        const responses = collectResponses();
        submitForm(responses);
    });
})
.catch(error => {
    console.error('Form loading error:', error);
    alert('Error loading form: ' + error.message);
});

window.addEventListener('beforeunload', function(e) {
    if (!isSurveyForm) {
        handleAutoSubmit();
        e.preventDefault();
        e.returnValue = '';
    }
});

document.addEventListener('visibilitychange', function() {
    if (!isSurveyForm && document.visibilityState === 'hidden') {
        handleAutoSubmit();
    }
});

window.addEventListener('resize', handleResize);