from flask import Flask, jsonify, request
from flask_cors import CORS
import math
from typing import cast

app = Flask(__name__)

# Enable CORS because frontend (Vercel) and backend (Render) run on different domains.
CORS(app)


@app.get("/")
def home():
    return jsonify({"message": "Concurrent Force System Analyzer API is running."})


@app.post("/calculate")
def calculate():
    raw_data = request.get_json(silent=True)

    if not isinstance(raw_data, dict):
        return jsonify({"error": "Request body must include a 'forces' array."}), 400

    data: dict[str, object] = cast(dict[str, object], raw_data)
    forces_obj: object = data.get("forces")

    if not isinstance(forces_obj, list):
        return jsonify({"error": "'forces' must be a non-empty array."}), 400

    forces: list[object] = cast(list[object], forces_obj)
    if len(forces) == 0:
        return jsonify({"error": "'forces' must be a non-empty array."}), 400

    sum_fx = 0.0
    sum_fy = 0.0

    for index, force in enumerate(forces, start=1):
        if not isinstance(force, dict):
            return jsonify({"error": f"Force {index} is invalid."}), 400

        force_data: dict[str, object] = cast(dict[str, object], force)
        magnitude_obj: object = force_data.get("magnitude")
        angle_obj: object = force_data.get("angle")

        if not isinstance(magnitude_obj, (int, float, str)) or not isinstance(angle_obj, (int, float, str)):
            return jsonify({"error": f"Force {index} must contain numeric magnitude and angle."}), 400

        try:
            magnitude = float(magnitude_obj)
            angle_deg = float(angle_obj)
        except (KeyError, TypeError, ValueError):
            return jsonify({"error": f"Force {index} must contain numeric magnitude and angle."}), 400

        # Convert angle from degrees to radians because Python trig functions use radians.
        theta = math.radians(angle_deg)

        # Resolve force into horizontal component.
        # Fx = F cos(theta)
        # cosine is used because it is the projection of the vector on the x-axis.
        fx = magnitude * math.cos(theta)

        # Resolve force into vertical component.
        # Fy = F sin(theta)
        # sine is used because it is the projection of the vector on the y-axis.
        fy = magnitude * math.sin(theta)

        sum_fx += fx
        sum_fy += fy

    # Resultant magnitude from the Pythagorean relation of net x and y components.
    # R = sqrt((sumFx)^2 + (sumFy)^2)
    resultant = math.sqrt((sum_fx ** 2) + (sum_fy ** 2))

    # Resultant direction from component ratio with quadrant-safe atan2.
    # theta = atan2(sumFy, sumFx)
    angle = math.degrees(math.atan2(sum_fy, sum_fx))

    return jsonify(
        {
            "sumFx": round(sum_fx, 4),
            "sumFy": round(sum_fy, 4),
            "resultant": round(resultant, 4),
            "angle": round(angle, 4),
        }
    )


if __name__ == "__main__":
    app.run(debug=True)
