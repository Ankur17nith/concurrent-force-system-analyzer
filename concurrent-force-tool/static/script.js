// =============================================================================
// script.js  —  Concurrent Force System Analyzer
// =============================================================================
// This file handles all client-side logic:
//   1.  Dynamically adding / removing force input rows
//   2.  Sending force data to the Flask /analyze endpoint (fetch API)
//   3.  Displaying step-by-step results in the UI
//   4.  Populating the force table with resolved components
//   5.  Drawing vector diagrams on the HTML5 Canvas
//   6.  Theory modal open / close
//
// Physics background:
//   All forces in a concurrent system act through one common point.
//   The goal is to find the RESULTANT (single equivalent force) and to
//   determine whether the system is in STATIC EQUILIBRIUM.
// =============================================================================

// ---------------------------------------------------------------------------
// GLOBAL STATE
// ---------------------------------------------------------------------------

// forceCounter — auto-increments so each row gets a unique label (F1, F2, …)
let forceCounter = 0;

// lastResult — stores the latest response from the server for canvas drawing
let lastResult = null;

// ---------------------------------------------------------------------------
// PAGE INITIALISATION
// ---------------------------------------------------------------------------

/**
 * Runs when the browser has finished loading the DOM.
 * Adds two default force rows and draws the empty canvas grid.
 */
document.addEventListener("DOMContentLoaded", function () {
  addForceRow();   // Add row for F1 (default: 50 N at 30°)
  addForceRow();   // Add row for F2 (default: 70 N at 120°)
  drawEmptyCanvas();
});

// ---------------------------------------------------------------------------
// FORCE ROW MANAGEMENT
// ---------------------------------------------------------------------------

/**
 * addForceRow()
 * -------------
 * Creates a new HTML row for force input and appends it to #force-list.
 * Each row has: label (F1, F2, …) | magnitude input | angle input | delete btn.
 *
 * Default values make it easy to demonstrate with a working example.
 */
function addForceRow() {
  forceCounter++;
  const id = forceCounter;

  // Default values for demonstration purposes
  const defaultMagnitude = id === 1 ? "50"  : id === 2 ? "70"  : "";
  const defaultAngle     = id === 1 ? "30"  : id === 2 ? "120" : "";

  const row = document.createElement("div");
  row.className = "force-row";
  row.id = `row-${id}`;

  row.innerHTML = `
    <!-- Force label badge -->
    <div class="force-label">F${id}</div>

    <!-- Magnitude input — unit: Newtons (N) -->
    <div class="input-group">
      <label for="mag-${id}">Magnitude (N)</label>
      <input
        type="number"
        id="mag-${id}"
        placeholder="e.g. 50"
        value="${defaultMagnitude}"
        min="0"
        step="any"
        title="Force magnitude in Newtons"
      />
    </div>

    <!-- Angle input — degrees, measured CCW from positive x-axis -->
    <div class="input-group">
      <label for="ang-${id}">Angle (°)</label>
      <input
        type="number"
        id="ang-${id}"
        placeholder="e.g. 30"
        value="${defaultAngle}"
        step="any"
        title="Angle in degrees, counter-clockwise from East (positive x-axis)"
      />
    </div>

    <!-- Delete button — removes this row from the list -->
    <button class="btn btn-delete" onclick="removeForceRow(${id})" title="Remove this force">✕</button>
  `;

  document.getElementById("force-list").appendChild(row);
}

/**
 * removeForceRow(id)
 * ------------------
 * Removes the force row with the given id.
 * Prevents removal if only one row remains (need at least one force).
 */
function removeForceRow(id) {
  const rows = document.querySelectorAll(".force-row");
  if (rows.length <= 1) {
    alert("At least one force is required. Add more forces before deleting.");
    return;
  }
  const row = document.getElementById(`row-${id}`);
  if (row) row.remove();
}

// ---------------------------------------------------------------------------
// DATA COLLECTION
// ---------------------------------------------------------------------------

