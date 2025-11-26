/* -----------------------------------------------------------
   GLOBAL STATE
----------------------------------------------------------- */
/* GLOBAL STATE */
let scale = 1;            // load at 100% zoom
let offsetX = 0;
let offsetY = 0;


let isPanning = false;
let lastX = 0, lastY = 0;

let draggedNode = null;
let pointerDownNode = null;
let selectedNode = null;
let downPos = { x: 0, y: 0 };
const clickThreshold = 6;

const zoomValue = document.getElementById("zoomValue");
/* -----------------------------------------------------------
   SOUND EFFECTS
----------------------------------------------------------- */
const SFX = {
    click: new Audio("sfx/click.wav"),
    pop: new Audio("sfx/pop.mp3"),
    throw: new Audio("sfx/throw.mp3"),
    woosh: new Audio("sfx/whooshend.mp3"),
    tap: new Audio("sfx/tap.mp3")
};

// Default volume tuning
SFX.click.volume = 0.25;
SFX.pop.volume = 0.35;
SFX.throw.volume = 0.4;
SFX.woosh.volume = 0.4;
SFX.tap.volume = 0.2;

// Utility: play safely
function playSFX(audio) {
    audio.currentTime = 0;
    audio.play().catch(()=>{});
}


/* -----------------------------------------------------------
   FORCE SETTINGS (soft, Obsidian-like)
----------------------------------------------------------- */
const FORCE = {
  chargeStrength: 80,        // repulsion, positive here (we'll subtract)
  centerStrength: 0.002,     // pull towards center
  velocityDecay: 0.96,       // damping
  collidePadding: 4,         // extra gap between nodes
  jitter: 0.002              // tiny random motion to keep it alive
};


/* -----------------------------------------------------------
   NODES (10 ads)
----------------------------------------------------------- */
let NODES = [
  {
    id: "#001",
    x: 0,
    y: 0,
    color: "#FF6B6B",
    videoUrl: "videos/ad1.mp4",
    metrics: { ctr: 3.1, hookRate: 45, holdRate: 60 }
  },
  {
    id: "#002",
    x: 0,
    y: 0,
    color: "#4ECDC4",
    videoUrl: "videos/ad2.mp4",
    metrics: { ctr: 2.4, hookRate: 42, holdRate: 55 }
  },
  {
    id: "#003",
    x: 0,
    y: 0,
    color: "#FFD93D",
    videoUrl: "videos/ad3.mp4",
    metrics: { ctr: 4.0, hookRate: 50, holdRate: 65 }
  },
  {
    id: "#004",
    x: 0,
    y: 0,
    color: "#6A4C93",
    videoUrl: "videos/ad4.mp4",
    metrics: { ctr: 3.8, hookRate: 47, holdRate: 62 }
  },
  {
    id: "#005",
    x: 0,
    y: 0,
    color: "#1A535C",
    videoUrl: "videos/ad5.mp4",
    metrics: { ctr: 5.2, hookRate: 55, holdRate: 70 }
  },
  {
    id: "#006",
    x: 0,
    y: 0,
    color: "#FF9F1C",
    videoUrl: "videos/ad6.mp4",
    metrics: { ctr: 4.6, hookRate: 53, holdRate: 68 }
  },
  {
    id: "#007",
    x: 0,
    y: 0,
    color: "#2EC4B6",
    videoUrl: "videos/ad7.mp4",
    metrics: { ctr: 2.9, hookRate: 39, holdRate: 52 }
  },
  {
    id: "#008",
    x: 0,
    y: 0,
    color: "#E71D36",
    videoUrl: "videos/ad8.mp4",
    metrics: { ctr: 3.3, hookRate: 44, holdRate: 59 }
  },
  {
    id: "#009",
    x: 0,
    y: 0,
    color: "#7FB800",
    videoUrl: "videos/ad9.mp4",
    metrics: { ctr: 4.9, hookRate: 56, holdRate: 72 }
  },
  {
    id: "#010",
    x: 0,
    y: 0,
    color: "#118AB2",
    videoUrl: "videos/ad10.mp4",
    metrics: { ctr: 3.7, hookRate: 48, holdRate: 63 }
  }
];

// add radius + velocities
NODES.forEach(n => {
  n.radius = 40 + n.metrics.ctr * 7;
  n.vx = 0;
  n.vy = 0;
});


/* -----------------------------------------------------------
   CANVAS SETUP
----------------------------------------------------------- */
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let canvasWidth = 0;
let canvasHeight = 0;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvasWidth = rect.width;
  canvasHeight = rect.height;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

resizeCanvas();
window.addEventListener("resize", () => {
  resizeCanvas();
  centerCamera();
});


/* -----------------------------------------------------------
   UTILS
----------------------------------------------------------- */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left - offsetX) / scale,
    y: (clientY - rect.top - offsetY) / scale
  };
}

