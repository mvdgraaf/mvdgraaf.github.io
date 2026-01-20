import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.182.0/build/three.module.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/controls/PointerLockControls.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.182.0/examples/jsm/loaders/GLTFLoader.js";

// =====================
// Scene, Camera, Renderer
// =====================
const scene = new THREE.Scene();
const loader = new THREE.TextureLoader();
const gltfLoader = new GLTFLoader();

const earthTexture = loader.load("media/earth.jpg");
const moonTexture = loader.load("media/moon.jpg");
const marsTexture = loader.load("media/mars.jpg");
const venusTexture = loader.load("media/venus.jpg");
const mercuryTexture = loader.load("media/mercury.jpg");
const neptuneTexture = loader.load("media/neptune.jpg");
const uranusTexture = loader.load("media/uranus.jpg");
const saturnTexture = loader.load("media/saturn.jpg");
const jupiterTexture = loader.load("media/jupiter.jpg");
const sunTexture = loader.load("media/sun.jpg");

loader.load("media/stars.jpg", texture => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    scene.background = texture;
});

const CAMERA_RADIUS = 3;
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 50, 100);
camera.lookAt(0, 0, 0);


const controls = new PointerLockControls(camera, document.body);

const move = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false
}

const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const moveSpeed = 100;
const upDownSpeed = 10;
let timeScale = 1;

const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.physicallyCorrectLights = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type= THREE.PCFSoftShadowMap;

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// =====================
// Shader
// =====================
const globalPlanetMaterial = new THREE.ShaderMaterial({
        uniforms:
            {
                uTexture: { value: null },
                uLightDir: { value: new THREE.Vector3(1, 1, 1).normalize()},
                uSunPosition: { value: new THREE.Vector3(0, 0, 0) }
            },
        vertexShader: `
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                            vUv = uv;
                            vNormal = normalize(mat3(modelMatrix) * normal);
                            vec4 worldPos = modelMatrix * vec4(position, 1.0);
                            vWorldPosition = worldPos.xyz;
                
                            gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,
    fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec3 uSunPosition;

        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPosition;

        void main() {
            vec3 lightDir = normalize(uSunPosition - vWorldPosition);
            float diff = max(dot(vNormal, lightDir), 0.0);

            vec3 tex = texture2D(uTexture, vUv).rgb;

            vec3 color = tex * (0.1 + diff); // ambient + diffuse
            gl_FragColor = vec4(color, 1.0);
        }
    `
})

// =====================
// Sphere
// =====================
function createSphere(radius = 1, widthSegments = 100, heightSegments = 100) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    const displacementNumber = 0.01;

    const displacementMap = [];

    for (let y = 0; y <= heightSegments; y++) {
        const v = y / heightSegments;
        const phi = v * Math.PI;

        const poolDisplacement = 1 + ((Math.random() - 0.5) * displacementNumber);

        for (let x = 0; x <= widthSegments; x++) {
            const u = x / widthSegments;
            const theta = u * Math.PI * 2;

            let displacement;

            if (y === 0 || y === heightSegments) {
                displacement = poolDisplacement;
            } else if (x === widthSegments) {
                displacement = displacementMap[y * (widthSegments + 1)];
            } else {
               displacement = 1 + ((Math.random() - 0.5) * displacementNumber);
            }

            displacementMap.push(displacement);

            const r = radius * displacement;
            const px = -r * Math.sin(phi) * Math.cos(theta);
            const py = r * Math.cos(phi);
            const pz = r * Math.sin(phi) * Math.sin(theta);

            vertices.push(px, py, pz);
            const normal = new THREE.Vector3();
            normal.set(px, py, pz).normalize();
            normals.push(normal.x, normal.y, normal.z);
            uvs.push(u, 1 - v);
        }
    }

    for (let y = 0; y < heightSegments; y++) {
        for (let x = 0; x < widthSegments; x++) {
            const first = y * (widthSegments + 1) + x;
            const second = first + widthSegments + 1;

            indices.push(first, second, first + 1);
            indices.push(second, second + 1, first + 1);
        }
    }

    geometry.setIndex(indices);
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

    return geometry;
}

// =====================
// Licht
// =====================

const sunLight = new THREE.PointLight(0xffffff, 100, 500);
sunLight.position.set(0, 0, 0);

sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;

sunLight.shadow.bias = -0.0005;

scene.add(sunLight);

// Zwak omgevingslicht
scene.add(new THREE.AmbientLight(0xffffff, 0.05));

