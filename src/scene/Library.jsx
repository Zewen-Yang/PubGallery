import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, MeshReflectorMaterial, Sparkles } from '@react-three/drei';
import * as THREE from 'three';
import { BOOKCASES, CASE, boardY, rand } from '../lib/papers.js';
import { useStore, anim } from '../store.js';
import { FONT } from './fonts.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// Every material in the room fades out together when switching to the star map.
function useRoomMaterials() {
  return useMemo(() => {
    const m = (o) => new THREE.MeshStandardMaterial({ transparent: true, ...o });
    return {
      wood: m({ color: '#3d2617', roughness: 0.72 }),
      woodDark: m({ color: '#1f140c', roughness: 0.9 }),
      brass: m({ color: '#c9a24e', emissive: '#3b2a0c', metalness: 0.75, roughness: 0.32 }),
      // Shelf label holders, as in an old library: tarnished brass around an aged paper card.
      // The card glows faintly so its lettering reads in the dim room.
      holder: m({ color: '#8a6a2c', emissive: '#22170a', metalness: 0.85, roughness: 0.5 }),
      card: m({ color: '#e4d5ad', emissive: '#6e6142', roughness: 0.95 }),
      screw: m({ color: '#5e4a22', emissive: '#150e05', metalness: 0.9, roughness: 0.4 }),
      wall: m({ color: '#17110d', roughness: 1, side: THREE.BackSide }),
      panel: m({ color: '#1d1510', roughness: 0.95 }),
      rug: m({ color: '#3b1c18', roughness: 1 }),
      rugBorder: m({ color: '#6b4a2a', roughness: 1 }),
      page: m({ color: '#bfb193', roughness: 1 }),
      plant: m({ color: '#3c5233', roughness: 0.9 }),
      pot: m({ color: '#8a6a52', roughness: 0.8 }),
      globe: m({ color: '#36584f', roughness: 0.5, metalness: 0.1 }),
      shade: m({ color: '#14100c', roughness: 0.6, metalness: 0.6, side: THREE.DoubleSide }),
      bulb: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0').multiplyScalar(4), toneMapped: false, transparent: true }),
      hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    };
  }, []);
}

function LyingStack({ x, y, seed, mats, palette }) {
  const r = rand(seed);
  const n = 2 + Math.floor(r() * 2);
  let yy = y;
  return Array.from({ length: n }, (_, i) => {
    const h = 0.07 + r() * 0.05;
    const w = 0.62 + r() * 0.2;
    const d = 0.5 + r() * 0.12;
    const mat = useMemo(
      () => new THREE.MeshStandardMaterial({ color: palette[Math.floor(r() * palette.length)], roughness: 0.7, transparent: true }),
      [], // eslint-disable-line react-hooks/exhaustive-deps
    );
    mats.extra.add(mat);
    const el = (
      <group key={i} position={[x + (r() - 0.5) * 0.06, yy + h / 2, -0.05]} rotation={[0, (r() - 0.5) * 0.25, 0]}>
        <mesh material={mat}>
          <boxGeometry args={[w, h, d]} />
        </mesh>
        <mesh material={mats.page} position={[0.005, 0, 0]}>
          <boxGeometry args={[w - 0.02, h - 0.02, d + 0.002]} />
        </mesh>
      </group>
    );
    yy += h;
    return el;
  });
}

function Plant({ x, y, mats }) {
  return (
    <group position={[x, y, -0.05]}>
      <mesh material={mats.pot} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.13, 0.1, 0.26, 20]} />
      </mesh>
      {[
        [0, 0.42, 0, 0.17],
        [0.1, 0.36, 0.05, 0.12],
        [-0.09, 0.37, -0.03, 0.13],
        [0.02, 0.55, -0.02, 0.1],
      ].map(([px, py, pz, s], i) => (
        <mesh key={i} material={mats.plant} position={[px, py, pz]}>
          <icosahedronGeometry args={[s, 0]} />
        </mesh>
      ))}
    </group>
  );
}

