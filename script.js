// -------------------------------------------------------------
// GLOBAL CONSTANTS
// -------------------------------------------------------------

// Boundary rectangle inside which nodes are allowed to move
const WORLD = {
    left: -600,
    right: 600,
    top: -400,
    bottom: 400
};

// Zoom UI
const zoomValue = document.getElementById("zoomValue");



// -------------------------------------------------------------
// NODES
// -------------------------------------------------------------

const NODES = [
    {
        id: "TravelAnimator – Beach Reel",
        x: -200, y: -100,
        color: "#ffb454",
        videoUrl: "videos/work1.mp4",
        metrics: { ctr: 3.2, hookRate: 46, holdRate: 61 }
    },
    {
        id: "Christmas Offer – UGC",
        x: 80, y: -40,
        color: "#7fd1b9",
        videoUrl: "videos/work2.mp4",
        metrics: { ctr: 4.7, hookRate: 53, holdRate: 72 }
    },
    {
        id: "Map Story – Johnny Harris Style",
        x: 260, y: 160,
        color: "#b9a7ff",
        videoUrl: "videos/work3.mp4",
        metrics: { ctr: 2.9, hookRate: 39, holdRate: 58 }
    },
    {
        id: "Black Friday Performers",
        x: -60, y: 200,
        color: "#ff6f91",
        videoUrl: "videos/work4.mp4",
        metrics: { ctr: 5.1, hookRate: 57, holdRate: 70 }
    }
];

// Add drift + physics velocity
NODES.forEach(n => {
    n.dx = (Math.random() * 0.005) - 0.0025;
    n.dy = (Math.random() * 0.005) - 0.0025;
    n.vx = 0;
    n.vy = 0;
});



// -------------------------------------------------------------
// CANVAS SETUP
// -------------------------------------------------------------

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let canvasWidth = 0;
let canvasHeight = 0;

let scale = 1;
let offsetX = 0;
let offsetY = 0;

let isPanning = false;
let lastX = 0;
let lastY = 0;

let vx = 0, vy = 0;
let isInertia = false;

let draggedNode = null;
let pointerDownNode = null;
let downPos = { x: 0, y: 0 };
let selectedNode = null;   // <— track highlighted node

const clickThreshold = 6;



// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

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



// -------------------------------------------------------------
// CANVAS RESIZING & CAMERA
// -------------------------------------------------------------

function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvasWidth = rect.width;
    canvasHeight = rect.height;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", () => {
    resizeCanvas();
    render();
});

resizeCanvas();

function centerCamera() {
    let cx = 0, cy = 0;
    NODES.forEach(n => { cx += n.x; cy += n.y; });
    cx /= NODES.length;
    cy /= NODES.length;

    offsetX = canvasWidth / 2 - cx * scale;
    offsetY = canvasHeight / 2 - cy * scale;
}

centerCamera();



// -------------------------------------------------------------
// DRAWING METHODS
// -------------------------------------------------------------

function drawBoundary() {
    ctx.save();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 6]);

    ctx.strokeRect(
        WORLD.left,
        WORLD.top,
        WORLD.right - WORLD.left,
        WORLD.bottom - WORLD.top
    );

    ctx.restore();
}

function drawGrid() {
    const grid = 40;
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;

    const startX = -((offsetX / scale + 2000) | 0);
    const endX = startX + canvasWidth / scale + 4000;
    const startY = -((offsetY / scale + 2000) | 0);
    const endY = startY + canvasHeight / scale + 4000;

    for (let x = startX; x < endX; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    for (let y = startY; y < endY; y += grid) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
    ctx.restore();
}

function sketchCircle(x, y, r, stroke, fill) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2.5;

    const jitter = 0.7;
    for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        const off = i === 0 ? jitter : -jitter;
        ctx.arc(x + off, y + off, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawNodes() {
    ctx.font = "14px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    NODES.forEach(node => {
        const r = 40 + node.metrics.ctr * 7;
        node.radius = r;

        sketchCircle(node.x, node.y, r, "#00000099", node.color);
        // highlight if selected
        if (selectedNode === node) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.lineWidth = 6;
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 22;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }


        let label = node.id.length > 28 ? node.id.slice(0, 25) + "…" : node.id;
        ctx.fillStyle = "#111";
        ctx.fillText(label, node.x, node.y);
    });
}



// -------------------------------------------------------------
// PHYSICS
// -------------------------------------------------------------

function physicsCollisions() {
    const e = 0.4;

    for (let i = 0; i < NODES.length; i++) {
        for (let j = i + 1; j < NODES.length; j++) {
            const A = NODES[i], B = NODES[j];

            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const dist = Math.hypot(dx, dy);
            const minDist = A.radius + B.radius;

            if (dist < minDist && dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;

                // Correct overlap
                const overlap = (minDist - dist) * 0.5;
                A.x -= nx * overlap;
                A.y -= ny * overlap;
                B.x += nx * overlap;
                B.y += ny * overlap;

                // Relative velocity
                const rvx = B.vx - A.vx;
                const rvy = B.vy - A.vy;

                const velAlong = rvx * nx + rvy * ny;
                if (velAlong > 0) continue;

                const jImpulse = -(1 + e) * velAlong;

                A.vx -= jImpulse * nx;
                A.vy -= jImpulse * ny;
                B.vx += jImpulse * nx;
                B.vy += jImpulse * ny;
            }
        }
    }
}

