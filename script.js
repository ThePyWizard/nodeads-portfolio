// -------------------------------------------------------------
// GLOBAL CONSTANTS
// -------------------------------------------------------------

let scale = 0.3;   // start fully zoomed out
let offsetX = 0;
let offsetY = 0;

let isPanning = false;
let lastX = 0, lastY = 0;
let vx = 0, vy = 0;
let isInertia = false;

let draggedNode = null;
let pointerDownNode = null;
let selectedNode = null;
let downPos = { x: 0, y: 0 };
const clickThreshold = 6;

const zoomValue = document.getElementById("zoomValue");



// -------------------------------------------------------------
// NODES DATA
// -------------------------------------------------------------

const NODES = [
    {
        id: "TravelAnimator – Beach Reel",
        x: 0, y: 0,
        color: "#ffb454",
        videoUrl: "videos/work1.mp4",
        metrics: { ctr: 3.2, hookRate: 46, holdRate: 61 }
    },
    {
        id: "Christmas Offer – UGC",
        x: 0, y: 0,
        color: "#7fd1b9",
        videoUrl: "videos/work2.mp4",
        metrics: { ctr: 4.7, hookRate: 53, holdRate: 72 }
    },
    {
        id: "Map Story – Johnny Harris Style",
        x: 0, y: 0,
        color: "#b9a7ff",
        videoUrl: "videos/work3.mp4",
        metrics: { ctr: 2.9, hookRate: 39, holdRate: 58 }
    },
    {
        id: "Black Friday Performers",
        x: 0, y: 0,
        color: "#ff6f91",
        videoUrl: "videos/work4.mp4",
        metrics: { ctr: 5.1, hookRate: 57, holdRate: 70 }
    }
];

NODES.forEach(n => {
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



// -------------------------------------------------------------
// UTILS
// -------------------------------------------------------------

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



// -------------------------------------------------------------
// CIRCULAR ARRANGEMENT (INITIAL)
// -------------------------------------------------------------

function arrangeNodesInCircle() {
    const count = NODES.length;
    const radius = 350;

    NODES.forEach((n, i) => {
        const angle = (i / count) * Math.PI * 2;
        n.x = Math.cos(angle) * radius;
        n.y = Math.sin(angle) * radius;
    });
}

arrangeNodesInCircle();



// -------------------------------------------------------------
// CAMERA CENTER
// -------------------------------------------------------------

function centerCamera() {
    offsetX = canvasWidth / 2;
    offsetY = canvasHeight / 2;
}

centerCamera();
updateZoomValue();



// -------------------------------------------------------------
// DRAWING
// -------------------------------------------------------------

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
        const off = i ? -jitter : jitter;
        ctx.arc(x + off, y + off, r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawNodes() {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "14px system-ui";

    NODES.forEach(node => {
        const r = 40 + node.metrics.ctr * 7;
        node.radius = r;

        sketchCircle(node.x, node.y, r, "#00000099", node.color);

        // glow highlight
        if (selectedNode === node) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,255,255,0.9)";
            ctx.shadowColor = node.color;
            ctx.shadowBlur = 22;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        const label =
            node.id.length > 28 ? node.id.slice(0, 25) + "…" : node.id;
        ctx.fillStyle = "#111";
        ctx.fillText(label, node.x, node.y);
    });
}


// -------------------------------------------------------------
// PHYSICS — REPULSION + RADIAL SPRING + COLLISIONS
// -------------------------------------------------------------

function applyRepulsion() {
    const repulsionStrength = 30000;

    for (let i = 0; i < NODES.length; i++) {
        for (let j = i + 1; j < NODES.length; j++) {
            const A = NODES[i], B = NODES[j];

            const dx = B.x - A.x;
            const dy = B.y - A.y;
            let dist = Math.hypot(dx, dy);
            if (dist < 1) dist = 1;

            const force = repulsionStrength / (dist * dist);

            const nx = dx / dist;
            const ny = dy / dist;

            A.vx -= nx * force;
            A.vy -= ny * force;

            B.vx += nx * force;
            B.vy += ny * force;
        }
    }
}

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

                const overlap = (minDist - dist) * 0.5;
                A.x -= nx * overlap;
                A.y -= ny * overlap;
                B.x += nx * overlap;
                B.y += ny * overlap;

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
    applyRepulsion(); // evenly spaced

    NODES.forEach(n => {
        // radial spring (pull toward circle)
        const targetRadius = 350;
        const distFromCenter = Math.hypot(n.x, n.y) || 1;
        const dirX = n.x / distFromCenter;
        const dirY = n.y / distFromCenter;

        const springStrength = 0.02;
        const radialForce = (targetRadius - distFromCenter) * springStrength;

        n.vx += dirX * radialForce;
        n.vy += dirY * radialForce;

        // apply velocity
        n.x += n.vx;
        n.y += n.vy;

        n.vx *= 0.94;
        n.vy *= 0.94;
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



// -------------------------------------------------------------
// DRAGGING + THROWING + PANNING
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

    // start panning
    isPanning = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;

    vx = vy = 0;
    isInertia = false;
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

        draggedNode.vx = clamp(draggedNode.x - prevX, -3, 3);
        draggedNode.vy = clamp(draggedNode.y - prevY, -3, 3);

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
    }
});



// -------------------------------------------------------------
// CLICK HANDLER
// -------------------------------------------------------------

function handleClick(e) {
    const world = screenToWorld(e.clientX, e.clientY);

    for (const node of NODES) {
        if (Math.hypot(world.x - node.x, world.y - node.y) <= node.radius) {
            selectedNode = node;
            openNode(node);
            return;
        }
    }
}



// -------------------------------------------------------------
// VIDEO PANEL UI
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
    videoEl.play().catch(() => {});
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