function Globe({ x, y, mats }) {
  return (
    <group position={[x, y, -0.05]}>
      <mesh material={mats.wood} position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.12, 0.14, 0.06, 20]} />
      </mesh>
      <mesh material={mats.brass} position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
      </mesh>
      <mesh material={mats.globe} position={[0, 0.4, 0]} rotation={[0, 0, 0.4]}>
        <sphereGeometry args={[0.2, 32, 24]} />
      </mesh>
      <mesh material={mats.brass} position={[0, 0.4, 0]} rotation={[0, Math.PI / 2, 0.4]}>
        <torusGeometry args={[0.235, 0.008, 8, 48, Math.PI * 1.4]} />
      </mesh>
    </group>
  );
}

function Bookend({ x, y, mats }) {
  return (
    <group position={[x, y, -0.02]}>
      <mesh material={mats.brass} position={[0, 0.22, 0]}>
        <boxGeometry args={[0.025, 0.44, 0.32]} />
      </mesh>
      <mesh material={mats.brass} position={[0.08, 0.008, 0]}>
        <boxGeometry args={[0.16, 0.016, 0.32]} />
      </mesh>
    </group>
  );
}

// Fill the space after the books with a bookend and a few objects, so shelves look lived-in.
// A library shelf label: a tarnished brass holder screwed to the shelf edge, with a paper card
// slipped into it that names the sub-topic.
const SCREW = new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14);
function ShelfLabel({ shelf, mats, texts, position }) {
  const w = Math.max(1.7, shelf.name.length * 0.078 + 0.56); // card width
  const tab = 0.13; // brass tab at each end, for the screw
  return (
    <group position={position}>
      {/* back plate */}
      <mesh material={mats.holder}>
        <boxGeometry args={[w + tab * 2, 0.17, 0.008]} />
      </mesh>
      {/* paper card */}
      <mesh material={mats.card} position={[0, 0, 0.006]}>
        <boxGeometry args={[w, 0.128, 0.004]} />
      </mesh>
      {/* rails that hold the card, top and bottom */}
      {[-1, 1].map((k) => (
        <mesh key={k} material={mats.holder} position={[0, k * 0.073, 0.01]}>
          <boxGeometry args={[w + 0.03, 0.022, 0.014]} />
        </mesh>
      ))}
      {/* end stops and screws */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (w / 2 + tab / 2), 0, 0]}>
          <mesh material={mats.holder} position={[-k * (tab / 2 - 0.008), 0, 0.01]}>
            <boxGeometry args={[0.016, 0.168, 0.014]} />
          </mesh>
          <mesh material={mats.screw} geometry={SCREW} position={[k * 0.012, 0, 0.008]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh material={mats.woodDark} position={[k * 0.012, 0, 0.0145]} rotation={[0, 0, 0.6]}>
            <boxGeometry args={[0.034, 0.005, 0.001]} />
          </mesh>
        </group>
      ))}
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, -0.002, 0.0095]}
        fontSize={0.094}
        letterSpacing={0.08}
        anchorX="center"
        anchorY="middle"
        color="#2e1e10"
      >
        {`${shelf.name.toUpperCase()}  ·  ${shelf.count}`}
      </Text>
    </group>
  );
}

function RowDecor({ bc, row, r, mats }) {
  const right = CASE.width / 2 - 0.1;
  const rnd = rand(`${bc.id}-${r}-decor`);
  const roll = [rnd(), rnd(), rnd()];
  const items = [];
  let x = row.shelf ? row.end + 0.03 : -CASE.width / 2 + 0.5;
  if (row.shelf) {
    items.push(<Bookend key="be" x={x} y={row.base} mats={mats} />);
    x += 0.35;
  }
  const space = () => right - x;
  // Empty shelves get a small still life; full ones only sometimes get a companion.
  const wantStack = !row.shelf || roll[0] > 0.45;
  const wantObj = !row.shelf || roll[1] > 0.55;
  if (wantStack && space() > 1.0) {
    items.push(<LyingStack key="st" x={x + 0.45} y={row.base} seed={`${bc.id}-${r}`} mats={mats} palette={bc.palette} />);
    x += 1.05;
  }
  if (wantObj && space() > 0.55) {
    const Obj = roll[2] > 0.5 ? Globe : Plant;
    items.push(<Obj key="ob" x={Math.min(x + 0.4, right - 0.25)} y={row.base} mats={mats} />);
  }
  return items;
}

