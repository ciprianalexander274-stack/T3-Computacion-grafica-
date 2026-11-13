// ============================================================
//  OPERACIÓN EXTRACCIÓN – FPS 3D con Three.js
//  Curso: Computación Gráfica y Visual (UPN) – T3
// ============================================================
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  mulberry32, makeForestPath, scatterTrees, scatterRocks,
  drawBrick, drawConcrete, drawAsphalt, drawMetal, drawWood, drawGrass, drawDirt, drawStone,
} from './procedural.js';

// ------------------------------------------------------------
//  LONGITUD DEL ESCENARIO
//  SHIFT = metros que se alarga el nivel. La zona nueva (bosque) va entre el patio de
//  contenedores (z≈-143) y la extracción, que se desplaza SHIFT metros hacia -Z.
// ------------------------------------------------------------
const SHIFT = 115;
const FOREST = { z0: -143, z1: -256, amp: 5, waves: 2 };   // tramo del bosque y forma del camino
const forestPathX = makeForestPath(FOREST);                 // x(z) del camino sinuoso

// ------------------------------------------------------------
//  CONFIGURACIÓN (todo lo "configurable" del enunciado está aquí)
// ------------------------------------------------------------
const CONFIG = {
  playerSpeed: 5.0,
  playerRadius: 0.45,
  eyeHeight: 1.65,
  mouseSensitivity: 0.0022,
  catchDistance: 1.0,       // distancia a la que un zombi "atrapa" al jugador
  boostMultiplier: 1.6,
  boostSeconds: 6,
  pickupRadius: 1.3,
  zombieHP: 2,              // RF07: dos puntos de resistencia
  extraction: { minZ: -144.2 - SHIFT, halfWidth: 6 },
};

// RF01/RF02: cada arma tiene su propio modelo GLB y su propio contador.
// Los modelos GLB de terceros tienen escalas y ejes distintos, así que cada arma
// declara cómo "encajarlos" (ver fitWeapon): yaw = giro para que el cañón apunte a -Z,
// length = largo en metros, muzzleZ = z de la boca del cañón, top = y del punto más alto,
// tipDown = cuánto por debajo de 'top' está el eje del cañón (para el fogonazo).
const WEAPON_DEFS = [
  { name: 'Pistola', file: 'assets/pistol.glb', startAmmo: 10, cooldown: 0.28, pos: [0.2, -0.2, -0.5],
    fit: { yaw: -Math.PI / 2, length: 0.34, muzzleZ: -0.34, top: 0.12, tipDown: 0.03 }, sound: 1700 },
  { name: 'Fusil',   file: 'assets/rifle.glb',  startAmmo: 6,  cooldown: 0.60, pos: [0.2, -0.2, -0.5],
    fit: { yaw: Math.PI / 2, length: 0.90, muzzleZ: -0.62, top: 0.13, tipDown: 0.078 }, sound: 800 },
];

// RF02: munición recuperada por cada caja (según el arma a la que pertenece).
const AMMO_PICKUP = [6, 4];

// RF04: modelos de zombi. 'normal' = zombi mutante (animado con sus clips Idle/Walk),
// 'fast' = zombi de Minecraft (sus extremidades se animan por código). Ambos GLB miran
// hacia -Z y miden distinto, por eso se normalizan (altura en metros) al cargarlos.
const ZOMBIE_MODELS = {
  normal: { file: 'assets/zombie.glb',      height: 2.3,  animated: true,  deathLift: 0.40, catchDistance: 1.35 },
  fast:   { file: 'assets/zombie_fast.glb', height: 1.95, animated: false, deathLift: 0.16, catchDistance: 1.0 },
};

// RF05: zombis. range = distancia de activación (configurable por zombi).
const ZOMBIE_DEFS = [
  // Calle
  { x: 3,  z: -20,  range: 12, speed: 2.4 },
  { x: -4, z: -24,  range: 10, speed: 2.5 },
  { x: 6,  z: -36,  range: 14, speed: 2.6 },
  { x: 0,  z: -45,  range: 12, speed: 2.6 },
  { x: -7, z: -55,  range: 12, speed: 2.8 },
  // Almacén
  { x: -3, z: -70,  range: 12, speed: 2.6 },
  { x: 3,  z: -72,  range: 12, speed: 2.7 },
  { x: 8,  z: -82,  range: 12, speed: 2.7 },
  { x: -2, z: -89,  range: 14, speed: 4.0, runner: true },
  // Patio de contenedores
  { x: 4,  z: -100, range: 14, speed: 2.8 },
  { x: -6, z: -110, range: 14, speed: 2.9 },
  { x: 2,  z: -120, range: 14, speed: 3.0 },
  { x: -3, z: -130, range: 16, speed: 4.2, runner: true },
  { x: 5,  z: -137, range: 16, speed: 3.0 },
  { x: -5, z: -137, range: 16, speed: 3.0 },
  // Bosque (zona 5): se colocan siguiendo el camino sinuoso [z, desvío en x, rango, velocidad, corredor]
  ...[
    [-152, 2, 12, 2.8], [-162, -2, 14, 3.0], [-172, 1.5, 14, 3.0], [-182, -1, 16, 4.3, 1],
    [-192, 2.5, 14, 3.1], [-202, -2.5, 14, 3.1], [-212, 0, 16, 3.2], [-222, 2, 16, 4.4, 1],
    [-232, -2, 14, 3.2], [-240, 2.5, 16, 3.3], [-247, -2, 16, 4.5, 1], [-252, 1, 16, 3.4],
  ].map(([z, off, range, speed, r]) => ({ x: forestPathX(z) + off, z, range, speed, runner: !!r })),
];

// RF02/RF10: objetos coleccionables
const PICKUP_DEFS = [
  { type: 'ammo', weapon: 0, x: 7,    z: -12 },
  { type: 'ammo', weapon: 1, x: -8,   z: -28 },
  { type: 'ammo', weapon: 0, x: 8,    z: -45 },
  { type: 'ammo', weapon: 1, x: -8,   z: -58 },
  { type: 'ammo', weapon: 0, x: -8.5, z: -76 },
  { type: 'ammo', weapon: 1, x: 8.5,  z: -88 },
  { type: 'ammo', weapon: 0, x: -8.5, z: -110 },
  { type: 'ammo', weapon: 1, x: 8,    z: -122 },
  { type: 'boost', x: 0, z: -58 },
  { type: 'boost', x: 6, z: -96 },
  // Bosque: [tipo, arma, z, desvío en x]
  ...[
    ['ammo', 0, -156, -2], ['ammo', 1, -170, 2], ['ammo', 0, -184, -2], ['boost', 0, -190, 0],
    ['ammo', 1, -200, 2], ['ammo', 0, -214, -2.5], ['ammo', 1, -228, 2], ['boost', 0, -236, -1],
    ['ammo', 0, -243, 2], ['ammo', 1, -250, -2],
  ].map(([type, weapon, z, off]) => ({ type, weapon, x: forestPathX(z) + off, z })),
];