/**
 * collectForces()
 * ---------------
 * Reads all force rows from the DOM and assembles an array of force objects.
 *
 * Each object has:
 *   label     — string,  e.g. "F1"
 *   magnitude — number,  in Newtons
 *   angle     — number,  in degrees
 *
 * Returns null (and shows an alert) if any input is invalid.
 */
function collectForces() {
  const rows = document.querySelectorAll(".force-row");
  const forces = [];

  for (let i = 0; i < rows.length; i++) {
    const rowId = rows[i].id.replace("row-", "");

    const magInput = document.getElementById(`mag-${rowId}`);
    const angInput = document.getElementById(`ang-${rowId}`);

    // Guard: missing input elements
    if (!magInput || !angInput) continue;

    const mag = parseFloat(magInput.value);
    const ang = parseFloat(angInput.value);

    // Validate magnitude: must be a positive number
    if (isNaN(mag) || mag <= 0) {
      alert(`Force F${i + 1}: Please enter a positive magnitude in Newtons.`);
      magInput.focus();
      return null;
    }

    // Validate angle: must be a finite number
    if (isNaN(ang)) {
      alert(`Force F${i + 1}: Please enter a valid angle in degrees.`);
      angInput.focus();
      return null;
    }

    forces.push({
      label    : `F${i + 1}`,
      magnitude: mag,
      angle    : ang
    });
  }

  return forces;
}

// ---------------------------------------------------------------------------
// MAIN CALCULATION  —  sends data to Flask and handles the response
// ---------------------------------------------------------------------------

/**
 * calculateForces()
 * -----------------
 * 1. Collects forces from the DOM.
 * 2. POSTs JSON to the Flask /analyze endpoint.
 * 3. Populates the Force Table, Step-by-Step output, and Canvas.
 *
 * Uses the browser's native fetch() API (no libraries needed).
 */
async function calculateForces() {
  // Step A — collect and validate input
  const forces = collectForces();
  if (!forces || forces.length === 0) return;

  // Show a loading state on the button
  const btn = document.querySelector(".btn-calculate");
  btn.textContent = "⏳ Computing…";
  btn.disabled = true;

  try {
    // Step B — send POST request to Flask backend
    const response = await fetch("/analyze", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ forces })
    });

    if (!response.ok) {
      const errData = await response.json();
      alert("Server error: " + (errData.error || response.statusText));
      return;
    }

    // Step C — parse the JSON response
    const result = await response.json();
    lastResult = result;   // store globally for canvas drawing

    // Step D — update all UI sections
    populateForceTable(result);
    renderSteps(result);
    drawVectorDiagram(result);

  } catch (err) {
    // Network error or Flask server not running
    alert("Could not reach the server. Make sure Flask is running.\n\nError: " + err.message);
  } finally {
    // Restore the button
    btn.textContent = "⚡ Analyze Forces";
    btn.disabled = false;
  }
}

// ---------------------------------------------------------------------------
// FORCE TABLE — Section 2
// ---------------------------------------------------------------------------

/**
 * populateForceTable(result)
 * --------------------------
 * Fills the table body with resolved component data for each force.
 * Also updates the summation row (ΣFx, ΣFy) in the table footer.
 *
 * Columns: Label | Magnitude (N) | Angle (°) | Fx = F·cosθ | Fy = F·sinθ
 */
