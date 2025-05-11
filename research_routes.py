from flask import Blueprint, request, jsonify, send_from_directory
from flask_login import login_required, current_user
from models import db, Research, ResearchFile
import os
import json
from werkzeug.utils import secure_filename
import uuid
import logging

research_bp = Blueprint('research', __name__)

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def save_research_file(file, upload_dir):
    if not file or not file.filename:
        return None, None
    filename = secure_filename(file.filename)
    unique_filename = f"{uuid.uuid4()}_{filename}"
    file_path = os.path.join(upload_dir, unique_filename)
    logger.debug(f"Saving file to {file_path}")
    file.save(file_path)
    return f"research/{unique_filename}", filename

@research_bp.route('/Uploads/<path:filename>')
@login_required
def serve_uploaded_file(filename):
    return send_from_directory('Uploads', filename)

@research_bp.route('/research/add', methods=['POST'])
@login_required
def add_research():
    try:
        UPLOAD_FOLDER = 'Uploads'
        upload_dir = os.path.join(UPLOAD_FOLDER, 'research')
        logger.debug(f"Ensuring upload directory exists: {upload_dir}")
        os.makedirs(upload_dir, exist_ok=True)

        title = request.form.get('title')
        description = request.form.get('description')
        tags = request.form.get('tags')
        research_type = request.form.get('research_type')
        logger.debug(f"Received form data: title={title}, research_type={research_type}, tags={tags}")

        if not title or not research_type:
            logger.error("Missing required fields: title and research_type")
            return jsonify({"error": "Missing required fields: title and research_type"}), 400

        new_research = Research(
            title=title,
            description=description,
            tags=tags,
            research_type=research_type,
            user_id=current_user.id
        )
        db.session.add(new_research)
        db.session.flush()
        logger.debug(f"Created new research item with ID: {new_research.id}")

        files = request.files.getlist('files')
        logger.debug(f"Received {len(files)} files: {[f.filename for f in files if f.filename]}")
        for file in files:
            if file and file.filename:
                file_path, file_name = save_research_file(file, upload_dir)
                if file_path:
                    new_file = ResearchFile(
                        research_id=new_research.id,
                        file_path=file_path,
                        file_name=file_name
                    )
                    db.session.add(new_file)
                    logger.debug(f"Added file: {file_name} with path: {file_path}")
                else:
                    logger.warning(f"Failed to save file: {file.filename}")

        db.session.commit()
        logger.info(f"Successfully added research item with ID: {new_research.id}")
        return jsonify({
            "message": "Research item added successfully",
            "research_id": new_research.id,
            "research": new_research.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error adding research item: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@research_bp.route('/research/update/<int:research_id>', methods=['PUT'])
@login_required
def update_research(research_id):
    try:
        UPLOAD_FOLDER = 'Uploads'
        upload_dir = os.path.join(UPLOAD_FOLDER, 'research')
        logger.debug(f"Ensuring upload directory exists: {upload_dir}")
        os.makedirs(upload_dir, exist_ok=True)

        research = Research.query.get_or_404(research_id)
        if research.user_id != current_user.id:
            logger.error("Unauthorized access attempt")
            return jsonify({"error": "Unauthorized"}), 403

        research.title = request.form.get('title', research.title)
        research.description = request.form.get('description', research.description)
        research.tags = request.form.get('tags', research.tags)
        research.research_type = request.form.get('research_type', research.research_type)
        logger.debug(f"Updated research item fields: title={research.title}, research_type={research.research_type}")

        existing_file_ids = request.form.get('existing_files', '[]')
        existing_file_ids = json.loads(existing_file_ids)
        logger.debug(f"Existing file IDs to keep: {existing_file_ids}")
        current_files = ResearchFile.query.filter_by(research_id=research_id).all()
        for file in current_files:
            if file.id not in existing_file_ids:
                file_path = os.path.join(UPLOAD_FOLDER, file.file_path)
                if os.path.exists(file_path):
                    os.remove(file_path)
                    logger.debug(f"Deleted file: {file_path}")
                db.session.delete(file)

        files = request.files.getlist('files')
        logger.debug(f"Received {len(files)} files for update: {[f.filename for f in files if f.filename]}")
        for file in files:
            if file and file.filename:
                file_path, file_name = save_research_file(file, upload_dir)
                if file_path:
                    new_file = ResearchFile(
                        research_id=research_id,
                        file_path=file_path,
                        file_name=file_name
                    )
                    db.session.add(new_file)
                    logger.debug(f"Added new file: {file_name} with path: {file_path}")

        db.session.commit()
        logger.info(f"Successfully updated research item with ID: {research_id}")
        return jsonify({
            "message": "Research item updated successfully",
            "research": research.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating research item: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@research_bp.route('/research/delete/<int:research_id>', methods=['DELETE'])
@login_required
def delete_research(research_id):
    try:
        UPLOAD_FOLDER = 'Uploads'
        research = Research.query.get_or_404(research_id)
        if research.user_id != current_user.id:
            logger.error("Unauthorized access attempt")
            return jsonify({"error": "Unauthorized"}), 403

        for file in research.files:
            file_path = os.path.join(UPLOAD_FOLDER, file.file_path)
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.debug(f"Deleted file: {file_path}")

        db.session.delete(research)
        db.session.commit()
        logger.info(f"Successfully deleted research item with ID: {research_id}")
        return jsonify({"message": "Research item deleted successfully"})
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting research item: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@research_bp.route('/research', methods=['GET'])
@login_required
def list_research():
    try:
        research_items = Research.query.filter_by(user_id=current_user.id).all()
        logger.debug(f"Fetched {len(research_items)} research items for user {current_user.id}")
        return jsonify([item.to_dict() for item in research_items]), 200
    except Exception as e:
        logger.error(f"Error listing research items: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@research_bp.route('/research/<int:research_id>', methods=['GET'])
@login_required
def get_research(research_id):
    try:
        research = Research.query.get_or_404(research_id)
        if research.user_id != current_user.id:
            logger.error("Unauthorized access attempt")
            return jsonify({"error": "Unauthorized"}), 403
        logger.debug(f"Fetched research item with ID: {research_id}")
        return jsonify(research.to_dict())
    except Exception as e:
        logger.error(f"Error getting research item: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@research_bp.route('/research/search', methods=['GET'])
@login_required
def search_research():
    try:
        query = request.args.get('q', '')
        research_type = request.args.get('type', None)
        base_query = Research.query.filter_by(user_id=current_user.id)
        if query:
            base_query = base_query.filter(
                (Research.title.ilike(f'%{query}%')) |
                (Research.description.ilike(f'%{query}%')) |
                (Research.tags.ilike(f'%{query}%'))
            )
        if research_type:
            base_query = base_query.filter_by(research_type=research_type)
        results = base_query.all()
        logger.debug(f"Search returned {len(results)} results for query: {query}")
        return jsonify([item.to_dict() for item in results])
    except Exception as e:
        logger.error(f"Error searching research items: {str(e)}", exc_info=True)
        return jsonify({"error": str(e)}), 500