function updateZoomValue() {
  zoomValue.textContent = `${Math.round(scale * 100)}%`;
}


/* -----------------------------------------------------------
   INITIAL LAYOUT: CIRCLE
----------------------------------------------------------- */
function arrangeNodesInCircle() {
  const count = NODES.length;
  const R = 350;

  NODES.forEach((n, i) => {
    const angle = (i / count) * Math.PI * 2;
    n.x = Math.cos(angle) * R;
    n.y = Math.sin(angle) * R;
  });
}

arrangeNodesInCircle();


/* -----------------------------------------------------------
   CAMERA CENTER
----------------------------------------------------------- */
function centerCamera() {
  offsetX = canvasWidth / 2;
  offsetY = canvasHeight / 2;
}

centerCamera();
updateZoomValue();


/* -----------------------------------------------------------
   DRAWING
----------------------------------------------------------- */
function sketchCircle(x, y, r, stroke, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.3;
  const jitter = 0.7;

  for (let i = 0; i < 2; i++) {
    ctx.beginPath();
    const off = i ? -jitter : jitter;
    ctx.arc(x + off, y + off, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawNodes() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "20px Ananias";

  NODES.forEach(n => {
    const r = n.radius;
    sketchCircle(n.x, n.y, r, "#00000099", n.color);

    if (selectedNode === n) {
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = 6;
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 22;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const label = n.id.length > 20 ? n.id.slice(0, 18) + "…" : n.id;
    ctx.fillStyle = "#111";
    ctx.fillText(label, n.x, n.y);
  });
}


/* -----------------------------------------------------------
   FORCE SIMULATION (soft, continuous, non-spinning)
----------------------------------------------------------- */
function updateNodes() {
  const dragging = draggedNode !== null;

  // 1. Many-body repulsion (soft)
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const A = NODES[i], B = NODES[j];

      let dx = B.x - A.x;
      let dy = B.y - A.y;
      let dist = Math.hypot(dx, dy) || 1;

      const force = FORCE.chargeStrength / (dist * dist); // ~1/r^2
      dx /= dist;
      dy /= dist;

      // Repulse (push apart)
      A.vx -= dx * force;
      A.vy -= dy * force;
      B.vx += dx * force;
      B.vy += dy * force;
    }
  }

  // 2. Center pull (light gravity to origin)
  NODES.forEach(n => {
    if (dragging && n === draggedNode) return;
    n.vx += -n.x * FORCE.centerStrength;
    n.vy += -n.y * FORCE.centerStrength;
  });

  // 3. Tiny jitter to keep graph "alive"
  NODES.forEach(n => {
    if (dragging && n === draggedNode) return;
    n.vx += (Math.random() - 0.5) * FORCE.jitter;
    n.vy += (Math.random() - 0.5) * FORCE.jitter;
  });

  // 4. Collision resolution (keep circles apart)
  for (let i = 0; i < NODES.length; i++) {
    for (let j = i + 1; j < NODES.length; j++) {
      const A = NODES[i], B = NODES[j];

      let dx = B.x - A.x;
      let dy = B.y - A.y;
      let dist = Math.hypot(dx, dy) || 1;

      const minDist = A.radius + B.radius + FORCE.collidePadding;

      if (dist < minDist) {
        // if (Math.random() < 0.02) {
        //     playSFX(SFX.tap);
        // }

        const overlap = (minDist - dist) * 0.5;
        dx /= dist;
        dy /= dist;

        // If dragging one, push the other more
        if (draggedNode === A && draggedNode !== B) {
          B.x += dx * overlap * 2;
          B.y += dy * overlap * 2;
        } else if (draggedNode === B && draggedNode !== A) {
          A.x -= dx * overlap * 2;
          A.y -= dy * overlap * 2;
        } else {
          A.x -= dx * overlap;
          A.y -= dy * overlap;
          B.x += dx * overlap;
          B.y += dy * overlap;
        }
      }
    }
  }

  // 5. Angular momentum cancellation (kills spin)
  let L = 0;
  let I = 0;
  NODES.forEach(n => {
    const { x, y, vx, vy } = n;
    L += x * vy - y * vx;
    I += x * x + y * y;
  });
  if (I > 0) {
    const omega = L / I; // angular velocity
    NODES.forEach(n => {
      // subtract rotational component: v' = v - (omega × r)
      const { x, y } = n;
      n.vx += omega * y; // minus (-omega*y)
      n.vy -= omega * x; // minus (omega*x)
    });
  }

  // 6. Integrate + decay
  NODES.forEach(n => {
    if (dragging && n === draggedNode) return;

    n.x += n.vx;
    n.y += n.vy;

    n.vx *= FORCE.velocityDecay;
    n.vy *= FORCE.velocityDecay;
  });
}


/* -----------------------------------------------------------
   RENDER LOOP
----------------------------------------------------------- */
function render() {
  updateNodes();

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  drawNodes();

  ctx.restore();

  requestAnimationFrame(render);
}

render();


/* -----------------------------------------------------------
   ZOOM CONTROLS
----------------------------------------------------------- */
function zoomAtCenter(factor) {
  const cx = canvasWidth / 2;
  const cy = canvasHeight / 2;

  const before = screenToWorld(cx, cy);
  scale = clamp(scale * factor, 0.3, 3);
  const after = screenToWorld(cx, cy);

  offsetX += (before.x - after.x) * scale;
  offsetY += (before.y - after.y) * scale;

  updateZoomValue();
}

document.getElementById("zoomIn").onclick = () => zoomAtCenter(1.1);
document.getElementById("zoomOut").onclick = () => zoomAtCenter(1 / 1.1);

canvas.addEventListener("wheel", e => {
  e.preventDefault();

  const factor = e.ctrlKey ? 1.2 : 1.1;
  const mouseBefore = screenToWorld(e.clientX, e.clientY);

  if (e.deltaY < 0) scale *= factor;
  else scale /= factor;

  scale = clamp(scale, 0.3, 3);

  const mouseAfter = screenToWorld(e.clientX, e.clientY);

  offsetX += (mouseBefore.x - mouseAfter.x) * scale;
  offsetY += (mouseBefore.y - mouseAfter.y) * scale;

  updateZoomValue();
});


/* -----------------------------------------------------------
   DRAGGING + THROW + PANNING
----------------------------------------------------------- */
canvas.addEventListener("mousedown", e => {
  if (e.button !== 0) return;

  downPos = { x: e.clientX, y: e.clientY };
  draggedNode = null;
  pointerDownNode = null;

  const worldPos = screenToWorld(e.clientX, e.clientY);

  for (const n of NODES) {
    if (Math.hypot(worldPos.x - n.x, worldPos.y - n.y) <= n.radius) {
      pointerDownNode = n;
      return;
    }
  }

  // PAN
  isPanning = true;
  const rect = canvas.getBoundingClientRect();
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
});

window.addEventListener("mousemove", e => {
  const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);

  if (pointerDownNode && moved > clickThreshold) {
    draggedNode = pointerDownNode;
    pointerDownNode = null;
  }

  if (draggedNode) {
    const world = screenToWorld(e.clientX, e.clientY);
    const prevX = draggedNode.x;
    const prevY = draggedNode.y;

    draggedNode.x = world.x;
    draggedNode.y = world.y;

    // throw velocity
    draggedNode.vx = clamp(draggedNode.x - prevX, -3, 3);
    draggedNode.vy = clamp(draggedNode.y - prevY, -3, 3);
    return;
  }

  if (isPanning) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    offsetX += x - lastX;
    offsetY += y - lastY;

    lastX = x;
    lastY = y;
  }
});

