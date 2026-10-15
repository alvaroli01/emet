"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { disposeScene } from "./dispose";

/**
 * The signature 3D object: a topographic mountain. Altitude = revenue toward the €30K summit.
 * Contour lines every €1K, a heavier index contour at each €5K camp, the climbed part washed in
 * glacier blue, and a trail spiralling to the summit with the team's marker on it.
 * Plain three.js (no React renderer) so it stays small; it only renders while on screen.
 */

export type MountainLabels = {
  summit: string;
  camp?: string | null;
  here?: string | null;
  nextCamp?: string | null;
};

type Props = {
  progress: number; // 0..1 of the revenue goal
  nextCampAt?: number | null; // 0..1 altitude of the next camp
  labels: MountainLabels;
  ariaLabel: string;
  variant?: "overview" | "login" | "camp" | "money";
  className?: string;
};

const PEAK = new THREE.Vector2(0.35, -0.3);
const RADIUS = 5;

// Small deterministic value noise so the mountain is the same for everyone
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  let sum = 0, amp = 0.5, f = 1;
  for (let i = 0; i < 4; i++) { sum += amp * noise(x * f, y * f); f *= 2.03; amp *= 0.5; }
  return sum;
}
function height(x: number, z: number) {
  const dx = x - PEAK.x, dz = z - PEAK.y;
  const r2 = dx * dx + dz * dz;
  const main = 3.1 * Math.exp(-r2 / (2 * 1.55 * 1.55));
  const shoulder = 1.05 * Math.exp(-((x + 2.1) ** 2 + (z - 1.5) ** 2) / 1.3);
  const ridge = 0.55 * Math.exp(-((x - 2.2) ** 2 + (z + 1.9) ** 2) / 0.9);
  const rough = (fbm(x * 0.75 + 3.1, z * 0.75 - 1.7) - 0.5) * 0.9;
  const fall = Math.max(0, 1 - Math.hypot(x, z) / RADIUS);
  return Math.max(0, (main + shoulder + ridge + rough * (0.35 + main * 0.25)) * Math.min(1, fall * 2.2));
}

/** Read a theme colour from where the mountain sits, so it matches its own card (e.g. Base camp's light glass). */
let colorScope: Element | null = null;
function cssColor(name: string, fallback: string) {
  const v = getComputedStyle(colorScope ?? document.documentElement).getPropertyValue(name).trim();
  return new THREE.Color(v || fallback);
}

const vertex = /* glsl */ `
  uniform float uMaxH;
  varying float vA;
  varying vec3 vN;
  varying float vR;
  void main() {
    vA = clamp(position.y / uMaxH, 0.0, 1.0);
    vN = normalize(normalMatrix * normal);
    vR = length(position.xz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const fragment = /* glsl */ `
  uniform vec3 uPaper; uniform vec3 uContour; uniform vec3 uClimbed;
  uniform float uProgress; uniform vec3 uLight; uniform float uRadius;
  varying float vA; varying vec3 vN; varying float vR;
  float isoline(float v, float width) {
    float w = fwidth(v);
    float d = abs(fract(v - 0.5) - 0.5) / max(w, 1e-4);
    return 1.0 - min(d / width, 1.0);
  }
  void main() {
    float light = clamp(dot(normalize(vN), normalize(uLight)), 0.0, 1.0);
    vec3 col = uPaper * (0.74 + 0.30 * light);
    float climbed = (1.0 - smoothstep(uProgress - 0.003, uProgress + 0.003, vA)) * step(0.0005, uProgress);
    col = mix(col, mix(col, uClimbed, 0.34), climbed * smoothstep(0.01, 0.05, vA));
    float onSlope = smoothstep(0.004, 0.02, vA);
    col = mix(col, uContour, isoline(vA * 30.0, 1.0) * 0.5 * onSlope);
    col = mix(col, uContour * 0.82, isoline(vA * 6.0, 1.9) * 0.9 * onSlope);
    float edge = 1.0 - min(abs(vA - uProgress) / max(fwidth(vA), 1e-4) / 1.6, 1.0);
    col = mix(col, uClimbed, edge * step(0.0005, uProgress) * onSlope);
    float alpha = 1.0 - smoothstep(uRadius - 0.9, uRadius - 0.05, vR);
    gl_FragColor = vec4(col, alpha);
  }