// ------------------------------------------------------------
//  DOM
// ------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const ui = {
  hud: $('hud'), overlay: $('overlay'), ovTitle: $('ovTitle'), ovSub: $('ovSub'), ovText: $('ovText'),
  startBtn: $('startBtn'), gameover: $('gameover'), victory: $('victory'),
  goStats: $('goStats'), vStats: $('vStats'),
  wname: $('wname'), ammo: $('ammo'), ammoAll: $('ammoAll'),
  dist: $('dist'), zcount: $('zcount'), toast: $('toast'), hit: $('hitmarker'), boost: $('boost'),
};

// ------------------------------------------------------------
//  RENDERER, ESCENA Y CÁMARA
// ------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.autoClear = false;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070b10);
scene.fog = new THREE.FogExp2(0x070b10, 0.026);

// RF06: cámara en primera persona. Orden YXZ: yaw (Y) primero, luego pitch (X).
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

// Escena separada para el arma: se dibuja encima con su propia cámara fija,
// de modo que el arma siempre acompaña la vista del jugador y nunca atraviesa paredes.
const weaponScene = new THREE.Scene();
const weaponCam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 10);
const weaponRig = new THREE.Group();   // se mueve con balanceo / retroceso
weaponScene.add(weaponRig);

// Luces del mundo
scene.add(new THREE.HemisphereLight(0x8fa4c4, 0x1b2230, 1.1));
scene.add(new THREE.AmbientLight(0x3a4658, 1.2));
const moon = new THREE.DirectionalLight(0xa9bfe0, 1.2);
moon.position.set(-20, 40, 10);
scene.add(moon);

// Linterna del jugador
const flashlight = new THREE.SpotLight(0xfff2d0, 90, 40, 0.5, 0.55, 1.2);
flashlight.position.set(0, 0, 0);
flashlight.target.position.set(0, 0, -1);
camera.add(flashlight);
camera.add(flashlight.target);

// Luces del arma
weaponScene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 1.6));
const weaponKey = new THREE.DirectionalLight(0xffffff, 1.8);
weaponKey.position.set(1, 2, 2);
weaponScene.add(weaponKey);

// ------------------------------------------------------------
//  UTILIDADES DE MUNDO
// ------------------------------------------------------------
function noiseTexture(base, amp, rx, ry) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = Math.floor(Math.random() * amp);
    g.fillStyle = `rgba(${v},${v},${v},0.14)`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Texturas procedurales: se dibujan en un <canvas> con una semilla fija (ver procedural.js)
const texRng = mulberry32(20241);
function canvasTex(draw, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size, texRng);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}
// Material con textura: 'tile' = metros del mundo que cubre una repetición de la textura
function texMat(map, tile, rough = 0.9, color = 0xffffff) {
  const m = new THREE.MeshStandardMaterial({ map, color, roughness: rough, metalness: 0.05 });
  m.userData.tile = tile;
  return m;
}
// BoxGeometry trae UV de 0 a 1 por cara; se escalan según el tamaño real para que el ladrillo,
// la madera, etc. no se estiren en muros largos.
function scaleBoxUV(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  const sizes = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];   // +x,-x,+y,-y,+z,-z
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * sizes[f][0]) / tile, (uv.getY(i) * sizes[f][1]) / tile);
    }
  }
  uv.needsUpdate = true;
}

const colliders = [];      // AABB 2D (x,z) para colisión de jugador y zombis
const obstacleMeshes = []; // mallas que bloquean los disparos

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0.05 });
}

// Caja centrada en (cx, cz). Por defecto es sólida (colisión + bloquea disparos).
function addBox(cx, cz, w, d, h, material, opts = {}) {
  const { y = 0, collide = true } = opts;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  if (material.userData.tile) scaleBoxUV(m.geometry, w, h, d, material.userData.tile);
  m.position.set(cx, y + h / 2, cz);
  scene.add(m);
  if (collide) {
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    obstacleMeshes.push(m);
  }
  return m;
}

function hitsCollider(x, z, r) {
  for (const c of colliders) {
    const px = Math.max(c.minX, Math.min(x, c.maxX));
    const pz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - px, dz = z - pz;
    if (dx * dx + dz * dz < r * r) return true;
  }
  return false;
}

// Movimiento por ejes separados → permite "deslizarse" por las paredes.
function moveWithCollision(pos, dx, dz, r) {
  if (!hitsCollider(pos.x + dx, pos.z, r)) pos.x += dx;
  if (!hitsCollider(pos.x, pos.z + dz, r)) pos.z += dz;
}

function makeLabel(text, color, w, h) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = Math.round(512 * h / w);
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(0,0,0,0.65)';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = color; g.lineWidth = 8;
  g.strokeRect(6, 6, c.width - 12, c.height - 12);
  g.fillStyle = color;
  g.font = `bold ${Math.floor(c.height * 0.45)}px Courier New`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, c.width / 2, c.height / 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
}

function addLamp(x, z, withLight) {
  addBox(x, z, 0.18, 0.18, 4.2, mat(0x2a2f36), { collide: false });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  head.position.set(x, 4.3, z);
  scene.add(head);
  if (withLight) {
    const l = new THREE.PointLight(0xffc98a, 60, 22, 2);
    l.position.set(x, 4, z);
    scene.add(l);
  }
}

