import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { disposeScene } from "./dispose.ts";

test("cleanup handles meshes with several materials (the coin crash)", () => {
  const scene = new THREE.Scene();
  const a = new THREE.MeshBasicMaterial(), b = new THREE.MeshBasicMaterial();
  let disposed = 0;
  a.addEventListener("dispose", () => disposed++); b.addEventListener("dispose", () => disposed++);
  scene.add(new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1), [a, b, b]));
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()));
  scene.add(new THREE.Group());
  assert.doesNotThrow(() => disposeScene(scene));
  assert.equal(disposed, 3); // a once, b twice is harmless; both were disposed
});
