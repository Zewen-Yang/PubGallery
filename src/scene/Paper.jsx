import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { easing } from 'maath';
import * as THREE from 'three';
import { useStore, anim } from '../store.js';
import { FONT } from './fonts.js';
import { displaySlots } from './display.js';
import { focusOf } from '../lib/collab.js';
import { starObjects } from './registry.js';

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = THREE.MathUtils.lerp;

const GOLD = new THREE.MeshStandardMaterial({ color: '#c9a23f', metalness: 0.9, roughness: 0.3 });
const GOLD_FLAT = new THREE.MeshBasicMaterial({ color: '#b8974a' });
const PAGES = new THREE.MeshStandardMaterial({ color: '#c9bc9e', roughness: 0.95 });
const Y = new THREE.Vector3(0, 1, 0);
const COVER_TO_CAMERA = new THREE.Quaternion().setFromAxisAngle(Y, -Math.PI / 2);
const tmpQ = new THREE.Quaternion();
const spinQ = new THREE.Quaternion();
const fwd = new THREE.Vector3();
const tmp = new THREE.Vector3();

function titleSize(n) {
  if (n <= 42) return 0.106;
  if (n <= 70) return 0.09;
  if (n <= 105) return 0.077;
  if (n <= 118) return 0.068;
  return 0.061;
}

function byline(authors) {
  const last = authors.map((a) => a.name.split(' ').pop());
  return last.length <= 3 ? last.join(' · ') : `${last.slice(0, 2).join(' · ')} et al.`;
}

