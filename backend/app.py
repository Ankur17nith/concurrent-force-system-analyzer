# Next line imports math functions for trigonometry and square root.
import math
# Next line imports environment access for reading the deployment port.
import os
# Next line imports cast for safe type conversion hints.
from typing import cast

# Next line imports Flask objects used to build API routes and JSON responses.
from flask import Flask, jsonify, request
# Next line imports CORS support so frontend and backend can talk across domains.
from flask_cors import CORS

# Next line creates the Flask application object.
app = Flask(__name__)


# Next line defines a helper that keeps angles in the 0 to 360 degree range.
def normalize_angle_deg(angle_deg: float) -> float:
    """Normalize an angle to the engineering convention range [0, 360)."""

    # Next line adds 360 then uses modulo to wrap angles into 0-360.
    return (angle_deg + 360.0) % 360.0


# Next line enables CORS so browser calls from Vercel are allowed.
CORS(app)


# Next line creates a health route for deployment checks.
@app.get("/")
# Next line defines the health function.
def home():
    # Next line returns a small message that backend is running.
    return "Backend running"


# Next line creates the mechanics calculation API endpoint.
@app.post("/calculate")
# Next line defines the main calculation function.
def calculate():
    # Next line reads JSON body from the incoming request.
    raw_data = request.get_json(silent=True)

    # Next line checks that request body is a JSON object.
    if not isinstance(raw_data, dict):
        # Next line returns an error if JSON format is not valid.
        return jsonify({"error": "Request body must include a 'forces' array."}), 400

    # Next line tells type checker this JSON object can be treated as a dictionary.
    data: dict[str, object] = cast(dict[str, object], raw_data)
    # Next line gets the forces list from JSON.
    forces_obj: object = data.get("forces")

    # Next line checks that forces is actually a list.
    if not isinstance(forces_obj, list):
        # Next line returns an error if forces is missing or not a list.
        return jsonify({"error": "'forces' must be a non-empty array."}), 400

    # Next line converts forces object to a typed Python list.
    forces: list[object] = cast(list[object], forces_obj)
    # Next line checks that at least one force is provided.
    if len(forces) == 0:
        # Next line returns an error if list is empty.
        return jsonify({"error": "'forces' must be a non-empty array."}), 400

    # Next line starts sum of x components.
    sum_fx = 0.0
    # Next line starts sum of y components.
    sum_fy = 0.0

    # Next line loops through each force for component calculation.
    for index, force in enumerate(forces, start=1):
        # Next line checks each force item is a JSON object.
        if not isinstance(force, dict):
            # Next line returns an error if a force entry is malformed.
            return jsonify({"error": f"Force {index} is invalid."}), 400

        # Next line converts one force object to a typed dictionary.
        force_data: dict[str, object] = cast(dict[str, object], force)
        # Next line reads magnitude value from the force object.
        magnitude_obj: object = force_data.get("magnitude")
        # Next line reads angle value from the force object.
        angle_obj: object = force_data.get("angle")

        # Next line validates that magnitude and angle are numeric-like values.
        if not isinstance(magnitude_obj, (int, float, str)) or not isinstance(angle_obj, (int, float, str)):
            # Next line returns an error if any value is not numeric.
            return jsonify({"error": f"Force {index} must contain numeric magnitude and angle."}), 400

        # Next line starts conversion of magnitude and angle to float numbers.
        try:
            # Next line converts magnitude to float.
            magnitude = float(magnitude_obj)
            # Next line converts angle to float.
            angle_deg = float(angle_obj)
        # Next line catches bad numeric conversion.
        except (KeyError, TypeError, ValueError):
            # Next line returns a numeric validation error.
            return jsonify({"error": f"Force {index} must contain numeric magnitude and angle."}), 400

        # Next line converts angle from degrees to radians.
        theta = math.radians(angle_deg)

        # Next line calculates horizontal component Fx = F cos(theta).
        fx = magnitude * math.cos(theta)
        # Next line calculates vertical component Fy = F sin(theta).
        fy = magnitude * math.sin(theta)

        # Next line adds this force's x component to total sum.
        sum_fx += fx
        # Next line adds this force's y component to total sum.
        sum_fy += fy

    # Next line calculates resultant magnitude using Pythagorean theorem.
    resultant = math.sqrt((sum_fx ** 2) + (sum_fy ** 2))
    # Next line sets a tiny tolerance for float comparison near zero.
    tolerance = 1e-6

    # Next line checks if system is practically in equilibrium.
    if resultant <= tolerance:
        # Next line stores no angle when resultant is zero.
        angle_deg: float | None = None
        # Next line stores readable text for undefined direction.
        direction_text = "Undefined (system in equilibrium)"
    else:
        # Next line computes raw resultant direction using atan2.
        raw_angle_deg = math.degrees(math.atan2(sum_fy, sum_fx))
        # Next line normalizes resultant direction to 0-360 degrees.
        angle_deg = normalize_angle_deg(raw_angle_deg)
        # Next line builds rounded direction text for UI.
        direction_text = f"{round(angle_deg, 4):.4f} deg"

    # Next line checks again if equilibrium force should be zero.
    if resultant <= tolerance:
        # Next line sets equilibrant x component to zero.
        eq_fx = 0.0
        # Next line sets equilibrant y component to zero.
        eq_fy = 0.0
        # Next line sets equilibrant magnitude to zero.
        eq_magnitude = 0.0
        # Next line sets equilibrant angle as undefined.
        eq_angle_deg: float | None = None
        # Next line stores text saying equilibrant direction is undefined.
        eq_direction_text = "Undefined (system in equilibrium)"
    else:
        # Next line sets equilibrant x component opposite to resultant x sum.
        eq_fx = -sum_fx
        # Next line sets equilibrant y component opposite to resultant y sum.
        eq_fy = -sum_fy
        # Next line computes equilibrant magnitude.
        eq_magnitude = math.sqrt((eq_fx ** 2) + (eq_fy ** 2))
        # Next line computes raw equilibrant direction using atan2.
        eq_raw_angle_deg = math.degrees(math.atan2(eq_fy, eq_fx))
        # Next line normalizes equilibrant direction to 0-360 degrees.
        eq_angle_deg = normalize_angle_deg(eq_raw_angle_deg)
        # Next line builds rounded equilibrant direction text.
        eq_direction_text = f"{round(eq_angle_deg, 4):.4f} deg"

    # Next line returns all rounded values as JSON response.
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


# Next line checks that this file is run directly, not imported.
if __name__ == "__main__":
    # Next line reads deployment port from environment or uses local default.
    port = int(os.environ.get("PORT", 10000))
    # Next line starts Flask server on all interfaces.
    app.run(host="0.0.0.0", port=port, debug=False)
