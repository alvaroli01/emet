"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { disposeScene } from "@/components/summit/dispose";
import { mesh } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

/**
 * Scout's globe: Earth drawn like a survey map — coastlines in contour ink, a faint graticule.
 * Idle: slow spin with a few example searches pinned. Searching: flies to the city, drops the trail-red pin,
 * and found places pop in around it (spread out for legibility; strong fits drawn bigger in glacier blue).
 * Plain three.js; pauses off-screen; a still frame for reduced motion.
 */

export type GlobePin = { id: string; lat: number; lng: number; fit?: string | null };
type Props = {
  target: { lat: number; lng: number } | null;
  pins: GlobePin[];
  radiusKm: number;
  examples: { lat: number; lng: number; label: string }[];
  ariaLabel: string;
  className?: string;
};

const R = 1;
const toVec = (lat: number, lng: number, r = R) => {
  const la = (lat * Math.PI) / 180, lo = (lng * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
};
const css = (name: string, fb: string) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fb);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export default function Globe({ target, pins, radiusKm, examples, ariaLabel, className }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const state = useRef({ target, pins, radiusKm, examples });
  state.current = { target, pins, radiusKm, examples };
  const api = useRef<{ sync: () => void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" }); }
    catch { return; } // no WebGL: the contour placeholder behind stays visible
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { display: "block", width: "100%", height: "100%" });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    camera.position.set(0, 0, 3.9);
    const earth = new THREE.Group();
    earth.rotation.order = "XYZ";
    scene.add(earth);

    const surfaceMat = new THREE.MeshBasicMaterial();
    earth.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 48), surfaceMat));
    // Rim: a slightly larger back-face shell gives the globe an edge on light backgrounds
    const rimMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0.55 });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 64, 48), rimMat));

    const gridMat = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
    const grid: number[] = [];
    for (let lat = -75; lat <= 75; lat += 15) for (let lng = -180; lng < 180; lng += 3) grid.push(...toVec(lat, lng, R * 1.001).toArray(), ...toVec(lat, lng + 3, R * 1.001).toArray());
    for (let lng = -180; lng < 180; lng += 15) for (let lat = -84; lat < 84; lat += 3) grid.push(...toVec(lat, lng, R * 1.001).toArray(), ...toVec(lat + 3, lng, R * 1.001).toArray());
    const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(grid, 3));
    earth.add(new THREE.LineSegments(gridGeo, gridMat));

    const coastMat = new THREE.LineBasicMaterial();
    let alive = true;
    import("world-atlas/land-110m.json").then((m) => {
      if (!alive) return;
      const topo = (m.default ?? m) as unknown as Topology<{ land: GeometryCollection }>;
      const lines = mesh(topo, topo.objects.land).coordinates as [number, number][][];
      const pos: number[] = [];
      for (const line of lines) for (let i = 1; i < line.length; i++) pos.push(...toVec(line[i - 1][1], line[i - 1][0], R * 1.002).toArray(), ...toVec(line[i][1], line[i][0], R * 1.002).toArray());
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      earth.add(new THREE.LineSegments(g, coastMat));
      if (reduced) loop();
    });

    // Pins
    const dotGeo = new THREE.SphereGeometry(1, 12, 8);
    const exampleMat = new THREE.MeshBasicMaterial(), targetMat = new THREE.MeshBasicMaterial(), placeMat = new THREE.MeshBasicMaterial(), strongMat = new THREE.MeshBasicMaterial(), skipMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.45 });
    const pinGroup = new THREE.Group(); earth.add(pinGroup);
    const exampleDots: THREE.Mesh[] = [];
    let born = new Map<string, number>();

    function colors() {
      surfaceMat.color = css("--terrain", "#fbfbf8");
      rimMat.color = css("--border", "#d6d9cf");
      gridMat.color = css("--grid", "#dcdfd6");
      coastMat.color = css("--contour", "#a9845c");
      exampleMat.color = css("--muted", "#59625b");
      targetMat.color = css("--trail", "#c9452c");
      placeMat.color = css("--series-1", "#2b6ca3");
      strongMat.color = css("--climbed", "#2b6ca3");
      skipMat.color = css("--muted", "#59625b");
      if (reduced) loop();
    }

    function sync() {
      const { target: tg, pins: ps, radiusKm: rk, examples: ex } = state.current;
      pinGroup.clear(); exampleDots.length = 0;
      if (!tg) for (const e of ex) { const d = new THREE.Mesh(dotGeo, exampleMat); d.position.copy(toVec(e.lat, e.lng, R * 1.004)); d.scale.setScalar(0.012); pinGroup.add(d); exampleDots.push(d); }
      if (tg) {
        const t = new THREE.Mesh(dotGeo, targetMat); t.position.copy(toVec(tg.lat, tg.lng, R * 1.006)); t.scale.setScalar(0.011); pinGroup.add(t);
        // Spread the city's places so they read at globe scale: the search radius is drawn as ~4° of arc
        const spread = 4 / Math.max(0.05, rk / 111);
        const now = performance.now();
        const seen = new Map<string, number>();
        ps.forEach((p, i) => {
          let lat = p.lat, lng = p.lng;
          // Places found on the web have no coordinates yet: place them on a sunflower spiral inside the radius
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) { const a = i * 2.39996, r = Math.sqrt((i + 1) / (ps.length + 1)) * (rk / 111) * 0.9; lat = tg.lat + Math.sin(a) * r; lng = tg.lng + Math.cos(a) * r; }
          const m = new THREE.Mesh(dotGeo, p.fit === "strong" || p.fit === "good" ? strongMat : p.fit === "skip" || p.fit === "maybe" ? skipMat : placeMat);
          m.position.copy(toVec(tg.lat + (lat - tg.lat) * spread, tg.lng + (lng - tg.lng) * spread, R * 1.005));
          const base = p.fit === "strong" ? 0.0085 : p.fit === "good" ? 0.0068 : 0.005;
          m.userData = { base, id: p.id };
          seen.set(p.id, born.get(p.id) ?? now);
          pinGroup.add(m);
        });
        born = seen;
      }
      if (reduced) loop(); // still mode: draw the new state once
    }
    api.current = { sync };

    let w = 0, h = 0;
    const resize = () => {
      w = el.clientWidth; h = el.clientHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el);

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let visible = true, raf = 0;
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }, { threshold: 0 }); io.observe(el);
    const mo = new MutationObserver(colors); mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    const mq = window.matchMedia("(prefers-color-scheme: dark)"); mq.addEventListener("change", colors);

    earth.rotation.set(0.35, -0.2, 0);
    const v = new THREE.Vector3();
    function frame() {
      const tg = state.current.target;
      if (tg) {
        const tx = (tg.lat * Math.PI) / 180, ty = (-tg.lng * Math.PI) / 180;
        const e = reduced ? 1 : 0.06;
        earth.rotation.x += (tx - earth.rotation.x) * e;
        earth.rotation.y += wrap(ty - earth.rotation.y) * e;
        camera.position.z += (1.62 - camera.position.z) * (reduced ? 1 : 0.045);
      } else {
        if (!reduced) earth.rotation.y += 0.0016;
        earth.rotation.x += (0.35 - earth.rotation.x) * 0.03;
        camera.position.z += (3.9 - camera.position.z) * (reduced ? 1 : 0.04);
      }
      const now = performance.now();
      for (const c of pinGroup.children) {
        const u = c.userData as { base?: number; id?: string };
        if (!u.base) continue;
        const t0 = born.get(u.id!) ?? now, age = reduced ? 1 : Math.min(1, (now - t0) / 450);
        const back = 1 + 2.2 * Math.pow(age - 1, 3) + 1.2 * Math.pow(age - 1, 2); // ease-out-back pop
        c.scale.setScalar(u.base * Math.max(0.001, back));
      }
      // Example labels follow their pins and hide on the far side
      const box = labels.current;
      if (box) {
        const kids = box.children as HTMLCollectionOf<HTMLElement>;
        exampleDots.forEach((d, i) => {
          const k = kids[i]; if (!k) return;
          d.getWorldPosition(v);
          const facing = v.clone().normalize().dot(camera.position.clone().normalize());
          v.project(camera);
          k.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
          k.style.opacity = !tg && facing > 0.35 ? String(Math.min(1, (facing - 0.35) * 3)) : "0";
        });
      }
      renderer.render(scene, camera);
    }
    function loop() {
      cancelAnimationFrame(raf);
      if (!visible) return;
      frame();
      if (reduced) return;
      raf = requestAnimationFrame(loop);
    }
    colors(); resize(); sync(); loop();

    return () => {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); mo.disconnect(); mq.removeEventListener("change", colors);
      renderer.dispose(); disposeScene(scene);
      renderer.domElement.remove(); api.current = null;
    };
  }, []);

  // Re-draw pins whenever the search, its places or the examples change
  const sig = `${target?.lat},${target?.lng}|${radiusKm}|${pins.map((p) => p.id + (p.fit ?? "")).join(",")}|${examples.length}`;
  useEffect(() => { api.current?.sync(); }, [sig]);

  return (
    <div className={`relative ${className ?? ""}`} role="img" aria-label={ariaLabel}>
      <div className="contours absolute inset-0 rounded-full opacity-40" aria-hidden />
      <div ref={host} className="absolute inset-0" />
      <div ref={labels} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        {!target && examples.map((e) => (
          <span key={e.label} className="absolute left-0 top-0 whitespace-nowrap pl-2 text-[11px] text-muted opacity-0 transition-opacity" style={{ marginTop: -7 }}>{e.label}</span>
        ))}
      </div>
    </div>
  );
}
