import math
import os
from typing import cast

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)


def normalize_angle_deg(angle_deg: float) -> float:
    """Normalize an angle to the engineering convention range [0, 360)."""

    return (angle_deg + 360.0) % 360.0

# Enable CORS because frontend (Vercel) and backend (Render) run on different domains.
CORS(app)


@app.get("/")
def home():
    return "Backend running"


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

    # Small tolerance to identify static equilibrium despite floating-point noise.
    tolerance = 1e-6

    # Resultant direction from component ratio with quadrant-safe atan2.
    # theta = atan2(sumFy, sumFx), normalized to [0, 360).
    if resultant <= tolerance:
        angle_deg: float | None = None
        direction_text = "Undefined (system in equilibrium)"
    else:
        raw_angle_deg = math.degrees(math.atan2(sum_fy, sum_fx))
        angle_deg = normalize_angle_deg(raw_angle_deg)
        direction_text = f"{round(angle_deg, 4):.4f} deg"

    # Equilibrium (equilibrant) force components are opposite to resultant components.
    # Fx_eq = -sumFx, Fy_eq = -sumFy
    if resultant <= tolerance:
        eq_fx = 0.0
        eq_fy = 0.0
        eq_magnitude = 0.0
        eq_angle_deg: float | None = None
        eq_direction_text = "Undefined (system in equilibrium)"
    else:
        eq_fx = -sum_fx
        eq_fy = -sum_fy
        eq_magnitude = math.sqrt((eq_fx ** 2) + (eq_fy ** 2))
        eq_raw_angle_deg = math.degrees(math.atan2(eq_fy, eq_fx))
        eq_angle_deg = normalize_angle_deg(eq_raw_angle_deg)
        eq_direction_text = f"{round(eq_angle_deg, 4):.4f} deg"

    return jsonify(
        {
            "sumFx": round(sum_fx, 4),
            "sumFy": round(sum_fy, 4),
            "resultant": round(resultant, 4),
            "angle": round(angle_deg, 4) if angle_deg is not None else None,
            "directionText": direction_text,
            "equilibriumFx": round(eq_fx, 4),
            "equilibriumFy": round(eq_fy, 4),
            "equilibriumMagnitude": round(eq_magnitude, 4),
            "equilibriumAngle": round(eq_angle_deg, 4) if eq_angle_deg is not None else None,
            "equilibriumDirectionText": eq_direction_text,
        }
    )


if __name__ == "__main__":
    # Read PORT from the environment so this also works on Render when run directly.
    # gunicorn (via the Procfile) also uses $PORT through --bind 0.0.0.0:$PORT.
    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port, debug=False)