// ------------------------------------------------------------
//  CONSTRUCCIÓN DEL NIVEL (RF03 / RF08)
//  Eje -Z = avance. Inicio z≈5, extracción z≈-148-SHIFT.
//  1) Sala de inicio  2) Calle en zigzag  3) Almacén  4) Patio  5) Bosque (procedural)  6) Extracción
// ------------------------------------------------------------
const matWall = texMat(canvasTex(drawConcrete), 3, 0.95, 0xb8bcc2);
const matBrick = texMat(canvasTex(drawBrick), 2.4, 0.9, 0xd0d0d0);
const matStone = texMat(canvasTex(drawStone), 2.6);
const matCar1 = mat(0x7a2a2a, 0.5);
const matCar2 = mat(0x2d4a6b, 0.5);
const matCar3 = mat(0x6b6b2d, 0.5);
const matCrate = texMat(canvasTex(drawWood), 1.4);
const metalTex = canvasTex(drawMetal);
const matShelf = texMat(metalTex, 2.0, 0.6, 0x55656f);
const matCont = [0xb04a38, 0x3a73b0, 0x5f8a49].map((c) => texMat(metalTex, 2.4, 0.55, c));

function buildLevel() {
  // Suelo
  // El asfalto cubre hasta z=-143 (inicio del bosque); el bosque tiene su propio suelo de pasto.
  const groundTex = canvasTex(drawAsphalt);
  groundTex.repeat.set(20.6 / 5, 151.5 / 5);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20.6, 151.5),
    new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -67.25);
  scene.add(ground);

  // Muros exteriores
  const H = 6, T = 0.6;
  addBox(-10, -67.25, T, 151.5, H, matBrick);
  addBox(10, -67.25, T, 151.5, H, matBrick);
  addBox(0, 8, 20.6, T, H, matBrick);
  addBox(0, -156 - SHIFT, 20.6, T, H, matBrick);
  // En el bosque los muros laterales son de piedra baja: se ven los árboles por encima
  addBox(-10, -207, T, 128, 2.4, matStone);
  addBox(10, -207, T, 128, 2.4, matStone);

  const WH = 4.5;
  // --- 1) Sala de inicio: puerta en x∈[-2,2], z=-8
  addBox(-6, -8, 8, T, WH, matWall);
  addBox(6, -8, 8, T, WH, matWall);
  addBox(-7, 3, 1.4, 1.4, 1.4, matCrate);
  addBox(7.5, -4, 1.4, 1.4, 1.4, matCrate);
  addBox(7.5, -2.6, 1.4, 1.4, 1.4, matCrate, { y: 0 });

  // --- 2) Calle en zigzag
  addBox(-3.5, -32, 13, T, WH, matWall);   // hueco a la derecha (x 3..10)
  addBox(3.5, -50, 13, T, WH, matWall);    // hueco a la izquierda (x -10..-3)
  // coches abandonados
  addBox(-6.5, -16, 2, 4.2, 1.3, matCar1);
  addBox(5, -26, 2, 4.2, 1.3, matCar2);
  addBox(0, -41, 2, 4.2, 1.3, matCar3);
  addBox(-6.5, -42, 2, 4.2, 1.3, matCar1);
  // marcas viales
  const matLine = new THREE.MeshStandardMaterial({ color: 0xc9b24a, roughness: 1 });
  for (let z = -12; z > -60; z -= 6) addBox(0, z, 0.25, 2, 0.02, matLine, { collide: false });
  // farolas
  for (let z = -14; z > -60; z -= 16) {
    addLamp(-9.2, z, true);
    addLamp(9.2, z - 8, false);
  }

  // --- 3) Almacén (z -62 .. -92) con techo
  addBox(-6.5, -62, 7, T, WH, matWall);
  addBox(6.5, -62, 7, T, WH, matWall);
  addBox(-4, -92, 12, T, WH, matWall);   // salida x 2..6
  addBox(8, -92, 4, T, WH, matWall);
  addBox(-6, -74, 1.2, 12, 2.2, matShelf);
  addBox(0, -80, 1.2, 12, 2.2, matShelf);
  addBox(6, -74, 1.2, 12, 2.2, matShelf);
  const roof = addBox(0, -77, 20.6, 30, 0.4, mat(0x2a2e33), { y: 4.5, collide: false });
  roof.material.side = THREE.DoubleSide;
  const warehouseLight = new THREE.PointLight(0xff9a50, 40, 24, 2);
  warehouseLight.position.set(0, 4, -75);
  scene.add(warehouseLight);
  const warehouseLight2 = warehouseLight.clone();
  warehouseLight2.position.set(0, 4, -86);
  scene.add(warehouseLight2);
  flickerLights.push(warehouseLight, warehouseLight2);

  // --- 4) Patio de contenedores y zona final
  addBox(-5, -105, 6, 2.4, 2.6, matCont[0]);
  addBox(5, -115, 6, 2.4, 2.6, matCont[1]);
  addBox(-4, -125, 6, 2.4, 2.6, matCont[2]);
  addBox(4, -133, 6, 2.4, 2.6, matCont[0]);
  addBox(-6, -141, 8, T, 2.4, matWall);  // valla con paso central x -2..2
  addBox(6, -141, 8, T, 2.4, matWall);
  addLamp(-9.2, -100, true);
  addLamp(9.2, -120, true);

  // Zona de extracción
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(12, 0.1, 8),
    new THREE.MeshStandardMaterial({ color: 0x1b6b3a, emissive: 0x16a34a, emissiveIntensity: 0.7 })
  );
  plate.position.set(0, 0.06, -148 - SHIFT);
  scene.add(plate);
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 14, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x4aff8a, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
  );
  beacon.position.set(0, 7, -148 - SHIFT);
  scene.add(beacon);
  const exLight = new THREE.PointLight(0x4aff8a, 120, 30, 2);
  exLight.position.set(0, 3, -148 - SHIFT);
  scene.add(exLight);

  // Carteles
  const sInicio = makeLabel('INICIO', '#ffd54a', 4, 1);
  sInicio.position.set(-6, 3.2, -7.65);
  scene.add(sInicio);
  const sCalle = makeLabel('CALLE', '#ff8a3d', 4, 1);
  sCalle.position.set(6, 3.2, -7.65);
  scene.add(sCalle);
  const sAlm = makeLabel('ALMACÉN', '#ffd54a', 5, 1.2);
  sAlm.position.set(-6.5, 3.2, -61.65);
  scene.add(sAlm);
  const sExt = makeLabel('ZONA DE EXTRACCIÓN', '#4aff8a', 9, 1.4);
  sExt.position.set(0, 4.3, -155.6 - SHIFT);
  scene.add(sExt);

  buildForest(T);

  return { beacon };
}

