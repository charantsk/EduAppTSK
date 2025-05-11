from flask import Flask, request, jsonify
from llama_cpp import Llama
import re
import traceback

# Initialize Flask app
app = Flask(__name__)

# Load the GGUF model once when the server starts
model = Llama(model_path="customweights.gguf", n_ctx=512)

@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_prompt = data.get("prompt", "")

    if not user_prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Structured chat format
    chat_messages = [
        {"role": "system", "content": "You are a helpful, intelligent assistant."},
        {"role": "user", "content": user_prompt + "Can u give response without emojis"}
    ]

    # Generate the response
    response = model.create_chat_completion(
        messages=chat_messages,
        max_tokens=256,
        temperature=0.7,
        top_p=0.95,
        stop=["</s>"]
    )

    answer = response['choices'][0]['message']['content'].strip()
    return jsonify({"response": answer})

@app.route('/evaluate', methods=['POST'])
def evaluate():
    try:
        data = request.json
        question = data.get("question", "")
        answer = data.get("answer", "")

        print("Question : ", question)
        print("Answer : ", answer)

        if not question or not answer:
            return jsonify({"error": "Question and answer are required"}), 400

        prompt = (
            f"You are a strict evaluator.\n"
            f"Evaluate the following answer from 0 to 10 (can be decimal).\n"
            f"ONLY return the number. DO NOT explain. DO NOT say anything else.\n\n"
            f"Question: {question}\nAnswer: {answer}\nScore:"
        )

        chat_messages = [
            {"role": "system", "content": "Return only a numeric score (like 7 or 8.5). Do not write anything else."},
            {"role": "user", "content": prompt}
        ]

        response = model.create_chat_completion(
            messages=chat_messages,
            max_tokens=256,
            temperature=0.7,
            top_p=0.95,
            stop=["</s>"]
        )

        output = response['choices'][0]['message']['content'].strip()
        print("=== Raw Model Output ===")
        print(output)

        import re
        match = re.match(r"^\d+(\.\d+)?$", output)
        if match:
            return jsonify({"score": float(match.group())})

        fallback = re.search(r"(\d+(\.\d+)?)", output)
        if fallback:
            return jsonify({"score": float(fallback.group(1))})

        return jsonify({
            "error": "Could not extract score from model output",
            "model_output": output
        }), 500
    except Exception as e:
        print("=== Exception Occurred ===")
        traceback.print_exc()
        return jsonify({"error": "Internal Server Error", "details": str(e)}), 500

def generate_question_and_answer(topic):
    prompt = f"Generate a question about {topic} and provide its correct answer.  Format the response as follows: Question: [the question] Answer: [the answer]"
    chat_messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": prompt}
    ]
    response = model.create_chat_completion(
        messages=chat_messages,
        max_tokens=256,
        temperature=0.7,
        top_p=0.95,
        stop=["</s>"]
    )
    full_response = response['choices'][0]['message']['content'].strip()

    # Use regex to parse the question and answer
    question_match = re.search(r"Question:\s*(.+?)\s*Answer:", full_response)
    answer_match = re.search(r"Answer:\s*(.+)", full_response)

    question = question_match.group(1).strip() if question_match else "Could not generate question"
    answer = answer_match.group(1).strip() if answer_match else "Could not generate answer"

    return question, answer

@app.route('/generate_questions', methods=['POST'])
def generate_questions_route():
    data = request.json
    topic = data.get('topic', 'general knowledge')
    num_questions = data.get('num_questions', 1)

    generated_questions = []
    for _ in range(num_questions):
        question, correct_answer = generate_question_and_answer(topic)
        generated_questions.append({
            'text': question,
            'type': 'SINGLE_WORD',  # Default type
            'correctAnswer': correct_answer,
            'points': 1,
            'choices': [],
            'keywords': []
        })

    return jsonify({'questions': generated_questions})

if __name__ == "__main__":
    app.run(port=5001,debug=True)
