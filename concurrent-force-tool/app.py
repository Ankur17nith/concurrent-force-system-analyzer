# =============================================================================
# app.py  —  Concurrent Force System Analyzer
# =============================================================================
# Subject  : Engineering Mechanics / Statics
# Topic    : Concurrent Force Systems — Resultant and Equilibrium Analysis
#
# Description:
#   This Flask server exposes a single REST endpoint (/analyze) that accepts
#   a list of forces (magnitude in Newtons, angle in degrees) and returns:
#       • Resolved Fx, Fy components for every force
#       • Summation of all x-components  (ΣFx)
#       • Summation of all y-components  (ΣFy)
#       • Resultant magnitude            R = √(ΣFx² + ΣFy²)
#       • Resultant direction angle      θ = tan⁻¹(ΣFy / ΣFx)
#       • Equilibrium force              F_eq = –Resultant
#       • Whether the system is in equilibrium (ΣFx ≈ 0 AND ΣFy ≈ 0)
#
# Physics Principle:
#   A concurrent force system has all force vectors acting through ONE common
#   point.  The system is in STATIC EQUILIBRIUM only when the vector sum of
#   all forces equals zero (Newton's First Law).
# =============================================================================

from typing import Mapping, TypedDict, cast

from flask import Flask, request, jsonify, render_template
import math


class ForceInput(TypedDict):
    """Incoming force data sent from the browser."""

    magnitude: float
    angle: float
    label: str


class ResolvedForce(TypedDict):
    """Resolved component form of one force vector."""

    label: str
    magnitude: float
    angle_deg: float
    Fx: float
    Fy: float


class EquilibrantForce(TypedDict):
    """Force required to balance the resultant."""

    magnitude: float
    angle_deg: float
    Fx: float
    Fy: float


class AnalysisResponse(TypedDict):
    """Shape of the JSON response returned to the browser."""

    resolved_forces: list[ResolvedForce]
    sum_Fx: float
    sum_Fy: float
    resultant_magnitude: float
    resultant_angle_deg: float
    in_equilibrium: bool
    equilibrant: EquilibrantForce


def parse_numeric_value(raw_value: object, field_name: str, index: int) -> float:
    """Convert a JSON value to float after checking it is a supported type."""

    if not isinstance(raw_value, (int, float, str)):
        raise ValueError(f"Invalid {field_name} for force {index}.")

    return float(raw_value)


app = Flask(__name__)


def parse_force_input(raw_force: Mapping[str, object], index: int) -> ForceInput:
    """Validate one incoming force object and return a fully shaped record."""

    if "magnitude" not in raw_force or "angle" not in raw_force:
        raise ValueError(f"Invalid data for force {index}.")

    magnitude_value: object = raw_force["magnitude"]
    angle_value: object = raw_force["angle"]
    raw_label: object = raw_force.get("label", f"F{index}")

    magnitude = parse_numeric_value(magnitude_value, "magnitude", index)
    angle = parse_numeric_value(angle_value, "angle", index)
    label = str(raw_label)

    return {
        "magnitude": magnitude,
        "angle": angle,
        "label": label,
    }