function updateNodes() {
    const friction = 0.96;

    NODES.forEach(n => {
        // drift if not dragging
        if (n !== draggedNode) {
            n.x += n.dx;
            n.y += n.dy;
        }

        // apply velocity
        n.x += n.vx;
        n.y += n.vy;

        // friction
        n.vx *= friction;
        n.vy *= friction;

        // boundary clamp
        if (n.x - n.radius < WORLD.left) {
            n.x = WORLD.left + n.radius;
            n.vx *= -0.4;
        }
        if (n.x + n.radius > WORLD.right) {
            n.x = WORLD.right - n.radius;
            n.vx *= -0.4;
        }
        if (n.y - n.radius < WORLD.top) {
            n.y = WORLD.top + n.radius;
            n.vy *= -0.4;
        }
        if (n.y + n.radius > WORLD.bottom) {
            n.y = WORLD.bottom - n.radius;
            n.vy *= -0.4;
        }
    });

    physicsCollisions();
}



// -------------------------------------------------------------
// RENDER LOOP
// -------------------------------------------------------------

function render() {
    updateNodes();

    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    drawBoundary();
    drawGrid();
    drawNodes();

    ctx.restore();

    requestAnimationFrame(render);
}

render();



// -------------------------------------------------------------
// ZOOM CONTROLS
// -------------------------------------------------------------

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
    const mouse = screenToWorld(e.clientX, e.clientY);

    if (e.deltaY < 0) scale *= factor;
    else scale /= factor;

    scale = clamp(scale, 0.3, 3);

    const after = screenToWorld(e.clientX, e.clientY);

    offsetX += (mouse.x - after.x) * scale;
    offsetY += (mouse.y - after.y) * scale;

    updateZoomValue();
});

updateZoomValue();



// -------------------------------------------------------------
// DRAGGING / THROWING / PANNING
// -------------------------------------------------------------

canvas.addEventListener("mousedown", e => {
    if (e.button !== 0) return;

    downPos = { x: e.clientX, y: e.clientY };
    draggedNode = null;
    pointerDownNode = null;

    const world = screenToWorld(e.clientX, e.clientY);

    for (const node of NODES) {
        if (Math.hypot(world.x - node.x, world.y - node.y) <= node.radius) {
            pointerDownNode = node;
            return;
        }
    }

    // else begin canvas panning
    isPanning = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;

    vx = vy = 0;
    isInertia = false;
});


window.addEventListener("mousemove", e => {
    const moved = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);

    // Start dragging node
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

        // Throw velocity
        const tvx = draggedNode.x - prevX;
        const tvy = draggedNode.y - prevY;

        draggedNode.vx = clamp(tvx, -3, 3);
        draggedNode.vy = clamp(tvy, -3, 3);

        physicsCollisions();
        return;
    }

    if (isPanning) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const dx = x - lastX;
        const dy = y - lastY;

        offsetX += dx;
        offsetY += dy;

        vx = dx; vy = dy;

        lastX = x;
        lastY = y;

        render();
    }
});

window.addEventListener("mouseup", e => {
    if (pointerDownNode) handleClick(e);

    pointerDownNode = null;
    draggedNode = null;

    if (isPanning) {
        isPanning = false;
        startInertia();
    }
});


function startInertia() {
    if (Math.hypot(vx, vy) < 0.1) return;

    isInertia = true;
    const friction = 0.9;

    function step() {
        if (!isInertia) return;

        offsetX += vx;
        offsetY += vy;

        vx *= friction;
        vy *= friction;

        render();

        if (Math.hypot(vx, vy) < 0.1) {
            isInertia = false;
            return;
        }
        requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}



// -------------------------------------------------------------
// NODE CLICK → SHOW VIDEO + METRICS
// -------------------------------------------------------------

function handleClick(e) {
    const world = screenToWorld(e.clientX, e.clientY);

    for (const node of NODES) {
        if (Math.hypot(world.x - node.x, world.y - node.y) <= node.radius) {
            openNode(node);
            return;
        }
    }
}



// -------------------------------------------------------------
// UI — VIDEO MODAL
// -------------------------------------------------------------

const infoPanel = document.getElementById("infoPanel");
const videoOverlay = document.getElementById("videoOverlay");
const closeVideoBtn = document.getElementById("closeVideo");
const videoEl = document.getElementById("adVideo");
const videoMeta = document.getElementById("videoMeta");

function openNode(node) {
    selectedNode = node;
    infoPanel.innerHTML = `
        <h3>${node.id}</h3>
        <div class="info-metrics">
            <p><strong>CTR:</strong> ${node.metrics.ctr}%</p>
            <p><strong>Hook Rate:</strong> ${node.metrics.hookRate}%</p>
            <p><strong>Hold Rate:</strong> ${node.metrics.holdRate}%</p>
        </div>
        <p style="margin-top:8px; font-size:12px; color:#888;">
            Tip: Scroll to zoom into the node, drag to reposition the canvas.
        </p>
    `;

    videoEl.src = node.videoUrl;
    videoMeta.textContent = node.id;

    videoOverlay.classList.remove("hidden");
    videoEl.play().catch(() => { });
}

function closeOverlay() {
    videoOverlay.classList.add("hidden");
    videoEl.pause();
    videoEl.src = "";
}

closeVideoBtn.addEventListener("click", closeOverlay);
videoOverlay.addEventListener("click", e => {
    if (e.target === videoOverlay) closeOverlay();
});
