from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
import enum
import os
from datetime import datetime
import json
from flask import render_template, redirect, url_for
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'  # Change this in production
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///forms.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

# Helper function to load enums from .env
def get_enum_from_env(name, default_values):
    values = os.getenv(name, ",".join(default_values)).split(",")
    return enum.Enum(name, {val.upper(): val for val in values})

# Enums for roles and question types
UserRole = get_enum_from_env("USER_ROLES", ["staff", "student", "other"])
QuestionType = get_enum_from_env("QUESTION_TYPES", [
    "single_word", "multi_word", "true_false", "attachment",
    "link", "number", "date", "multiple_choice", "checkbox"
])
FormType = get_enum_from_env("FORM_TYPES", ["notification", "question_bank", "survey"])


# Database Models
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)  # Add this line
    password_hash = db.Column(db.String(120), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

# Update Form model to include form_type
class Form(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    form_type = db.Column(db.Enum(FormType), nullable=False, default=FormType.NOTIFICATION)
    time_limit = db.Column(db.Integer)  # Add this line (time limit in minutes)
    questions = db.relationship('Question', backref='form', lazy=True, cascade='all, delete-orphan')
    submissions = db.relationship('Submission', backref='form', lazy=True, cascade='all, delete-orphan')
    
class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.Integer, db.ForeignKey('form.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    type = db.Column(db.Enum(QuestionType), nullable=False)
    correct_answer = db.Column(db.String(200), nullable=False)  # Added correct answer field
    points = db.Column(db.Integer, default=1)  # Points for this question
    choices = db.Column(db.JSON)

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.Integer, db.ForeignKey('form.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    responses = db.Column(db.Text, nullable=False)  # JSON string of responses
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    score = db.Column(db.Float, nullable=False, default=0.0)  # Added score field


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({"error": "Internal server error", "details": str(error)}), 500

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Helper functions
def requires_role(*roles):
    def wrapper(f):
        @login_required
        def wrapped(*args, **kwargs):
            if current_user.role not in roles:
                return jsonify({"error": "Unauthorized"}), 403
            return f(*args, **kwargs)
        wrapped.__name__ = f.__name__
        return wrapped
    return wrapper

def calculate_score(form_id, responses):
    """Calculate the score for a submission based on correct answers."""
    total_score = 0
    total_points = 0
    questions = Question.query.filter_by(form_id=form_id).all()
    
    responses_dict = json.loads(responses) if isinstance(responses, str) else responses
    
    for question in questions:
        total_points += question.points
        if str(question.id) in responses_dict:
            student_answer = str(responses_dict[str(question.id)]).strip().lower()
            correct_answer = str(question.correct_answer).strip().lower()
            
            # If correct answer is 'null', consider any answer as correct
            if correct_answer == 'null' or student_answer == correct_answer:
                total_score += question.points
    
    return (total_score / total_points * 100) if total_points > 0 else 0

# Authentication routes

@app.route('/api/users/create', methods=['POST'])
def create_user():
    data = request.get_json()
    if User.query.filter_by(username=data['username']).first():
        return jsonify({"error": "Username already exists"}), 400
    
    # Check if email exists and is unique (if provided)
    if 'email' in data:
        if User.query.filter_by(email=data['email']).first():
            return jsonify({"error": "Email already exists"}), 400
    
    user = User(
        username=data['username'],
        role=UserRole[data['role'].upper()],
        email=data.get('email')  # This will be None if email is not provided
    )
    user.set_password(data['password'])
    db.session.add(user)
    db.session.commit()
    return jsonify({"message": "User created successfully"}), 201


@app.route('/api/users/<int:user_id>', methods=['PUT'])
@requires_role(UserRole.STAFF)
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if 'username' in data:
        user.username = data['username']
    if 'password' in data:
        user.set_password(data['password'])
    if 'role' in data:
        user.role = UserRole[data['role'].upper()]
    if 'email' in data:
        # Check if the new email is unique (if it's different from current)
        if data['email'] != user.email:
            if User.query.filter_by(email=data['email']).first():
                return jsonify({"error": "Email already exists"}), 400
        user.email = data['email']
    
    db.session.commit()
    return jsonify({"message": "User updated successfully"})


@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@requires_role(UserRole.STAFF)
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted successfully"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    user = User.query.filter_by(username=data['username']).first()
    
    if user and user.check_password(data['password']):
        login_user(user)
        return jsonify({"message": "Logged in successfully"})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    return jsonify({"message": "Logged out successfully"})

# Form management routes
@app.route('/api/forms/create', methods=['POST'])
@requires_role(UserRole.STAFF)
def create_form():
    try:
        data = request.get_json()
        print("Received data:", data)
        
        if not data:
            return jsonify({"error": "No data provided"}), 400
        
        if not data.get('title'):
            return jsonify({"error": "Form title is required"}), 400

        form_type = FormType[data.get('form_type', 'NOTIFICATION').upper()]

        form = Form(
            title=data['title'],
            description=data.get('description', ''),
            created_by=current_user.id,
            form_type=form_type,
            time_limit=data.get('time_limit') if form_type == FormType.QUESTION_BANK else None  # Add this line
        )
        
        for q_data in data['questions']:
            print("Processing question:", q_data)
            try:
                question = Question(
                    text=q_data['text'],
                    type=QuestionType[q_data['type']],
                    correct_answer=q_data['correct_answer'],
                    points=int(q_data.get('points', 1)),
                    choices=q_data.get('choices', [])  
                )
                form.questions.append(question)
            except KeyError as e:
                print(f"KeyError: {e}")
                return jsonify({"error": f"Missing required field in question: {str(e)}"}), 400
            except ValueError as e:
                print(f"ValueError: {e}")
                return jsonify({"error": f"Invalid value in question: {str(e)}"}), 400
        
        db.session.add(form)
        db.session.commit()
        return jsonify({"message": "Form created successfully", "form_id": form.id}), 201
    
    except Exception as e:
        db.session.rollback()
        print(f"Error creating form: {str(e)}")
        return jsonify({"error": f"Internal server error: {str(e)}"}), 500

@app.route('/api/forms/<int:form_id>', methods=['PUT'])
@requires_role(UserRole.STAFF)
def edit_form(form_id):
    form = Form.query.get_or_404(form_id)
    data = request.get_json()
    
    form.title = data.get('title', form.title)
    form.description = data.get('description', form.description)
    
    if 'questions' in data:
        Question.query.filter_by(form_id=form_id).delete()
        for q_data in data['questions']:
            question = Question(
                form_id=form_id,
                text=q_data['text'],
                type=QuestionType[q_data['type'].upper()],
                correct_answer=q_data['correct_answer'],  # Added correct answer
                points=q_data.get('points', 1)  # Added points
            )
            db.session.add(question)
    
    db.session.commit()
    return jsonify({"message": "Form updated successfully"})

@app.route('/api/forms/<int:form_id>', methods=['DELETE'])
@requires_role(UserRole.STAFF)
def delete_form(form_id):
    form = Form.query.get_or_404(form_id)
    db.session.delete(form)
    db.session.commit()
    return jsonify({"message": "Form deleted successfully"})




@app.route('/api/forms', methods=['GET'])
@login_required
def get_all_forms():
    if current_user.role == UserRole.STUDENT:
        forms = Form.query.filter(Form.form_type.in_([FormType.QUESTION_BANK, FormType.NOTIFICATION,FormType.SURVEY])).all()
    else:
        forms = Form.query.all()

    # Debugging: Log the forms data to ensure the staff are getting data
    print("Forms for Staff:", forms)

    forms_data = {
        'forms': [],
        'notifications': []
    }

    for form in forms:
        form_data = {
            'id': form.id,
            'title': form.title,
            'description': form.description,
            'created_by': form.created_by,
            'created_at': form.created_at.isoformat(),
            'form_type': form.form_type.value
        }

        if form.form_type == FormType.NOTIFICATION:
            forms_data['notifications'].append(form_data)
        else:
            if current_user.role == UserRole.STUDENT:
                form_data['already_submitted'] = has_submitted_form(current_user.id, form.id)
            forms_data['forms'].append(form_data)

    return jsonify(forms_data)

@app.route('/api/forms/<int:form_id>', methods=['GET'])
@login_required
def get_form_details(form_id):
    form = Form.query.get_or_404(form_id)
    
    # Students can access QUESTION_BANK and SURVEY so they can enter stuff
    if current_user.role == UserRole.STUDENT and form.form_type not in [FormType.QUESTION_BANK, FormType.SURVEY]:
        return jsonify({"error": "Unauthorized"}), 403
    
    questions_data = [{
    'id': q.id,
    'text': q.text,
    'type': q.type.value,
    'points': q.points,
    'choices': q.choices if q.type == QuestionType.MULTIPLE_CHOICE else None
} for q in form.questions]
    
    # Add correct answers only for staff members
    if current_user.role == UserRole.STAFF:
        for i, q in enumerate(form.questions):
            questions_data[i]['correct_answer'] = q.correct_answer
    
    return jsonify({
        'id': form.id,
        'title': form.title,
        'description': form.description,
        'created_by': form.created_by,
        'created_at': form.created_at.isoformat(),
        'form_type': form.form_type.value,
        'time_limit': form.time_limit,  # Include time_limit in response
        'questions': questions_data
    })


# Form submission routes
@app.route('/api/forms/<int:form_id>/submit', methods=['POST'])
@login_required
def submit_form(form_id):
    # Check if the user has already submitted this form
    if has_submitted_form(current_user.id, form_id):
        return jsonify({
            "error": "You have already submitted this form"
        }), 403
    
    form = Form.query.get_or_404(form_id)
    data = request.get_json()
    
    # Calculate score for the submission
    score = calculate_score(form_id, data['responses'])
    
    submission = Submission(
        form_id=form_id,
        user_id=current_user.id,
        responses=json.dumps(data['responses']),
        score=score
    )
    
    db.session.add(submission)
    db.session.commit()
    return jsonify({
        "message": "Form submitted successfully",
        "submission_id": submission.id,
        "score": score
    }), 201

@app.route('/api/forms/<int:form_id>/submissions', methods=['GET'])
@requires_role(UserRole.STAFF)
def get_form_submissions(form_id):
    form = Form.query.get_or_404(form_id)
    submissions = Submission.query.filter_by(form_id=form_id).all()
    
    # Get all questions for this form
    questions = {q.id: {
        'text': q.text,
        'correct_answer': q.correct_answer,
        'type': q.type.value,
        'points': q.points
    } for q in form.questions}
    
    return jsonify([{
        'id': sub.id,
        'user_id': sub.user_id,
        'responses': json.loads(sub.responses),
        'submitted_at': datetime.now(timezone.utc),
        'score': sub.score if form.form_type == FormType.QUESTION_BANK else None,
        'form_type': form.form_type.value,
        'questions': questions  # Include questions data
    } for sub in submissions])

@app.route('/api/forms/submissions/<int:submission_id>', methods=['DELETE'])
@requires_role(UserRole.STAFF)
def delete_submission(submission_id):
    submission = Submission.query.get_or_404(submission_id)
    db.session.delete(submission)
    db.session.commit()
    return jsonify({"message": "Submission deleted successfully"})



def has_submitted_form(user_id, form_id):
    """Check if a user has already submitted a particular form."""
    submission = Submission.query.filter_by(
        user_id=user_id,
        form_id=form_id
    ).first()
    return submission is not None


# HTML Routes

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['GET', 'POST'])
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('login.html')


@app.route('/dashboard')
@login_required
def dashboard():
    if current_user.role == UserRole.STAFF:
        return render_template('staff_dashboard.html')
    elif current_user.role == UserRole.STUDENT:
        return render_template('student_dashboard.html')
    return jsonify({"error": "Unauthorized"}), 403

@app.route('/student_profile')
@login_required  # Ensure user is logged in
def student_profile():
    # Fetch the actual student data from the database (assuming current_user is a student)
    student = current_user  # Or you can fetch a specific student using their ID
    
    return render_template('student_profile.html', student=student)


@app.route('/staff_profile')
@login_required  # Ensure user is logged in
def staff_profile():
    # Fetch the actual student data from the database (assuming current_user is a student)
    staff = current_user  # Or you can fetch a specific student using their ID
    
    return render_template('staff_profile.html', staff=staff)


@app.route('/register_user', methods=['GET', 'POST'])
@requires_role(UserRole.STAFF)
def create_user_page():
    return render_template('create_user.html')


@app.route('/staff/create_form')
@login_required
@requires_role(UserRole.STAFF)
def create_form_page():
    return render_template('create_form.html')

@app.route('/staff/view_form')
@login_required
@requires_role(UserRole.STAFF)
def view_form_page():
    form_id = request.args.get('form_id')
    if not form_id:
        return redirect(url_for('dashboard'))
    return render_template('view_form.html', form_id=form_id)


@app.route('/student/submit_form')
@login_required
@requires_role(UserRole.STUDENT)
def submit_form_page():
    form_id = request.args.get('form_id')
    if not form_id:
        return redirect(url_for('dashboard'))
    
    # Check if the student has already submitted this form
    if has_submitted_form(current_user.id, int(form_id)):
        return render_template('error.html', 
                             message="You have already submitted this form"), 403
    
    return render_template('submit_form.html', form_id=form_id)


@app.route('/api/user/submissions')
@login_required
def get_user_submissions():
    submissions = Submission.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        'id': sub.id,
        'form_id': sub.form_id,
        'form_title': Form.query.get(sub.form_id).title,
        'submitted_at': sub.submitted_at.isoformat(),
        'score': sub.score
    } for sub in submissions])


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)