"use client";
import * as React from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { COLOR, SIZES } from "./config";
import { SPIKE_ABOVE, SAUCER_SEAT, type State } from "./design";
import { POS } from "./export3mf";

type Props = { geos: Record<string, THREE.BufferGeometry> | null; state: State; explode: number; highlight: string | null };
const GAP = 70;

export function PoleScene({ geos, state, explode, highlight }: Props) {
  const host = React.useRef<HTMLDivElement>(null);
  const ctx = React.useRef<any>(null);

  React.useEffect(() => {
    const el = host.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    el.appendChild(renderer.domElement); renderer.domElement.style.touchAction = "none";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 5, 30000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.08;
    controls.autoRotate = !matchMedia("(prefers-reduced-motion: reduce)").matches; controls.autoRotateSpeed = 0.6;
    controls.addEventListener("start", () => (controls.autoRotate = false));
    scene.add(new THREE.HemisphereLight(0xf2f6ee, 0x3b4a36, 2.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(400, 900, 600); scene.add(sun);
    const fill = new THREE.DirectionalLight(0xffffff, 0.9); fill.position.set(-600, 200, -500); scene.add(fill);
    const world = new THREE.Group(); world.rotation.x = -Math.PI / 2; scene.add(world);   // parts are modelled Z-up in mm
    const pole = new THREE.Group(); world.add(pole);                                    // pole-local frame: z = 0 at the first joint
    const mats: Record<string, THREE.MeshStandardMaterial> = {};
    const matFor = (id: string) => {
      if (mats[id]) return mats[id];
      const c = COLOR[id], hex = c.hex.toLowerCase() === "#000000" ? "#141414" : c.hex;   // keep black readable as a shape
      const m = c.finish === "translucent"
        ? new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0, flatShading: true, transparent: true, opacity: 0.88 })
        : new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, flatShading: true });
      m.color.set(hex); return (mats[id] = m);
    };
    const resize = () => {
      const r = el.getBoundingClientRect();
      renderer.setSize(r.width, r.height, false); renderer.domElement.style.width = "100%"; renderer.domElement.style.height = "100%";
      camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize); ro.observe(el); resize();
    let raf = 0; const loop = () => { controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop); }; loop();
    ctx.current = { renderer, scene, camera, controls, world, pole, matFor, parts: [] as any[], framed: "" };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); controls.dispose(); renderer.dispose(); el.removeChild(renderer.domElement); };
  }, []);

  // rebuild when the design changes
  React.useEffect(() => {
    const c = ctx.current; if (!c || !geos) return;
    for (const p of c.parts) p.parent.remove(p.mesh);
    c.parts = [];
    const place = (parent: THREE.Group, key: string, geo: string, color: string, z: number, dir: number[], rotZ = 0) => {
      if (!geos[geo]) return;
      const mesh = new THREE.Mesh(geos[geo], c.matFor(color)); mesh.rotation.z = rotZ;
      if (COLOR[color].finish === "translucent") mesh.renderOrder = 2;
      parent.add(mesh); c.parts.push({ key, mesh, parent, color, base: [0, 0, z], dir });
    };
    const S = SIZES[state.size], s = state;
    // where the pole stands
    if (s.base === "pot") {
      // the pot is turned so its socket tower is at the back and the panel side faces the viewer
      const R = S.pot[0] / 2, H = S.pot[1], ty = -(R - 1.6) + S.D + 2.5;   // same placement as the pot's socket tower
      c.pole.position.set(0, -ty, H); c.pole.rotation.z = 0;
      place(c.world, "base", "pot", s.baseColor, 0, [0, 0, 0], Math.PI);
      place(c.world, "saucer", "saucer", s.saucerColor, -SAUCER_SEAT, [0, 0, -40]);   // the pot's foot rests on the saucer rim seat
    } else if (s.base === "spike") {
      c.pole.position.set(0, 0, 170 + SPIKE_ABOVE); c.pole.rotation.z = 0;
      place(c.world, "base", "spike", s.baseColor, 0, [0, 0, -60]);
    } else {
      c.pole.position.set(0, 0, POS.baseShell + POS.floor); c.pole.rotation.z = 0;
      place(c.pole, "base", "base", s.baseColor, -(POS.baseShell + POS.floor), [0, 0, 0]);
    }
    let joint = 0;
    s.sections.forEach((h, i) => { place(c.pole, "sec" + i, "pole_" + h, s.sectionColors[i], joint - POS.collar, [0, 0, (i + 1) * GAP]); joint += h; });
    const cupZ = joint - 100 - POS.cupSeat, up = (s.sections.length + 1) * GAP + 90;
    if (s.cup) {
      place(c.pole, "cup", "cup", s.cupColor, cupZ, [0, 0, up]);
      place(c.pole, "cup", "cup_lid", s.cupColor, cupZ + POS.lidAbove, [0, 0, up + 40]);
      place(c.pole, "cup", "valve_stem", s.cupColor, cupZ + POS.stemAbove, [0, 0, up + 70]);
      place(c.pole, "knob", "valve_knob", s.knobColor, cupZ + POS.knobAbove, [0, 0, up + 100]);
    }
    let z = (s.base === "none" ? -POS.baseShell : 0) + POS.panelGap;
    s.panels.forEach((p, i) => { place(c.pole, "pan" + i, `panel_${p.size}_${p.pat}`, p.color, z, [0, -90, i * 30 + z * 0.25]); z += p.size; });
    // frame the camera when size, base or height changes
    const top = c.pole.position.z + joint + 30, key = `${s.size}|${s.base}|${top}`;
    if (key !== c.framed) {
      c.framed = key;
      const w = s.base === "pot" ? S.pot[0] : S.W;
      const target = new THREE.Vector3(0, top * 0.48, -20), dist = Math.max(560, top * 2.5, w * 3.2);
      const dir = c.camera.position.clone().sub(c.controls.target);
      if (dir.lengthSq() < 1) dir.set(0.55, 0.3, 1);
      dir.normalize().multiplyScalar(dist);
      c.controls.target.copy(target); c.camera.position.copy(target).add(dir); c.controls.update();
    }
  }, [geos, state]);

  React.useEffect(() => {
    const c = ctx.current; if (!c) return;
    for (const p of c.parts) {
      p.mesh.position.set(p.base[0] + p.dir[0] * explode, p.base[1] + p.dir[1] * explode, p.base[2] + p.dir[2] * explode);
      if (p.key === highlight) { const m = c.matFor(p.color).clone(); m.emissive = new THREE.Color(0xd9c25a); m.emissiveIntensity = 0.4; p.mesh.material = m; }
      else p.mesh.material = c.matFor(p.color);
    }
  }, [explode, highlight, geos, state]);

  return <div ref={host} className="absolute inset-0" aria-label="3D preview of your moss pole. Drag to rotate, scroll or pinch to zoom." role="img" />;
}
