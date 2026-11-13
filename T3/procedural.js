// ============================================================
//  GENERACIÓN PROCEDURAL (sin dependencias de Three.js)
//  - Texturas dibujadas en <canvas> (ladrillo, concreto, asfalto, metal, madera, pasto, tierra, piedra)
//  - Camino sinuoso del bosque, y colocación de árboles y rocas con semilla (mismo resultado cada vez)
// ============================================================

// Generador pseudoaleatorio con semilla: la misma semilla produce siempre el mismo mundo.
export function mulberry32(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h, s, l) => `hsl(${h.toFixed(0)},${s.toFixed(0)}%,${l.toFixed(0)}%)`;

function speckle(g, S, rng, n, colors, w = 2, h = 2, alpha = 1) {
  g.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[(rng() * colors.length) | 0];
    g.fillRect(rng() * S, rng() * S, w * (0.5 + rng()), h * (0.5 + rng()));
  }
  g.globalAlpha = 1;
}

// ---------------- Texturas (cada función dibuja en un canvas S×S) ----------------

export function drawBrick(g, S, rng) {
  g.fillStyle = '#8d867a'; g.fillRect(0, 0, S, S);           // mortero
  const rows = 8, rh = S / rows, bw = S / 4;
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? bw / 2 : 0;
    for (let c = -1; c <= 4; c++) {
      const x = c * bw + off, y = r * rh;
      g.fillStyle = hsl(8 + rng() * 14, 36 + rng() * 14, 34 + rng() * 12);
      g.fillRect(x + 1.5, y + 1.5, bw - 3, rh - 3);
      g.fillStyle = 'rgba(255,220,200,0.10)';                  // luz arriba
      g.fillRect(x + 1.5, y + 1.5, bw - 3, 2);
      g.fillStyle = 'rgba(0,0,0,0.16)';                        // sombra abajo
      g.fillRect(x + 1.5, y + rh - 4.5, bw - 3, 3);
    }
  }
  speckle(g, S, rng, 900, ['rgba(0,0,0,0.25)', 'rgba(255,255,255,0.10)', 'rgba(60,30,20,0.3)'], 2, 2);
}

export function drawConcrete(g, S, rng) {
  g.fillStyle = hsl(210, 6, 52); g.fillRect(0, 0, S, S);
  speckle(g, S, rng, 3500, ['rgba(0,0,0,0.12)', 'rgba(255,255,255,0.10)', 'rgba(40,50,60,0.12)'], 2, 2);
  for (let i = 0; i < 8; i++) {                                // manchas de humedad
    const x = rng() * S, w = 8 + rng() * 26, h = 30 + rng() * 120;
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, 'rgba(20,25,30,0.22)'); gr.addColorStop(1, 'rgba(20,25,30,0)');
    g.fillStyle = gr; g.translate(x, 0); g.fillRect(0, 0, w, h); g.translate(-x, 0);
  }
  g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 2;         // juntas de paneles
  g.beginPath(); g.moveTo(1, 0); g.lineTo(1, S); g.moveTo(0, S / 2); g.lineTo(S, S / 2); g.stroke();
}

export function drawAsphalt(g, S, rng) {
  g.fillStyle = '#2b2e33'; g.fillRect(0, 0, S, S);
  speckle(g, S, rng, 4500, ['rgba(255,255,255,0.10)', 'rgba(0,0,0,0.22)', 'rgba(120,120,130,0.12)'], 2, 2);
  g.strokeStyle = 'rgba(8,8,10,0.75)'; g.lineWidth = 1.5;     // grietas
  for (let k = 0; k < 4; k++) {
    let x = rng() * S, y = rng() * S, a = rng() * 6.28;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 14; i++) { a += (rng() - 0.5) * 1.2; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); }
    g.stroke();
  }
}

export function drawMetal(g, S, rng) {                         // chapa ondulada (se tiñe con el color del material)
  for (let x = 0; x < S; x += 8) {
    const gr = g.createLinearGradient(x, 0, x + 8, 0);
    gr.addColorStop(0, '#9aa1a6'); gr.addColorStop(0.5, '#d4d9dc'); gr.addColorStop(1, '#8a9196');
    g.fillStyle = gr; g.fillRect(x, 0, 8, S);
  }
  for (let i = 0; i < 14; i++) {                               // vetas de óxido
    const x = rng() * S, w = 4 + rng() * 14, h = 30 + rng() * 110, y = rng() * S * 0.6;
    const gr = g.createLinearGradient(0, y, 0, y + h);
    gr.addColorStop(0, 'rgba(120,60,25,0)'); gr.addColorStop(0.3, 'rgba(120,60,25,0.38)'); gr.addColorStop(1, 'rgba(120,60,25,0)');
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }
  speckle(g, S, rng, 1200, ['rgba(0,0,0,0.18)', 'rgba(255,255,255,0.12)'], 2, 2);
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, S, 3); g.fillRect(0, S - 3, S, 3);
}

export function drawWood(g, S, rng) {
  const planks = 4, ph = S / planks;
  for (let p = 0; p < planks; p++) {
    g.fillStyle = hsl(28 + rng() * 6, 40 + rng() * 8, 30 + rng() * 8);
    g.fillRect(0, p * ph, S, ph);
    for (let i = 0; i < 26; i++) {                              // vetas
      g.strokeStyle = `rgba(30,15,5,${0.10 + rng() * 0.18})`; g.lineWidth = 1;
      const y = p * ph + 3 + rng() * (ph - 6), x = rng() * S, len = 40 + rng() * 140;
      g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + 2, x + len * 0.7, y - 2, x + len, y); g.stroke();
    }
    if (rng() < 0.7) {                                          // nudo
      g.fillStyle = 'rgba(30,15,5,0.45)';
      g.beginPath(); g.ellipse(rng() * S, p * ph + ph / 2, 7, 4, 0, 0, 6.28); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, p * ph, S, 2);
  }
}