// =====================
// Zon
// =====================
const SUN_RADIUS = 4;
const sunGeometry = createSphere(SUN_RADIUS);
const sunMaterial = new THREE.ShaderMaterial({
    uniforms:
        {
            uTexture: { value: sunTexture },
        },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D uTexture;
        varying vec2 vUv;

        void main() {
            vec3 tex = texture2D(uTexture, vUv).rgb;
            vec3 color = tex * 1.3; // felle zon
            gl_FragColor = vec4(color, 1.0);
        }
    `
});

const sun = new THREE.Mesh(sunGeometry, sunMaterial);
sun.castShadow = true;
sun.receiveShadow = true;
scene.add(sun);


// =====================
// Planeet functions
// =====================
var baseGeometry = createSphere();
function createPlanet({size, distance, color, texture, orbitSpeed, rotationSpeed}) {
    const orbit = new THREE.Object3D();
    scene.add(orbit);

    let material;
    if (texture) {
        material = globalPlanetMaterial.clone()
        material.uniforms.uTexture.value = texture;
    } else {
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2 });
    }


    const planet = new THREE.Mesh(baseGeometry, material);
    planet.scale.setScalar(size)
    planet.castShadow = true;
    planet.receiveShadow = true;
    planet.position.x = distance;
    orbit.add(planet);

    return { orbit, planet, orbitSpeed, rotationSpeed };
}

function createMoon(size, distance, color, texture, orbitSpeed, rotationSpeed) {
    const moonOrbit = new THREE.Object3D();

    let material;
    if (texture) {
        material = globalPlanetMaterial.clone();
        material.uniforms.uTexture.value = texture;
    } else {
        material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.2 });
    }
    const geometry = createSphere(size, );
    const moon = new THREE.Mesh(geometry, material);

    moon.position.x = distance;
    moon.castShadow = true;
    moon.receiveShadow = true;
    moonOrbit.add(moon);

    return { orbit: moonOrbit, moon, orbitSpeed, rotationSpeed };
}

function createOrbitingModel({parentPlanet, modelPath, distance, scale = 1, orbitspeed = 0.01, rotationSpeed = 0.02, heightOffset = 0}) {
    const orbit = new THREE.Object3D();
    scene.add(orbit);

    gltfLoader.load(modelPath, gltf => {
        const model = gltf.scene;
        model.scale.setScalar(scale);
        model.position.set(distance, heightOffset, 0);

        model.traverse(obj => {
            if (obj.isMesh) {
                obj.castShadow = true;
                obj.receiveShadow = true;

                const originalTexture = obj.material.map;
                const shaderMaterial = globalPlanetMaterial.clone();
                shaderMaterial.uniforms.uTexture.value = originalTexture;
                obj.material = shaderMaterial;
            }
        })

        orbit.add(model);

        orbit.userData = {
            model,
            orbitspeed,
            rotationSpeed,
            parentPlanet
        }
    });
    return orbit;
}

// =====================
// Planeten
// =====================

const planets = [
    createPlanet({
        size: 0.38,
        distance: 13,
        color: 0xaaaaaa,
        texture: mercuryTexture,
        orbitSpeed: 0.004,
        rotationSpeed: 0.02
    }), // Mercurius

    createPlanet({
        size: 0.95,
        distance: 16,
        texture: venusTexture,
        orbitSpeed: 0.0035,
        rotationSpeed: 0.01
    }), // Venus

    createPlanet({
        size: 1.0,
        distance: 23,
        texture: earthTexture,
        orbitSpeed: 0.003,
        rotationSpeed: 0.02
    }), // Aarde

    createPlanet({
        size: 0.53,
        distance: 29,
        color: 0xff0000,
        texture: marsTexture,
        orbitSpeed: 0.0025,
        rotationSpeed: 0.02
    }), // Mars

    createPlanet({
        size: 2.5,
        distance: 37,
        texture: jupiterTexture,
        orbitSpeed: 0.0015,
        rotationSpeed: 0.01
    }), // Jupiter

    createPlanet({
        size: 2.0,
        distance: 51,
        texture: saturnTexture,
        orbitSpeed: 0.0012,
        rotationSpeed: 0.01
    }), // Saturnus

    createPlanet({
        size: 1.5,
        distance: 62,
        texture: uranusTexture,
        orbitSpeed: 0.0008,
        rotationSpeed: 0.01
    }), // Uranus

    createPlanet({
        size: 1.4,
        distance: 74,
        texture: neptuneTexture,
        orbitSpeed: 0.0007,
        rotationSpeed: 0.01
    }) // Neptunus
];



// =====================
// Planeten (manen)
// =====================

const earth = planets[2];

const earthMoon = createMoon(0.3, 2.5, 0xffffff, moonTexture, 0.015, 0.01);
scene.add(earthMoon.orbit);
earthMoon.orbit.position.copy(earth.planet.position);

// =====================
// Models
// =====================
const mars = planets[3];

const satellites = [
    createOrbitingModel(
        {parentPlanet: mars,
            modelPath: "models/sat.gltf",
            distance: 2,
            scale: 0.03,
            orbitspeed: 0.01,
            rotationSpeed: 0,
            heightOffset: 0.3
        }),
    createOrbitingModel(
        {parentPlanet: earth,
            modelPath: "models/sat.gltf",
            distance: 2,
            scale: 0.03,
            orbitspeed: 0.01,
            rotationSpeed: 0,
            heightOffset: 0.3
        }),
    createOrbitingModel(
        {parentPlanet: planets[0],
            modelPath: "models/sat.gltf",
            distance: 30,
            orbitspeed: 0.002,
            scale: 0.1,
        }
    )
]



// =====================
// HUD
// =====================

const hud = document.getElementById("hud");

function updateHUD() {
    const pos = camera.position;
    hud.innerHTML = `
        Camera X: ${pos.x.toFixed(2)} <br>
        Camera Y: ${pos.y.toFixed(2)} <br>
        Camera Z: ${pos.z.toFixed(2)} <br>
        <br>
        Speed: ${timeScale.toFixed(1)}x <br>
        <br>
        ESC knop om muis te locken, klikken om te unlocken.<br>
        Muis om te draaien.<br>
        W, A, S, D om te bewegen.<br>       
        Spatie om omhoog te gaan.<br>
        Shift om omlaag te gaan.<br>
        [, ], 0 voor het instellen van de snelheid.
    `;
}


// =====================
// Animatie
// =====================

const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    // Beweging
    velocity.x -= velocity.x * 10.0 * delta;
    velocity.z -= velocity.z * 10.0 * delta;

    direction.z = Number(move.forward) - Number(move.backward);
    direction.x = Number(move.right) - Number(move.left);
    direction.normalize();

    if (move.forward || move.backward) velocity.z -= direction.z * moveSpeed * delta;
    if (move.left || move.right) velocity.x -= direction.x * moveSpeed * delta;
    if (move.up) {camera.position.y += upDownSpeed * delta;}
    if (move.down) {camera.position.y -= upDownSpeed * delta;}

    controls.moveRight(-velocity.x * delta);
    controls.moveForward(-velocity.z * delta);

    const cameraPos = camera.position;
    const sunPos = sun.position;

    const distance = cameraPos.distanceTo(sunPos);
    const minDistance = SUN_RADIUS + CAMERA_RADIUS;

    if (distance < minDistance) {
        const pushDirection = cameraPos.clone().sub(sunPos).normalize();

        camera.position.copy(
            sunPos.clone().add(pushDirection.multiplyScalar(minDistance))
        )
    }

    // Zon draait
    sun.rotation.y += 0.002;

    // Planeten
    planets.forEach(p => {
        p.orbit.rotation.y += p.orbitSpeed * timeScale;
        p.planet.rotation.y += p.rotationSpeed * timeScale;
    });

    earthMoon.orbit.rotation.y += earthMoon.orbitSpeed * timeScale;
    earthMoon.moon.rotation.y += earthMoon.rotationSpeed * timeScale;
    earth.planet.add(earthMoon.moon);

    satellites.forEach(satelliteOrbit => {
        if (satelliteOrbit.userData.parentPlanet) {
            const planetPos = satelliteOrbit.userData.parentPlanet.planet.getWorldPosition(new THREE.Vector3());

            satelliteOrbit.position.copy(planetPos);
            satelliteOrbit.rotation.y += satelliteOrbit.userData.orbitspeed * timeScale;

            if (satelliteOrbit.userData.model) {
                satelliteOrbit.userData.model.rotation.y += satelliteOrbit.userData.rotationSpeed * timeScale;
            }
        }
    })

    updateHUD();

    renderer.render(scene, camera);
}

animate();

// =====================
// Resize
// =====================
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// =====================
// EventListeners
// =====================

document.addEventListener("click", () => {
    controls.lock();
})

document.addEventListener("keydown", e => {
    switch(e.code) {
        case "KeyW": move.forward = true; break;
        case "KeyS": move.backward = true; break;
        case "KeyA": move.left = true; break;
        case "KeyD": move.right = true; break;
        case "Space": move.up = true; break;
        case "ShiftLeft":
        case "ShiftRight": move.down = true; break;
        case "BracketRight":timeScale += 0.1;break;
        case "BracketLeft": timeScale -= 0.1; break;
        case "Digit0": timeScale = 1; break;
    }
})
document.addEventListener("keyup", e => {
    switch(e.code) {
        case "KeyW": move.forward = false; break;
        case "KeyS": move.backward = false; break;
        case "KeyA": move.left = false; break;
        case "KeyD": move.right = false; break;
        case "Space": move.up = false; break;
        case "ShiftLeft":
        case "ShiftRight": move.down = false; break;
    }
})