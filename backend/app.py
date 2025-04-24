from flask import Flask, request, jsonify
from flask_cors import CORS
import cv2
import base64
import numpy as np
from deepface import DeepFace

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "http://localhost:5173"}})

# Load the reference image
reference_img = cv2.imread("reference.jpg")
if reference_img is None:
    print("reference.jpg not found or unreadable!")
    raise FileNotFoundError("reference.jpg not found in the current directory.")

@app.route("/verify", methods=["POST"])
def verify():
    try:
        # Get the request data (JSON)
        data = request.get_json()
        if not data or 'image' not in data:
            return jsonify({"message": " No image data provided."}), 400

        # Decode base64 image data
        image_data = data['image'].split(',')[1]
        decoded = base64.b64decode(image_data)
        np_arr = np.frombuffer(decoded, np.uint8)
        captured_img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

        if captured_img is None:
            return jsonify({"message": " Failed to decode image."}), 400

        print("Verifying face...")

        # Use DeepFace to verify the face
        result = DeepFace.verify(captured_img, reference_img, enforce_detection=True)

        print(" Verification result:", result)

        # Return verification result based on the DeepFace comparison
        if result.get("verified"):
            return jsonify({"result": "matched", "message": "Face verified. Attendance marked!"})
        else:
            return jsonify({"result": "unmatched", "message": "Face not matched."})


        # working -> Harish
        # if result.get("verified"):
        #     return jsonify({"message": "Face verified. Attendance marked!"})
        # else:
        #     return jsonify({"message": "Face not matched."})
        
    except Exception as e:
        # Log the error message for debugging
        print(" Error during verification:", str(e))
        return jsonify({"message": f"Error: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(debug=True)


# {
#   "verified": True,                      Whether the faces matched
#   "distance": 0.32,                      Distance between embeddings (lower = more similar)
#   "threshold": 0.4,                      Threshold used for deciding match
#   "model": "VGG-Face",                   Model used for verification
#   "similarity_metric": "cosine",         Metric used to compare faces
#   "facial_areas": {                      info about detected face areas
#     "img1": {"x": ..., "y": ..., "w": ..., "h": ...},
#     "img2": {"x": ..., "y": ..., "w": ..., "h": ...}
#   },
#   "time": 1.23                           Time taken for verification (in seconds)
# }
