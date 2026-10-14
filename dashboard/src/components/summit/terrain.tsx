"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Data terrain: a series (e.g. revenue per week) as columns standing on a contour-map plate.
 * Drag to turn it, hover/tap a column to read it. The latest point is inked in glacier blue.
 * Plain three.js like the mountain; pauses off-screen; a still frame for reduced motion.
 */
export type TerrainPoint = { label: string; value: number };
type Props = { points: TerrainPoint[]; format: (v: number) => string; ariaLabel: string; className?: string };

const css = (name: string, fb: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);

export default function Terrain({ points, format, ariaLabel, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ x: number; y: number; label: string; value: string } | null>(null);
  const data = useRef({ points, format });
  data.current = { points, format };
  const sig = points.map((p) => `${p.label}:${p.value}`).join("|");

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%", touchAction: "pan-y" });
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
    camera.position.set(0, 5.6, 9.6);
    camera.lookAt(0, 0.7, 0);
    const world = new THREE.Group();
    scene.add(world);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x888877, 1.5));
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 6, 4); scene.add(sun);

    // Plate: a disc with contour rings, like the edge of a survey map
    const plateMat = new THREE.MeshLambertMaterial();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.25, 0.12, 96), plateMat);
    plate.position.y = -0.06; world.add(plate);
    const ringMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.8 });
    for (let i = 1; i <= 6; i++) {
      const r = 0.5 * i, pts: THREE.Vector3[] = [];
      // slightly wobbly rings read as contours, not targets
      for (let a = 0; a <= 64; a++) { const t = (a / 64) * Math.PI * 2; const w = 1 + 0.05 * Math.sin(t * 3 + i) + 0.03 * Math.cos(t * 5 - i); pts.push(new THREE.Vector3(Math.cos(t) * r * w, 0.002, Math.sin(t) * r * w)); }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    }

    const colMat = new THREE.MeshLambertMaterial(), lastMat = new THREE.MeshLambertMaterial(), edgeMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.35 });
    const cols = new THREE.Group(); world.add(cols);
    const boxGeo = new THREE.BoxGeometry(1, 1, 1); boxGeo.translate(0, 0.5, 0);
    const edgeGeo = new THREE.EdgesGeometry(boxGeo);

    function colors() {
      plateMat.color = css("--surface", "#fbfbf8");
      ringMat.color = css("--contour", "#a9845c");
      colMat.color = css("--surface-2", "#e7e9e2");
      lastMat.color = css("--climbed", "#2b6ca3");
      edgeMat.color = css("--text", "#1a201c");
      draw();
    }

    let targets: { mesh: THREE.Mesh; h: number; i: number }[] = [];
    function build() {
      cols.clear(); targets = [];
      const ps = data.current.points;
      const n = ps.length, max = Math.max(1, ...ps.map((p) => p.value));
      // Columns walk along a gentle ridge across the plate, oldest at the back-left
      ps.forEach((p, i) => {
        const t = n === 1 ? 0.5 : i / (n - 1);
        const x = -2.1 + t * 4.2, z = 0.8 - Math.sin(t * Math.PI) * 1.4 + t * 0.3;
        const h = Math.max(0.04, (p.value / max) * 2.2);
        const m = new THREE.Mesh(boxGeo, i === n - 1 ? lastMat : colMat);
        const w = Math.min(0.42, 3.6 / Math.max(n, 1));
        m.scale.set(w, reduced ? h : 0.001, w); m.position.set(x, 0, z);
        m.userData = { i };
        const e = new THREE.LineSegments(edgeGeo, edgeMat); m.add(e);
        cols.add(m); targets.push({ mesh: m, h, i });
      });
      grow = 0;
    }

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let w = 0, h = 0, grow = 0, raf = 0, visible = true, spin = -0.2, drag: { x: number; s: number } | null = null, idle = true;
    const resize = () => { w = el.clientWidth; h = el.clientHeight; renderer.setSize(w, h, false); camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix(); draw(); };
    const ro = new ResizeObserver(resize); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }); io.observe(el);
    const mo = new MutationObserver(colors); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", colors);

    // Pointer: drag turns the plate; hover/tap shows the column's value
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    const pick = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hit = ray.intersectObjects(cols.children, false)[0];
      if (!hit) { setTip(null); return; }
      const p = data.current.points[(hit.object.userData as { i: number }).i];
      setTip({ x: cx - r.left, y: cy - r.top, label: p.label, value: data.current.format(p.value) });
    };
    const down = (e: PointerEvent) => { drag = { x: e.clientX, s: spin }; idle = false; };
    const move = (e: PointerEvent) => { if (drag && e.pointerType === "mouse" ? e.buttons : drag) { spin = drag!.s + (e.clientX - drag!.x) * 0.01; draw(); } pick(e.clientX, e.clientY); };
    const up = () => { drag = null; };
    const leave = () => { drag = null; setTip(null); };
    el.addEventListener("pointerdown", down); el.addEventListener("pointermove", move); window.addEventListener("pointerup", up); el.addEventListener("pointerleave", leave);

    function frame() {
      if (idle && !reduced) spin += 0.0018;
      world.rotation.y = spin;
      if (grow < 1) {
        grow = reduced ? 1 : Math.min(1, grow + 0.025);
        const e = 1 - Math.pow(1 - grow, 3);
        for (const t of targets) t.mesh.scale.y = Math.max(0.001, t.h * Math.min(1, e * 1.15 - t.i * 0.012));
      }
      renderer.render(scene, camera);
    }
    function draw() { if (reduced || !visible) frame(); }
    function loop() { cancelAnimationFrame(raf); if (!visible) return; frame(); if (!reduced) raf = requestAnimationFrame(loop); }
    api.current = () => { build(); draw(); };
    colors(); build(); resize(); loop();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); mq.removeEventListener("change", colors);
      el.removeEventListener("pointerdown", down); el.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); el.removeEventListener("pointerleave", leave);
      renderer.dispose(); boxGeo.dispose(); edgeGeo.dispose(); renderer.domElement.remove(); api.current = null;
    };
  }, []);
  const api = useRef<(() => void) | null>(null);
  useEffect(() => { api.current?.(); }, [sig]);

  return (
    <div className={`relative ${className ?? ""}`} role="img" aria-label={ariaLabel}>
      <div ref={host} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-brand-contrast shadow-lg" style={{ left: tip.x, top: tip.y }}>
          <span className="opacity-70">{tip.label}</span> <span className="font-semibold">{tip.value}</span>
        </div>
      )}
    </div>
  );
}
