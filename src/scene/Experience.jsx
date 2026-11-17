import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { easing } from 'maath';
import * as THREE from 'three';
import { BOOKS, BOOKCASES, CASE_BY_ID, MAP_CENTER } from '../lib/papers.js';
import { useStore, anim } from '../store.js';
import { Library } from './Library.jsx';
import { Paper } from './Paper.jsx';
import { Globe } from './Globe.jsx';
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
    const down = (e) => (drag.current = { down: true, x: e.clientX });
    const move = (e) => {
      if (!drag.current.down || useStore.getState().mode !== 'map') return;
      anim.dragV += (e.clientX - drag.current.x) * 0.0006;
      drag.current.x = e.clientX;
    };
    const up = () => (drag.current.down = false);
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
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

    if (mode === 'map') {
      anim.rotY += dt * 0.05 + anim.dragV;
      anim.dragV *= 0.92;
    } else {
      anim.dragV = 0;
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
      const mapFit = Math.max(17, 15 / aspect);
      // A pinned country opens a panel on the left: slide the view so the globe sits beside it.
      const off = useStore.getState().country && aspect > 1.1 ? -Math.min(4.2, mapFit * TAN * aspect * 0.42) : 0;
      pos = [MAP_CENTER[0] + off + px * 1.2, MAP_CENTER[1] + 1.6 + py * 1.2, MAP_CENTER[2] + mapFit];
      look.set(MAP_CENTER[0] + off, MAP_CENTER[1], MAP_CENTER[2]);
      smooth = 1.1;
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
      pos = [px * 0.6, 3.4 + py * 0.3, OVERVIEW_LOOK.z + dist];
      look.copy(OVERVIEW_LOOK);
    }
    easing.damp3(camera.position, pos, smooth, dt);
    easing.damp3(lookCur, look, smooth * 0.8, dt);
    camera.lookAt(lookCur);
  });
  return null;
}

// The library lives in here; on the globe view it turns with the globe.
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
        <DisplayLight />
      </World>
      <Globe />
      <StarDust />
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={1.0} radius={0.7} />
        <Vignette offset={0.22} darkness={0.8} />
      </EffectComposer>
    </Canvas>
  );
}
