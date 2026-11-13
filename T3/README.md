# Operación Extracción – FPS 3D

Videojuego de disparos en primera persona hecho con **Three.js (WebGL)** para el curso *Computación Gráfica y Visual* (UPN) – Evaluación T3.

El mundo fue invadido por zombis. Cruza una calle en zigzag, un almacén y un patio de contenedores, administra tu munición y llega a la **zona de extracción** antes de que te atrapen.

## Cómo ejecutarlo

Los modelos `.glb` se cargan con `fetch`, así que el juego **debe abrirse desde un servidor local** (no funciona con doble clic en `index.html`). Se necesita conexión a internet porque Three.js se carga desde un CDN (unpkg).

```bash
git clone <URL-DE-TU-REPOSITORIO>
cd <carpeta>
python3 -m http.server 8000
```

Luego abre <http://localhost:8000> en Chrome/Edge/Firefox. Alternativas: `npx serve` o la extensión *Live Server* de VS Code.

## Controles

| Control | Acción |
|---|---|
| W / A / S / D | Avanzar / izquierda / retroceder / derecha |
| Mouse | Orientar la cámara |
| Clic izquierdo | Disparar (un disparo por clic, sin disparo automático) |
| 1 / 2 | Pistola / Fusil |
| Esc | Pausa |
| R | Reiniciar (en Game Over o victoria) |

## Mecánicas (mapa con los requerimientos)

| RF | Implementación en `main.js` |
|---|---|
| RF01 Armas | `WEAPON_DEFS`, `selectWeapon()`, evento `mousedown` (un evento por clic). Modelos `assets/pistol.glb` (Colt M1911) y `assets/rifle.glb` (G95 A1); `fitWeapon()` los escala y orienta |
| RF02 Munición | `weapons[i].ammo` independiente; `shoot()` descuenta 1 y bloquea al llegar a 0; solo se recupera con cajas (`updatePickups()`) |
| RF03 / RF08 Nivel | `buildLevel()`: sala de inicio → calle con coches y muros en zigzag → almacén con estantes → patio de contenedores → **bosque procedural con camino sinuoso** → zona de extracción (~270 m de recorrido en línea recta, más de 1 minuto corriendo sin parar) |
| RF04 Zombis GLB | Zombi normal = `assets/zombie.glb` (mutante, clips Idle/Walk) y zombi rápido = `assets/zombie_fast.glb` (Minecraft); `buildZombieKit()` los normaliza y `class Zombie` clona uno por enemigo |
| RF05 Comportamiento | Estados `idle` → `chase`; el rango de activación es configurable por zombi (`range` en `ZOMBIE_DEFS`) |
| RF06 Cámara FPS | `player.yaw/pitch`, movimiento relativo a la cámara, colisión círculo‑AABB con deslizamiento (`moveWithCollision`) |
| RF07 Disparos | `Raycaster` desde el centro de pantalla; las paredes bloquean la bala; `Zombie.takeHit()` resta 1 de 2 puntos de vida y muere exactamente al 2.º impacto |
| RF09 Game Over | `gameOver()`: contacto con un zombi → estado `over`, la simulación se detiene y aparece GAME OVER con botón de reinicio |
| RF10 Coleccionables | Cajas de munición (amarilla = pistola, naranja = fusil) y potenciador de velocidad (cian) |
| RF11 Dificultad | 27 zombis distribuidos por zonas, 5 corredores más rápidos, munición inicial limitada (10 + 6) y cajas escasas (+6 pistola / +4 fusil) |

Datos del equilibrio: se necesitan 54 impactos para eliminar a todos los zombis; hay 96 balas disponibles en total, así que conviene **evitar** a algunos enemigos.

## Parámetros configurables