window.addEventListener("mouseup", e => {
  if (pointerDownNode) handleClick(e);
  if (draggedNode) {
    playSFX(SFX.throw);
    }


  pointerDownNode = null;
  draggedNode = null;
  isPanning = false;
});


/* -----------------------------------------------------------
   CLICK HANDLER → OPEN NODE
----------------------------------------------------------- */
function handleClick(e) {
  const world = screenToWorld(e.clientX, e.clientY);

  for (const n of NODES) {
    if (Math.hypot(world.x - n.x, world.y - n.y) <= n.radius) {
      selectedNode = n;
      playSFX(SFX.click);
      openNode(n);
      return;
    }
  }
}


/* -----------------------------------------------------------
   VIDEO POPUP / INFO PANEL
----------------------------------------------------------- */
const infoPanel = document.getElementById("infoPanel");
const videoOverlay = document.getElementById("videoOverlay");
const closeVideoBtn = document.getElementById("closeVideo");
const videoEl = document.getElementById("adVideo");
const videoMeta = document.getElementById("videoMeta");

function openNode(n) {
  //playSFX(SFX.pop);

  selectedNode = n;

  infoPanel.innerHTML = `
    <h3>${n.id}</h3>
    <p><strong>CTR:</strong> ${n.metrics.ctr}%</p>
    <p><strong>Hook Rate:</strong> ${n.metrics.hookRate}%</p>
    <p><strong>Hold Rate:</strong> ${n.metrics.holdRate}%</p>
  `;

  videoEl.src = n.videoUrl;
  videoMeta.textContent = n.id;

  videoOverlay.classList.remove("hidden");
  videoEl.play().catch(() => {});
}

function closeOverlay() {
  //playSFX(SFX.tap);

  videoOverlay.classList.add("hidden");
  videoEl.pause();
  videoEl.src = "";
}

closeVideoBtn.addEventListener("click", closeOverlay);
videoOverlay.addEventListener("click", e => {
  if (e.target === videoOverlay) closeOverlay();
});
