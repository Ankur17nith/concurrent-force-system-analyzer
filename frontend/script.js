// Next line gets the force input container from the page.
const forceInputs = document.getElementById("forceInputs");
// Next line gets the table body where component rows are shown.
const forceTableBody = document.getElementById("forceTableBody");
// Next line gets the result box where final outputs are printed.
const resultBox = document.getElementById("resultBox");
// Next line gets the canvas element used for vector drawing.
const vectorCanvas = document.getElementById("vectorCanvas");
// Next line gets the 2D drawing context from the canvas.
const ctx = vectorCanvas.getContext("2d");

// Next line gets the button that adds a new force row.
const addForceBtn = document.getElementById("addForceBtn");
// Next line gets the button that starts calculation.
const calculateBtn = document.getElementById("calculateBtn");

// Next line stores backend base URL for API calls.
const API_BASE_URL = "https://concurrent-force-system-analyzer.onrender.com";

// Next line stores how many force rows have been created.
let forceCount = 0;

// Next line defines a function to add one force row to the UI.
function addForceRow(defaultMagnitude = "", defaultAngle = "") {
  // Next line increases force row counter by one.
  forceCount += 1;

  // Next line creates a new row container element.
  const row = document.createElement("div");
  // Next line sets CSS class for row styling.
  row.className = "forceRow";
  // Next line stores row id in a data attribute.
  row.dataset.id = String(forceCount);

  // Next line builds row HTML with magnitude and angle inputs.
  row.innerHTML = `
    <div class="forceTag">F${forceCount}</div>
    <div>
      <label for="magnitude-${forceCount}">Magnitude (N)</label>
      <input id="magnitude-${forceCount}" type="number" step="any" min="0" value="${defaultMagnitude}" />
    </div>
    <div>
      <label for="angle-${forceCount}">Angle (deg)</label>
      <input id="angle-${forceCount}" type="number" step="any" value="${defaultAngle}" />
    </div>
    <button type="button" class="removeBtn">Remove</button>
  `;

  // Next line attaches click handler to remove button.
  row.querySelector(".removeBtn").addEventListener("click", () => {
    // Next line prevents deleting the last remaining force row.
    if (forceInputs.children.length === 1) {
      // Next line shows warning message to user.
      alert("At least one force is required.");
      // Next line exits this click handler early.
      return;
    }
    // Next line removes this row from the DOM.
    row.remove();
    // Next line updates force labels after row removal.
    relabelForces();
  });

  // Next line adds the new row to the force input area.
  forceInputs.appendChild(row);
}

// Next line defines a function to relabel rows as F1, F2, F3.
function relabelForces() {
  // Next line collects all existing force rows.
  const rows = [...forceInputs.querySelectorAll(".forceRow")];
  // Next line loops through rows for relabeling.
  rows.forEach((row, index) => {
    // Next line computes label number from index.
    const labelNumber = index + 1;
    // Next line gets the tag element showing force name.
    const tag = row.querySelector(".forceTag");
    // Next line writes the updated label text.
    tag.textContent = `F${labelNumber}`;
  });
}

// Next line defines a function to read and validate user inputs.
function getForcesFromInputs() {
  // Next line collects all row elements.
  const rows = [...forceInputs.querySelectorAll(".forceRow")];
  // Next line creates array that will hold force objects.
  const forces = [];

  // Next line loops through each input row.
  for (let i = 0; i < rows.length; i += 1) {
    // Next line finds magnitude input in current row.
    const magnitudeInput = rows[i].querySelector("input[id^='magnitude-']");
    // Next line finds angle input in current row.
    const angleInput = rows[i].querySelector("input[id^='angle-']");

    // Next line converts magnitude text to number.
    const magnitude = Number(magnitudeInput.value);
    // Next line converts angle text to number.
    const angle = Number(angleInput.value);

    // Next line validates magnitude is positive.
    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      // Next line alerts the user about invalid magnitude.
      alert(`Force F${i + 1}: magnitude must be greater than 0.`);
      // Next line puts focus back on invalid field.
      magnitudeInput.focus();
      // Next line returns null to stop calculation flow.
      return null;
    }

    // Next line validates angle is a valid number.
    if (!Number.isFinite(angle)) {
      // Next line alerts the user about invalid angle.
      alert(`Force F${i + 1}: angle must be a valid number.`);
      // Next line puts focus back on invalid field.
      angleInput.focus();
      // Next line returns null to stop calculation flow.
      return null;
    }

    // Next line saves validated force in array.
    forces.push({ magnitude, angle });
  }

  // Next line returns the full validated force array.
  return forces;
}