// ------------------------------------------------------------
//  ZONA 5: BOSQUE PROCEDURAL
//  Suelo de pasto, camino de tierra sinuoso, árboles (pinos y robles), rocas y un campamento.
//  Todo sale de generadores con semilla (procedural.js): cambia las semillas para otro bosque.
// ------------------------------------------------------------
function buildForest(T) {
  const zLen = 272 - 143;                                   // de z=-143 a z=-272
  const zMid = -(143 + zLen / 2);

  // Pasto dentro del recinto, y pasto oscuro enorme fuera de los muros (se ve entre los árboles)
  const grassTex = canvasTex(drawGrass);
  grassTex.repeat.set(20.6 / 4, zLen / 4);
  const forestGround = new THREE.Mesh(new THREE.PlaneGeometry(20.6, zLen),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
  forestGround.rotation.x = -Math.PI / 2;
  forestGround.position.set(0, 0, zMid);
  scene.add(forestGround);

  const outerTex = grassTex.clone();
  outerTex.needsUpdate = true;
  outerTex.repeat.set(120 / 5, 330 / 5);
  const outer = new THREE.Mesh(new THREE.PlaneGeometry(120, 330),
    new THREE.MeshStandardMaterial({ map: outerTex, color: 0x667766, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2;
  outer.position.set(0, -0.05, -130);
  scene.add(outer);

  // Camino de tierra: manchas con borde difuminado a lo largo de x(z)
  const dirtTex = canvasTex(drawDirt);
  const dirtMat = new THREE.MeshStandardMaterial({
    map: dirtTex, transparent: true, depthWrite: false, roughness: 1,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  for (let z = FOREST.z0 - 1; z > FOREST.z1 - 8; z -= 3.2) {
    const dxdz = (forestPathX(z - 1) - forestPathX(z + 1)) / -2;   // pendiente del camino
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 5.2), dirtMat);
    patch.rotation.set(-Math.PI / 2, 0, Math.atan(dxdz));
    patch.position.set(forestPathX(z), 0.012, z);
    scene.add(patch);
  }

  // Árboles y rocas: se generan como datos y se dibujan con InstancedMesh (pocas llamadas de dibujo)
  const area = { pathX: forestPathX, z0: FOREST.z0, z1: FOREST.z1, wallHalf: 9.7 };
  // Zonas que se dejan despejadas: el campamento y el coche abandonado
  const cz = -206, cx = forestPathX(cz) + 5.2;
  const carX = forestPathX(-228) - 5.5;
  const clear = [[cx + 1, cz, 4.5], [carX, -228, 4.5]];
  const trees = scatterTrees(mulberry32(777), area)
    .filter((t) => !clear.some(([x, z, r]) => Math.hypot(t.x - x, t.z - z) < r));
  const rocks = scatterRocks(mulberry32(4242), area);
  const pines = trees.filter((t) => t.type === 'pine');
  const oaks = trees.filter((t) => t.type === 'oak');

  const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const barkMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true });
  const trunkGeo = new THREE.CylinderGeometry(0.55, 1, 1, 6).translate(0, 0.5, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 1);

  const trunks = new THREE.InstancedMesh(trunkGeo, barkMat, trees.length);
  const cones = [0, 1, 2].map(() => new THREE.InstancedMesh(coneGeo, leafMat, pines.length));
  const blobs = [0, 1].map(() => new THREE.InstancedMesh(blobGeo, leafMat, oaks.length));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const put = (mesh, i, x, y, z, sx, sy, sz, yaw) => {
    q.setFromAxisAngle(up, yaw);
    mesh.setMatrixAt(i, m4.compose(pos.set(x, y, z), q, sc.set(sx, sy, sz)));
  };

  trees.forEach((t, i) => {
    const tr = 0.2 + t.h * 0.025;                              // radio del tronco
    const th = t.type === 'pine' ? t.h * 0.5 : t.h * 0.55;     // alto del tronco
    put(trunks, i, t.x, 0, t.z, tr, th, tr, t.yaw);
    trunks.setColorAt(i, col.setHSL(0.07, 0.35, 0.12 + (t.light - 0.13) * 0.8));
    if (t.collide) {
      colliders.push({ minX: t.x - 0.35, maxX: t.x + 0.35, minZ: t.z - 0.35, maxZ: t.z + 0.35 });
    }
  });
  pines.forEach((t, i) => {
    const h = t.h;
    const tiers = [[h * 0.22, h * 0.34, h * 0.42], [h * 0.46, h * 0.25, h * 0.36], [h * 0.70, h * 0.16, h * 0.30]];
    tiers.forEach(([y, r, ch], k) => {
      put(cones[k], i, t.x, y, t.z, r, ch, r, t.yaw);
      cones[k].setColorAt(i, col.setHSL(t.hue + 0.02, 0.45, t.light + k * 0.015));
    });
  });
  oaks.forEach((t, i) => {
    const h = t.h, r = h * 0.3, base = h * 0.55;
    put(blobs[0], i, t.x, base + r * 0.5, t.z, r, r * 0.8, r, t.yaw);
    blobs[0].setColorAt(i, col.setHSL(t.hue - 0.02, 0.5, t.light + 0.02));
    put(blobs[1], i, t.x + Math.cos(t.yaw) * r * 0.6, base + r * 1.0, t.z + Math.sin(t.yaw) * r * 0.6, r * 0.7, r * 0.6, r * 0.7, t.yaw);
    blobs[1].setColorAt(i, col.setHSL(t.hue, 0.5, t.light + 0.045));
  });
  for (const mesh of [trunks, ...cones, ...blobs]) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
  }
  obstacleMeshes.push(trunks);                                // los troncos frenan las balas

  // Rocas decorativas
  const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true }), rocks.length);
  rocks.forEach((r, i) => {
    put(rockMesh, i, r.x, r.s * r.sy * 0.35, r.z, r.s, r.s * r.sy, r.s * 0.9, r.yaw);
    rockMesh.setColorAt(i, col.setHSL(0.1, 0.05, r.tone * 0.7));
  });
  rockMesh.instanceMatrix.needsUpdate = true;
  rockMesh.instanceColor.needsUpdate = true;
  rockMesh.frustumCulled = false;
  scene.add(rockMesh);

  // Cartel de entrada al bosque (sobre la valla del patio)
  const sBosque = makeLabel('BOSQUE', '#4aff8a', 3.4, 0.9);
  sBosque.position.set(-6, 1.7, -140.65);
  scene.add(sBosque);

  // Farolas del bosque (solo 2 con luz, para no cargar la GPU)
  addLamp(-9.2, -176, true);
  addLamp(9.2, -236, true);

  // Campamento con fogata a mitad del bosque
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.16, 6, 9), mat(0x55564f));
  ring.rotation.x = -Math.PI / 2; ring.position.set(cx, 0.15, cz); scene.add(ring);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.8, 7), new THREE.MeshBasicMaterial({ color: 0xff8a2a }));
  fire.position.set(cx, 0.55, cz); scene.add(fire);
  const fireLight = new THREE.PointLight(0xff8a3a, 36, 20, 2);
  fireLight.position.set(cx, 1.2, cz); scene.add(fireLight);
  flickerLights.push(fireLight);
  addBox(cx + 1.8, cz + 1.0, 1.3, 1.3, 1.3, matCrate);
  addBox(cx + 2.2, cz - 0.6, 1.3, 1.3, 1.3, matCrate);
  addBox(carX, -228, 2, 4.2, 1.3, matCar2);    // coche abandonado
}

