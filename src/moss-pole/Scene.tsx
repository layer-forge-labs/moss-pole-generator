"use client";
import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { COLOR } from "./config";
import type { State } from "./design";

type Props = { geos: Record<string, THREE.BufferGeometry> | null; state: State; explode: number; highlight: string | null };
const FLOOR = 2.4, COLLAR = 22, GAP = 70;

export function PoleScene({ geos, state, explode, highlight }: Props) {
  const host = React.useRef<HTMLDivElement>(null);
  const ctx = React.useRef<any>(null);

  // one-time three.js setup
  React.useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 5, 20000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches; controls.autoRotateSpeed = 0.6;
    controls.addEventListener("start", () => (controls.autoRotate = false));
    scene.add(new THREE.HemisphereLight(0xf2f6ee, 0x3b4a36, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(400, 900, 600); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(-600, 200, -500); scene.add(fill);
    const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; scene.add(world);   // parts are modelled Z-up in mm
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    const matFor = (id: string) => {
      if (mats[id]) return mats[id];
      const c = COLOR[id];
      const hex = c.hex.toLowerCase() === "#000000" ? "#141414" : c.hex;   // keep black readable as a shape
      const m = c.finish === "translucent"
        ? new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, flatShading: true, transparent: true, opacity: 0.88 })
        : new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, flatShading: true });
      m.color.set(hex);
      return (mats[id] = m);
    };
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
      camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    ctx.current = { renderer, scene, camera, controls, world, matFor, parts: [] as any[], framedH: 0 };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);

  // rebuild the pole when the design changes
  React.useEffect(() => {
    const c = ctx.current; if (!c || !geos) return;
    for (const p of c.parts) c.world.remove(p.mesh);
    c.parts = [];
    const place = (key: string, geo: string, color: string, z: number, dir: number[]) => {
      const mesh = new THREE.Mesh(geos[geo], c.matFor(color));
      if (COLOR[color].finish === "translucent") mesh.renderOrder = 2;
      c.world.add(mesh); c.parts.push({ key, mesh, color, base: [0, 0, z], dir });
    };
    place("base", "base", state.baseColor, 0, [0, 0, 0]);
    let joint = 200 + FLOOR;
    state.sections.forEach((h, i) => { place("sec" + i, "pole_" + h, state.sectionColors[i], joint - COLLAR, [0, 0, (i + 1) * GAP]); joint += h; });
    const topJoint = joint - 100;   // the top section is always 10 cm
    if (state.cup) place("cup", "cup", state.cupColor, topJoint - 5.75, [0, 0, (state.sections.length + 1) * GAP + 90]);
    let z = FLOOR + 0.15;
    state.panels.forEach((p, i) => { place("pan" + i, `panel_${p.size}_${p.pat}`, p.color, z, [0, -90, i * 30 + z * 0.25]); z += p.size; });
    // frame the camera when the height changes
    const H = 202.4 + state.sections.reduce((a, b) => a + b, 0);
    if (Math.abs(H - c.framedH) > 1) {
      c.framedH = H;
      const target = new THREE.Vector3(0, H * 0.48, -28), dist = Math.max(620, H * 2.75);
      const dir = c.camera.position.clone().sub(c.controls.target);
      if (dir.lengthSq() < 1) dir.set(0.55, 0.28, 1);
      dir.normalize().multiplyScalar(dist);
      c.controls.target.copy(target); c.camera.position.copy(target).add(dir); c.controls.update();
    }
  }, [geos, state]);

  // explode + highlight
  React.useEffect(() => {
    const c = ctx.current; if (!c) return;
    for (const p of c.parts) {
      p.mesh.position.set(p.base[0] + p.dir[0] * explode, p.base[1] + p.dir[1] * explode, p.base[2] + p.dir[2] * explode);
      if (p.key === highlight) {
        const m = c.matFor(p.color).clone(); m.emissive = new THREE.Color(0xd9c25a); m.emissiveIntensity = 0.4; p.mesh.material = m;
      } else p.mesh.material = c.matFor(p.color);
    }
  }, [explode, highlight, geos, state]);

  return <div ref={host} className="absolute inset-0" aria-label="3D preview of your moss pole. Drag to rotate, scroll or pinch to zoom." role="img" />;
}
