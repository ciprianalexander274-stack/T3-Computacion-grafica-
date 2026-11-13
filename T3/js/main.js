
import * as THREE from 'three';

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';


// ==========================================
// 1. CREAR EL ESCENARIO
// ==========================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x18212b);


// ==========================================
// 2. CREAR LA CÁMARA
// ==========================================

const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

camera.position.set(0, 2, 8);
scene.add(camera);

// ==========================================
// 3. CREAR EL RENDERIZADOR
// ==========================================

const renderer = new THREE.WebGLRenderer({
    antialias: true
});

renderer.setSize(
    window.innerWidth,
    window.innerHeight
);

renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 2)
);

document.getElementById('game-container')
    .appendChild(renderer.domElement);


// ==========================================
// 4. CONFIGURAR CONTROLES FPS
// ==========================================

// Crear controles de primera persona

const controls = new PointerLockControls(
    camera,
    renderer.domElement
);

// Activar controles al hacer clic

renderer.domElement.addEventListener('click', function() {
    controls.lock();
});

// Detectar las teclas del teclado

const keys = {};

document.addEventListener('keydown', function(event) {
    keys[event.code] = true;
});

document.addEventListener('keyup', function(event) {
    keys[event.code] = false;
});

// Reloj para calcular el movimiento

const clock = new THREE.Clock();


// ==========================================
// 5. CREAR ILUMINACIÓN
// ==========================================

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1.5
);

scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    2
);

directionalLight.position.set(5, 10, 5);

scene.add(directionalLight);


// ==========================================
// 6. CREAR EL SUELO
// ==========================================

const floorGeometry = new THREE.PlaneGeometry(50, 50);

const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0x444444
});

const floor = new THREE.Mesh(
    floorGeometry,
    floorMaterial
);

floor.rotation.x = -Math.PI / 2;

floor.position.y = -0.5;

scene.add(floor);


// ==========================================
// 7. CREAR UN CUBO DE PRUEBA
// ==========================================

const cubeGeometry = new THREE.BoxGeometry(2, 2, 2);

const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0x27ae60
});

const cube = new THREE.Mesh(
    cubeGeometry,
    cubeMaterial
);

// Colocarlo a un lado para que no tape a los zombis

cube.position.set(6, 1, -2);

scene.add(cube);


// ==========================================
// 8. CARGAR LOS TRES ZOMBIS
// ==========================================
// Lista de enemigos del videojuego
const zombies = [];

let gameOver = false;

const loader = new GLTFLoader();

loader.load(

    'models/zombies/zombie.glb',

    function(gltf) {

        // Crear tres copias independientes
        const zombie1 = clone(gltf.scene);
        const zombie2 = clone(gltf.scene);
        const zombie3 = clone(gltf.scene);

        // Posicionar los zombis
        zombie1.position.set(0, 0, -5);
        zombie2.position.set(-3, 0, -7);
        zombie3.position.set(3, 0, -7);

        // Configurar tamaño
        zombie1.scale.set(1, 1, 1);
        zombie2.scale.set(1, 1, 1);
        zombie3.scale.set(1, 1, 1);

        // Agregar a la escena
        scene.add(zombie1);
        scene.add(zombie2);
        scene.add(zombie3);

        // Guardar los zombis en la lista
        zombies.push(zombie1);
        zombies.push(zombie2);
        zombies.push(zombie3);

        console.log('Los tres zombis fueron cargados correctamente');

    },

    undefined,

    function(error) {
        console.error('Error al cargar los zombis:', error);
    }

);

// ======================================
// 9. CARGAR ARMAS EN PRIMERA PERSONA
// ======================================

const rifleGroup = new THREE.Group();
const pistolGroup = new THREE.Group();

camera.add(rifleGroup);
camera.add(pistolGroup);

// Posición delante de la cámara
rifleGroup.position.set(0.4, -0.4, -1);
pistolGroup.position.set(0.4, -0.4, -1);

// Escala inicial
rifleGroup.scale.setScalar(0.05);
pistolGroup.scale.setScalar(0.05);

// Visibilidad
rifleGroup.visible = true;
pistolGroup.visible = false;

// Cargar rifle
loader.load(
    'models/Weapons/Rifle.glb',

    function(gltf) {

        const rifle = gltf.scene;

        rifle.position.set(0, 0, 0);
        rifleGroup.add(rifle);

        console.log('RIFLE CARGADO');
        console.log('Dimensiones:', new THREE.Box3().setFromObject(rifle));

    },

    undefined,

    function(error) {
        console.error('ERROR DEL RIFLE:', error);
    }
);

// Cargar pistola
loader.load(
    'models/Weapons/Pistola.glb',

    function(gltf) {

        const pistol = gltf.scene;

        pistol.position.set(0, 0, 0);
        pistolGroup.add(pistol);

        console.log('PISTOLA CARGADA');
        console.log('Dimensiones:', new THREE.Box3().setFromObject(pistol));

    },

    undefined,

    function(error) {
        console.error('ERROR DE LA PISTOLA:', error);
    }
);

// Cambiar armas
window.addEventListener('keydown', function(event) {

    if (event.code === 'Digit1') {
        rifleGroup.visible = true;
        pistolGroup.visible = false;
    }

    if (event.code === 'Digit2') {
        rifleGroup.visible = false;
        pistolGroup.visible = true;
    }

});

// ==========================================
// 9. FUNCIÓN PRINCIPAL DE ANIMACIÓN
// ==========================================

function animate() {

    requestAnimationFrame(animate);

    // Calcular tiempo entre fotogramas
    const delta = clock.getDelta();

    // ==========================================
    // INTELIGENCIA ARTIFICIAL DE LOS ZOMBIS
    // ==========================================

    if (!gameOver) {

        const rangoDeteccion = 15;
        const velocidadZombie = 2.2;
        const distanciaAtaque = 1.5;

        zombies.forEach((zombie) => {

            const dx = camera.position.x - zombie.position.x;
            const dz = camera.position.z - zombie.position.z;

            const distancia = Math.sqrt(
                dx * dx + dz * dz
            );

            if (distancia < rangoDeteccion) {

                if (distancia > distanciaAtaque) {

                    const direccionX = dx / distancia;
                    const direccionZ = dz / distancia;

                    zombie.position.x += direccionX * velocidadZombie * delta;
                    zombie.position.z += direccionZ * velocidadZombie * delta;

                    // Girar hacia el jugador
                    zombie.rotation.y = Math.atan2(dx, dz);

                } else {

                    gameOver = true;

                    controls.unlock();

                    alert('¡GAME OVER! Un zombi te ha atrapado.');

                }

            }

        });

    }

    // ==========================================
    // MOVIMIENTO DEL JUGADOR
    // ==========================================

    if (controls.isLocked && !gameOver) {

        const velocidad = 8;

        if (keys['KeyW']) {
            controls.moveForward(velocidad * delta);
        }

        if (keys['KeyS']) {
            controls.moveForward(-velocidad * delta);
        }

        if (keys['KeyA']) {
            controls.moveRight(-velocidad * delta);
        }

        if (keys['KeyD']) {
            controls.moveRight(velocidad * delta);
        }

    }

    // Rotar cubo de prueba
    cube.rotation.y += 0.5 * delta;

    // Renderizar escenario
    renderer.render(scene, camera);

}

animate();


// ==========================================
// 10. ADAPTAR EL ESCENARIO A LA VENTANA
// ==========================================

window.addEventListener('resize', () => {

    // Actualizar proporciones de la cámara

    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    // Actualizar tamaño del renderizador

    renderer.setSize(
        window.innerWidth,
        window.innerHeight
    );

});