function populateForceTable(result) {
  const tbody = document.getElementById("table-body");
  const tfoot = document.getElementById("table-foot");

  // Clear previous rows
  tbody.innerHTML = "";

  result.resolved_forces.forEach(function (f) {
    const tr = document.createElement("tr");

    // Color-code Fx and Fy: positive → white, negative → reddish
    const fxColor = f.Fx >= 0 ? "#e8eaf0" : "#e07070";
    const fyColor = f.Fy >= 0 ? "#e8eaf0" : "#e07070";

    tr.innerHTML = `
      <td>${f.label}</td>
      <td>${f.magnitude.toFixed(2)}</td>
      <td>${f.angle_deg.toFixed(2)}</td>
      <td style="color:${fxColor}">${f.Fx.toFixed(4)}</td>
      <td style="color:${fyColor}">${f.Fy.toFixed(4)}</td>
    `;
    tbody.appendChild(tr);
  });

  // Update summation footer row
  const sumFxCell = document.getElementById("sum-fx-cell");
  const sumFyCell = document.getElementById("sum-fy-cell");

  sumFxCell.textContent = result.sum_Fx.toFixed(4) + " N";
  sumFyCell.textContent = result.sum_Fy.toFixed(4) + " N";

  // Show the footer
  tfoot.style.display = "";
}

// ---------------------------------------------------------------------------
// STEP-BY-STEP CALCULATIONS — Section 3
// ---------------------------------------------------------------------------

/**
 * renderSteps(result)
 * -------------------
 * Builds an HTML step-by-step solution display showing all formulas,
 * intermediate values, and final results.
 *
 * Steps shown:
 *   STEP 1 — Force resolution for each force  (Fx = F·cosθ, Fy = F·sinθ)
 *   STEP 2 — Summation of components          (ΣFx, ΣFy)
 *   STEP 3 — Resultant magnitude              R = √(ΣFx² + ΣFy²)
 *   STEP 4 — Resultant direction              θ = tan⁻¹(ΣFy / ΣFx)
 *   STEP 5 — Equilibrium check                ΣFx = 0 AND ΣFy = 0 ?
 *   STEP 6 — Equilibrant force                F_eq = −R, θ_eq = θ_R + 180°
 */
