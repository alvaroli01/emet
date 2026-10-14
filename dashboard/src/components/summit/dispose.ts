import * as THREE from "three";

/**
 * Free a three.js scene's GPU memory when a 3D view leaves the page. Meshes can have one material or an array of
 * them (e.g. a coin: edge + two faces) — both are handled. Never throws: a failed cleanup must not crash the page.
 */
export function disposeScene(root: THREE.Object3D) {
  root.traverse((o) => {
    try {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
      for (const mat of mats) {
        for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
        mat.dispose?.();
      }
    } catch { /* keep cleaning the rest */ }
  });
}