Todo está al inicio de `main.js`: `SHIFT` (cuántos metros se alarga el nivel) y `FOREST` (tramo y forma del camino del bosque), `CONFIG` (velocidad, sensibilidad, vida del zombi), `WEAPON_DEFS` (munición inicial, cadencia), `AMMO_PICKUP` (balas por caja), `ZOMBIE_DEFS` (posición, rango, velocidad) y `PICKUP_DEFS`.

## Estructura

```
index.html      Interfaz (HUD, pantallas de inicio / Game Over / victoria)
main.js         Lógica completa del juego
procedural.js   Generación procedural: texturas en canvas, camino del bosque, árboles y rocas
assets/
  pistol.glb    Arma 1 (Colt M1911 con grabados)
  rifle.glb     Arma 2 (fusil G95 A1 low-poly)
  zombie.glb    Zombi normal: Minecraft Mutant Zombie (animado con los clips Idle y Walk del GLB)
  zombie_fast.glb  Zombi rápido (corredor): Minecraft Zombie (brazos y piernas animados por código)
```

## Recursos y fuentes

- **Three.js r160** (MIT) – <https://threejs.org>, cargado desde unpkg.
- **Modelos GLB** (todos de Sketchfab, licencia **CC-BY 4.0**):
  - Pistola: *Pistol with engravings* de Mateusz Woliński – <https://sketchfab.com/3d-models/pistol-with-engravings-bccd75a0016d49448243135a56facb96>
  - Fusil: *low-poly G95 A1* de D_U – <https://sketchfab.com/3d-models/low-poly-g95-a1-6e66f2cb28234868b06940669c7d388a>
  - Zombi normal: *Minecraft Animated Mutant Zombie* de CanYuTsai – <https://sketchfab.com/3d-models/minecraft-animated-mutant-zombie-27fa326d172c499396fe67088d61afe4>
  - Zombi rápido: *minecraft zombie* de JoohnElkes – <https://sketchfab.com/3d-models/minecraft-zombie-45037ec52b6a4444a0981f916d0dbd43>

  Cada modelo tiene escala y orientación distintas; `fitWeapon()` (armas) y `buildZombieKit()` (zombis) los ajustan al cargar, y los parámetros están en `WEAPON_DEFS[].fit` y `ZOMBIE_MODELS`. Si cambias un zombi por otro, el GLB debe mirar hacia -Z; el zombi rápido necesita los nodos `leftArm_10`, `rightArm_7`, `leftLeg_14`, `rightLeg_12`, y el normal los clips `Idle` y `Walk`.
- **Sonidos:** sintetizados con la API WebAudio (sin archivos externos).
- **Texturas y bosque procedurales** (`procedural.js`, sin archivos de imagen): ladrillo, concreto, asfalto con grietas, chapa oxidada de contenedores, madera, pasto, tierra y piedra se dibujan con `<canvas>`. Los árboles (pinos y robles), las rocas y el camino sinuoso se generan con `mulberry32(semilla)`: la misma semilla da siempre el mismo bosque. Cambia las semillas en `buildForest()` (`777` árboles, `4242` rocas) para obtener otro. Los árboles usan `InstancedMesh` (pocas llamadas de dibujo), los troncos tienen colisión y frenan las balas.

## Publicar en GitHub Pages (opcional)

1. Sube el proyecto a un repositorio.
2. *Settings → Pages → Deploy from a branch → main / root*.
3. Tu juego quedará en `https://<usuario>.github.io/<repo>/`.

## Guion sugerido para el video (máx. 3 min)

1. **0:00–0:20** Muestra el inicio, el HUD y los controles.
2. **0:20–1:30** Demostración: cambio de arma con 1/2, un disparo por clic, munición agotada, recoger una caja, zombi inactivo vs. activado por distancia, muerte al 2.º impacto.
3. **1:30–2:20** Explicación técnica en el código: `shoot()` (raycasting + `takeHit()`) y la máquina de estados de `Zombie.update()`.
4. **2:20–3:00** Llegada a la extracción (mensaje de victoria) y un Game Over.