function renderSteps(result) {
  const container = document.getElementById("steps-output");
  let html = "";

  // ── STEP 1: Force Resolution ──────────────────────────────────────────────
  html += `<div class="step-block">`;
  html += `<div class="step-title">STEP 1 — Force Resolution  (Fx = F·cos θ, Fy = F·sin θ)</div>`;

  result.resolved_forces.forEach(function (f) {
    html += `<div class="step-value">${f.label} = ${f.magnitude} N @ ${f.angle_deg}°</div>`;
    html += `<div class="step-formula">
      &nbsp;&nbsp;Fx = ${f.magnitude} × cos(${f.angle_deg}°) = <strong>${f.Fx.toFixed(4)} N</strong>
    </div>`;
    html += `<div class="step-formula">
      &nbsp;&nbsp;Fy = ${f.magnitude} × sin(${f.angle_deg}°) = <strong>${f.Fy.toFixed(4)} N</strong>
    </div>`;
    html += `<br/>`;
  });

  html += `<div class="step-note">
    cos(θ) gives the x-projection (adjacent/hypotenuse in the force triangle).<br/>
    sin(θ) gives the y-projection (opposite/hypotenuse in the force triangle).
  </div>`;
  html += `</div>`;   // end step-block

  // ── STEP 2: Summation ─────────────────────────────────────────────────────
  html += `<div class="step-block">`;
  html += `<div class="step-title">STEP 2 — Summation of Components</div>`;
  html += `<div class="step-formula">ΣFx = ${buildSumString(result.resolved_forces, "Fx")} = <strong>${result.sum_Fx.toFixed(4)} N</strong></div>`;
  html += `<div class="step-formula">ΣFy = ${buildSumString(result.resolved_forces, "Fy")} = <strong>${result.sum_Fy.toFixed(4)} N</strong></div>`;
  html += `<div class="step-note">Algebraically add all x-components and all y-components separately.</div>`;
  html += `</div>`;

  // ── STEP 3: Resultant Magnitude ───────────────────────────────────────────
  html += `<div class="step-block resultant">`;
  html += `<div class="step-title">STEP 3 — Resultant Magnitude  (R = √(ΣFx² + ΣFy²))</div>`;
  html += `<div class="step-formula">R = √( (${result.sum_Fx.toFixed(4)})² + (${result.sum_Fy.toFixed(4)})² )</div>`;
  html += `<div class="step-formula">R = √( ${(result.sum_Fx ** 2).toFixed(4)} + ${(result.sum_Fy ** 2).toFixed(4)} )</div>`;
  html += `<div class="step-formula">R = √( ${(result.sum_Fx ** 2 + result.sum_Fy ** 2).toFixed(4)} )</div>`;
  html += `<div class="step-formula"><strong class="text-red">R = ${result.resultant_magnitude.toFixed(4)} N</strong></div>`;
  html += `<div class="step-note">Pythagorean theorem applied to the net component triangle.</div>`;
  html += `</div>`;

  // ── STEP 4: Resultant Direction ───────────────────────────────────────────
  html += `<div class="step-block resultant">`;
  html += `<div class="step-title">STEP 4 — Resultant Direction  (θ = tan⁻¹(ΣFy / ΣFx))</div>`;
  html += `<div class="step-formula">θ = tan⁻¹( ${result.sum_Fy.toFixed(4)} / ${result.sum_Fx.toFixed(4)} )</div>`;
  html += `<div class="step-formula"><strong class="text-red">θ_R = ${result.resultant_angle_deg.toFixed(4)}°</strong>  (measured CCW from +x-axis)</div>`;
  html += `<div class="step-note">
    atan2(y, x) is used instead of atan(y/x) to correctly handle all four quadrants.<br/>
    A positive angle is counter-clockwise; negative is clockwise.
  </div>`;
  html += `</div>`;

  // ── STEP 5: Equilibrium Check ─────────────────────────────────────────────
  const eq = result.in_equilibrium;
  html += `<div class="step-block equilibrium">`;
  html += `<div class="step-title">STEP 5 — Equilibrium Check  (ΣFx = 0  AND  ΣFy = 0)</div>`;
  html += `<div class="step-formula">ΣFx = ${result.sum_Fx.toFixed(4)} N → ${Math.abs(result.sum_Fx) < 1e-4 ? "≈ 0  ✓" : "≠ 0  ✗"}</div>`;
  html += `<div class="step-formula">ΣFy = ${result.sum_Fy.toFixed(4)} N → ${Math.abs(result.sum_Fy) < 1e-4 ? "≈ 0  ✓" : "≠ 0  ✗"}</div>`;

  if (eq) {
    html += `<span class="badge badge-equilibrium">✔ System IS in Static Equilibrium</span>`;
    html += `<div class="step-note">Both summations equal zero — the net force is zero. Newton's First Law is satisfied.</div>`;
  } else {
    html += `<span class="badge badge-not-equilibrium">✗ System is NOT in Equilibrium</span>`;
    html += `<div class="step-note">A net force exists — the system would accelerate. An equilibrant force is needed.</div>`;
  }
  html += `</div>`;

  // ── STEP 6: Equilibrant (only shown when not in equilibrium) ──────────────
  if (!eq) {
    const feq = result.equilibrant;
    html += `<div class="step-block equilibrium">`;
    html += `<div class="step-title">STEP 6 — Required Equilibrant Force  (F_eq = −R)</div>`;
    html += `<div class="step-value">The equilibrant is equal in magnitude to the resultant but acts in the OPPOSITE direction.</div>`;
    html += `<div class="step-formula">|F_eq| = |R| = <strong class="text-green">${feq.magnitude.toFixed(4)} N</strong></div>`;
    html += `<div class="step-formula">θ_eq  = θ_R + 180° = <strong class="text-green">${feq.angle_deg.toFixed(4)}°</strong></div>`;
    html += `<div class="step-formula">F_eq_x = −ΣFx = <strong>${feq.Fx.toFixed(4)} N</strong></div>`;
    html += `<div class="step-formula">F_eq_y = −ΣFy = <strong>${feq.Fy.toFixed(4)} N</strong></div>`;
    html += `<div class="step-note">
      Applying this force at the common point will make ΣFx = 0 and ΣFy = 0,
      bringing the system into static equilibrium.
    </div>`;
    html += `</div>`;
  }

  container.innerHTML = html;
}