function Bookcase({ bc, mats, texts }) {
  const focus = useStore((s) => s.focus);
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selected);
  const setFocus = useStore((s) => s.setFocus);
  const hoverCase = useStore((s) => s.hoverCase);
  const { width: W, depth: D, side, rows, board, plinth, crown, height: H } = CASE;
  const interactive = mode === 'library' && focus !== bc.id && !selected;

  return (
    <group position={bc.pos} rotation={[0, bc.yaw, 0]}>
      {/* carcass */}
      <mesh material={mats.woodDark} position={[0, H / 2, -D / 2 + 0.02]} receiveShadow>
        <boxGeometry args={[W, H, 0.04]} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} material={mats.wood} position={[s * (W / 2 + side / 2), H / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[side, H, D + 0.04]} />
        </mesh>
      ))}
      <mesh material={mats.wood} position={[0, plinth / 2, 0.02]}>
        <boxGeometry args={[W + side * 2 + 0.06, plinth, D + 0.08]} />
      </mesh>
      <mesh material={mats.wood} position={[0, H - crown / 2, 0.04]} castShadow>
        <boxGeometry args={[W + side * 2 + 0.2, crown, D + 0.16]} />
      </mesh>
      <mesh material={mats.brass} position={[0, H - crown / 2, D / 2 + 0.125]}>
        <boxGeometry args={[W + side * 2 + 0.2, 0.012, 0.004]} />
      </mesh>
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, H - crown / 2 + 0.115, D / 2 + 0.125]}
        fontSize={0.2}
        letterSpacing={0.09}
        anchorX="center"
        anchorY="middle"
        color="#d6b25e"
      >
        {`${ROMAN[bc.index]}  ·  ${bc.name.toUpperCase()}`}
      </Text>
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, H - crown / 2 - 0.13, D / 2 + 0.125]}
        fontSize={0.11}
        letterSpacing={0.24}
        anchorX="center"
        anchorY="middle"
        color="#9c8150"
      >
        {`${bc.count} VOLUMES`}
      </Text>

      {/* shelves */}
      {Array.from({ length: rows }, (_, k) => (
        <mesh key={k} material={mats.wood} position={[0, boardY(k), 0]} castShadow receiveShadow>
          <boxGeometry args={[W, board, D]} />
        </mesh>
      ))}
      {bc.rows.map((row, r) => (
        <group key={r}>
          {row.shelf && (
            <ShelfLabel shelf={row.shelf} mats={mats} texts={texts} position={[0, boardY(rows - 1 - r), D / 2 + 0.004]} />
          )}
          <RowDecor bc={bc} row={row} r={r} mats={mats} />
        </group>
      ))}

      {/* click target for walking up to this bookcase */}
      <mesh
        material={mats.hit}
        position={[0, H / 2, D / 2 + 0.3]}
        onPointerOver={
          interactive
            ? (e) => {
                e.stopPropagation();
                hoverCase(bc.id);
              }
            : undefined
        }
        onPointerOut={interactive ? () => useStore.getState().hoveredCase === bc.id && hoverCase(null) : undefined}
        onClick={
          interactive
            ? (e) => {
                e.stopPropagation();
                setFocus(bc.id);
              }
            : undefined
        }
      >
        <boxGeometry args={[W + 0.4, H, 0.05]} />
      </mesh>
    </group>
  );
}

