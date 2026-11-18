import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import { Billboard, Text } from '@react-three/drei';
import { PAPERS, BOOKS, LINKS, BOOKCASES, CASE_BY_ID, MAP_CENTER } from '../lib/papers.js';
import { PAPER_SITES, SITE_PAPERS, focusOf } from '../lib/collab.js';
import { starObjects, siteObjects } from './registry.js';
import { FONT } from './fonts.js';
import { useStore, anim, IDLE_SPIN, LIB_YAW_MAX } from '../store.js';
import { Library } from './Library.jsx';
import { Paper } from './Paper.jsx';
import { Globe, GLOBE_R, GLOBE_CENTER } from './Globe.jsx';
import { FOV, TAN, focusPose, displaySlots } from './display.js';

const LIB_BG = new THREE.Color('#0d0907');
const MAP_BG = new THREE.Color('#03040b');
const OVERVIEW_LOOK = new THREE.Vector3(0, 2.7, -5.4);

// Drives the shared animation values: library↔map progress, world rotation, background and fog.
function Director() {
  const mode = useStore((s) => s.mode);
  const drag = useRef({ down: false, x: 0 });
  const { gl, scene, camera } = useThree();
  const first = useRef(true);

  useEffect(() => {
    const el = gl.domElement;
    const down = (e) => {
      drag.current = { down: true, x: e.clientX, y: e.clientY, x0: e.clientX };
      anim.libDragged = false;
    };
    const move = (e) => {
      if (!drag.current.down) return;
      const s = useStore.getState();
      // Room overview: sideways drags turn the view around the room.
      if (s.mode === 'library' && !s.focus && !s.selected && !s.listOpen) {
        if (Math.abs(e.clientX - drag.current.x0) > 6) anim.libDragged = true;
        if (anim.libDragged) {
          const k = 2.4 / Math.max(600, window.innerWidth);
          anim.libYawGoal = THREE.MathUtils.clamp(anim.libYawGoal + (e.clientX - drag.current.x) * k, -LIB_YAW_MAX, LIB_YAW_MAX);
        }
        drag.current.x = e.clientX;
        drag.current.y = e.clientY;
        return;
      }
      if (s.mode !== 'map') return;
      anim.dragV += (e.clientX - drag.current.x) * 0.0006;
      anim.dragVy += (e.clientY - drag.current.y) * 0.0006;
      drag.current.x = e.clientX;
      drag.current.y = e.clientY;
    };
    const up = () => (drag.current.down = false);
    // Wheel (or pinch) moves in on the globe and back out to the whole map.
    const wheel = (e) => {
      if (useStore.getState().mode !== 'map') return;
      e.preventDefault();
      anim.zoomGoal = THREE.MathUtils.clamp(anim.zoomGoal - e.deltaY * 0.0014, 0, 1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    // Pinning a country moves in on it; closing the panel moves back out.
    const unsub = useStore.subscribe((s, prev) => {
      if (s.country !== prev.country) anim.zoomGoal = s.country ? Math.max(anim.zoomGoal, 0.72) : 0;
    });
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      unsub();
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, [gl]);

  useFrame((_, dt) => {
    if (first.current) {
      first.current = false;
      useStore.getState().setReady();
    }
    const target = mode === 'map' ? 1 : 0;
    const step = dt / 1.6;
    anim.map = target > anim.map ? Math.min(target, anim.map + step) : Math.max(target, anim.map - step);
    if (mode !== 'map') anim.zoomGoal = 0;
    anim.zoom = THREE.MathUtils.damp(anim.zoom, anim.zoomGoal, 3.2, dt);

    if (mode === 'map') {
      // Sideways drags turn the star clusters and the globe; up/down drags tip the globe only.
      anim.dYaw = anim.dragV;
      anim.dPitch = anim.dragVy;
      anim.rotY += dt * IDLE_SPIN + anim.dragV;
      anim.dragV *= 0.92;
      anim.dragVy *= 0.92;
    } else {
      anim.dragV = anim.dragVy = anim.dYaw = anim.dPitch = 0;
      const goal = Math.round(anim.rotY / (Math.PI * 2)) * Math.PI * 2;
      anim.rotY = THREE.MathUtils.damp(anim.rotY, goal, 3, dt);
    }
    const m = Math.min(1, anim.map * 1.4);
    if (!scene.background) scene.background = LIB_BG.clone();
    scene.background.lerpColors(LIB_BG, MAP_BG, m);
    if (scene.fog) {
      scene.fog.color.copy(scene.background);
      // Fog scales with how far the camera stands from the room centre.
      const d = Math.max(camera.position.distanceTo(OVERVIEW_LOOK), 12);
      scene.fog.near = THREE.MathUtils.lerp(d * 0.95, 80, m);
      scene.fog.far = THREE.MathUtils.lerp(d * 2.4, 160, m);
    }
  });
  return null;
}

function CameraRig() {
  const look = useMemo(() => new THREE.Vector3(), []);
  const lookCur = useMemo(() => OVERVIEW_LOOK.clone(), []);
  const { camera, size } = useThree();
  useFrame((state, dt) => {
    const { mode, selected, focus, ready } = useStore.getState();
    const aspect = size.width / size.height;
    const tanV = TAN;
    const px = ready ? state.pointer.x : 0;
    const py = ready ? state.pointer.y : 0;
    const calm = selected ? 0.12 : 1;
    let pos;
    let smooth = 0.9;

    if (!ready) {
      pos = [0, 4.2, 22];
      look.copy(OVERVIEW_LOOK);
    } else if (mode === 'map') {
      const mapFit = Math.max(19, 16 / aspect);
      // A pinned country opens a panel on the left: slide the view so the globe sits beside it.
      const pinned = useStore.getState().country && aspect > 1.1;
      const z = anim.zoom;
      // Far: the whole map. Near: close on the side of the globe that faces the viewer.
      const nearD = GLOBE_R + 3.4;
      const offFar = pinned ? -Math.min(4.2, mapFit * TAN * aspect * 0.42) : 0;
      const offNear = pinned ? -3.4 * TAN * aspect * 0.42 : 0;
      const off = THREE.MathUtils.lerp(offFar, offNear, z);
      const sway = 1.2 * (1 - 0.85 * z);
      pos = [
        THREE.MathUtils.lerp(MAP_CENTER[0], GLOBE_CENTER[0], z) + off + px * sway,
        THREE.MathUtils.lerp(MAP_CENTER[1] + 1.6, GLOBE_CENTER[1] + 0.9, z) + py * sway,
        THREE.MathUtils.lerp(MAP_CENTER[2] + mapFit, GLOBE_CENTER[2] + nearD, z),
      ];
      look.set(
        THREE.MathUtils.lerp(MAP_CENTER[0], GLOBE_CENTER[0], z) + off,
        THREE.MathUtils.lerp(MAP_CENTER[1], GLOBE_CENTER[1] + 0.5, z),
        MAP_CENTER[2],
      );
      smooth = 0.5;
    } else if (focus) {
      const bc = CASE_BY_ID[focus];
      const pose = focusPose(bc, aspect);
      pos = [
        pose.pos[0] + bc.right[0] * px * 0.3 * calm,
        pose.pos[1] + py * 0.2 * calm,
        pose.pos[2] + bc.right[2] * px * 0.3 * calm,
      ];
      look.set(...pose.look);
      smooth = 0.75;
    } else {
      const half = 8.7;
      // Portrait screens can't fit the whole arc; show the middle and let the index do the rest.
      const dist = Math.min(Math.max(4.6 / tanV, half / (tanV * aspect)), 24);
      // Turned by dragging: the camera swings around the room centre (the origin), so the
      // bookcases at either end of the arc can be brought to the middle of the screen.
      anim.libYaw = THREE.MathUtils.damp(anim.libYaw, anim.libYawGoal, 4, dt);
      const c = Math.cos(anim.libYaw), s = Math.sin(anim.libYaw);
      const turn = (x, z) => [x * c + z * s, -x * s + z * c];
      const [cx, cz] = turn(px * 0.6, OVERVIEW_LOOK.z + dist);
      const [lx, lz] = turn(OVERVIEW_LOOK.x, OVERVIEW_LOOK.z);
      pos = [cx, 3.4 + py * 0.3, cz];
      look.set(lx, OVERVIEW_LOOK.y, lz);
    }
    easing.damp3(camera.position, pos, smooth, dt);
    easing.damp3(lookCur, look, smooth * 0.8, dt);
    camera.lookAt(lookCur);
  });
  return null;
}

// Everything lives in here; on the star map it turns (with the globe) around the map centre.
function World({ children }) {
  const outer = useRef();
  const inner = useRef();
  useFrame(() => {
    const c = MAP_CENTER;
    outer.current.position.set(c[0], 0, c[2]);
    outer.current.rotation.y = anim.rotY;
    inner.current.position.set(-c[0], 0, -c[2]);
  });
  return (
    <group ref={outer}>
      <group ref={inner}>{children}</group>
    </group>
  );
}

// Faint lines between papers that share co-authors.
function Links() {
  const ref = useRef();
  const geom = useMemo(() => {
    const pos = new Float32Array(LINKS.length * 6);
    LINKS.forEach((l, i) => {
      pos.set(PAPERS[l.a].starPos, i * 6);
      pos.set(PAPERS[l.b].starPos, i * 6 + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame(() => {
    const o = THREE.MathUtils.smoothstep(anim.map, 0.85, 1);
    const f = focusOf(useStore.getState());
    ref.current.material.opacity = o * (f ? 0.04 : 0.09);
    ref.current.visible = o > 0.01;
  });
  return (
    <lineSegments ref={ref} geometry={geom}>
      <lineBasicMaterial color="#a9c1ff" transparent opacity={0} depthWrite={false} />
    </lineSegments>
  );
}

function ClusterLabels() {
  const refs = useRef([]);
  useFrame(() => {
    const o = THREE.MathUtils.smoothstep(anim.map, 0.8, 1);
    refs.current.forEach((t) => {
      if (!t) return;
      t.fillOpacity = o;
      t.visible = o > 0.01;
    });
  });
  return BOOKCASES.map((bc, i) => (
    <Billboard key={bc.id} position={[bc.starCenter[0], bc.starCenter[1] + bc.starRadius * 0.8 + 0.5, bc.starCenter[2]]}>
      <Text ref={(el) => (refs.current[i] = el)} font={FONT} fontSize={0.32} letterSpacing={0.08} color={bc.star} anchorX="center" anchorY="middle">
        {bc.name}
      </Text>
    </Billboard>
  ));
}

// Threads from paper stars down to the cities they were written with: for the hovered star, or
// for every paper of the hovered city / pinned country.
const MAX_THREADS = 400;
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
function Threads() {
  const ref = useRef();
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_THREADS * 6), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAX_THREADS * 6), 3));
    return g;
  }, []);
  useFrame((state, dt) => {
    const st = useStore.getState();
    const o = THREE.MathUtils.smoothstep(anim.map, 0.9, 1);
    const pairs = [];
    if (st.mode === 'map' && o > 0.01) {
      if (st.hoveredSite) SITE_PAPERS[st.hoveredSite].forEach((id) => pairs.push([id, st.hoveredSite]));
      else if (st.hovered) (PAPER_SITES[st.hovered] || []).forEach((sid) => pairs.push([st.hovered, sid]));
    }
    const pos = geom.attributes.position.array;
    const col = geom.attributes.color.array;
    let n = 0;
    for (const [id, sid] of pairs) {
      const a = starObjects[id];
      const b = siteObjects[sid];
      if (!a || !b || n >= MAX_THREADS) continue;
      a.getWorldPosition(_a);
      b.getWorldPosition(_b);
      pos.set([_a.x, _a.y, _a.z, _b.x, _b.y, _b.z], n * 6);
      // Bright at the star, fading towards the city.
      col.set([1.5, 1.5, 1.6, 0.35, 0.35, 0.4], n * 6);
      n++;
    }
    geom.setDrawRange(0, n * 2);
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
    ref.current.visible = n > 0;
    ref.current.material.opacity = THREE.MathUtils.damp(ref.current.material.opacity, n ? o * 0.7 : 0, 8, dt);
  });
  return (
    <lineSegments ref={ref} geometry={geom} frustumCulled={false}>
      <lineBasicMaterial vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </lineSegments>
  );
}

function StarDust() {
  const ref = useRef();
  const geom = useMemo(() => {
    const n = 1800;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 25 + Math.random() * 40;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return g;
  }, []);
  useFrame((_, dt) => {
    const o = THREE.MathUtils.smoothstep(anim.map, 0.3, 1);
    ref.current.material.opacity = o * 0.85;
    ref.current.visible = o > 0.01;
    ref.current.rotation.y += dt * 0.004;
  });
  return (
    <points ref={ref} geometry={geom} position={MAP_CENTER}>
      <pointsMaterial size={0.12} color="#cfd8ff" transparent opacity={0} depthWrite={false} sizeAttenuation fog={false} />
    </points>
  );
}

function Ambient() {
  const amb = useRef();
  const hemi = useRef();
  useFrame((_, dt) => {
    const k = 1 - Math.min(1, anim.map * 1.5);
    const f = useStore.getState().focus ? 0.45 : 1;
    amb.current.intensity = THREE.MathUtils.damp(amb.current.intensity, (0.08 + 0.18 * k) * f, 3, dt);
    hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, 0.35 * k * f, 3, dt);
  });
  return (
    <>
      <ambientLight ref={amb} color="#ffd9b0" intensity={0.3} />
      <hemisphereLight ref={hemi} args={['#5a6a8a', '#2a1a10', 0.35]} />
    </>
  );
}

// A soft light from behind the viewer that falls on the covers laid out on display.
function DisplayLight() {
  const light = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  const { size } = useThree();
  useFrame((_, dt) => {
    const { focus, shelf, mode } = useStore.getState();
    const on = mode === 'library' && focus && shelf;
    if (on) {
      const bc = CASE_BY_ID[focus];
      const aspect = size.width / size.height;
      const pose = focusPose(bc, aspect);
      const c = displaySlots(focus, shelf, aspect).__center;
      light.current.position.set(pose.pos[0], pose.pos[1] + 2.2, pose.pos[2]);
      target.position.set(c[0], c[1], c[2]);
    }
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, on ? 125 : 0, 3, dt);
  });
  return (
    <>
      <primitive object={target} />
      <spotLight ref={light} target={target} angle={0.85} penumbra={0.9} intensity={0} decay={1.6} distance={30} color="#ffe6c4" />
    </>
  );
}

export function Experience() {
  // Order 0..1 for the staggered fly-out: bookcase by bookcase, shelf by shelf.
  const orders = useMemo(() => {
    const idx = (p) => {
      const bc = CASE_BY_ID[p.bookcase];
      return bc.index * 1000 + bc.shelves.findIndex((s) => s.id === p.shelf) * 100 + p.shelfIndex;
    };
    const sorted = [...BOOKS].sort((a, b) => idx(a) - idx(b));
    return Object.fromEntries(sorted.map((p, i) => [p.id, i / (sorted.length - 1)]));
  }, []);

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [0, 4.2, 22], near: 0.1, far: 200 }}
      gl={{ antialias: true }}
      onPointerMissed={() => useStore.setState({ hovered: null, hoveredCase: null })}
    >
      <fog attach="fog" args={['#0d0907', 13, 32]} />
      <Director />
      <CameraRig />
      <Ambient />
      <World>
        <Library />
        {BOOKS.map((b) => (
          <Paper key={b.id} p={b} order={orders[b.id]} />
        ))}
        <Links />
        <ClusterLabels />
        <DisplayLight />
      </World>
      <Globe />
      <Threads />
      <StarDust />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={1.0} radius={0.7} />
        <Vignette offset={0.22} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