/**
 * buildSumString(forces, component)
 * ----------------------------------
 * Helper that creates a readable summation string like "12.00 + (−8.00) + 3.00"
 * for display in the step-by-step output.
 *
 * @param {Array}  forces    — array of resolved force objects from the server
 * @param {string} component — "Fx" or "Fy"
 * @returns {string}
 */
function buildSumString(forces, component) {
  return forces.map(f => {
    const val = f[component].toFixed(4);
    return f[component] < 0 ? `(${val})` : val;
  }).join(" + ");
}

// ---------------------------------------------------------------------------
// CANVAS VECTOR DIAGRAM — Section 4
// ---------------------------------------------------------------------------

/**
 * drawEmptyCanvas()
 * -----------------
 * Draws the coordinate axis grid on the canvas before any analysis.
 * Called once on page load.
 */
function drawEmptyCanvas() {
  const canvas = document.getElementById("force-canvas");
  const ctx    = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0a0d14";
  ctx.fillRect(0, 0, W, H);

  // Draw grid and axes
  drawGrid(ctx, W, H, W / 2, H / 2);
  drawAxesLabels(ctx, W, H, W / 2, H / 2);

  // Instruction text
  ctx.fillStyle = "#3a3f58";
  ctx.font = "13px 'Roboto Mono', monospace";
  ctx.textAlign = "center";
  ctx.fillText("Add forces and click Analyze to see vectors", W / 2, H / 2 + 30);
}

/**
 * drawVectorDiagram(result)
 * -------------------------
 * Main drawing function called after receiving results from the server.
 *
 * Drawing steps:
 *   1. Find the maximum force magnitude to determine the canvas scale.
 *   2. Draw the coordinate grid.
 *   3. Draw each individual force as a BLUE arrow from the origin.
 *   4. Draw the resultant as a RED arrow.
 *   5. Draw the equilibrant as a GREEN arrow (if system is not in equilibrium).
 *   6. Label each arrow.
 *
 * Sign convention:
 *   Canvas y-axis is flipped (y increases downward in canvas coords), so
 *   we negate the Fy value when drawing to make up = positive y direction.
 *
 * @param {Object} result — server response from /analyze
 */