// Next line defines a function that resolves each force into x and y components.
function computeComponents(forces) {
  // Next line maps each force to a component object.
  return forces.map((force, index) => {
    // Next line converts angle from degrees to radians.
    const theta = (force.angle * Math.PI) / 180;
    // Next line calculates x component using cosine.
    const fx = force.magnitude * Math.cos(theta);
    // Next line calculates y component using sine.
    const fy = force.magnitude * Math.sin(theta);

    // Next line returns one component row object.
    return {
      label: `F${index + 1}`,
      magnitude: force.magnitude,
      angle: force.angle,
      fx,
      fy,
    };
  });
}

// Next line defines a function to render the force component table.
function renderForceTable(componentRows) {
  // Next line checks whether no rows are available.
  if (componentRows.length === 0) {
    // Next line shows placeholder when no rows exist.
    forceTableBody.innerHTML = '<tr><td colspan="5" class="empty">No forces available.</td></tr>';
    // Next line exits early.
    return;
  }

  // Next line builds all table rows and injects into tbody.
  forceTableBody.innerHTML = componentRows
    .map(
      (row) => `
        <tr>
          <td>${row.label}</td>
          <td>${row.magnitude.toFixed(2)}</td>
          <td>${row.angle.toFixed(2)}</td>
          <td>${row.fx.toFixed(4)}</td>
          <td>${row.fy.toFixed(4)}</td>
        </tr>
      `
    )
    .join("");
}

// Next line defines a function to render final calculation results.
function renderResult(resultData) {
  // Next line prepares resultant direction text or equilibrium text.
  const resultantDirection =
    resultData.angle === null
      ? "Undefined (system in equilibrium)"
      : `${Number(resultData.angle).toFixed(4)} deg`;

  // Next line prepares equilibrant direction text or equilibrium text.
  const equilibriumDirection =
    resultData.equilibriumAngle === null
      ? "Undefined (system in equilibrium)"
      : `${Number(resultData.equilibriumAngle).toFixed(4)} deg`;

  // Next line writes all final values in result box.
  resultBox.innerHTML = `
    <p><strong>&Sigma;Fx:</strong> ${resultData.sumFx.toFixed(4)} N</p>
    <p><strong>&Sigma;Fy:</strong> ${resultData.sumFy.toFixed(4)} N</p>
    <p><strong>Resultant R:</strong> ${resultData.resultant.toFixed(4)} N</p>
    <p><strong>Resultant Direction &theta;:</strong> ${resultantDirection}</p>
    <p><strong>Equilibrium Force Magnitude:</strong> ${resultData.equilibriumMagnitude.toFixed(4)} N</p>
    <p><strong>Equilibrium Force Direction:</strong> ${equilibriumDirection}</p>
    <p><strong>Equilibrium Components:</strong> Fx = ${resultData.equilibriumFx.toFixed(4)} N, Fy = ${resultData.equilibriumFy.toFixed(4)} N</p>
  `;
}