function Lamp({ bc, mats }) {
  const light = useRef();
  const bulb = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  const pos = useMemo(() => {
    const c = Math.cos(bc.yaw);
    const s = Math.sin(bc.yaw);
    const z = 1.9;
    return [bc.pos[0] + z * s, CASE.height + 1.15, bc.pos[2] + z * c];
  }, [bc]);

  useFrame((_, dt) => {
    const { focus, hoveredCase } = useStore.getState();
    const goal = focus ? (focus === bc.id ? 14 : 3) : hoveredCase === bc.id ? 85 : 55;
    const k = 1 - Math.min(1, anim.map * 1.5);
    light.current.intensity = THREE.MathUtils.damp(light.current.intensity, goal * k, 4, dt);
  });

  return (
    <group>
      <primitive object={target} position={[bc.center[0], CASE.height * 0.42, bc.center[2]]} />
      <spotLight
        ref={light}
        position={pos}
        target={target}
        angle={0.42}
        penumbra={0.85}
        intensity={0}
        distance={14}
        decay={1.6}
        color="#ffd6a0"
        castShadow={bc.index === 1 || bc.index === 2}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
      />
      <group position={pos}>
        <mesh material={mats.shade} position={[0, 2.6, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 5, 6]} />
        </mesh>
        <mesh material={mats.shade} position={[0, 0.12, 0]}>
          <coneGeometry args={[0.3, 0.3, 32, 1, true]} />
        </mesh>
        <mesh ref={bulb} material={mats.bulb} position={[0, 0.0, 0]}>
          <sphereGeometry args={[0.07, 16, 12]} />
        </mesh>
      </group>
    </group>
  );
}

export function Library() {
  const group = useRef();
  const sparkles = useRef();
  const floorMat = useRef();
  const base = useRoomMaterials();
  const mats = useMemo(() => ({ ...base, extra: new Set() }), [base]);
  const texts = useMemo(() => new Set(), []);

  useFrame(() => {
    const o = 1 - Math.min(1, anim.map * 1.6);
    const all = [...Object.values(base), ...mats.extra];
    for (const m of all) {
      if (m === base.hit) continue;
      m.opacity = o;
      m.depthWrite = o > 0.98;
    }
    if (floorMat.current) {
      floorMat.current.transparent = true;
      floorMat.current.opacity = o;
    }
    texts.forEach((t) => (t.fillOpacity = o));
    if (sparkles.current) sparkles.current.visible = o > 0.5;
    if (group.current) group.current.visible = o > 0.01;
  });

  return (
    <group ref={group}>
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[30, 64]} />
        <MeshReflectorMaterial
          ref={floorMat}
          blur={[400, 120]}
          resolution={1024}
          mixBlur={1}
          mixStrength={22}
          roughness={0.95}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.4}
          color="#120d0a"
          metalness={0.55}
        />
      </mesh>
      {/* rug */}
      <mesh material={mats.rugBorder} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, -2.6]}>
        <circleGeometry args={[3.3, 72]} />
      </mesh>
      <mesh material={mats.rug} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, -2.6]}>
        <circleGeometry args={[3.15, 72]} />
      </mesh>
      {/* back wall */}
      <mesh material={mats.wall} position={[0, 6, 0]}>
        <cylinderGeometry args={[9.4, 9.4, 12, 64, 1, true, Math.PI * 0.55, Math.PI * 0.9]} />
      </mesh>

      {BOOKCASES.map((bc) => (
        <Bookcase key={bc.id} bc={bc} mats={mats} texts={texts} />
      ))}
      {BOOKCASES.map((bc) => (
        <Lamp key={bc.id} bc={bc} mats={mats} />
      ))}
      <Sparkles ref={sparkles} count={70} scale={[14, 5, 9]} position={[0, 3, -3.5]} size={1.6} speed={0.15} opacity={0.35} color="#ffd9a8" />
    </group>
  );
}