// The front cover: venue + year, the full title, and the authors, inside a thin gilt frame.
function Cover({ p, w, h, d }) {
  const m = 0.04; // frame inset
  const pad = 0.075; // text inset
  const fw = d - m * 2;
  const fh = h - m * 2;
  const line = 0.006;
  const abbr = (p.abbr || (p.isJournal ? 'Journal' : 'Conference')).toUpperCase();
  const abbrSize = abbr.length > 15 ? 0.036 : abbr.length > 9 ? 0.043 : 0.056;
  return (
    <group position={[w / 2 + 0.003, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
      {/* gilt frame */}
      <mesh material={GOLD_FLAT} position={[0, fh / 2, 0]}>
        <planeGeometry args={[fw, line]} />
      </mesh>
      <mesh material={GOLD_FLAT} position={[0, -fh / 2, 0]}>
        <planeGeometry args={[fw, line]} />
      </mesh>
      <mesh material={GOLD_FLAT} position={[-fw / 2, 0, 0]}>
        <planeGeometry args={[line, fh]} />
      </mesh>
      <mesh material={GOLD_FLAT} position={[fw / 2, 0, 0]}>
        <planeGeometry args={[line, fh]} />
      </mesh>

      <Text font={FONT} position={[-d / 2 + pad, h / 2 - 0.135, 0]} fontSize={abbrSize} letterSpacing={abbr.length > 9 ? 0.06 : 0.14} anchorX="left" anchorY="middle" color="#d2ae58">
        {abbr}
      </Text>
      <Text font={FONT} position={[d / 2 - pad, h / 2 - 0.135, 0]} fontSize={0.054} letterSpacing={0.04} anchorX="right" anchorY="middle" color="#d2ae58">
        {String(p.year)}
      </Text>
      <mesh material={GOLD_FLAT} position={[0, h / 2 - 0.195, 0]}>
        <planeGeometry args={[d - pad * 2, 0.004]} />
      </mesh>

      <Text
        font={FONT}
        position={[-d / 2 + pad, h / 2 - 0.24, 0]}
        fontSize={titleSize(p.title.length)}
        maxWidth={d - pad * 2}
        lineHeight={1.1}
        textAlign="left"
        anchorX="left"
        anchorY="top"
        color="#f4e8c8"
        overflowWrap="break-word"
      >
        {p.title}
      </Text>

      <Text font={FONT} position={[-d / 2 + pad, -h / 2 + 0.125, 0]} fontSize={0.05} maxWidth={d - pad * 2 - 0.08} anchorX="left" anchorY="middle" color="#c5b58e">
        {byline(p.authors)}
      </Text>
      {p.selected && (
        <Text font={FONT} position={[d / 2 - pad, -h / 2 + 0.125, 0]} fontSize={0.06} anchorX="right" anchorY="middle" color="#d2ae58">
          ★
        </Text>
      )}
    </group>
  );
}

export function Paper({ p, order }) {
  const group = useRef();
  const book = useRef();
  const star = useRef();
  const halo = useRef();
  const emph = useRef({ v: 1 });
  const pull = useRef({ v: 0 });
  const sel = useRef({ v: 0 });
  const dsp = useRef({ v: 0 });
  // `p` is one book (one placement of a paper); `p.key` is the paper. Hover and selection are per
  // paper, so only the copy on the shelf in front of you (or the home copy on the star map) reacts.
  const isHovered = useStore(
    (s) => s.hovered === p.key && (s.mode === 'map' ? p.home : s.focus === p.bookcase && s.shelf === p.shelf),
  );
  const isSelected = useStore((s) => s.selected === p.key && s.focus === p.bookcase && s.shelf === p.shelf);
  const mode = useStore((s) => s.mode);
  const focused = useStore((s) => s.focus === p.bookcase);
  const onDisplay = useStore((s) => s.mode === 'library' && s.focus === p.bookcase && s.shelf === p.shelf);
  const anySelected = useStore((s) => !!s.selected);
  const hover = useStore((s) => s.hover);
  const select = useStore((s) => s.select);
  const setShelf = useStore((s) => s.setShelf);
  const openFromMap = useStore((s) => s.openFromMap);

  const [w, h, d] = p.size;
  const shelfQ = useMemo(() => new THREE.Quaternion().setFromAxisAngle(Y, p.yaw), [p.yaw]);
  const displayQ = useMemo(() => shelfQ.clone().multiply(COVER_TO_CAMERA), [shelfQ]);
  const leather = useMemo(
    () => new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.62, metalness: 0.05 }),
    [p.color],
  );
  const starColor = useMemo(() => new THREE.Color(p.starColor).multiplyScalar(2.6), [p.starColor]);
  // Box face order: +x (front cover), -x (back cover), +y, -y, +z (spine), -z (fore-edge)
  const materials = useMemo(() => [leather, leather, PAGES, PAGES, leather, PAGES], [leather]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = ease(clamp01((anim.map - order * 0.35) / 0.65));
    const cam = state.camera;

    easing.damp(pull.current, 'v', isHovered && mode === 'library' && !isSelected ? 1 : 0, 0.12, dt);
    easing.damp(sel.current, 'v', isSelected ? 1 : 0, 0.32, dt);
    easing.damp(dsp.current, 'v', onDisplay ? 1 : 0, 0.26 + p.shelfIndex * 0.022, dt);
    const s = sel.current.v;
    const k = dsp.current.v;
    const pv = pull.current.v;

    // 1. On the shelf → 2. cover-out on display in front of the bookcase.
    let x = p.shelfPos[0];
    let y = p.shelfPos[1];
    let z = p.shelfPos[2];
    let scale = 1;
    if (k > 0.0005) {
      const slot = displaySlots(p.bookcase, p.shelf, state.size.width / state.size.height)[p.id];
      if (slot) {
        const lift = Math.sin(Math.PI * k) * 0.5;
        x = lerp(x, slot.pos[0], k) + p.normal[0] * lift;
        y = lerp(y, slot.pos[1], k);
        z = lerp(z, slot.pos[2], k) + p.normal[2] * lift;
        scale = lerp(1, slot.scale, k);
      }
    }
    // Hover: come a little towards the viewer.
    const reach = pv * lerp(0.32, 0.3 * scale, k);
    x += p.normal[0] * reach;
    z += p.normal[2] * reach;
    scale *= 1 + pv * 0.035 * k;

    // 3. Selected: fly to the camera.
    fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    tmp.copy(cam.position).addScaledVector(fwd, 3.1);
    x = lerp(x, tmp.x, s);
    y = lerp(y, tmp.y, s);
    z = lerp(z, tmp.z, s);
    scale = lerp(scale, 1, s);

    // 4. Library → star map around the globe.
    const sp = p.starPos;
    g.position.set(lerp(x, sp[0], t), lerp(y, sp[1], t) + Math.sin(Math.PI * t) * 1.4, lerp(z, sp[2], t));
    g.quaternion.copy(shelfQ).slerp(displayQ, k);
    tmpQ.copy(cam.quaternion).multiply(COVER_TO_CAMERA);
    g.quaternion.slerp(tmpQ, s);
    if (t > 0) g.quaternion.multiply(spinQ.setFromAxisAngle(Y, t * 2.4));

    const time = state.clock.elapsedTime;
    if (book.current) {
      const bs = Math.max((1 - smooth(0.2, 0.7, t)) * scale, 0.0001);
      book.current.scale.setScalar(bs);
      book.current.visible = bs > 0.002;
      book.current.rotation.z = pv * -0.04 * (1 - k) + Math.sin(time * 1.3) * 0.025 * s;
      book.current.rotation.x = Math.sin(time * 0.9) * 0.03 * s;
      book.current.rotation.y = pv * 0.12 * k * (1 - s);
    }
    if (star.current && p.home) {
      // Brighter when the globe points at this paper (hovered city / pinned country), dimmer otherwise.
      const f = mode === 'map' ? focusOf(useStore.getState()) : null;
      easing.damp(emph.current, 'v', f ? (f.paper(p.key) ? 1.9 : 0.45) : 1, 0.15, dt);
      const twinkle = 1 + Math.sin(time * 2 + order * 40) * 0.12;
      const ss = smooth(0.45, 1, t) * p.starSize * twinkle * emph.current.v * (isHovered ? 1.3 : 1);
      star.current.scale.setScalar(Math.max(ss, 0.0001));
      star.current.visible = ss > 0.001;
      halo.current.visible = ss > 0.001;
    }
  });

  const onOver = (e) => {
    e.stopPropagation();
    hover(p.key);
  };
  const onOut = () => {
    if (useStore.getState().hovered === p.key) hover(null);
  };

  const canOpen = onDisplay && !anySelected;
  // A spine still on the shelf: clicking it brings its whole shelf out on display.
  const canSummon = mode === 'library' && focused && !onDisplay && !anySelected;
  const starActive = mode === 'map' && p.home;
  const spineFont = Math.min(w * 0.4, 0.056);

  return (
    <group ref={group} position={p.shelfPos}>
      <group ref={book}>
        <mesh
          material={materials}
          castShadow
          receiveShadow
          onPointerOver={canOpen ? onOver : undefined}
          onPointerOut={canOpen ? onOut : undefined}
          onClick={
            canOpen
              ? (e) => {
                  e.stopPropagation();
                  select(p.key, { bookcase: p.bookcase, shelf: p.shelf });
                }
              : canSummon
                ? (e) => {
                    e.stopPropagation();
                    setShelf(p.shelf);
                  }
                : undefined
          }
        >
          <boxGeometry args={[w, h, d]} />
        </mesh>
        {/* spine */}
        <Text
          font={FONT}
          position={[0, 0.05, d / 2 + 0.002]}
          rotation={[0, 0, -Math.PI / 2]}
          fontSize={spineFont}
          maxWidth={h * 0.76}
          anchorX="center"
          anchorY="middle"
          whiteSpace="nowrap"
          color="#ead9b0"
        >
          {p.spine}
        </Text>
        <Text
          font={FONT}
          position={[0, -h / 2 + 0.075, d / 2 + 0.002]}
          fontSize={Math.min(w * 0.3, 0.042)}
          anchorX="center"
          anchorY="middle"
          color="#ead9b0"
        >
          {`'${String(p.year).slice(2)}`}
        </Text>
        {p.selected && (
          <>
            <mesh material={GOLD} position={[0, h / 2 - 0.07, d / 2 + 0.001]}>
              <boxGeometry args={[w + 0.004, 0.022, 0.004]} />
            </mesh>
            <mesh material={GOLD} position={[0, -h / 2 + 0.135, d / 2 + 0.001]}>
              <boxGeometry args={[w + 0.004, 0.012, 0.004]} />
            </mesh>
          </>
        )}
        <Cover p={p} w={w} h={h} d={d} />
      </group>

      {/* star */}
      <mesh
        ref={(el) => {
          star.current = el;
          if (p.home) starObjects[p.key] = el;
        }}
        visible={false}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshBasicMaterial color={starColor} toneMapped={false} />
      </mesh>
      <mesh
        ref={halo}
        visible={false}
        onPointerOver={starActive ? onOver : undefined}
        onPointerOut={starActive ? onOut : undefined}
        onClick={
          starActive
            ? (e) => {
                e.stopPropagation();
                openFromMap(p.key);
              }
            : undefined
        }
      >
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

    </group>
  );
}
