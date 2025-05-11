# view_routes.py
from flask import Blueprint, render_template, redirect, url_for,jsonify,request
from flask_login import login_required, current_user
from models import db, User, UserRole, Submission, Form
from utils import requires_role
from edbot import EdBot  # Import the EdBot class
import requests
from utils import has_submitted_form
from datetime import datetime, timezone


# Initialize EdBot (you might want to do this at application startup)
bot = EdBot(model_path="customweights.gguf")  # Adjust the path as needed

view_bp = Blueprint('view', __name__)


@view_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('view.dashboard'))
    return render_template('index.html')
    

@view_bp.route('/tutor')
@login_required
@requires_role(UserRole.STUDENT)
def tutor():
    return render_template('tutor.html')


@view_bp.route('/student_courses')
@login_required
@requires_role(UserRole.STUDENT)
def student_courses():
    return render_template('student_courses.html')


@view_bp.route('/staff_courses')
@login_required
@requires_role(UserRole.STAFF)
def staff_courses():
    return render_template('staff_courses.html')

@view_bp.route('/student_research')
@login_required
@requires_role(UserRole.STUDENT)
def student_research():
    return render_template('student_research.html')


@view_bp.route('/login', methods=['GET', 'POST'])
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('view.dashboard'))
    return render_template('login.html')

@view_bp.route('/dashboard')
@login_required
def dashboard():
    if current_user.role == UserRole.STAFF:
        return render_template('staff_dashboard.html')
    elif current_user.role == UserRole.STUDENT:
        return render_template('student_dashboard.html')
    return jsonify({"error": "Unauthorized"}), 403

@view_bp.route('/student_profile')
@login_required
def student_profile():
    student = current_user
    # Fetch submissions for the current user
    submissions = db.session.query(
        Submission, Form.title.label('form_title')
    ).join(
        Form, Submission.form_id == Form.id
    ).filter(
        Submission.user_id == current_user.id
    ).all()
    
    # Format submissions data
    submissions_data = [{
        'form_title': sub.form_title,
        'submitted_at': sub.Submission.submitted_at,
        'score': sub.Submission.score
    } for sub in submissions]
    
    return render_template('student_profile.html', 
                        student=student, 
                        submissions=submissions_data)

@view_bp.route('/staff_profile')
@login_required
def staff_profile():
    staff = current_user
    return render_template('staff_profile.html', staff=staff)

@view_bp.route('/register_user', methods=['GET', 'POST'])
def create_user_page():
    return render_template('create_user.html')

@view_bp.route('/staff/create_form')
@login_required
@requires_role(UserRole.STAFF)
def create_form_page():
    return render_template('create_form.html')

@view_bp.route('/staff/view_form')
@login_required
@requires_role(UserRole.STAFF)
def view_form_page():
    form_id = request.args.get('form_id')
    if not form_id:
        return redirect(url_for('dashboard'))
    
    return render_template('view_form.html', form_id=form_id)

@view_bp.route('/student/submit_form')
@login_required
@requires_role(UserRole.STUDENT)
def submit_form_page():
    form_id = request.args.get('form_id')
    if not form_id:
        return redirect(url_for('dashboard'))

    form = Form.query.get(int(form_id))
    if not form:
        return render_template('error.html', message="Form not found"), 404

    # Check if the user has already submitted the form
    if has_submitted_form(current_user.id, int(form_id)):
        return render_template('error.html', message="You have already submitted this form"), 403

    # Get the current local time
    current_time = datetime.now()

    # Log the values to see if the comparison is correct
    print(f"Current Time: {current_time}")
    print(f"Form Scheduled At: {form.scheduled_at}")
    print(f"Form Deadline: {form.deadline}")

    # Check if it's past the deadline
    if form.deadline and current_time > form.deadline:
        print("Deadline has passed, rendering deadline_passed.html")
        return render_template('deadline_passed.html', deadline=form.deadline)

    # Check if it's before the scheduled time
    elif form.scheduled_at and current_time < form.scheduled_at:
        print("Before scheduled time, rendering wait_for_test.html")
        return render_template('wait_for_test.html', scheduled_at=form.scheduled_at)

    # If it's between scheduled time and deadline, show the form
    print("Within scheduled time and deadline, rendering submit_form.html")
    return render_template('submit_form.html', form_id=form_id)

@view_bp.route('/api/evaluate-answer', methods=['POST'])
def evaluate():
    try:
        data = request.json
        mode = data.get("mode")
        question = data.get("question")
        correct_answer = data.get("correct_answer")
        user_answer = data.get("user_answer")
        keywords = data.get("keywords", [])  # Optional
        context = data.get("context")  # Optional

        # Validate required fields
        if not all([mode, question, correct_answer, user_answer]):
            return jsonify({
                "error": "Missing required fields. Please provide mode, question, correct_answer, and user_answer"
            }), 400

        if mode != "evaluate":
            return jsonify({"error": "Invalid mode"}), 400

        # Process the evaluation using EdBot
        result = bot.process(
            mode=mode,
            question=question,
            correct_answer=correct_answer,
            user_answer=user_answer,
            keywords=keywords,
            context=context
        )

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@view_bp.route('/api/tutor', methods=['POST'])
def tutor_chat():
    try:
        data = request.json
        question = data.get("message")

        if not question:
            return jsonify({
                "error": "Missing required field: message"
            }), 400

        # Send the user's question to the local AI model
        response = requests.post(
            "http://127.0.0.1:5001/chat",
            json={"prompt": question},
            timeout=60
        )

        # If model API fails
        if response.status_code != 200:
            return jsonify({
                "error": f"Model server error: {response.status_code}",
                "details": response.text
            }), response.status_code

        # Extract and return AI's message
        ai_response = response.json().get("response", "No response from AI model.")
        return jsonify({
            "response": ai_response
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500