function drawVectorDiagram(result) {
  const canvas = document.getElementById("force-canvas");
  const ctx    = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // Canvas center = physical origin (0, 0)
  const cx = W / 2;
  const cy = H / 2;

  ctx.clearRect(0, 0, W, H);

  // Background
  ctx.fillStyle = "#0a0d14";
  ctx.fillRect(0, 0, W, H);

  drawGrid(ctx, W, H, cx, cy);

  // ── Determine a good scale ─────────────────────────────────────────────
  // Find the largest magnitude among all forces (including resultant).
  // Scale so that the longest vector fits within 80% of half the canvas.

  const allMags = result.resolved_forces.map(f => f.magnitude);
  allMags.push(result.resultant_magnitude);

  const maxMag   = Math.max(...allMags);
  const maxPx    = Math.min(cx, cy) * 0.75;   // 75% of half-dimension
  const scale    = maxMag > 0 ? maxPx / maxMag : 1;

  // ── Draw individual forces (blue) ──────────────────────────────────────
  result.resolved_forces.forEach(function (f, i) {
    const angleRad = degreesToRadians(f.angle_deg);

    // Scale Fx and Fy to pixel lengths
    // NOTE: Fy is negated because canvas y-axis points DOWN
    const dx = f.Fx * scale;
    const dy = -f.Fy * scale;   // negate for canvas coordinate system

    drawArrow(ctx, cx, cy, cx + dx, cy + dy, "#4fa3e0", 2.5);

    // Label the force
    const labelX = cx + dx * 1.12;
    const labelY = cy + dy * 1.12;
    drawLabel(ctx, f.label, labelX, labelY, "#4fa3e0");
  });

  // ── Draw resultant (red) ──────────────────────────────────────────────
  const rAngleRad = degreesToRadians(result.resultant_angle_deg);
  const rDx = result.sum_Fx * scale;
  const rDy = -result.sum_Fy * scale;   // negate for canvas

  if (result.resultant_magnitude > 1e-6) {
    drawArrow(ctx, cx, cy, cx + rDx, cy + rDy, "#e05555", 3.5);
    drawLabel(ctx, "R = " + result.resultant_magnitude.toFixed(2) + " N",
              cx + rDx * 1.14, cy + rDy * 1.14, "#e05555");
  }

  // ── Draw equilibrant (green) if not in equilibrium ────────────────────
  if (!result.in_equilibrium) {
    const eq = result.equilibrant;
    const eDx = eq.Fx * scale;
    const eDy = -eq.Fy * scale;   // negate for canvas

    drawArrow(ctx, cx, cy, cx + eDx, cy + eDy, "#3ec97e", 3);
    drawLabel(ctx, "F_eq = " + eq.magnitude.toFixed(2) + " N",
              cx + eDx * 1.14, cy + eDy * 1.14, "#3ec97e");
  }

  // ── Draw axes labels on top ────────────────────────────────────────────
  drawAxesLabels(ctx, W, H, cx, cy);

  // ── Scale reference in bottom-right corner ────────────────────────────
  ctx.fillStyle = "#3a3f58";
  ctx.font = "11px 'Roboto Mono', monospace";
  ctx.textAlign = "right";
  ctx.fillText(
    "Scale: 1 px ≈ " + (1 / scale).toFixed(2) + " N",
    W - 10, H - 10
  );
}

// ---------------------------------------------------------------------------
// CANVAS HELPER FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * drawGrid(ctx, W, H, cx, cy)
 * ----------------------------
 * Draws a faint coordinate grid and the main x/y axes on the canvas.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} W  — canvas width
 * @param {number} H  — canvas height
 * @param {number} cx — x-coordinate of canvas center
 * @param {number} cy — y-coordinate of canvas center
 */
function drawGrid(ctx, W, H, cx, cy) {
  const GRID_SPACING = 40;   // pixels between grid lines

  ctx.strokeStyle = "#1a1f2e";
  ctx.lineWidth   = 1;

  // Vertical grid lines
  for (let x = cx % GRID_SPACING; x < W; x += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let y = cy % GRID_SPACING; y < H; y += GRID_SPACING) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Main X axis (horizontal center line)
  ctx.strokeStyle = "#2a3050";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, cy);
  ctx.lineTo(W, cy);
  ctx.stroke();

  // Main Y axis (vertical center line)
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, H);
  ctx.stroke();

  // Origin dot
  ctx.fillStyle = "#4a5070";
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * drawAxesLabels(ctx, W, H, cx, cy)
 * -----------------------------------
 * Draws "+X", "−X", "+Y", "−Y" directional labels at the canvas edges.
 */
function drawAxesLabels(ctx, W, H, cx, cy) {
  ctx.fillStyle  = "#3a4060";
  ctx.font       = "11px 'Roboto Mono', monospace";
  ctx.textAlign  = "center";

  ctx.fillText("+X (East)", W - 36, cy - 8);
  ctx.fillText("−X (West)", 32,     cy - 8);
  ctx.fillText("+Y (North)", cx,    14);
  ctx.fillText("−Y (South)", cx,    H - 6);
}

/**
 * drawArrow(ctx, x1, y1, x2, y2, color, lineWidth)
 * --------------------------------------------------
 * Draws a vector arrow from (x1, y1) to (x2, y2) with an arrowhead.
 *
 * Arrow geometry:
 *   - The arrowhead is drawn as a filled triangle at the tip (x2, y2).
 *   - headLength controls the size of the arrowhead.
 *   - The angle of the arrowhead is calculated using Math.atan2.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x1, y1   — tail of the arrow (origin)
 * @param {number} x2, y2   — tip  of the arrow
 * @param {string} color    — CSS color string
 * @param {number} lineWidth
 */
