const forceInputs = document.getElementById("forceInputs");
const forceTableBody = document.getElementById("forceTableBody");
const resultBox = document.getElementById("resultBox");
const vectorCanvas = document.getElementById("vectorCanvas");
const ctx = vectorCanvas.getContext("2d");

const addForceBtn = document.getElementById("addForceBtn");
const calculateBtn = document.getElementById("calculateBtn");

// Set this to your Render backend URL (no trailing slash).
const API_BASE_URL = "https://concurrent-force-system-analyzer.onrender.com";

let forceCount = 0;

function addForceRow(defaultMagnitude = "", defaultAngle = "") {
  forceCount += 1;

  const row = document.createElement("div");
  row.className = "forceRow";
  row.dataset.id = String(forceCount);

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

  row.querySelector(".removeBtn").addEventListener("click", () => {
    if (forceInputs.children.length === 1) {
      alert("At least one force is required.");
      return;
    }
    row.remove();
    relabelForces();
  });

  forceInputs.appendChild(row);
}

function relabelForces() {
  const rows = [...forceInputs.querySelectorAll(".forceRow")];
  rows.forEach((row, index) => {
    const labelNumber = index + 1;
    const tag = row.querySelector(".forceTag");
    tag.textContent = `F${labelNumber}`;
  });
}

function getForcesFromInputs() {
  const rows = [...forceInputs.querySelectorAll(".forceRow")];
  const forces = [];

  for (let i = 0; i < rows.length; i += 1) {
    const magnitudeInput = rows[i].querySelector("input[id^='magnitude-']");
    const angleInput = rows[i].querySelector("input[id^='angle-']");

    const magnitude = Number(magnitudeInput.value);
    const angle = Number(angleInput.value);

    if (!Number.isFinite(magnitude) || magnitude <= 0) {
      alert(`Force F${i + 1}: magnitude must be greater than 0.`);
      magnitudeInput.focus();
      return null;
    }

    if (!Number.isFinite(angle)) {
      alert(`Force F${i + 1}: angle must be a valid number.`);
      angleInput.focus();
      return null;
    }

    forces.push({ magnitude, angle });
  }

  return forces;
}

function computeComponents(forces) {
  return forces.map((force, index) => {
    // Convert angle from degrees to radians before trig operations.
    const theta = (force.angle * Math.PI) / 180;

    // Resolve force into horizontal component.
    // Fx = F cos(theta)
    // cosine gives the projection of force along the x-axis.
    const fx = force.magnitude * Math.cos(theta);

    // Resolve force into vertical component.
    // Fy = F sin(theta)
    // sine gives the projection of force along the y-axis.
    const fy = force.magnitude * Math.sin(theta);

    return {
      label: `F${index + 1}`,
      magnitude: force.magnitude,
      angle: force.angle,
      fx,
      fy,
    };
  });
}

function renderForceTable(componentRows) {
  if (componentRows.length === 0) {
    forceTableBody.innerHTML = '<tr><td colspan="5" class="empty">No forces available.</td></tr>';
    return;
  }

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

function renderResult(resultData) {
  const resultantDirection =
    resultData.angle === null
      ? "Undefined (system in equilibrium)"
      : `${Number(resultData.angle).toFixed(4)} deg`;

  const equilibriumDirection =
    resultData.equilibriumAngle === null
      ? "Undefined (system in equilibrium)"
      : `${Number(resultData.equilibriumAngle).toFixed(4)} deg`;

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

function drawAxes() {
  const { width, height } = vectorCanvas;
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.clearRect(0, 0, width, height);

  ctx.strokeStyle = "#cdd9e7";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, centerY);
  ctx.lineTo(width, centerY);
  ctx.moveTo(centerX, 0);
  ctx.lineTo(centerX, height);
  ctx.stroke();

  ctx.fillStyle = "#5f7187";
  ctx.font = "14px Barlow";
  ctx.fillText("+X", width - 35, centerY - 8);
  ctx.fillText("-X", 10, centerY - 8);
  ctx.fillText("+Y", centerX + 8, 16);
  ctx.fillText("-Y", centerX + 8, height - 10);
}

function drawArrow(startX, startY, endX, endY, color, label) {
  const headLength = 10;
  const angle = Math.atan2(endY - startY, endX - startX);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.5;

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(endX, endY);
  ctx.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();

  ctx.font = "12px Barlow";
  ctx.fillText(label, endX + 4, endY - 4);
}

function drawVectors(componentRows, resultData) {
  drawAxes();

  const { width, height } = vectorCanvas;
  const centerX = width / 2;
  const centerY = height / 2;

  const magnitudes = componentRows.map((row) => row.magnitude);
  magnitudes.push(Math.abs(resultData.resultant));

  const maxMagnitude = Math.max(...magnitudes, 1);
  const scale = 170 / maxMagnitude;

  componentRows.forEach((row) => {
    const endX = centerX + row.fx * scale;
    const endY = centerY - row.fy * scale;
    drawArrow(centerX, centerY, endX, endY, "#1b74d1", row.label);
  });

  // Avoid drawing zero-length arrows when system is in equilibrium.
  if (resultData.resultant > 0.0001) {
    const resultantEndX = centerX + resultData.sumFx * scale;
    const resultantEndY = centerY - resultData.sumFy * scale;
    drawArrow(centerX, centerY, resultantEndX, resultantEndY, "#d7263d", "R");

    const equilibriumEndX = centerX + resultData.equilibriumFx * scale;
    const equilibriumEndY = centerY - resultData.equilibriumFy * scale;
    drawArrow(centerX, centerY, equilibriumEndX, equilibriumEndY, "#24935a", "Feq");
  }
}

async function calculate() {
  const forces = getForcesFromInputs();
  if (!forces) return;

  const componentRows = computeComponents(forces);
  renderForceTable(componentRows);

  const endpoint = `${API_BASE_URL}/calculate`;
  console.log("[ConcurrentForce] Request URL:", endpoint);
  console.log("[ConcurrentForce] Request payload:", { forces });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ forces }),
    });

    console.log("[ConcurrentForce] Response status:", response.status, response.statusText);

    if (!response.ok) {
      let serverMessage = `API request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData && errorData.error) {
          serverMessage = errorData.error;
        }
      } catch (_parseError) {
        // Keep fallback message when backend does not return JSON.
      }
      throw new Error(serverMessage);
    }

    const resultData = await response.json();
    console.log("[ConcurrentForce] Response data:", resultData);
    renderResult(resultData);
    drawVectors(componentRows, resultData);
  } catch (error) {
    console.error("[ConcurrentForce] API error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown API error";
    resultBox.innerHTML = `
      <p><strong style="color:#d7263d;">Calculation failed</strong></p>
      <p style="color:#d7263d;">${errorMessage}</p>
      <p style="font-size:0.85rem;color:#5f7187;">Check that your Render backend URL is correct and the service is running.</p>
    `;
  }
}

addForceBtn.addEventListener("click", () => addForceRow());
calculateBtn.addEventListener("click", calculate);

addForceRow(50, 30);
addForceRow(70, 120);
drawAxes();
