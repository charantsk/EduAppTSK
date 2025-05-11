from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime
import enum
import os
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

db = SQLAlchemy()

def get_enum_from_env(name, default_values):
    values = os.getenv(name, ",".join(default_values)).split(",")
    return enum.Enum(name, {val.upper(): val for val in values})

# Enums for roles and question types
UserRole = get_enum_from_env("USER_ROLES", ["staff", "student", "other"])
QuestionType = get_enum_from_env("QUESTION_TYPES", [
    "single_word", "multi_word",  # Changed multi_word to multiword
    "true_false", "attachment",
    "link", "number", "date", 
    "multiple_choice", "checkbox"
])

# New ClassGroup enum with default academic years and departments
ClassGroup = get_enum_from_env("CLASS_GROUPS", [
    "year1_cse", "year1_ece", "year1_mech",
    "year2_cse", "year2_ece", "year2_mech",
    "year3_cse", "year3_ece", "year3_mech",
    "year4_cse", "year4_ece", "year4_mech"
])

FormType = get_enum_from_env("FORM_TYPES", ["notification", "question_bank", "survey"])

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(120), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False)
    class_group = db.Column(db.Enum(ClassGroup), nullable=True)  # New field for class/department

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

class Form(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    form_type = db.Column(db.Enum(FormType), nullable=False, default=FormType.NOTIFICATION)
    time_limit = db.Column(db.Integer)
    questions = db.relationship('Question', backref='form', lazy=True, cascade='all, delete-orphan')
    submissions = db.relationship('Submission', backref='form', lazy=True, cascade='all, delete-orphan')
    target_class_group = db.Column(db.String(50))
    scheduled_at = db.Column(db.DateTime)
    deadline = db.Column(db.DateTime)  # New deadline field

class Question(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.Integer, db.ForeignKey('form.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    type = db.Column(db.Enum(QuestionType), nullable=False)
    correct_answer = db.Column(db.String(200), nullable=False)
    keywords = db.Column(db.String(500))  # Store keywords as comma-separated string
    points = db.Column(db.Integer, default=1)
    choices = db.Column(db.JSON)

class Submission(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    form_id = db.Column(db.Integer, db.ForeignKey('form.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    responses = db.Column(db.Text, nullable=False)
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    score = db.Column(db.Float, nullable=False, default=0.0)
    autosubmitted = db.Column(db.String(255), nullable=True)  # Reason for auto-submission
    strike = db.Column(db.Integer, nullable=False, default=0)  # Strike count

class Course(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    target_class_group = db.Column(db.String(50), nullable=False)  # Stored as a string
    modules = db.relationship('Module', backref='course', lazy=True, cascade='all, delete-orphan')

class Module(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('course.id'), nullable=False)
    files = db.relationship('File', backref='module', lazy=True, cascade='all, delete-orphan')

class File(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_url = db.Column(db.String(500), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    module_id = db.Column(db.Integer, db.ForeignKey('module.id'), nullable=False)

class Research(db.Model):
    __tablename__ = 'research'
    
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    tags = db.Column(db.String(255))
    research_type = db.Column(db.String(50))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user_id = db.Column(db.Integer, nullable=False)
    files = db.relationship('ResearchFile', backref='research', lazy=True, cascade="all, delete-orphan")

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'tags': self.tags.split(',') if self.tags else [],
            'research_type': self.research_type,
            'files': [file.to_dict() for file in self.files],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'user_id': self.user_id
        }

class ResearchFile(db.Model):
    __tablename__ = 'research_files'
    
    id = db.Column(db.Integer, primary_key=True)
    research_id = db.Column(db.Integer, db.ForeignKey('research.id'), nullable=False)
    file_path = db.Column(db.String(255))
    file_name = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'research_id': self.research_id,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }



