import { forwardRef, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { BOOKCASES, CASE, boardY, rand } from '../lib/papers.js';
import { useStore, anim } from '../store.js';
import { FONT } from './fonts.js';

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

// A warm, lamp-lit room to reflect in, so the brass reads as metal rather than flat brown.
let ENV;
function brassEnv() {
  if (ENV) return ENV;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const g = c.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#2a1d12');
  sky.addColorStop(0.32, '#9c7a4a');
  sky.addColorStop(0.42, '#5a4024');
  sky.addColorStop(0.6, '#2b1c10');
  sky.addColorStop(1, '#0d0805');
  g.fillStyle = sky;
  g.fillRect(0, 0, 256, 128);
  // a few lamps along the walls
  for (let i = 0; i < 6; i++) {
    const x = 20 + i * 43;
    const r = g.createRadialGradient(x, 34, 0, x, 34, 22);
    r.addColorStop(0, 'rgba(255,230,180,0.45)');
    r.addColorStop(1, 'rgba(255,236,190,0)');
    g.fillStyle = r;
    g.fillRect(x - 22, 12, 44, 44);
  }
  ENV = new THREE.CanvasTexture(c);
  ENV.mapping = THREE.EquirectangularReflectionMapping;
  ENV.colorSpace = THREE.SRGBColorSpace;
  return ENV;
}

// Old brass is never even: faint darker clouding and fine horizontal brushing.
let PATINA;
function patina() {
  if (PATINA) return PATINA;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 256, 256);
  const r = rand('patina');
  for (let i = 0; i < 70; i++) {
    const x = r() * 256, y = r() * 256, rad = 10 + r() * 40;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(70,50,20,${0.08 + r() * 0.12})`);
    gr.addColorStop(1, 'rgba(70,50,20,0)');
    g.fillStyle = gr;
    g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  for (let y = 0; y < 256; y++) {
    g.fillStyle = `rgba(${r() > 0.5 ? '255,245,220' : '60,40,15'},${r() * 0.07})`;
    g.fillRect(0, y, 256, 1);
  }
  PATINA = new THREE.CanvasTexture(c);
  PATINA.wrapS = PATINA.wrapT = THREE.RepeatWrapping;
  PATINA.repeat.set(0.6, 2.4);
  PATINA.colorSpace = THREE.SRGBColorSpace;
  return PATINA;
}

// Every material in the room fades out together when switching to the star map.
function useRoomMaterials() {
  return useMemo(() => {
    const m = (o) => new THREE.MeshStandardMaterial({ transparent: true, ...o });
    return {
      wood: m({ color: '#3d2617', roughness: 0.72 }),
      woodDark: m({ color: '#1f140c', roughness: 0.9 }),
      brass: m({ color: '#a8843f', emissive: '#1c1307', metalness: 0.85, roughness: 0.5, envMap: brassEnv(), envMapIntensity: 0.5 }),
      // Shelf label holders, as in an old library: tarnished brass around an aged paper card.
      // The card glows faintly so its lettering reads in the dim room.
      holder: m({ color: '#9a7636', emissive: '#170f05', metalness: 0.88, roughness: 0.55, envMap: brassEnv(), envMapIntensity: 0.5, map: patina() }),
      card: m({ color: '#d2bd84', emissive: '#4f3f1c', roughness: 0.95 }),
      ink: m({ color: '#4a3119', emissive: '#120a04', roughness: 1 }),
      screw: m({ color: '#8a6a2e', emissive: '#120c04', metalness: 0.9, roughness: 0.45, envMap: brassEnv(), envMapIntensity: 0.55 }),
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

// A shelf label in the manner of an old British college library: a cast-brass plate with
// bevelled edges and rounded ears, a raised bead framing a printed card, and domed screws.
const SCREW_HEAD = new THREE.SphereGeometry(0.021, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const ROSETTE = new THREE.CylinderGeometry(0.03, 0.032, 0.004, 24);
const PLATE_DEPTH = 0.004;

function plateGeometry(w) {
  const hh = 0.094; // half height of the middle
  const x1 = w / 2 + 0.035; // where the ears begin
  const xe = w / 2 + 0.11; // ear centre
  const re = 0.066; // ear radius
  const sh = new THREE.Shape();
  sh.moveTo(-x1, hh);
  sh.lineTo(x1, hh);
  sh.quadraticCurveTo(xe - 0.035, hh, xe, re); // sweep down into the ear
  sh.absarc(xe, 0, re, Math.PI / 2, -Math.PI / 2, true);
  sh.quadraticCurveTo(xe - 0.035, -hh, x1, -hh);
  sh.lineTo(-x1, -hh);
  sh.quadraticCurveTo(-xe + 0.035, -hh, -xe, -re);
  sh.absarc(-xe, 0, re, -Math.PI / 2, Math.PI / 2, true);
  sh.quadraticCurveTo(-xe + 0.035, hh, -x1, hh);
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: PLATE_DEPTH, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.006, bevelSegments: 4, curveSegments: 24,
  });
  g.translate(0, 0, -PLATE_DEPTH / 2);
  return g;
}

// The raised bead around the card window.
function frameGeometry(w) {
  const ow = w / 2 + 0.024, oh = 0.077, iw = w / 2 + 0.002, ih = 0.062, rr = 0.012;
  const rect = (sh, x, y, r) => {
    sh.moveTo(-x + r, -y);
    sh.lineTo(x - r, -y);
    sh.quadraticCurveTo(x, -y, x, -y + r);
    sh.lineTo(x, y - r);
    sh.quadraticCurveTo(x, y, x - r, y);
    sh.lineTo(-x + r, y);
    sh.quadraticCurveTo(-x, y, -x, y - r);
    sh.lineTo(-x, -y + r);
    sh.quadraticCurveTo(-x, -y, -x + r, -y);
  };
  const sh = new THREE.Shape();
  rect(sh, ow, oh, rr);
  const hole = new THREE.Path();
  rect(hole, iw, ih, 0.004);
  sh.holes.push(hole);
  return new THREE.ExtrudeGeometry(sh, {
    depth: 0.003, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 4, curveSegments: 12,
  });
}

function ShelfLabel({ shelf, mats, texts, position }) {
  const w = Math.max(1.7, shelf.name.length * 0.074 + 0.62); // card width
  const plate = useMemo(() => plateGeometry(w), [w]);
  const frame = useMemo(() => frameGeometry(w), [w]);
  const front = PLATE_DEPTH / 2 + 0.005; // face of the plate
  const rule = (y, inset, t) => (
    <mesh material={mats.ink} position={[0, y, front + 0.0012]}>
      <boxGeometry args={[w - inset * 2, t, 0.0004]} />
    </mesh>
  );
  const side = (x, inset, t) => (
    <mesh material={mats.ink} position={[x, 0, front + 0.0012]}>
      <boxGeometry args={[t, 0.124 - inset * 2, 0.0004]} />
    </mesh>
  );
  return (
    <group position={[position[0], position[1], position[2] + 0.006]}>
      <mesh material={mats.holder} geometry={plate} castShadow />
      {/* printed card, sunk behind the bead */}
      <mesh material={mats.card} position={[0, 0, front + 0.0005]}>
        <boxGeometry args={[w, 0.124, 0.001]} />
      </mesh>
      {/* double rule, as printed on old catalogue cards */}
      {[-1, 1].map((k) => (
        <group key={k}>
          {rule(k * 0.05, 0.012, 0.0028)}
          {rule(k * 0.043, 0.019, 0.001)}
          {side(k * (w / 2 - 0.012), 0.012, 0.0028)}
          {side(k * (w / 2 - 0.019), 0.019, 0.001)}
          {/* small diamond ornaments either side of the title */}
          <mesh material={mats.ink} position={[k * (w / 2 - 0.06), 0, front + 0.0012]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.016, 0.016, 0.0004]} />
          </mesh>
        </group>
      ))}
      <mesh material={mats.holder} geometry={frame} position={[0, 0, front]} />
      {/* domed screws on rosettes in the ears */}
      {[-1, 1].map((k) => (
        <group key={k} position={[k * (w / 2 + 0.11), 0, front]}>
          <mesh material={mats.holder} geometry={ROSETTE} position={[0, 0, 0.002]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh material={mats.screw} geometry={SCREW_HEAD} position={[0, 0, 0.004]} rotation={[Math.PI / 2, 0, 0]} />
          <mesh material={mats.woodDark} position={[0, 0, 0.0245]} rotation={[0, 0, k * 0.5]}>
            <boxGeometry args={[0.03, 0.004, 0.004]} />
          </mesh>
        </group>
      ))}
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, -0.003, front + 0.0015]}
        fontSize={0.084}
        letterSpacing={0.12}
        anchorX="center"
        anchorY="middle"
        color="#2a1a0c"
      >
        {`${shelf.name.toUpperCase()}  ·  ${shelf.count}`}
      </Text>
    </group>
  );
}

// Fill the space after the books with a bookend and a few objects, so shelves look lived-in.
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

// Rounded rectangle traced into a shape or path, centred on the origin.
function roundRect(sh, x, y, r) {
  sh.moveTo(-x + r, -y);
  sh.lineTo(x - r, -y);
  sh.quadraticCurveTo(x, -y, x, -y + r);
  sh.lineTo(x, y - r);
  sh.quadraticCurveTo(x, y, x - r, y);
  sh.lineTo(-x + r, y);
  sh.quadraticCurveTo(-x, y, -x, y - r);
  sh.lineTo(-x, -y + r);
  sh.quadraticCurveTo(-x, -y, -x + r, -y);
  return sh;
}

function beadFrame(ow, oh, iw, ih) {
  const sh = roundRect(new THREE.Shape(), ow, oh, 0.014);
  sh.holes.push(roundRect(new THREE.Path(), iw, ih, 0.006));
  return new THREE.ExtrudeGeometry(sh, {
    depth: 0.004, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.005, bevelSegments: 3, curveSegments: 10,
  });
}

// The arched crest that stands on the cornice: a segmental arch, rising from short sides.
function crestGeometry() {
  const c = 0.42, sideH = 0.1, sag = 0.24;
  const r = (c * c + sag * sag) / (2 * sag);
  const sh = new THREE.Shape();
  sh.moveTo(-c, 0);
  sh.lineTo(c, 0);
  sh.lineTo(c, sideH);
  const a0 = Math.asin(c / r);
  sh.absarc(0, sideH + sag - r, r, Math.PI / 2 - a0, Math.PI / 2 + a0, false);
  sh.lineTo(-c, 0);
  return new THREE.ExtrudeGeometry(sh, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 3, curveSegments: 32,
  });
}
const CREST = crestGeometry();
// A gilt bead along the crest's outline.
const CREST_EDGE = (() => {
  const c = 0.42, sideH = 0.1, sag = 0.24;
  const r = (c * c + sag * sag) / (2 * sag);
  const a0 = Math.asin(c / r);
  const pts = [new THREE.Vector3(-c - 0.012, 0, 0), new THREE.Vector3(-c - 0.012, sideH, 0)];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI / 2 + a0 - (2 * a0 * i) / 32;
    pts.push(new THREE.Vector3(Math.cos(a) * (r + 0.012), sideH + sag - r + Math.sin(a) * (r + 0.012), 0));
  }
  pts.push(new THREE.Vector3(c + 0.012, sideH, 0), new THREE.Vector3(c + 0.012, 0, 0));
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05), 80, 0.009, 6);
})();
const DENTIL = new THREE.BoxGeometry(0.044, 0.056, 0.04);
const BOSS = new THREE.SphereGeometry(0.034, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
const MEDALLION_RING = new THREE.TorusGeometry(0.118, 0.014, 10, 48);
const MEDALLION_DISC = new THREE.CircleGeometry(0.11, 40);

// The top of a bookcase, after the classical library bays: a frieze with an ebonised name panel
// in a brass bead, a row of dentils, a stepped cornice, and an arched crest with the numeral.
function Crown({ bc, mats, texts }) {
  const { width: W, depth: D, side, crown, height: H } = CASE;
  const FW = W + side * 2 + 0.2; // frieze width
  const face = D / 2 + 0.12; // front face of the frieze
  const box = (front) => ({ depth: front + D / 2 + 0.02, z: (front - D / 2 - 0.02) / 2 });
  const panel = useMemo(() => beadFrame(FW / 2 - 0.22, 0.19, FW / 2 - 0.25, 0.165), [FW]);
  const dentils = useMemo(() => {
    const step = 0.08;
    const n = Math.floor((FW - 0.12) / step);
    return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * step);
  }, [FW]);
  const dentilRef = useRef();
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    dentils.forEach((x, i) => dentilRef.current.setMatrixAt(i, m.makeTranslation(x, H - 0.046, face + 0.02)));
    dentilRef.current.instanceMatrix.needsUpdate = true;
  }, [dentils, H, face]);
  const cornice = [
    // [bottom, height, extra width, front, material]
    [H, 0.035, 0.06, face + 0.07, mats.wood],
    [H + 0.035, 0.06, 0.12, face + 0.11, mats.wood],
    [H + 0.095, 0.045, 0.18, face + 0.15, mats.woodDark],
  ];
  const textZ = face + 0.004;
  return (
    <group>
      {/* frieze */}
      <mesh material={mats.wood} position={[0, H - crown / 2, 0.04]} castShadow>
        <boxGeometry args={[FW, crown, D + 0.16]} />
      </mesh>
      {/* dentils under the cornice, with a gilt fillet below them */}
      <instancedMesh ref={dentilRef} args={[DENTIL, mats.wood, dentils.length]} />
      <mesh material={mats.brass} position={[0, H - 0.088, face + 0.003]}>
        <boxGeometry args={[FW, 0.01, 0.006]} />
      </mesh>
      {/* stepped cornice */}
      {cornice.map(([y, h, xw, front, mat], i) => {
        const b = box(front);
        return (
          <mesh key={i} material={mat} position={[0, y + h / 2, b.z]} castShadow>
            <boxGeometry args={[FW + xw, h, b.depth]} />
          </mesh>
        );
      })}
      <mesh material={mats.brass} position={[0, H + 0.065, face + 0.112]}>
        <boxGeometry args={[FW + 0.12, 0.008, 0.004]} />
      </mesh>
      {/* ebonised name panel in a brass bead */}
      <mesh material={mats.woodDark} position={[0, H - 0.3, face + 0.001]}>
        <boxGeometry args={[FW - 0.5, 0.33, 0.004]} />
      </mesh>
      <mesh material={mats.brass} geometry={panel} position={[0, H - 0.3, face]} />
      {/* brass bosses at the ends of the frieze */}
      {[-1, 1].map((k) => (
        <mesh key={k} material={mats.brass} geometry={BOSS} position={[k * (FW / 2 - 0.12), H - 0.3, face]} rotation={[Math.PI / 2, 0, 0]} />
      ))}
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, H - 0.275, textZ + 0.003]}
        fontSize={0.17}
        letterSpacing={0.14}
        anchorX="center"
        anchorY="middle"
        color="#e0bd68"
      >
        {bc.name.toUpperCase()}
      </Text>
      <Text
        ref={(el) => el && texts.add(el)}
        font={FONT}
        position={[0, H - 0.405, textZ + 0.003]}
        fontSize={0.068}
        letterSpacing={0.32}
        anchorX="center"
        anchorY="middle"
        color="#a88a52"
      >
        {`—  ${bc.count} VOLUMES  —`}
      </Text>
      {/* arched crest with the bookcase numeral in a brass medallion */}
      <group position={[0, H + 0.14, face + 0.02]}>
        <mesh material={mats.wood} geometry={CREST} position={[0, 0, -0.06]} castShadow />
        <mesh material={mats.brass} geometry={CREST_EDGE} position={[0, 0, 0.004]} />
        <mesh material={mats.brass} position={[0, 0.012, 0.014]}>
          <boxGeometry args={[0.86, 0.008, 0.004]} />
        </mesh>
        <group position={[0, 0.19, 0.016]}>
          <mesh material={mats.woodDark} geometry={MEDALLION_DISC} />
          <mesh material={mats.brass} geometry={MEDALLION_RING} />
          <Text
            ref={(el) => el && texts.add(el)}
            font={FONT}
            position={[0, -0.004, 0.004]}
            fontSize={0.12}
            letterSpacing={0.04}
            anchorX="center"
            anchorY="middle"
            color="#e0bd68"
          >
            {ROMAN[bc.index]}
          </Text>
        </group>
      </group>
    </group>
  );
}

// A brass inlay in the rug that tells you the room can be turned: two curved arrows that rock
// gently around a ring. Only in the room overview; it fades once you walk up to a bookcase.
function FloorHint() {
  const group = useRef();
  const arrows = useRef();
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#a8843f', emissive: '#3a2a0c', metalness: 0.6, roughness: 0.55, transparent: true, depthWrite: false }),
    [],
  );
  const geo = useMemo(() => {
    const R = 1.75, t = 0.05;
    const arc = (a0, len) => new THREE.RingGeometry(R - t, R + t, 48, 1, a0, len);
    const head = (a, dir) => {
      // arrowhead at angle a, pointing along the circle (dir = ±1)
      const sh = new THREE.Shape();
      const tip = [Math.cos(a + dir * 0.15) * R, Math.sin(a + dir * 0.15) * R];
      const r1 = R + 0.17, r2 = R - 0.17;
      sh.moveTo(Math.cos(a) * r1, Math.sin(a) * r1);
      sh.lineTo(tip[0], tip[1]);
      sh.lineTo(Math.cos(a) * r2, Math.sin(a) * r2);
      sh.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      return new THREE.ShapeGeometry(sh);
    };
    // Arcs on the near half of the ring (towards the camera, which is at +z = -y in ring space).
    return {
      right: arc(-Math.PI / 2 + 0.25, 0.8),
      rightHead: head(-Math.PI / 2 + 1.05, 1),
      left: arc(-Math.PI / 2 - 1.05, 0.8),
      leftHead: head(-Math.PI / 2 - 1.05, -1),
      ring: new THREE.RingGeometry(1.2, 1.215, 96),
    };
  }, []);

  useFrame((state, dt) => {
    const { focus, selected, mode } = useStore.getState();
    const want = mode === 'library' && !focus && !selected ? 1 : 0;
    const room = 1 - Math.min(1, anim.map * 1.6);
    group.current.userData.v = THREE.MathUtils.damp(group.current.userData.v ?? 0, want, 3, dt);
    const o = group.current.userData.v * room * (0.75 + 0.25 * Math.sin(state.clock.elapsedTime * 1.6));
    mat.opacity = o;
    group.current.visible = o > 0.01;
    arrows.current.rotation.z = Math.sin(state.clock.elapsedTime * 1.1) * 0.12;
  });

  return (
    <group ref={group} position={[0, 0.014, -2.6]} rotation={[-Math.PI / 2, 0, 0]}>
      <group ref={arrows}>
        <mesh material={mat} geometry={geo.right} />
        <mesh material={mat} geometry={geo.rightHead} />
        <mesh material={mat} geometry={geo.left} />
        <mesh material={mat} geometry={geo.leftHead} />
      </group>
      <mesh material={mat} geometry={geo.ring} />
    </group>
  );
}

function Bookcase({ bc, mats, texts }) {
  const focus = useStore((s) => s.focus);
  const mode = useStore((s) => s.mode);
  const selected = useStore((s) => s.selected);
  const setFocus = useStore((s) => s.setFocus);
  const hoverCase = useStore((s) => s.hoverCase);
  const { width: W, depth: D, side, rows, board, plinth, crown, height: H } = CASE;
  // Only from the room overview: once a bookcase is entered, the other bookcases stay inert.
  const interactive = mode === 'library' && !focus && !selected;

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
      <Crown bc={bc} mats={mats} texts={texts} />

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
                if (!anim.libDragged) setFocus(bc.id);
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
    // Hung just in front of the crown, directly above the middle of the bookcase.
    const z = 0.8;
    return [bc.pos[0] + z * s, CASE.height + 0.95, bc.pos[2] + z * c];
  }, [bc]);
  // The beam itself comes from further out and higher than the fixture, so it falls on the
  // books at an angle and the crest just below the lamp stays outside the cone (otherwise the
  // brass right under the bulb burns out).
  const beam = useMemo(() => {
    const c = Math.cos(bc.yaw);
    const s = Math.sin(bc.yaw);
    const z = 2.2;
    return [bc.pos[0] + z * s, CASE.height + 1.2, bc.pos[2] + z * c];
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
        position={beam}
        target={target}
        angle={0.5}
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

// Dust drifting in the lamplight. Soft round motes whose brightness stays well below the bloom
// threshold, so none of them can flare up as it crosses a pixel (drei's Sparkles have a very hot
// core that does exactly that).
const MOTE_TEX = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,1)');
  r.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
})();
const DustMotes = forwardRef(function DustMotes(_, ref) {
  const N = 70;
  const { geom, seeds } = useMemo(() => {
    const r = rand('dust');
    const pos = new Float32Array(N * 3);
    const seeds = Array.from({ length: N }, () => [r() * 14 - 7, r() * 5 + 0.5, r() * 9 - 8, r() * 6.28, 0.3 + r() * 0.7]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return { geom: g, seeds };
  }, []);
  const mat = useMemo(
    () => new THREE.PointsMaterial({ map: MOTE_TEX, color: new THREE.Color('#ffd9a8').multiplyScalar(0.55), size: 0.05, sizeAttenuation: true, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: true }),
    [],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.15;
    const a = geom.attributes.position.array;
    seeds.forEach(([x, y, z, ph, sp], i) => {
      a[i * 3] = x + Math.sin(t * sp + ph) * 0.4;
      a[i * 3 + 1] = y + Math.sin(t * sp * 0.7 + ph * 2) * 0.3;
      a[i * 3 + 2] = z + Math.cos(t * sp + ph) * 0.4;
    });
    geom.attributes.position.needsUpdate = true;
  });
  return <points ref={ref} geometry={geom} material={mat} />;
});

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
      <FloorHint />
      <DustMotes ref={sparkles} />
    </group>
  );
}