export function drawGrass(g, S, rng) {
  g.fillStyle = '#2c4421'; g.fillRect(0, 0, S, S);
  speckle(g, S, rng, 9000, ['#35562a', '#274019', '#3f6a30', '#4f7a38', '#1f3516'], 1.5, 3.5);
  speckle(g, S, rng, 260, ['#4a3b25', '#3a2d1b'], 3, 2);
}

// Mancha de tierra con bordes difuminados (con transparencia) para el camino del bosque
export function drawDirt(g, S, rng) {
  g.fillStyle = '#4d3b29'; g.fillRect(0, 0, S, S);
  speckle(g, S, rng, 4500, ['#5a4631', '#3e2f20', '#6b5740', '#2f2418'], 2, 2);
  speckle(g, S, rng, 90, ['#7d7468', '#665e55'], 4, 3);        // piedritas
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createRadialGradient(S / 2, S / 2, S * 0.18, S / 2, S / 2, S * 0.5);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-over';
}

export function drawStone(g, S, rng) {
  g.fillStyle = '#33362f'; g.fillRect(0, 0, S, S);
  const rows = 4, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const widths = []; let sum = 0;
    while (sum < S - 40) { const w = 50 + rng() * 60; widths.push(w); sum += w; }
    const k = S / (sum + 45); widths.push(S / k - sum);          // normaliza para cerrar exacto en S (tile continuo)
    let x = 0;
    for (const w of widths) {
      const ww = w * k;
      g.fillStyle = hsl(90 + rng() * 30, 4 + rng() * 8, 36 + rng() * 14);
      g.fillRect(x + 2, r * rh + 2, ww - 4, rh - 4);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x + 2, r * rh + 2, ww - 4, 3);
      x += ww;
    }
  }
  speckle(g, S, rng, 1800, ['rgba(0,0,0,0.2)', 'rgba(255,255,255,0.1)'], 2, 2);
  speckle(g, S, rng, 420, ['rgba(50,95,35,0.55)', 'rgba(70,110,40,0.45)'], 3, 3);   // musgo
}

// ---------------- Camino del bosque ----------------
// Devuelve x(z): un camino que serpentea y vuelve a x = 0 al inicio y al final de la zona.
export function makeForestPath({ z0, z1, amp, waves }) {
  return function (z) {
    const t = Math.min(1, Math.max(0, (z0 - z) / (z0 - z1)));
    return amp * Math.sin(t * Math.PI * 2 * waves) * Math.min(1, t * 8, (1 - t) * 8);
  };
}

// ---------------- Árboles y rocas ----------------
// Devuelve datos puros (posición, tamaño, tipo, tono); main.js los convierte en InstancedMesh.
function tooClose(list, x, z, d) {
  for (const p of list) { const dx = p.x - x, dz = p.z - z; if (dx * dx + dz * dz < d * d) return true; }
  return false;
}

export function scatterTrees(rnd, { pathX, z0, z1, wallHalf, pathClear = 3.6, count = 140, backdrop = 260, zFront = 12, zBack = -280 }) {
  const trees = [];
  const mk = (x, z, hMin, hMax, collide) => ({
    x, z, collide, type: rnd() < 0.65 ? 'pine' : 'oak',
    h: hMin + rnd() * (hMax - hMin), yaw: rnd() * 6.283, hue: 0.26 + rnd() * 0.1, light: 0.13 + rnd() * 0.1,
  });
  // Árboles dentro del bosque (con colisión), fuera del camino
  for (let i = 0; i < 2500 && trees.length < count; i++) {
    const z = z0 - 3 - rnd() * (z0 - z1 - 7);
    const x = (rnd() * 2 - 1) * (wallHalf - 1.2);
    if (Math.abs(x - pathX(z)) < pathClear) continue;
    if (tooClose(trees, x, z, 2.5)) continue;
    trees.push(mk(x, z, 4, 7, true));
  }
  // Telón de fondo detrás de los muros: solo se ven las copas (sin colisión)
  const outer = [];
  for (let i = 0; i < 4000 && outer.length < backdrop; i++) {
    const z = zFront + rnd() * (zBack - zFront);
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (wallHalf + 2.5 + rnd() * 15);
    if (tooClose(outer, x, z, 3.2)) continue;
    outer.push(mk(x, z, 6.5, 11, false));
  }
  return trees.concat(outer);
}

export function scatterRocks(rnd, { pathX, z0, z1, wallHalf, count = 70 }) {
  const rocks = [];
  for (let i = 0; i < count * 4 && rocks.length < count; i++) {
    const z = z0 - 2 - rnd() * (z0 - z1 - 4);
    const x = (rnd() * 2 - 1) * (wallHalf - 0.8);
    if (Math.abs(x - pathX(z)) < 2.4) continue;
    const s = 0.25 + rnd() * 0.7;
    rocks.push({ x, z, s, sy: 0.5 + rnd() * 0.5, yaw: rnd() * 6.283, tone: 0.32 + rnd() * 0.2 });
  }
  return rocks;
}