const flickerLights = [];
const { beacon } = buildLevel();

// ------------------------------------------------------------
//  AUDIO (WebAudio simple, sin archivos externos)
// ------------------------------------------------------------
let audioCtx = null;
let noiseBuf = null;
function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    noiseBuf = audioCtx.createBuffer(1, audioCtx.sampleRate * 0.4, audioCtx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { audioCtx = null; }
}
function tone(freq, dur, type = 'square', vol = 0.15, slideTo = null) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator(), g = audioCtx.createGain();
  o.type = type; o.frequency.value = freq;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, audioCtx.currentTime + dur);
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function shotSound(cutoff) {
  if (!audioCtx) return;
  const s = audioCtx.createBufferSource(); s.buffer = noiseBuf;
  const f = audioCtx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  const g = audioCtx.createGain();
  g.gain.setValueAtTime(0.5, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
  s.connect(f).connect(g).connect(audioCtx.destination);
  s.start();
  tone(cutoff / 12, 0.12, 'sine', 0.3, 40);
}

// ------------------------------------------------------------
//  ESTADO DEL JUEGO
// ------------------------------------------------------------
let state = 'loading'; // loading | menu | playing | paused | over | won
const player = { pos: new THREE.Vector3(0, 0, 5), yaw: 0, pitch: 0, boost: 0 };
const keys = {};
const stats = { kills: 0, shots: 0, hits: 0, time: 0 };

const weapons = WEAPON_DEFS.map((d) => ({ ...d, ammo: d.startAmmo, holder: null, flash: null }));
let current = 0;
let nextShotTime = 0;
let switchT = 0;      // animación de cambio de arma
let kick = 0;         // retroceso
let flashT = 0;       // fogonazo
let swayX = 0, swayY = 0, bobT = 0;

const zombies = [];
const pickups = [];
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();

// ------------------------------------------------------------
//  ZOMBIS (RF04 / RF05 / RF07)
// ------------------------------------------------------------
// Prepara un GLB de zombi: mide su caja (en pose de caminata si tiene clips), lo escala a
// 'height' metros, apoya los pies en y=0 y lo gira 180° para que el frente quede en +Z
// (el juego orienta a los zombis con +Z al frente; ambos GLB miran hacia -Z).
function buildZombieKit(gltf, cfg) {
  const model = gltf.scene;
  const clips = {};
  for (const c of gltf.animations) if (!clips[c.name]) clips[c.name] = c;

  const box = new THREE.Box3();
  const acc = { minY: 0, maxY: 0, cx: 0, cz: 0, n: 0 };
  const sample = (obj) => {
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    acc.minY += box.min.y; acc.maxY += box.max.y;
    acc.cx += (box.min.x + box.max.x) / 2; acc.cz += (box.min.z + box.max.z) / 2;
    acc.n++;
  };
  if (cfg.animated && clips.Walk) {
    const probe = model.clone(true);
    const mixer = new THREE.AnimationMixer(probe);
    mixer.clipAction(clips.Walk).play();
    for (const t of [0, 0.25, 0.5, 0.75]) { mixer.setTime(t); sample(probe); }
  } else {
    sample(model);
  }
  const minY = acc.minY / acc.n, maxY = acc.maxY / acc.n;
  const scale = cfg.height / (maxY - minY);
  model.position.set(-acc.cx / acc.n, -minY, -acc.cz / acc.n);

  const template = new THREE.Group();
  template.add(model);
  template.scale.setScalar(scale);
  template.rotation.y = Math.PI;
  return { template, clips, cfg };
}

class Zombie {
  constructor(def, kit) {
    const template = kit.template;
    this.kit = kit;
    this.def = def;
    this.hp = CONFIG.zombieHP;
    this.alive = true;
    this.state = 'idle';     // idle → chase → dead
    this.speed = def.speed;
    this.range = def.range;
    this.hitFlash = 0;
    this.deathT = 0;
    this.phase = Math.random() * 6.28;

    this.root = new THREE.Group();            // posición + giro (yaw)
    this.root.position.set(def.x, 0, def.z);
    this.root.rotation.y = Math.random() * 6.28;
    this.root.userData.zombie = this;

    this.body = new THREE.Group();            // se inclina al morir
    this.model = template.clone(true);        // modelo GLB clonado
    this.body.add(this.model);
    this.root.add(this.body);
    this.catchDist = Math.max(CONFIG.catchDistance, kit.cfg.catchDistance || 0);

    this.mats = [];
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();      // material propio (para el destello al recibir impacto)
        o.material.userData.baseEmissive = o.material.emissive.clone();
        if (def.runner) o.material.color.multiplyScalar(0.8).lerp(new THREE.Color(0.7, 0.1, 0.1), 0.35);
        this.mats.push(o.material);
      }
    });
    if (kit.cfg.animated) {
      // zombi mutante: usa los clips del propio GLB (Idle mientras espera, Walk al perseguir)
      this.mixer = new THREE.AnimationMixer(this.model);
      this.idleAct = this.mixer.clipAction(kit.clips.Idle);
      this.walkAct = this.mixer.clipAction(kit.clips.Walk);
      this.walkAct.timeScale = this.speed / 2.5;
      this.idleAct.play();
      this.idleAct.time = Math.random() * 6;
    } else {
      // zombi de Minecraft: pivotes de brazos y piernas movidos por código
      this.armL = this.model.getObjectByName('leftArm_10');
      this.armR = this.model.getObjectByName('rightArm_7');
      this.legL = this.model.getObjectByName('leftLeg_14');
      this.legR = this.model.getObjectByName('rightLeg_12');
    }
    scene.add(this.root);
  }

  // RF05: pasa de 'idle' a 'chase' (por distancia o por recibir un disparo)
  wake() {
    this.state = 'chase';
    if (this.mixer) {
      this.idleAct.fadeOut(0.25);
      this.walkAct.reset().fadeIn(0.25).play();
      this.walkAct.time = Math.random();
    }
  }

  // RF07: cada impacto válido resta 1 punto; muere exactamente en el segundo.
  takeHit() {
    if (!this.alive) return false;
    this.hp -= 1;
    this.hitFlash = 0.15;
    if (this.state === 'idle') this.wake(); // un disparo también lo despierta
    if (this.hp <= 0) this.die();
    return true;
  }

  die() {
    this.alive = false;
    this.state = 'dead';   // deja de perseguir y de atacar (ver update)
    stats.kills++;
    tone(140, 0.4, 'sawtooth', 0.2, 50);
  }

  update(dt, t) {
    // destello rojo al recibir impacto
    for (const m of this.mats) {
      if (this.hitFlash > 0) { m.emissive.setHex(0x771100); }
      else m.emissive.copy(m.userData.baseEmissive);
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;

    if (this.state === 'dead') {
      this.deathT = Math.min(1, this.deathT + dt / 0.6);
      this.body.rotation.x = -this.deathT * Math.PI / 2;
      this.body.position.y = this.kit.cfg.deathLift * this.deathT;
      return;
    }

    const p = this.root.position;
    const dx = player.pos.x - p.x, dz = player.pos.z - p.z;
    const dist = Math.hypot(dx, dz);

    // RF05: activación por distancia
    if (this.state === 'idle') {
      if (dist < this.range) {
        this.wake();
        tone(90, 0.5, 'sawtooth', 0.12, 60);
      } else {
        // inactivo: animación Idle (mutante) o leve balanceo con brazos al frente (Minecraft)
        if (this.mixer) this.mixer.update(dt);
        else {
          this.body.rotation.z = Math.sin(t * 1.4 + this.phase) * 0.04;
          this.armL.rotation.x = 1.4; this.armR.rotation.x = 1.4;
          this.legL.rotation.x = 0; this.legR.rotation.x = 0;
        }
        return;
      }
    }

    // Persecución
    if (dist > 0.001) {
      const nx = dx / dist, nz = dz / dist;
      moveWithCollision(p, nx * this.speed * dt, nz * this.speed * dt, 0.4);
      const targetYaw = Math.atan2(dx, dz);   // el frente del modelo es +Z
      let diff = targetYaw - this.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.root.rotation.y += diff * Math.min(1, dt * 8);
    }
    // animación de caminata
    if (this.mixer) {
      this.mixer.update(dt);
    } else {
      const w = t * (this.speed * 3) + this.phase;
      this.legL.rotation.x = Math.sin(w) * 0.6;
      this.legR.rotation.x = -Math.sin(w) * 0.6;
      this.armL.rotation.x = 1.35 + Math.sin(w) * 0.15;   // el GLB mira a -Z: +X = brazos al frente
      this.armR.rotation.x = 1.35 - Math.sin(w) * 0.15;
      this.body.rotation.z = Math.sin(w * 0.5) * 0.06;
    }

    // RF09: contacto con el jugador → atrapado
    if (dist < this.catchDist) gameOver();
  }
}