// Next line defines a function to draw x and y axes on canvas.
function drawAxes() {
  // Next line reads canvas size values.
  const { width, height } = vectorCanvas;
  // Next line calculates horizontal center position.
  const centerX = width / 2;
  // Next line calculates vertical center position.
  const centerY = height / 2;

  // Next line clears previous drawing.
  ctx.clearRect(0, 0, width, height);

  // Next line sets axis line color.
  ctx.strokeStyle = "#cdd9e7";
  // Next line sets axis line thickness.
  ctx.lineWidth = 1;
  // Next line starts a new path for axes.
  ctx.beginPath();
  // Next line moves pen to start of x-axis.
  ctx.moveTo(0, centerY);
  // Next line draws x-axis to right side.
  ctx.lineTo(width, centerY);
  // Next line moves pen to start of y-axis.
  ctx.moveTo(centerX, 0);
  // Next line draws y-axis downward.
  ctx.lineTo(centerX, height);
  // Next line paints axis lines.
  ctx.stroke();

  // Next line sets label text color.
  ctx.fillStyle = "#5f7187";
  // Next line sets label font style.
  ctx.font = "14px Barlow";
  // Next line writes +X label.
  ctx.fillText("+X", width - 35, centerY - 8);
  // Next line writes -X label.
  ctx.fillText("-X", 10, centerY - 8);
  // Next line writes +Y label.
  ctx.fillText("+Y", centerX + 8, 16);
  // Next line writes -Y label.
  ctx.fillText("-Y", centerX + 8, height - 10);
}

// Next line defines a helper to draw one vector arrow.
function drawArrow(startX, startY, endX, endY, color, label) {
  // Next line sets arrow head size.
  const headLength = 10;
  // Next line finds arrow direction angle in radians.
  const angle = Math.atan2(endY - startY, endX - startX);

  // Next line sets stroke color for arrow line.
  ctx.strokeStyle = color;
  // Next line sets fill color for arrow head.
  ctx.fillStyle = color;
  // Next line sets arrow line width.
  ctx.lineWidth = 2.5;

  // Next line starts line path for arrow body.
  ctx.beginPath();
  // Next line moves to arrow starting point.
  ctx.moveTo(startX, startY);
  // Next line draws arrow body to end point.
  ctx.lineTo(endX, endY);
  // Next line paints arrow body.
  ctx.stroke();

  // Next line starts path for triangular arrow head.
  ctx.beginPath();
  // Next line moves to arrow tip.
  ctx.moveTo(endX, endY);
  // Next line draws first side of arrow head.
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  // Next line draws second side of arrow head.
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  // Next line closes arrow head shape.
  ctx.closePath();
  // Next line fills arrow head.
  ctx.fill();

  // Next line sets text font for arrow label.
  ctx.font = "12px Barlow";
  // Next line draws label near arrow end.
  ctx.fillText(label, endX + 4, endY - 4);
}

// Next line defines a function to draw all force vectors.
function drawVectors(componentRows, resultData) {
  // Next line redraws clean axes first.
  drawAxes();

  // Next line reads canvas width and height.
  const { width, height } = vectorCanvas;
  // Next line gets x-coordinate of origin.
  const centerX = width / 2;
  // Next line gets y-coordinate of origin.
  const centerY = height / 2;

  // Next line creates list of all magnitudes for scaling.
  const magnitudes = componentRows.map((row) => row.magnitude);
  // Next line includes resultant in scaling list.
  magnitudes.push(Math.abs(resultData.resultant));

  // Next line finds largest magnitude for dynamic scale.
  const maxMagnitude = Math.max(...magnitudes, 1);
  // Next line creates drawing scale factor.
  const scale = 170 / maxMagnitude;

  // Next line draws each individual force vector.
  componentRows.forEach((row) => {
    // Next line computes vector end x position.
    const endX = centerX + row.fx * scale;
    // Next line computes vector end y position.
    const endY = centerY - row.fy * scale;
    // Next line draws individual vector in blue.
    drawArrow(centerX, centerY, endX, endY, "#1b74d1", row.label);
  });

  // Next line avoids drawing zero-length resultant/equilibrant arrows.
  if (resultData.resultant > 0.0001) {
    // Next line computes resultant end x position.
    const resultantEndX = centerX + resultData.sumFx * scale;
    // Next line computes resultant end y position.
    const resultantEndY = centerY - resultData.sumFy * scale;
    // Next line draws resultant vector in red.
    drawArrow(centerX, centerY, resultantEndX, resultantEndY, "#d7263d", "R");

    // Next line computes equilibrant end x position.
    const equilibriumEndX = centerX + resultData.equilibriumFx * scale;
    // Next line computes equilibrant end y position.
    const equilibriumEndY = centerY - resultData.equilibriumFy * scale;
    // Next line draws equilibrant vector in green.
    drawArrow(centerX, centerY, equilibriumEndX, equilibriumEndY, "#24935a", "Feq");
  }
}