# ---------------------------------------------------------------------------
# Route: Home page
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Serve the main HTML page."""
    return render_template("index.html")


# ---------------------------------------------------------------------------
# Route: /analyze  (POST)
# ---------------------------------------------------------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Analyze a concurrent force system.

    Expects JSON body:
        {
            "forces": [
                {"magnitude": 50, "angle": 30, "label": "F1"},
                {"magnitude": 70, "angle": 120, "label": "F2"},
                ...
            ]
        }

    Returns a JSON object with full step-by-step analysis.
    """

    data = cast(dict[str, object] | None, request.get_json(silent=True))

    # Validate input
    if not isinstance(data, dict) or "forces" not in data:
        return jsonify({"error": "No force data received."}), 400

    raw_forces: object = data["forces"]

    if not isinstance(raw_forces, list):
        return jsonify({"error": "Force data must be provided as a list."}), 400

    raw_force_items = cast(list[object], raw_forces)
    forces: list[ForceInput] = []

    for index, raw_force in enumerate(raw_force_items, start=1):
        try:
            if not isinstance(raw_force, Mapping):
                raise ValueError

            typed_raw_force = cast(Mapping[str, object], raw_force)
            forces.append(parse_force_input(typed_raw_force, index))
        except (TypeError, ValueError):
            return jsonify({"error": f"Invalid data for force {index}."}), 400

    if len(forces) == 0:
        return jsonify({"error": "Please enter at least one force."}), 400

    # -----------------------------------------------------------------------
    # STEP 1 — Resolve each force into rectangular components
    # -----------------------------------------------------------------------
    # Physics:
    #   Any force F acting at angle θ (measured from positive x-axis / East)
    #   can be split into two perpendicular components:
    #
    #       Fx = F · cos(θ)   ← horizontal component (x-direction)
    #       Fy = F · sin(θ)   ← vertical   component (y-direction)
    #
    #   WHY cosine for x?
    #     In a right triangle formed by the force vector and the axes, the
    #     adjacent side (x-axis side) over the hypotenuse (force magnitude)
    #     equals cos(θ).  So  Fx = F · cos(θ).
    #
    #   WHY sine for y?
    #     The opposite side (y-axis side) over the hypotenuse equals sin(θ).
    #     So  Fy = F · sin(θ).
    # -----------------------------------------------------------------------

    resolved: list[ResolvedForce] = []  # Will hold component data for every force

    for force in forces:
        F = force["magnitude"]   # Force magnitude in Newtons
        theta = force["angle"]   # Angle in degrees
        label = force["label"]

        # Convert degrees to radians (Python's math functions need radians)
        theta_rad = math.radians(theta)

        # Resolve into components — core engineering mechanics formula
        Fx = F * math.cos(theta_rad)   # Horizontal component
        Fy = F * math.sin(theta_rad)   # Vertical   component

        resolved_force: ResolvedForce = {
            "label"    : label,
            "magnitude": round(F, 4),
            "angle_deg": round(theta, 4),
            "Fx"       : round(Fx, 4),
            "Fy"       : round(Fy, 4)
        }
        resolved.append(resolved_force)

    # -----------------------------------------------------------------------
    # STEP 2 — Summation of force components
    # -----------------------------------------------------------------------
    # Principle of Transmissibility / Vector Addition:
    #   When multiple forces act at one point, the net effect along each axis
    #   is simply the algebraic sum of all components along that axis.
    #
    #       ΣFx = Fx1 + Fx2 + Fx3 + ...
    #       ΣFy = Fy1 + Fy2 + Fy3 + ...
    # -----------------------------------------------------------------------

    fx_components: list[float] = [force_item["Fx"] for force_item in resolved]
    fy_components: list[float] = [force_item["Fy"] for force_item in resolved]

    sum_Fx = sum(fx_components)   # ΣFx
    sum_Fy = sum(fy_components)   # ΣFy

    # -----------------------------------------------------------------------
    # STEP 3 — Resultant Force magnitude
    # -----------------------------------------------------------------------
    # Using the Pythagorean theorem on the net components:
    #
    #       R = √(ΣFx² + ΣFy²)
    #
    # This is derived from the right-angle triangle whose legs are ΣFx (base)
    # and ΣFy (height), and whose hypotenuse is the resultant magnitude R.
    # -----------------------------------------------------------------------

    R = math.sqrt(sum_Fx**2 + sum_Fy**2)   # Resultant magnitude (N)

    # -----------------------------------------------------------------------
    # STEP 4 — Resultant Force direction
    # -----------------------------------------------------------------------
    # Using the inverse tangent (arctan) function:
    #
    #       θ_R = tan⁻¹(ΣFy / ΣFx)
    #
    # math.atan2 is preferred over math.atan because atan2(y, x) correctly
    # handles all four quadrants of the coordinate plane.
    # The result is converted from radians back to degrees for display.
    # -----------------------------------------------------------------------

    theta_resultant_rad = math.atan2(sum_Fy, sum_Fx)        # in radians
    theta_resultant_deg = math.degrees(theta_resultant_rad)  # convert to °

    # -----------------------------------------------------------------------
    # STEP 5 — Equilibrium Check
    # -----------------------------------------------------------------------
    # A concurrent force system is in STATIC EQUILIBRIUM when:
    #
    #       ΣFx = 0   AND   ΣFy = 0
    #
    # (Lami's Theorem and Newton's First Law)
    #
    # Tolerance of 1×10⁻⁶ N is used due to floating-point arithmetic.
    # -----------------------------------------------------------------------

    TOLERANCE    = 1e-6
    in_equilibrium = (abs(sum_Fx) < TOLERANCE and abs(sum_Fy) < TOLERANCE)

    # -----------------------------------------------------------------------
    # STEP 6 — Equilibrant Force (force needed to achieve equilibrium)
    # -----------------------------------------------------------------------
    # If the system is NOT already in equilibrium, we need an extra force
    # called the EQUILIBRANT that is equal in magnitude but opposite in
    # direction to the resultant:
    #
    #       F_eq = –R          (magnitude same as resultant)
    #       θ_eq = θ_R + 180°  (exactly opposite direction)
    #
    # This ensures  ΣFx + F_eq_x = 0  and  ΣFy + F_eq_y = 0.
    # -----------------------------------------------------------------------

    eq_magnitude = round(R, 4)                             # same magnitude
    eq_angle     = round((theta_resultant_deg + 180) % 360, 4)  # opposite dir

    # -----------------------------------------------------------------------
    # Build and return the response object
    # -----------------------------------------------------------------------
    equilibrant: EquilibrantForce = {
        "magnitude": eq_magnitude,
        "angle_deg": eq_angle,
        "Fx"       : round(-sum_Fx, 4),
        "Fy"       : round(-sum_Fy, 4)
    }

    response: AnalysisResponse = {
        "resolved_forces"    : resolved,
        "sum_Fx"             : round(sum_Fx, 4),
        "sum_Fy"             : round(sum_Fy, 4),
        "resultant_magnitude": round(R, 4),
        "resultant_angle_deg": round(theta_resultant_deg, 4),
        "in_equilibrium"     : in_equilibrium,
        "equilibrant"       : equilibrant
    }

    return jsonify(response)


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # Run Flask development server on port 5000
    # Debug=True enables auto-reload and detailed error messages
    app.run(debug=True, port=5000)