// separación suave entre zombis que persiguen (evita que se apilen)
function separateZombies() {
  for (let i = 0; i < zombies.length; i++) {
    const a = zombies[i];
    if (a.state !== 'chase') continue;
    for (let j = i + 1; j < zombies.length; j++) {
      const b = zombies[j];
      if (b.state !== 'chase') continue;
      const dx = b.root.position.x - a.root.position.x;
      const dz = b.root.position.z - a.root.position.z;
      const d = Math.hypot(dx, dz);
      if (d > 0 && d < 0.75) {
        const push = (0.75 - d) * 0.5;
        const px = (dx / d) * push, pz = (dz / d) * push;
        moveWithCollision(b.root.position, px, pz, 0.4);
        moveWithCollision(a.root.position, -px, -pz, 0.4);
      }
    }
  }
}

// ------------------------------------------------------------
//  COLECCIONABLES (RF02 / RF10)
// ------------------------------------------------------------
function createPickups() {
  for (const d of PICKUP_DEFS) {
    let mesh;
    if (d.type === 'ammo') {
      const color = d.weapon === 0 ? 0xffd54a : 0xff8a3d;
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.35, 0.38),
        new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.5 })
      );
    } else {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32),
        new THREE.MeshStandardMaterial({ color: 0x4ad8ff, emissive: 0x4ad8ff, emissiveIntensity: 0.7 })
      );
    }
    mesh.position.set(d.x, 0.7, d.z);
    // halo aditivo en vez de una PointLight por caja: con más cajas, tantas luces bajarían los FPS
    const haloColor = d.type === 'boost' ? 0x4ad8ff : (d.weapon === 0 ? 0xffd54a : 0xff8a3d);
    mesh.add(new THREE.Mesh(
      new THREE.SphereGeometry(0.62, 12, 8),
      new THREE.MeshBasicMaterial({ color: haloColor, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending })
    ));
    scene.add(mesh);
    pickups.push({ def: d, mesh, taken: false });
  }
}