// Next line defines main function that calls backend and updates UI.
async function calculate() {
  // Next line reads and validates force inputs from UI.
  const forces = getForcesFromInputs();
  // Next line exits if validation fails.
  if (!forces) return;

  // Next line computes local component table data.
  const componentRows = computeComponents(forces);
  // Next line renders component values in table.
  renderForceTable(componentRows);

  // Next line builds full API endpoint URL.
  const endpoint = `${API_BASE_URL}/calculate`;
  // Next line logs request URL for debugging.
  console.log("[ConcurrentForce] Request URL:", endpoint);
  // Next line logs request payload for debugging.
  console.log("[ConcurrentForce] Request payload:", { forces });

  // Next line starts error-safe network request section.
  try {
    // Next line sends POST request to backend API.
    const response = await fetch(endpoint, {
      // Next line sets HTTP method to POST.
      method: "POST",
      // Next line sets JSON content header.
      headers: { "Content-Type": "application/json" },
      // Next line sends forces array in JSON body.
      body: JSON.stringify({ forces }),
    });

    // Next line logs response status for debugging.
    console.log("[ConcurrentForce] Response status:", response.status, response.statusText);

    // Next line checks if backend returned non-success status.
    if (!response.ok) {
      // Next line creates default error message.
      let serverMessage = `API request failed (${response.status})`;
      // Next line tries reading backend JSON error.
      try {
        // Next line parses backend error body as JSON.
        const errorData = await response.json();
        // Next line replaces message if backend provided one.
        if (errorData && errorData.error) {
          // Next line stores backend-provided error text.
          serverMessage = errorData.error;
        }
      // Next line catches JSON parse errors for non-JSON responses.
      } catch (_parseError) {
        // Next line intentionally keeps fallback message.
      }
      // Next line throws error so catch block can handle it.
      throw new Error(serverMessage);
    }

    // Next line parses successful JSON response.
    const resultData = await response.json();
    // Next line logs response data for debugging.
    console.log("[ConcurrentForce] Response data:", resultData);
    // Next line renders textual results in UI.
    renderResult(resultData);
    // Next line renders vectors in canvas.
    drawVectors(componentRows, resultData);
  // Next line handles fetch/network/backend errors.
  } catch (error) {
    // Next line logs full error object in console.
    console.error("[ConcurrentForce] API error:", error);
    // Next line converts unknown error to readable message.
    const errorMessage = error instanceof Error ? error.message : "Unknown API error";
    // Next line shows error message in result panel.
    resultBox.innerHTML = `
      <p><strong style="color:#d7263d;">Calculation failed</strong></p>
      <p style="color:#d7263d;">${errorMessage}</p>
      <p style="font-size:0.85rem;color:#5f7187;">Check that your Render backend URL is correct and the service is running.</p>
    `;
  }
}

// Next line binds add button click to addForceRow function.
addForceBtn.addEventListener("click", () => addForceRow());
// Next line binds calculate button click to calculate function.
calculateBtn.addEventListener("click", calculate);

// Next line inserts first default force row.
addForceRow(50, 30);
// Next line inserts second default force row.
addForceRow(70, 120);
// Next line draws coordinate axes when page loads.
drawAxes();