function drawArrow(ctx, x1, y1, x2, y2, color, lineWidth) {
  const headLength = 12;   // pixels — arrowhead length
  const headAngle  = Math.PI / 6;   // 30° spread of arrowhead

  // Angle of the arrow vector (in canvas coords)
  const angle = Math.atan2(y2 - y1, x2 - x1);

  ctx.strokeStyle = color;
  ctx.fillStyle   = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = "round";

  // Draw the shaft line (tail → tip)
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // Draw the arrowhead as a solid filled triangle
  ctx.beginPath();
  ctx.moveTo(x2, y2);   // tip
  ctx.lineTo(
    x2 - headLength * Math.cos(angle - headAngle),
    y2 - headLength * Math.sin(angle - headAngle)
  );
  ctx.lineTo(
    x2 - headLength * Math.cos(angle + headAngle),
    y2 - headLength * Math.sin(angle + headAngle)
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * drawLabel(ctx, text, x, y, color)
 * -----------------------------------
 * Draws a text label at (x, y) with a semi-transparent dark background
 * for readability against the grid.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x, y   — center position of the label
 * @param {string} color  — text color
 */
function drawLabel(ctx, text, x, y, color) {
  ctx.font      = "bold 11px 'Roboto Mono', monospace";
  ctx.textAlign = "center";

  const metrics = ctx.measureText(text);
  const padding = 4;
  const bw = metrics.width + padding * 2;
  const bh = 16;

  // Dark background rectangle
  ctx.fillStyle = "rgba(10, 13, 20, 0.75)";
  ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);

  // Label text
  ctx.fillStyle = color;
  ctx.fillText(text, x, y + 4);
}

// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------

/**
 * degreesToRadians(deg)
 * ----------------------
 * Converts angle from degrees to radians.
 * Formula: radians = degrees × (π / 180)
 *
 * Used when feeding angles to JavaScript's Math.cos / Math.sin,
 * which require radians, not degrees.
 *
 * @param  {number} deg — angle in degrees
 * @returns {number}     — angle in radians
 */
function degreesToRadians(deg) {
  return deg * (Math.PI / 180);
}

/**
 * resetAll()
 * ----------
 * Clears all force rows, resets the table and output panels,
 * and re-draws the empty canvas grid.
 * Then adds two fresh default rows to start over.
 */
function resetAll() {
  // Clear all force input rows
  document.getElementById("force-list").innerHTML = "";
  forceCounter = 0;
  lastResult   = null;

  // Reset force table
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = `
    <tr id="table-placeholder">
      <td colspan="5" class="placeholder-cell">No forces analyzed yet. Enter forces above and click <em>Analyze</em>.</td>
    </tr>
  `;
  document.getElementById("table-foot").style.display = "none";

  // Reset step-by-step output
  document.getElementById("steps-output").innerHTML =
    `<p class="placeholder-text">Results will appear here after analysis.</p>`;

  // Reset canvas
  drawEmptyCanvas();

  // Add fresh default rows
  addForceRow();
  addForceRow();
}

// ---------------------------------------------------------------------------
// THEORY MODAL — open / close
// ---------------------------------------------------------------------------

/**
 * openTheory()
 * ------------
 * Shows the mechanical theory modal by adding the 'active' CSS class.
 */
function openTheory() {
  document.getElementById("theory-overlay").classList.add("active");
  document.getElementById("theory-modal").classList.add("active");
  document.body.style.overflow = "hidden";   // prevent background scroll
}

/**
 * closeTheory()
 * -------------
 * Hides the theory modal.
 */
function closeTheory() {
  document.getElementById("theory-overlay").classList.remove("active");
  document.getElementById("theory-modal").classList.remove("active");
  document.body.style.overflow = "";
}

// Close modal with Escape key
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeTheory();
});
