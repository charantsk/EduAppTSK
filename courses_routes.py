import os
import json
from datetime import datetime
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename

from models import db, Course, Module, File, UserRole
from utils import requires_role

courses_bp = Blueprint('courses', __name__)

UPLOAD_FOLDER = os.path.join('static', 'uploads', 'modules')
ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# Add a new course with multiple file upload
@courses_bp.route('/staff/course/add', methods=['POST'])
@login_required
@requires_role(UserRole.STAFF)
def add_course():
    try:
        course_data_str = request.form.get('course')
        if not course_data_str:
            return jsonify({"error": "Missing course data"}), 400
        
        course_data = json.loads(course_data_str)

        title = course_data.get('title')
        description = course_data.get('description')
        target_class_group = current_user.class_group.name.lower()
        modules_data = course_data.get('modules', [])

        if not title or not target_class_group:
            return jsonify({"error": "Missing required fields: title and target_class_group"}), 400

        new_course = Course(
            title=title,
            description=description,
            target_class_group=target_class_group,
            created_by=current_user.id,
            created_at=datetime.utcnow()
        )
        db.session.add(new_course)
        db.session.commit()

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        for index, module_data in enumerate(modules_data):
            module_title = module_data.get('title')
            if not module_title:
                return jsonify({"error": "Module title is required"}), 400

            new_module = Module(
                title=module_title,
                description=module_data.get('description'),
                course_id=new_course.id
            )
            db.session.add(new_module)
            db.session.flush()

            # Handle multiple files for each module
            file_keys = [key for key in request.files.keys() if key.startswith(f'file_{index}_')]
            
            if not file_keys:
                # Check if there's a single file for backward compatibility
                single_file_key = f'file_{index}'
                if single_file_key in request.files:
                    file_keys = [single_file_key]
            
            for file_key in file_keys:
                file = request.files[file_key]
                if file and allowed_file(file.filename):
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(UPLOAD_FOLDER, filename)
                    file.save(file_path)

                    file_url = f"/{file_path.replace(os.sep, '/')}"
                    new_file = File(
                        filename=filename,
                        file_url=file_url,
                        module_id=new_module.id
                    )
                    db.session.add(new_file)
                elif file.filename:  # Only show error if a file was actually selected
                    return jsonify({"error": f"Invalid file format for {file_key}"}), 400

        db.session.commit()
        return jsonify({"message": "Course added successfully", "course_id": new_course.id}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Update an existing course with multiple file upload
@courses_bp.route('/staff/course/update/<int:course_id>', methods=['PUT'])
@login_required
@requires_role(UserRole.STAFF)
def update_course(course_id):
    try:
        course = Course.query.get_or_404(course_id)

        course_data_str = request.form.get('course')
        if not course_data_str:
            return jsonify({"error": "Missing course data"}), 400

        course_data = json.loads(course_data_str)

        course.title = course_data.get('title', course.title)
        course.description = course_data.get('description', course.description)
        course.target_class_group = course_data.get('target_class_group', course.target_class_group)
        modules_data = course_data.get('modules', [])

        os.makedirs(UPLOAD_FOLDER, exist_ok=True)

        for index, module_data in enumerate(modules_data):
            module_id = module_data.get('id')
            module_title = module_data.get('title')
            if not module_title:
                return jsonify({"error": "Module title is required"}), 400

            # Handle multiple files for this module
            file_keys = [key for key in request.files.keys() if key.startswith(f'file_{index}_')]
            
            if not file_keys:
                # Check if there's a single file for backward compatibility
                single_file_key = f'file_{index}'
                if single_file_key in request.files and request.files[single_file_key].filename:
                    file_keys = [single_file_key]

            if module_id:
                existing_module = Module.query.get(module_id)
                if existing_module:
                    existing_module.title = module_title
                    existing_module.description = module_data.get('description', existing_module.description)

                    # Add new files to existing module
                    for file_key in file_keys:
                        file = request.files[file_key]
                        if file and allowed_file(file.filename):
                            filename = secure_filename(file.filename)
                            file_path = os.path.join(UPLOAD_FOLDER, filename)
                            file.save(file_path)
                            file_url = f"/{file_path.replace(os.sep, '/')}"
                            new_file = File(
                                filename=filename,
                                file_url=file_url,
                                module_id=existing_module.id
                            )
                            db.session.add(new_file)
                        elif file.filename:  # Only show error if a file was actually selected
                            return jsonify({"error": f"Invalid file for {file_key}"}), 400
            else:
                # Create a new module
                new_module = Module(
                    title=module_title,
                    description=module_data.get('description'),
                    course_id=course.id
                )
                db.session.add(new_module)
                db.session.flush()

                # Add files to new module
                for file_key in file_keys:
                    file = request.files[file_key]
                    if file and allowed_file(file.filename):
                        filename = secure_filename(file.filename)
                        file_path = os.path.join(UPLOAD_FOLDER, filename)
                        file.save(file_path)
                        file_url = f"/{file_path.replace(os.sep, '/')}"
                        new_file = File(
                            filename=filename,
                            file_url=file_url,
                            module_id=new_module.id
                        )
                        db.session.add(new_file)
                    elif file.filename:  # Only show error if a file was actually selected
                        return jsonify({"error": f"Invalid file for {file_key}"}), 400

        db.session.commit()
        return jsonify({"message": "Course and modules updated successfully"})

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500


# Delete a course
@courses_bp.route('/staff/course/delete/<int:course_id>', methods=['DELETE'])
@login_required
@requires_role(UserRole.STAFF)
def delete_course(course_id):
    try:
        course = Course.query.get_or_404(course_id)
        db.session.delete(course)
        db.session.commit()
        return jsonify({"message": "Course deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# Delete a specific file from a module
@courses_bp.route('/staff/file/delete/<int:file_id>', methods=['DELETE'])
@login_required
@requires_role(UserRole.STAFF)
def delete_file(file_id):
    try:
        file = File.query.get_or_404(file_id)
        db.session.delete(file)
        db.session.commit()
        return jsonify({"message": "File deleted successfully"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# List all courses
@courses_bp.route('/staff/courses', methods=['GET'])
@login_required
def list_courses():
    try:
        courses = Course.query.filter_by(target_class_group=current_user.class_group.name.lower()).all()
        courses_data = []

        for course in courses:
            course_data = {
                "id": course.id,
                "title": course.title,
                "description": course.description,
                "target_class_group": course.target_class_group,
                "created_at": course.created_at,
                "modules": []
            }

            for module in course.modules:
                module_data = {
                    "id": module.id,
                    "title": module.title,
                    "description": module.description,
                    "files": [
                        {"id": f.id, "filename": f.filename, "file_path": f.file_url} for f in module.files
                    ]
                }
                course_data["modules"].append(module_data)

            courses_data.append(course_data)

        return jsonify(courses_data)

    except Exception as e:
        return jsonify({"error": str(e)}), 500