function updatePickups(dt, t) {
  for (const p of pickups) {
    if (p.taken) continue;
    p.mesh.rotation.y += dt * 1.8;
    p.mesh.position.y = 0.7 + Math.sin(t * 2.5 + p.def.x) * 0.1;
    if (state !== 'playing') continue;
    const dx = player.pos.x - p.def.x, dz = player.pos.z - p.def.z;
    if (dx * dx + dz * dz < CONFIG.pickupRadius * CONFIG.pickupRadius) {
      p.taken = true;
      scene.remove(p.mesh);
      if (p.def.type === 'ammo') {
        weapons[p.def.weapon].ammo += AMMO_PICKUP[p.def.weapon];
        toast(`+${AMMO_PICKUP[p.def.weapon]} balas · ${weapons[p.def.weapon].name}`);
        tone(660, 0.12, 'triangle', 0.2); setTimeout(() => tone(880, 0.12, 'triangle', 0.2), 90);
      } else {
        player.boost = CONFIG.boostSeconds;
        toast('¡Velocidad aumentada!');
        tone(500, 0.25, 'triangle', 0.2, 1000);
      }
    }
  }
}

// ------------------------------------------------------------
//  ARMAS: selección y disparo (RF01 / RF02 / RF07)
// ------------------------------------------------------------
function selectWeapon(i) {
  if (state !== 'playing' || i === current) return;
  current = i;
  switchT = 0.3;
  weapons.forEach((w, idx) => { if (w.holder) w.holder.visible = idx === current; });
  tone(300, 0.06, 'square', 0.08);
}

function shoot() {
  if (state !== 'playing') return;
  const now = clock.elapsedTime;
  if (now < nextShotTime || switchT > 0.1) return;
  const w = weapons[current];

  // RF02: sin munición no se puede disparar
  if (w.ammo <= 0) {
    nextShotTime = now + 0.25;
    tone(180, 0.05, 'square', 0.1);
    toast('SIN MUNICIÓN · busca una caja');
    return;
  }

  w.ammo -= 1;                         // cada disparo consume 1
  nextShotTime = now + w.cooldown;
  stats.shots++;
  kick = 1; flashT = 0.05;
  shotSound(w.sound);

  // RF07: raycasting desde el centro de la pantalla
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  raycaster.far = 120;
  const targets = [];
  for (const z of zombies) if (z.alive) targets.push(z.root);
  const hits = raycaster.intersectObjects([...targets, ...obstacleMeshes], true);
  if (hits.length > 0) {
    // el primer impacto decide: si es una pared, la bala se detiene ahí
    let o = hits[0].object;
    while (o && !(o.userData && o.userData.zombie)) o = o.parent;
    if (o && o.userData.zombie && o.userData.zombie.takeHit()) {
      stats.hits++;
      ui.hit.classList.add('on');
      setTimeout(() => ui.hit.classList.remove('on'), 90);
      tone(240, 0.08, 'square', 0.15);
    }
  }
}

// ------------------------------------------------------------
//  ENTRADA (RF06)
// ------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Digit1') selectWeapon(0);
  if (e.code === 'Digit2') selectWeapon(1);
  if (e.code === 'KeyR' && (state === 'over' || state === 'won')) location.reload();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

window.addEventListener('mousemove', (e) => {
  if (state !== 'playing' || document.pointerLockElement !== renderer.domElement) return;
  player.yaw -= e.movementX * CONFIG.mouseSensitivity;
  player.pitch -= e.movementY * CONFIG.mouseSensitivity;
  player.pitch = Math.max(-1.4, Math.min(1.4, player.pitch));
  swayX = Math.max(-0.05, Math.min(0.05, swayX - e.movementX * 0.0003));
  swayY = Math.max(-0.04, Math.min(0.04, swayY + e.movementY * 0.0003));
});

// RF01: un disparo por clic. Se usa 'mousedown' (un evento por pulsación),
// por lo que mantener presionado NO dispara automáticamente.
window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (state === 'playing' && document.pointerLockElement === renderer.domElement) shoot();
});

ui.startBtn.addEventListener('click', () => {
  initAudio();
  renderer.domElement.requestPointerLock();
});
$('goBtn').addEventListener('click', () => location.reload());
$('vBtn').addEventListener('click', () => location.reload());

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === renderer.domElement;
  if (locked && (state === 'menu' || state === 'paused')) {
    state = 'playing';
    ui.overlay.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    clock.getDelta();
  } else if (!locked && state === 'playing') {
    state = 'paused';
    ui.ovTitle.textContent = 'PAUSA';
    ui.ovSub.textContent = 'Haz clic para continuar';
    ui.ovText.textContent = '';
    ui.startBtn.textContent = 'CONTINUAR';
    ui.overlay.classList.remove('hidden');
  }
});

window.addEventListener('resize', () => {
  camera.aspect = weaponCam.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  weaponCam.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ------------------------------------------------------------
//  FIN DE PARTIDA (RF08 / RF09)
// ------------------------------------------------------------
function endStats() {
  const acc = stats.shots ? Math.round((stats.hits / stats.shots) * 100) : 0;
  return `Zombis eliminados: ${stats.kills}/${ZOMBIE_DEFS.length} · Disparos: ${stats.shots} · Precisión: ${acc}% · Tiempo: ${Math.round(stats.time)} s`;
}

function gameOver() {
  if (state !== 'playing') return;
  state = 'over';                       // detiene update(): nada se mueve ni se puede disparar
  document.exitPointerLock();
  ui.hud.classList.add('hidden');
  ui.goStats.textContent = endStats();
  ui.gameover.classList.remove('hidden');
  tone(220, 0.8, 'sawtooth', 0.25, 50);
}

function victory() {
  if (state !== 'playing') return;
  state = 'won';
  document.exitPointerLock();
  ui.hud.classList.add('hidden');
  ui.vStats.textContent = endStats();
  ui.victory.classList.remove('hidden');
  [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'triangle', 0.2), i * 140));
}

// ------------------------------------------------------------
//  HUD
// ------------------------------------------------------------
let toastTimer = null;
function toast(msg) {
  ui.toast.textContent = msg;
  ui.toast.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('on'), 1600);
}

function updateHUD() {
  const w = weapons[current];
  ui.wname.textContent = `[${current + 1}] ${w.name}`;
  ui.ammo.textContent = w.ammo;
  ui.ammo.classList.toggle('empty', w.ammo <= 0);
  ui.ammoAll.textContent = weapons.map((x, i) => `${i + 1}: ${x.name} ${x.ammo}`).join('   ');
  const remaining = Math.max(0, Math.round(player.pos.z - CONFIG.extraction.minZ));
  ui.dist.textContent = `Extracción: ${remaining} m`;
  ui.zcount.textContent = `Zombis: ${zombies.filter((z) => z.alive).length}`;
  ui.boost.classList.toggle('hidden', player.boost <= 0);
}