`;

export default function Mountain({ progress, nextCampAt, labels, ariaLabel, variant = "overview", className = "" }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const summitEl = useRef<HTMLSpanElement>(null);
  const hereEl = useRef<HTMLSpanElement>(null);
  const campEl = useRef<HTMLSpanElement>(null);
  const tentEl = useRef<HTMLSpanElement>(null);
  const target = useRef(progress);
  const campTarget = useRef(nextCampAt ?? null);
  const [failed, setFailed] = useState(false);

  target.current = Math.max(0, Math.min(1, progress));
  campTarget.current = nextCampAt ?? null;

  useEffect(() => {
    const host = wrap.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      setFailed(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.style.touchAction = "pan-y";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(variant === "login" ? 30 : 32, 1, 0.1, 100);
    if (variant === "login") camera.position.set(0, 5.4, 14.5);
    else camera.position.set(0, 6.2, 11.6);
    camera.lookAt(0, variant === "login" ? 2.3 : variant === "money" ? 2.1 : 1.1, 0);

    const world = new THREE.Group();
    scene.add(world);
    // "money" (Today): gold climb, shiny lit coins, a glowing € summit and drifting gold sparkles
    const money = variant === "money";
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffe2b0, 2.2);
    sun.position.set(-3, 6, 5);
    scene.add(sun);

    // Terrain
    const geo = new THREE.PlaneGeometry(RADIUS * 2, RADIUS * 2, 180, 180);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let maxH = 0;
    for (let i = 0; i < pos.count; i++) {
      const h = height(pos.getX(i), pos.getZ(i));
      pos.setY(i, h);
      if (h > maxH) maxH = h;
    }
    geo.computeVertexNormals();
    const uniforms = {
      uMaxH: { value: maxH },
      uPaper: { value: new THREE.Color() },
      uContour: { value: new THREE.Color() },
      uClimbed: { value: new THREE.Color() },
      uProgress: { value: 0 },
      uLight: { value: new THREE.Vector3(-0.5, 0.9, 0.6) },
      uRadius: { value: RADIUS },
    };
    const terrainMat = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true });
    const terrain = new THREE.Mesh(geo, terrainMat);
    world.add(terrain);

    // Trail: spiral from the base to the summit, sitting just above the ground
    const pts: THREE.Vector3[] = [];
    const alts: number[] = [];
    const N = 260;
    let best = 0;
    // A switchback trail up the front face, like a real mountain path
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      const x = PEAK.x - 0.5 * (1 - t) + Math.sin(t * Math.PI * 5) * 1.5 * Math.pow(1 - t, 0.9);
      const z = PEAK.y + 4.3 * Math.pow(1 - t, 1.05);
      const y = height(x, z);
      pts.push(new THREE.Vector3(x, y + 0.04, z));
      best = Math.max(best, y / maxH);
      alts.push(best);
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const indexAt = (a: number) => {
      const i = alts.findIndex((v) => v >= a);
      return i < 0 ? N : i;
    };

    const inkMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.32 });
    const trailMat = new THREE.MeshBasicMaterial();
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffc23d, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    let glowTube: THREE.Mesh | null = null;
    const fullTube = new THREE.TubeGeometry(curve, 400, 0.022, 6, false);
    world.add(new THREE.Mesh(fullTube, inkMat));
    let doneTube: THREE.Mesh | null = null;
    const setDone = (a: number) => {
      if (doneTube) { world.remove(doneTube); doneTube.geometry.dispose(); doneTube = null; }
      if (glowTube) { world.remove(glowTube); glowTube.geometry.dispose(); glowTube = null; }
      const i = indexAt(a);
      if (i < 2) return;
      const sub = new THREE.CatmullRomCurve3(pts.slice(0, i + 1));
      doneTube = new THREE.Mesh(new THREE.TubeGeometry(sub, Math.max(8, i * 2), money ? 0.05 : 0.04, 8, false), trailMat);
      world.add(doneTube);
      if (money) { glowTube = new THREE.Mesh(new THREE.TubeGeometry(sub, Math.max(8, i * 2), 0.14, 8, false), glowMat); world.add(glowTube); }
    };

    // Marker: a pin with a pulsing ring
    const marker = new THREE.Group();
    const pinMat = new THREE.MeshBasicMaterial();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14), pinMat);
    head.position.y = 0.5;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 6), pinMat);
    stem.position.y = 0.25;
    const ringMat = new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.12, 0.16, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    marker.add(head, stem, ring);
    world.add(marker);

    // Summit flag
    const flagMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const summit = pts[N].clone();
    const bigCoinBase = summit.y + 1.25;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6), flagMat);
    pole.position.copy(summit).add(new THREE.Vector3(0, 0.3, 0));
    const flagShape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(0.32, -0.09), new THREE.Vector2(0, -0.18)]);
    const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), flagMat);
    flag.position.copy(summit).add(new THREE.Vector3(0, 0.6, 0));
    if (!money) world.add(pole, flag);

    // Money on the mountain: a gold coin on the trail for every €1K climbed, a coin stack at each €5K camp
    // reached, and a big € coin turning above the summit (the goal).
    const goldTop = new THREE.MeshStandardMaterial({ color: 0xffc23d, metalness: 0.85, roughness: 0.28, emissive: 0x6a4000, emissiveIntensity: 0.45 });
    const goldSide = new THREE.MeshStandardMaterial({ color: 0xd99400, metalness: 0.9, roughness: 0.35, emissive: 0x3a2200, emissiveIntensity: 0.4 });
    const coinMats = [goldSide, goldTop, goldTop];
    const coinGeo = new THREE.CylinderGeometry(0.085, 0.085, 0.022, 28);
    const coins: { mesh: THREE.Mesh; at: number; phase: number; base: number }[] = [];
    for (let k = 1; k < 30; k++) {
      const a = k / 30;
      const p = curve.getPoint(indexAt(a) / N);
      const mesh = new THREE.Mesh(coinGeo, coinMats);
      mesh.rotation.x = Math.PI / 2; // stand the coin on its edge
      mesh.position.set(p.x, p.y + 0.16, p.z);
      if (money) mesh.scale.setScalar(1.3);
      mesh.visible = false;
      world.add(mesh);
      coins.push({ mesh, at: a, phase: k * 0.7, base: p.y + 0.16 });
    }
    const stacks: { group: THREE.Group; at: number }[] = [];
    for (let c = 1; c < 6; c++) {
      const a = c / 6, p = curve.getPoint(indexAt(a) / N), g = new THREE.Group();
      for (let j = 0; j < 4; j++) { const m = new THREE.Mesh(coinGeo, coinMats); m.position.set((j % 2) * 0.012, j * 0.024, 0); m.scale.setScalar(1.25); g.add(m); }
      g.position.set(p.x + 0.22, p.y + 0.02, p.z + 0.05);
      g.visible = false;
      world.add(g);
      stacks.push({ group: g, at: a });
    }
    const euroCanvas = document.createElement("canvas");
    euroCanvas.width = euroCanvas.height = 128;
    const ec = euroCanvas.getContext("2d");
    if (ec) {
      const g = ec.createRadialGradient(50, 44, 6, 64, 64, 70);
      g.addColorStop(0, "#fff1b8"); g.addColorStop(0.45, "#ffc23d"); g.addColorStop(1, "#c98200");
      ec.fillStyle = g; ec.fillRect(0, 0, 128, 128);
      ec.strokeStyle = "rgba(120,70,0,0.55)"; ec.lineWidth = 6; ec.beginPath(); ec.arc(64, 64, 54, 0, Math.PI * 2); ec.stroke();
      ec.font = "bold 80px sans-serif"; ec.textAlign = "center"; ec.textBaseline = "middle";
      ec.fillStyle = "rgba(255,255,255,0.5)"; ec.fillText("€", 66, 72);
      ec.fillStyle = "#8a5600"; ec.fillText("€", 64, 70);
    }
    const euroTex = new THREE.CanvasTexture(euroCanvas);
    const bigCoin = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.05, 40), [goldSide, new THREE.MeshBasicMaterial({ map: euroTex }), new THREE.MeshBasicMaterial({ map: euroTex })]);
    bigCoin.rotation.x = Math.PI / 2;
    if (money) bigCoin.scale.setScalar(1.6);
    world.add(bigCoin);

    // Golden halo behind the summit coin, and gold sparkles drifting up around the mountain
    const glowCanvas = document.createElement("canvas");
    glowCanvas.width = glowCanvas.height = 128;
    const gc = glowCanvas.getContext("2d");
    if (gc) { const g = gc.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, "rgba(255,200,80,0.9)"); g.addColorStop(0.35, "rgba(255,160,40,0.35)"); g.addColorStop(1, "rgba(255,140,20,0)"); gc.fillStyle = g; gc.fillRect(0, 0, 128, 128); }
    const glowTex = new THREE.CanvasTexture(glowCanvas);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    halo.scale.setScalar(2.2);
    halo.visible = money;
    world.add(halo);
    const SPARKS = money ? 140 : 0;
    const sparkPos = new Float32Array(SPARKS * 3);
    const sparkSpeed: number[] = [];
    for (let k = 0; k < SPARKS; k++) {
      const r = 0.6 + Math.random() * 3.2, a = Math.random() * Math.PI * 2;
      sparkPos.set([PEAK.x + Math.cos(a) * r, Math.random() * 4.2, PEAK.y + Math.sin(a) * r], k * 3);
      sparkSpeed.push(0.12 + Math.random() * 0.35);
    }
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffd36b, size: 0.16, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    if (money) world.add(sparks);

    // Base camp: your tent at the foot of the trail
    const tentAt = curve.getPoint(0.05);
    const tentMat = new THREE.MeshBasicMaterial();
    const tent = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.34, 4), tentMat);
    tent.position.copy(tentAt).add(new THREE.Vector3(0.35, 0.15, 0.1));
    tent.rotation.y = Math.PI / 4;
    tent.visible = variant === "camp";
    world.add(tent);

    const applyTheme = () => {
      colorScope = host;
      uniforms.uPaper.value.copy(cssColor("--terrain", "#fbfbf8"));
      uniforms.uContour.value.copy(cssColor("--contour", "#a9845c"));
      uniforms.uClimbed.value.copy(cssColor("--climbed", "#2b6ca3"));
      const ink = cssColor("--text", "#1a201c");
      inkMat.color.copy(ink);
      trailMat.color.copy(cssColor("--trail", "#c9452c"));
      pinMat.color.copy(cssColor("--trail", "#c9452c"));
      ringMat.color.copy(cssColor("--trail", "#c9452c"));
      flagMat.color.copy(ink);
      tentMat.color.copy(cssColor("--climbed", "#2b6ca3"));
      if (money) {
        // Warm night rock with gold contour lines, so the mountain reads on the dark card
        uniforms.uPaper.value.set(0x3a2a1a);
        uniforms.uContour.value.set(0xc8913a);
        uniforms.uClimbed.value.set(0xffb43d);
        trailMat.color.set(0xffd166); pinMat.color.set(0xffd166); ringMat.color.set(0xffc23d);
      }
    };
    applyTheme();
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", applyTheme);

    // Size
    const resize = () => {
      const { width, height: h } = host.getBoundingClientRect();
      if (!width || !h) return;
      renderer.setSize(width, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = width / h;
      // On the login screen, slide the mountain right on wide frames so the headline has clear sky
      if (variant === "login" && width / h > 1.4) camera.setViewOffset(width, h, -width * 0.14, 0, width, h);
      else if (variant === "login") camera.setViewOffset(width, h, 0, -h * 0.24, width, h); // phones: drop it below the headline
      else camera.clearViewOffset();
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    // Drag to turn (horizontal only, so vertical swipes still scroll the page), with inertia
    let rotY = variant === "login" ? 0.6 : -0.35;
    let vel = 0;
    let dragging = false;
    let lastX = 0;
    let lastInput = performance.now();
    const down = (e: PointerEvent) => { dragging = true; lastX = e.clientX; vel = 0; lastInput = performance.now(); };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      rotY += dx * 0.008;
      vel = dx * 0.008;
      lastInput = performance.now();
    };
    const up = () => { dragging = false; lastInput = performance.now(); };
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") { rotY -= 0.18; lastInput = performance.now(); }
      if (e.key === "ArrowRight") { rotY += 0.18; lastInput = performance.now(); }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    host.addEventListener("keydown", key);

    // Labels follow their 3D points
    const v = new THREE.Vector3();
    const place = (el: HTMLElement | null, p: THREE.Vector3 | null) => {
      if (!el) return;
      if (!p) { el.style.opacity = "0"; return; }
      v.copy(p).applyMatrix4(world.matrixWorld).project(camera);
      const r = host.getBoundingClientRect();
      el.style.opacity = v.z < 1 ? "1" : "0";
      el.style.transform = `translate(${((v.x + 1) / 2) * r.width}px, ${((1 - v.y) / 2) * r.height}px)`;
    };

    // Hide the pin's label while the mountain is between it and the camera
    const ray = new THREE.Raycaster();
    const hidden = { here: false };
    let frame = 0;
    const occluded = (p: THREE.Vector3) => {
      const wp = p.clone().applyMatrix4(world.matrixWorld);
      const dir = wp.clone().sub(camera.position);
      const dist = dir.length();
      ray.set(camera.position, dir.normalize());
      ray.far = dist - 0.08;
      return ray.intersectObject(terrain, false).length > 0;
    };

    // Render only while visible
    let visible = true;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 });
    io.observe(host);

    let shown = reduced ? target.current : 0;
    let shownDone = -1;
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      cancelAnimationFrame(raf);
      if (!visible || document.hidden) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Climb toward the real number (one authored moment on load, then live updates)
      const goal = target.current;
      shown += (goal - shown) * (reduced ? 1 : Math.min(1, dt * 2.2));
      if (Math.abs(goal - shown) < 0.0004) shown = goal;
      uniforms.uProgress.value = shown;
      if (Math.abs(shownDone - shown) > 0.004 || (shown === goal && shownDone !== goal)) { setDone(shown); shownDone = shown; }

      if (!dragging) {
        vel *= Math.pow(0.04, dt);
        rotY += vel;
        if (!reduced && now - lastInput > 2500) rotY += dt * 0.07;
      }
      world.rotation.y = rotY;

      // Coins appear as the climb passes them, spin and bob; the summit coin turns slowly
      const tsec = now / 1000;
      for (const c of coins) {
        c.mesh.visible = c.at <= shown + 1e-6;
        if (c.mesh.visible && !reduced) { c.mesh.rotation.z = tsec * 1.6 + c.phase; c.mesh.position.y = c.base + Math.sin(tsec * 2 + c.phase) * 0.025; }
      }
      for (const st of stacks) st.group.visible = st.at <= shown + 1e-6;
      bigCoin.position.set(summit.x, bigCoinBase + (reduced ? 0 : Math.sin(tsec * 1.2) * 0.06), summit.z);
      if (!reduced) bigCoin.rotation.z = tsec * 0.9;
      if (money) {
        halo.position.copy(bigCoin.position);
        halo.scale.setScalar(2.2 + (reduced ? 0 : Math.sin(tsec * 1.6) * 0.18));
        if (!reduced) {
          const arr = sparkGeo.attributes.position as THREE.BufferAttribute;
          for (let k = 0; k < SPARKS; k++) { let y = arr.getY(k) + sparkSpeed[k] * dt; if (y > 4.4) y = 0; arr.setY(k, y); }
          arr.needsUpdate = true;
        }
      }

      const i = indexAt(shown);
      const at = curve.getPoint(i / N);
      marker.position.copy(at);
      marker.visible = goal > 0;
      const pulse = reduced ? 1 : 1 + ((now / 1000) % 1.6) / 1.6 * 1.8;
      ring.scale.setScalar(pulse);
      ringMat.opacity = reduced ? 0.6 : 0.7 * (1 - ((now / 1000) % 1.6) / 1.6);

      world.updateMatrixWorld();
      place(summitEl.current, summit.clone().add(new THREE.Vector3(0, 0.75, 0)));
      if (frame++ % 8 === 0) hidden.here = goal > 0 && occluded(at.clone().add(new THREE.Vector3(0, 0.3, 0)));
      place(hereEl.current, goal > 0 && !hidden.here ? at.clone().add(new THREE.Vector3(0, 0.7, 0)) : null);
      if (variant === "camp") place(tentEl.current, tent.position.clone().add(new THREE.Vector3(0, 0.45, 0)));
      const camp = campTarget.current;
      place(campEl.current, camp && camp < 1 ? curve.getPoint(indexAt(camp) / N).add(new THREE.Vector3(0, 0.05, 0)) : null);

      renderer.render(scene, camera);
    };
    const onVis = () => { last = performance.now(); loop(); };
    document.addEventListener("visibilitychange", onVis);
    loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect(); themeObs.disconnect();
      mq.removeEventListener("change", applyTheme);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      host.removeEventListener("keydown", key);
      disposeScene(scene);
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [variant]);

  const label = "pointer-events-none absolute left-0 top-0 whitespace-nowrap transition-opacity duration-300 will-change-transform";
  return (
    <div
      ref={wrap}
      role="img"
      aria-label={ariaLabel}
      tabIndex={0}
      className={`relative cursor-grab select-none overflow-hidden active:cursor-grabbing ${failed ? "contours" : ""} ${className}`}
    >
      <span ref={summitEl} className={label} style={{ opacity: 0 }}>
        <span className="-translate-x-1/2 -translate-y-full inline-block rounded-md bg-surface/90 px-2 py-0.5 text-xs font-semibold shadow-sm backdrop-blur-sm">
          {labels.summit}
        </span>
      </span>
      {labels.camp && (
        <span ref={tentEl} className={label} style={{ opacity: 0 }}>
          <span className="-translate-x-1/2 -translate-y-full inline-block rounded-md bg-climbed px-2 py-0.5 text-xs font-semibold text-brand-contrast shadow">
            {labels.camp}
          </span>
        </span>
      )}
      {labels.nextCamp && (
        <span ref={campEl} className={label} style={{ opacity: 0 }}>
          <span className="ml-3 -translate-y-1/2 inline-block rounded-md border border-dashed border-contour bg-surface/85 px-1.5 py-0.5 text-[11px] font-medium text-muted backdrop-blur-sm">
            {labels.nextCamp}
          </span>
        </span>
      )}
      {labels.here && (
        <span ref={hereEl} className={label} style={{ opacity: 0 }}>
          <span className="readout -translate-x-1/2 -translate-y-full inline-block rounded-md bg-trail px-2 py-0.5 text-xs text-brand-contrast shadow">
            {labels.here}
          </span>
        </span>
      )}
    </div>
  );
}
