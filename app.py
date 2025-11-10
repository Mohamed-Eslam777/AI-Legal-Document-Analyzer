import os
import json
import re
from flask import Flask, request, render_template, jsonify
from dotenv import load_dotenv
from google import genai
from google.genai import types  # Required for structured output config


# --- Configuration ---
load_dotenv()  # Load environment variables from .env
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY")


# --- AI Setup ---
try:
    # Initialize the client using the API key from the environment variables
    client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
except Exception as e:
    print(f"Error initializing Gemini client: {e}")
    # Handle the error gracefully if the key is missing/invalid
    client = None


# --- AI System Prompt and Configuration ---
SYSTEM_PROMPT = """
You are a highly professional legal document analyst and simplifier.
Your task is to analyze the user-provided legal text, identify the most critical clauses, and simplify them into clear, actionable Arabic sentences.

You MUST follow these strict formatting rules:
1. Respond ONLY with a clean JSON object. Do not include any text outside of the JSON block.
2. The JSON object MUST contain two main keys: 'obligations' and 'risks'.
3. 'obligations' must be an array of strings listing the 3 most crucial user obligations.
4. 'risks' must be an array of strings listing the 2 highest-risk clauses that favor the service provider/landlord.
5. All output strings (within the arrays) must be in clear, simple Arabic language.
"""


# Define the expected output structure for the model to follow
response_schema = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "obligations": types.Schema(
            type=types.Type.ARRAY,
            description="The 3 most crucial obligations the user must fulfill.",
            items=types.Schema(type=types.Type.STRING)
        ),
        "risks": types.Schema(
            type=types.Type.ARRAY,
            description="The 2 highest-risk clauses that favor the service provider/landlord.",
            items=types.Schema(type=types.Type.STRING)
        ),
    }
)


# --- Utility Functions ---

def clean_document_text(text):
    """Removes excessive whitespace, normalizes formatting, and cleans up common junk."""
    if not text:
        return ""
    
    # 1. Replace multiple newlines/tabs with a single space
    text = re.sub(r'[\n\t\r]+', ' ', text)
    
    # 2. Replace multiple spaces with a single space
    text = re.sub(r'\s+', ' ', text)
    
    # 3. Strip leading/trailing whitespace
    text = text.strip()
    
    return text


# --- Routes ---


@app.route("/", methods=["GET"])
def index():
    """Renders the main HTML interface."""
    return render_template("index.html")


@app.route("/simplify", methods=["POST"])
def simplify():
    """Handles single document simplification OR comparison of two documents."""
    legal_text_1 = request.form.get("legal_text_1")  # New name for the first text area
    legal_text_2 = request.form.get("legal_text_2")  # New optional text area
    
    # Apply cleanup logic to normalize text before processing
    legal_text_1 = clean_document_text(legal_text_1) if legal_text_1 else None
    if legal_text_2:
        legal_text_2 = clean_document_text(legal_text_2)
    
    if not legal_text_1:
        return jsonify({"success": False, "message": "Please provide at least one document text for analysis."}), 400
    
    if not client:
        return jsonify({"success": False, "message": "AI service is unavailable. Check GEMINI_API_KEY."}), 503

    # --- Determine Mode (Simplification or Comparison) ---
    if legal_text_2:
        # Comparison Mode Logic
        system_prompt = (
            "You are an expert legal document comparator. You received two documents. "
            "Your task is to identify the 3 most crucial differences or discrepancies between Document 1 and Document 2, and identify the 1 major clause that is present in Document 2 but missing in Document 1. "
            "Respond ONLY with a clean JSON object containing the keys: 'differences' (array of strings for 3 differences) and 'missing_clause' (string for the one missing clause). Output must be in Arabic."
        )
        contents = f"DOCUMENT 1:\n{legal_text_1}\n\n---\n\nDOCUMENT 2:\n{legal_text_2}"
        
        # Define new schema for comparison output
        comparison_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "differences": types.Schema(
                    type=types.Type.ARRAY, 
                    description="The 3 most crucial differences between the documents.", 
                    items=types.Schema(type=types.Type.STRING)
                ),
                "missing_clause": types.Schema(
                    type=types.Type.STRING, 
                    description="The most significant clause present in Document 2 but missing in Document 1."
                )
            }
        )
        target_schema = comparison_schema
        
    else:
        # Simplification Mode Logic (Original Logic)
        system_prompt = SYSTEM_PROMPT  # Use the existing global SYSTEM_PROMPT
        contents = legal_text_1
        target_schema = response_schema  # Use the existing global response_schema

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_schema=target_schema
            )
        )
        
        # The response.text should be a valid JSON string (due to response_mime_type="application/json")
        ai_data = json.loads(response.text)
        
        # Add mode to the response for frontend to handle display
        return jsonify({
            "success": True, 
            "analysis": ai_data, 
            "mode": "comparison" if legal_text_2 else "simplification"
        })

    except json.JSONDecodeError:
        return jsonify({"success": False, "message": "AI returned malformed data. Please try again with a clear legal document."}), 500
    except Exception as e:
        print(f"AI API Error: {e}")
        return jsonify({"success": False, "message": f"An error occurred during AI processing: {str(e)}"}), 500


@app.route("/assess", methods=["POST"])
def assess():
    """Quickly assesses the document type and complexity using Gemini."""
    text = request.form.get("text")

    if not text or len(text) < 100:
        return jsonify({"success": True, "type": "Awaiting Input...", "valid": False}), 200

    if not client:
        return jsonify({"success": False, "type": "Error: AI service unavailable", "valid": False}), 503

    try:
        # Use a quick prompt to classify the text structure (limit input for speed)
        prompt = (
            "Analyze the following text. Is it structured, formal, legal, or policy-related? "
            "Respond ONLY with a single JSON object. The object must contain 'type' (e.g., Contract, Terms of Service, Article, None) "
            "and 'valid' (boolean: true if formal, false otherwise)."
        )
        
        # Define schema for assessment response
        assess_schema = types.Schema(
            type=types.Type.OBJECT,
            properties={
                "type": types.Schema(
                    type=types.Type.STRING,
                    description="The type of document (e.g., Contract, Terms of Service, Privacy Policy, Article, None)"
                ),
                "valid": types.Schema(
                    type=types.Type.BOOLEAN,
                    description="True if the document is formal/legal, false otherwise"
                ),
            }
        )
        
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=f"{prompt}\n\nDOCUMENT TEXT:\n\n{text[:2000]}",  # Limit text length for speed
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=assess_schema
            )
        )

        ai_data = json.loads(response.text)
        
        return jsonify({
            "success": True, 
            "type": ai_data.get('type', 'Unclassified'), 
            "valid": ai_data.get('valid', False)
        }), 200

    except json.JSONDecodeError:
        return jsonify({"success": False, "type": "Error: Invalid response format", "valid": False}), 500
    except Exception as e:
        print(f"Assessment API Error: {e}")
        return jsonify({"success": False, "type": "Error: Check API/Input", "valid": False}), 500


if __name__ == "__main__":
    app.run(debug=True)