// ------------------------------------------------------------
//  ACTUALIZACIÓN POR FOTOGRAMA
// ------------------------------------------------------------
function update(dt, t) {
  stats.time += dt;

  // Movimiento WASD relativo a la orientación (yaw)
  const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0);
  const s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
  let mx = -Math.sin(player.yaw) * f + Math.cos(player.yaw) * s;
  let mz = -Math.cos(player.yaw) * f - Math.sin(player.yaw) * s;
  const len = Math.hypot(mx, mz);
  const moving = len > 0;
  if (moving) { mx /= len; mz /= len; }
  if (player.boost > 0) player.boost -= dt;
  const speed = CONFIG.playerSpeed * (player.boost > 0 ? CONFIG.boostMultiplier : 1);
  moveWithCollision(player.pos, mx * speed * dt, mz * speed * dt, CONFIG.playerRadius);

  // Cámara
  bobT += moving ? dt * speed * 1.8 : 0;
  const bob = moving ? Math.sin(bobT) * 0.04 : 0;
  camera.position.set(player.pos.x, CONFIG.eyeHeight + bob, player.pos.z);
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;

  // Zombis
  for (const z of zombies) z.update(dt, t);
  separateZombies();

  // Coleccionables
  updatePickups(dt, t);

  // Victoria
  if (player.pos.z < CONFIG.extraction.minZ && Math.abs(player.pos.x) < CONFIG.extraction.halfWidth) victory();

  updateHUD();
}

function updateWeaponRig(dt, t) {
  // balanceo suave por movimiento del mouse + vaivén al caminar + retroceso
  swayX *= Math.pow(0.001, dt);
  swayY *= Math.pow(0.001, dt);
  kick = Math.max(0, kick - dt * 8);
  if (switchT > 0) switchT = Math.max(0, switchT - dt);
  const raise = switchT / 0.3;       // 1 → arma abajo, 0 → arma arriba
  const bobX = Math.cos(bobT * 0.5) * 0.008;
  const bobY = Math.abs(Math.sin(bobT)) * 0.01;
  weaponRig.position.set(swayX + bobX, swayY - bobY - raise * 0.35, kick * 0.07);
  weaponRig.rotation.set(kick * 0.1, swayX * 2, 0);

  const w = weapons[current];
  if (w.flash) {
    flashT = Math.max(0, flashT - dt);
    w.flash.visible = flashT > 0;
  }
}

// ------------------------------------------------------------
//  BUCLE PRINCIPAL
// ------------------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (state === 'playing') update(dt, t);
  else {
    updatePickups(dt, t);
    if (state === 'over' || state === 'won') for (const z of zombies) if (z.state === 'dead') z.update(dt, t);
  }
  updateWeaponRig(dt, t);
  beacon.material.opacity = 0.2 + Math.sin(t * 2) * 0.06;
  for (const l of flickerLights) l.intensity = 36 + Math.random() * 8;

  renderer.clear();
  renderer.render(scene, camera);
  renderer.clearDepth();
  renderer.render(weaponScene, weaponCam);
}

// ------------------------------------------------------------
//  CARGA DE MODELOS GLB (RF01 / RF04)
// ------------------------------------------------------------
// Encaja un GLB de arma: lo gira (yaw) para que el cañón apunte a -Z, lo escala al largo
// deseado, centra en X, y coloca la boca del cañón en muzzleZ y el punto más alto en 'top'.
function fitWeapon(model, fit) {
  const outer = new THREE.Group();
  model.rotation.y = fit.yaw;
  outer.add(model);
  outer.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(outer);
  outer.scale.setScalar(fit.length / (box.max.z - box.min.z));
  outer.updateMatrixWorld(true);
  box.setFromObject(outer);
  outer.position.set(-(box.min.x + box.max.x) / 2, fit.top - box.max.y, fit.muzzleZ - box.min.z);
  return outer;
}

// Los materiales PBR metálicos de las armas se ven negros sin reflejos: se les da un
// entorno de estudio (RoomEnvironment) solo en la escena del arma.
function setupWeaponEnvironment() {
  try {
    const pmrem = new THREE.PMREMGenerator(renderer);
    weaponScene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  } catch (e) { console.warn('Sin entorno para las armas', e); }
}

async function init() {
  const loader = new GLTFLoader();
  try {
    setupWeaponEnvironment();
    const [gltfs, zNormal, zFast] = await Promise.all([
      Promise.all(WEAPON_DEFS.map((d) => loader.loadAsync(d.file))),
      loader.loadAsync(ZOMBIE_MODELS.normal.file),
      loader.loadAsync(ZOMBIE_MODELS.fast.file),
    ]);
    const kits = {
      normal: buildZombieKit(zNormal, ZOMBIE_MODELS.normal),
      fast: buildZombieKit(zFast, ZOMBIE_MODELS.fast),
    };

    // Armas: cada GLB va dentro de un "holder" en la escena del arma
    gltfs.forEach((g, i) => {
      const w = weapons[i];
      const holder = new THREE.Group();
      holder.position.set(...w.pos);
      holder.rotation.y = 0.06;
      holder.add(fitWeapon(g.scene, w.fit));
      g.scene.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) m.envMapIntensity = 0.7;
        }
      });
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe28a })
      );
      flash.position.set(0, w.fit.top - w.fit.tipDown, w.fit.muzzleZ - 0.02);
      flash.visible = false;
      holder.add(flash);
      holder.visible = i === 0;
      weaponRig.add(holder);
      w.holder = holder;
      w.flash = flash;
    });

    // Zombis: se clona el mismo GLB para cada enemigo
    for (const d of ZOMBIE_DEFS) zombies.push(new Zombie(d, d.runner ? kits.fast : kits.normal));
    createPickups();

    state = 'menu';
    ui.startBtn.disabled = false;
    ui.startBtn.textContent = 'JUGAR';
  } catch (err) {
    console.error(err);
    ui.ovSub.textContent = 'Error cargando los modelos GLB';
    ui.ovText.textContent = 'Ejecuta el proyecto desde un servidor local (por ejemplo: python3 -m http.server 8000) y abre http://localhost:8000. Abrir index.html con doble clic no funciona.';
    ui.startBtn.textContent = 'ERROR';
  }
}

camera.position.set(player.pos.x, CONFIG.eyeHeight, player.pos.z);
animate();
init();
