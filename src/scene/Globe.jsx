import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { MAP_CENTER } from '../lib/papers.js';
import { SITES, SITE_BY_ID, COUNTRY_BY_ISO, CITIES, HOME, focusOf } from '../lib/collab.js';
import { siteObjects, cityAnchors, labelEls } from './registry.js';
import { useStore, anim, IDLE_SPIN } from '../store.js';

export const GLOBE_R = 3.0;
// The globe hangs below the star clusters.
export const GLOBE_CENTER = [MAP_CENTER[0], MAP_CENTER[1] - 3.4, MAP_CENTER[2]];
const TILT = 0.42; // tip the north towards the viewer
const FACE_LON = 62; // longitude that faces the camera at rest (between Europe and China)
// Spin (about the globe's axis) that brings longitude `lon` to face the camera.
const spinFor = (lon) => -Math.atan2(Math.cos((lon * Math.PI) / 180), -Math.sin((lon * Math.PI) / 180));
const START = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, spinFor(FACE_LON), 0));
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();

// The globe is grey and white only; colour belongs to the star clusters.
const SITE = '#ffffff';

// lat/lon → point on the unit sphere, matching three's SphereGeometry UVs (u=0 at lon −180).
export function sph(lat, lon, r = 1) {
  const a = THREE.MathUtils.degToRad(lat);
  const b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
}

const fade = () => THREE.MathUtils.smoothstep(anim.map, 0.45, 1);
// Markers and labels keep roughly their on-screen size when the camera moves in.
const shrink = () => THREE.MathUtils.lerp(1, 0.27, anim.zoom);

// The land as a matrix of dots: evenly spread points on the sphere, kept where a (hidden)
// equirectangular country map says there is land. Collaborator countries get white dots.
function useLandDots() {
  return useMemo(() => {
    const W = 2048;
    const H = 1024;
    const countries = feature(world, world.objects.countries).features;
    const maxP = Math.max(...Object.values(COUNTRY_BY_ISO).map((c) => c.papers.length));
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const path = geoPath(geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]), ctx);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    for (const f of countries) {
      const c = COUNTRY_BY_ISO[f.id];
      ctx.beginPath();
      path(f);
      // red = collaborator country (green carries how many papers), blue = other land
      ctx.fillStyle = c ? `rgb(255,${Math.round(80 + 175 * Math.sqrt(c.papers.length / maxP))},0)` : 'rgb(0,0,255)';
      ctx.fill();
    }
    const px = ctx.getImageData(0, 0, W, H).data;

    const N = 64000;
    const pos = [];
    const col = [];
    const size = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const land = new THREE.Color('#3b4250');
    const lit = new THREE.Color('#e6e9ef');
    for (let i = 0; i < N; i++) {
      const y = 1 - ((i + 0.5) / N) * 2;
      const lat = THREE.MathUtils.radToDeg(Math.asin(y));
      if (lat < -60) continue; // leave Antarctica out
      const lon = ((THREE.MathUtils.radToDeg(golden * i) % 360) + 540) % 360 - 180;
      const o = (Math.floor(((90 - lat) / 180) * H) * W + Math.floor(((lon + 180) / 360) * W)) * 4;
      const hot = px[o] > 128;
      if (!hot && px[o + 2] < 128) continue;
      const v = sph(lat, lon, GLOBE_R * 1.002);
      pos.push(v.x, v.y, v.z);
      const c = hot ? lit.clone().multiplyScalar(0.7 + (px[o + 1] / 255) * 0.45) : land;
      col.push(c.r, c.g, c.b);
      size.push(hot ? 1.25 : 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
    return g;
  }, []);
}

const DOT_VERT = /* glsl */ `
  attribute float aSize; uniform float uScale; uniform float uSize;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const DOT_FRAG = /* glsl */ `
  uniform float uOpacity; varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.36, d);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * uOpacity);
  }`;

const ARC_VERT = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ARC_FRAG = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uHot; uniform float uDim; uniform float uDashes; uniform float uSeed;
  varying float vU;
  void main() {
    float head = fract(uTime * 0.28 + uSeed);
    float d = vU - head; if (d > 0.0) d -= 1.0; // trail behind the head
    float pulse = exp(d * 9.0);
    float ends = smoothstep(0.0, 0.04, vU) * smoothstep(1.0, 0.96, vU);
    // Idle: a grey dashed line. Active: solid white with a travelling pulse.
    float dash = step(0.45, fract(vU * uDashes));
    float a = mix(0.42 * dash, 0.55 + pulse * 0.9, uHot) * ends * uOpacity * uDim;
    vec3 c = mix(vec3(0.42, 0.45, 0.52), vec3(1.0) * (1.0 + pulse * 2.0), uHot);
    gl_FragColor = vec4(c, a);
  }`;

function Arc({ site, home }) {
  const mat = useRef();
  const geom = useMemo(() => {
    const a = sph(home.lat, home.lon);
    const b = sph(site.lat, site.lon);
    const ang = a.angleTo(b);
    const lift = 0.02 + Math.min(ang, 1.5) * 0.1;
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      // Great-circle (slerp) between the two cities, lifted towards the middle.
      const p = a.clone().multiplyScalar(Math.sin((1 - t) * ang)).addScaledVector(b, Math.sin(t * ang)).divideScalar(Math.sin(ang));
      pts.push(p.multiplyScalar(GLOBE_R * (1.004 + Math.sin(Math.PI * t) * lift)));
    }
    const r = 0.005 + Math.min(site.papers.length, 20) * 0.0009;
    const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, r, 6, false);
    g.userData.dashes = Math.max(6, Math.round(ang * 26));
    return g;
  }, [site, home]);
  const seed = useMemo(() => (site.lon * 0.013) % 1, [site]);
  useFrame((state, dt) => {
    const f = focusOf(useStore.getState());
    const hot = f && f.site(site) ? 1 : 0;
    const u = mat.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uOpacity.value = fade();
    u.uHot.value = THREE.MathUtils.damp(u.uHot.value, hot, 6, dt);
    u.uDim.value = THREE.MathUtils.damp(u.uDim.value, f && !hot ? 0.45 : 1, 6, dt);
  });
  return (
    <mesh geometry={geom}>
      <shaderMaterial
        ref={mat}
        vertexShader={ARC_VERT}
        fragmentShader={ARC_FRAG}
        transparent
        depthWrite={false}
        toneMapped={false}
        uniforms={{ uTime: { value: 0 }, uOpacity: { value: 0 }, uHot: { value: 0 }, uDim: { value: 1 }, uDashes: { value: geom.userData.dashes }, uSeed: { value: seed } }}
      />
    </mesh>
  );
}

const DOT = new THREE.SphereGeometry(1, 16, 12);
const RING = new THREE.RingGeometry(0.8, 1, 40);

function Site({ site, isHome }) {
  const dot = useRef();
  const ring = useRef();
  const pos = useMemo(() => sph(site.lat, site.lon, GLOBE_R * 1.003), [site]);
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize()), [pos]);
  const size = (isHome ? 0.05 : 0.03) + Math.sqrt(site.papers.length) * 0.006;
  const color = useMemo(() => new THREE.Color(SITE).multiplyScalar(isHome ? 2.6 : 1.5), [isHome]);
  const hover = useStore((s) => s.hoverSite);
  const pick = useStore((s) => s.pickCountry);
  useFrame((state, dt) => {
    const st = useStore.getState();
    const mode = st.mode;
    const f = focusOf(st);
    const hot = !!(f && f.site(site));
    const o = fade() * shrink();
    const k = THREE.MathUtils.damp(dot.current.userData.k ?? 1, hot ? 1.7 : 1, 8, dt);
    dot.current.userData.k = k;
    dot.current.scale.setScalar(Math.max(size * k * o, 1e-4));
    const t = (state.clock.elapsedTime * 0.6 + site.lon * 0.01) % 1;
    ring.current.scale.setScalar(size * (1.4 + t * (isHome ? 2.2 : 3)) * o + 1e-4);
    ring.current.material.opacity = (1 - t) * 0.7 * fade();
    dot.current.visible = ring.current.visible = mode === 'map' || o > 0.01;
  });
  return (
    <group position={pos} quaternion={quat} ref={(el) => (siteObjects[site.id] = el)}>
      <mesh ref={dot} geometry={DOT}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={ring} geometry={RING}>
        <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh
        onPointerOver={(e) => {
          if (useStore.getState().mode !== 'map') return;
          e.stopPropagation();
          hover(site.id);
        }}
        onPointerOut={() => useStore.getState().hoveredSite === site.id && hover(null)}
        onClick={(e) => {
          if (useStore.getState().mode !== 'map') return;
          e.stopPropagation();
          pick(site.iso);
        }}
      >
        <sphereGeometry args={[0.14, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  );
}

// City labels are DOM elements (ui/CityLabels.jsx) laid out here every frame, in screen space:
// each label looks for free room near its city (open sea, usually) and a thin leader line joins
// them, so crowded regions such as Europe stay readable without moving in.
const _w = new THREE.Vector3();
const _c = new THREE.Vector3();
const _n = new THREE.Vector3();
const _v = new THREE.Vector3();
const DIRS = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);
const STEPS = [8, 24, 44, 68, 96, 130, 170];
const overlap = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

function CityLabelLayout() {
  const anchors = useRef({});
  const state0 = useMemo(() => Object.fromEntries(CITIES.map((c) => [c.city, { x: 0, y: 0, a: 0, pick: null, w: 0, h: 0 }])), []);
  useFrame((state, dt) => {
    const { width, height } = state.size;
    const st = useStore.getState();
    const o = st.mode === 'map' && !st.listOpen ? THREE.MathUtils.smoothstep(anim.map, 0.8, 1) : 0;
    const f = focusOf(st);
    const root = anchors.current[CITIES[0].city]?.parent;
    if (!root) return;
    root.getWorldPosition(_c);
    const toScreen = (v) => [(v.x * 0.5 + 0.5) * width, (-v.y * 0.5 + 0.5) * height];

    // Visible cities in screen space.
    const vis = [];
    for (const c of CITIES) {
      const g = anchors.current[c.city];
      const el = labelEls[c.city];
      if (!g || !el) continue;
      g.getWorldPosition(_w);
      _n.copy(_w).sub(_c).normalize();
      const face = THREE.MathUtils.smoothstep(_n.dot(_v.copy(state.camera.position).sub(_w).normalize()), 0.12, 0.35);
      const [x, y] = toScreen(_v.copy(_w).project(state.camera));
      const s0 = state0[c.city];
      if (!s0.w && el.label.offsetWidth) {
        s0.w = el.label.offsetWidth;
        s0.h = el.label.offsetHeight;
      }
      vis.push({ c, el, s0, x, y, face, hot: !!(f && c.sites.some(f.site)) });
    }
    const [cx, cy] = toScreen(_v.copy(_c).project(state.camera));

    // Place: hot cities first, then busiest. Obstacles are the city dots and labels already placed.
    const order = vis.filter((v) => v.face > 0.02 && o > 0).sort((a, b) => b.hot - a.hot || b.c.n - a.c.n);
    const boxes = order.map((v) => [v.x - 5, v.y - 5, v.x + 5, v.y + 5]);
    for (const v of order) {
      const { s0 } = v;
      // Lean away from neighbours (and, when alone, away from the globe's centre).
      let px = 0;
      let py = 0;
      for (const u of order) {
        if (u === v) continue;
        const dx = v.x - u.x;
        const dy = v.y - u.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 * 120) {
          px += dx / (d2 + 30);
          py += dy / (d2 + 30);
        }
      }
      if (Math.hypot(px, py) < 1e-4) {
        px = v.x - cx || 1;
        py = (v.y - cy) * 0.4;
      }
      const lean = Math.atan2(py, px);
      const cand = [];
      for (const d of STEPS)
        for (const th of DIRS) {
          let dth = Math.abs(((th - lean + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const ex = v.x + Math.cos(th) * d;
          const ey = v.y + Math.sin(th) * d;
          const right = Math.cos(th) >= -0.2;
          const bx = right ? ex + 3 : ex - 3 - s0.w;
          const box = [bx, ey - s0.h / 2, bx + s0.w, ey + s0.h / 2];
          cand.push({ key: `${d}|${th}`, ex, ey, box, score: d + dth * 30 });
        }
      cand.sort((a, b) => a.score - b.score);
      const inView = (b) => b[0] > 8 && b[2] < width - 8 && b[1] > 70 && b[3] < height - 10;
      const free = (b) => inView(b) && !boxes.some((o2) => overlap(b, o2));
      const prev = s0.pick && cand.find((k) => k.key === s0.pick);
      const best = cand.find((k) => free(k.box));
      // Keep the last spot while it is still free and not much worse (no flicker while turning).
      const pick = prev && free(prev.box) && (!best || prev.score < best.score + 40) ? prev : best;
      v.pick = pick;
      if (pick) {
        boxes.push(pick.box);
        s0.pick = pick.key;
      }
    }

    // Write to the DOM (eased, so labels glide rather than jump).
    const k = 1 - Math.exp(-14 * dt);
    for (const v of vis) {
      const { el, s0, pick } = v;
      const target = pick && o > 0 ? 1 : 0;
      s0.a = THREE.MathUtils.damp(s0.a, target * v.face, 10, dt);
      const a = s0.a * o * (f && !v.hot ? 0.4 : 1);
      if (pick) {
        const jump = !s0.x || Math.hypot(s0.x - pick.box[0], s0.y - pick.box[1]) > 260;
        s0.x = jump ? pick.box[0] : s0.x + (pick.box[0] - s0.x) * k;
        s0.y = jump ? pick.box[1] : s0.y + (pick.box[1] - s0.y) * k;
        s0.ex = pick.ex;
        s0.ey = pick.ey;
      }
      el.label.style.opacity = a.toFixed(3);
      el.label.style.visibility = a > 0.02 ? 'visible' : 'hidden';
      el.label.style.transform = `translate(${s0.x.toFixed(1)}px, ${s0.y.toFixed(1)}px)`;
      el.label.classList.toggle('hot', v.hot);
      // Leader line from the dot to the label's near edge.
      const right = s0.ex >= v.x - 1;
      const lx = right ? s0.x : s0.x + s0.w;
      const ly = s0.y + s0.h / 2;
      const long = Math.hypot(lx - v.x, ly - v.y) > 12;
      el.line.setAttribute('x1', v.x.toFixed(1));
      el.line.setAttribute('y1', v.y.toFixed(1));
      el.line.setAttribute('x2', lx.toFixed(1));
      el.line.setAttribute('y2', ly.toFixed(1));
      el.line.style.opacity = long ? (a * (v.hot ? 0.9 : 0.5)).toFixed(3) : '0';
    }
  });
  return CITIES.map((c) => (
    <group
      key={c.city}
      ref={(el) => {
        anchors.current[c.city] = el;
        cityAnchors[c.city] = el;
      }}
      position={sph(c.lat, c.lon, GLOBE_R * 1.004)}
    />
  ));
}

export function Globe() {
  const root = useRef();
  const spin = useRef();
  const body = useRef();
  const dots = useRef();
  const land = useLandDots();
  const home = SITE_BY_ID[HOME];
  useFrame((state, dt) => {
    const o = fade();
    root.current.visible = o > 0.001;
    root.current.scale.setScalar(0.55 + 0.45 * THREE.MathUtils.smoothstep(anim.map, 0.3, 1));
    // Trackball: drags turn the globe about the screen's axes, so any side can be brought round.
    const q = spin.current.quaternion;
    q.premultiply(_q.setFromEuler(_e.set(anim.dPitch, anim.dYaw, 0)));
    const { country: iso, mode } = useStore.getState();
    const dragging = Math.abs(anim.dragV) + Math.abs(anim.dragVy) > 0.002;
    if (iso && !dragging) {
      // A pinned country turns upright to face the viewer (its paper-weighted mean position).
      const c = COUNTRY_BY_ISO[iso];
      const w = c.sites.reduce((a, s) => a + s.papers.length, 0);
      const lon = c.sites.reduce((a, s) => a + s.lon * s.papers.length, 0) / w;
      const lat = c.sites.reduce((a, s) => a + s.lat * s.papers.length, 0) / w;
      q.slerp(_q.setFromEuler(_e.set(THREE.MathUtils.degToRad(lat) * 0.8, spinFor(lon), 0)), 1 - Math.exp(-2.5 * dt));
    } else if (mode === 'map' && !dragging) {
      q.multiply(_q.setFromAxisAngle(Y_AXIS, dt * IDLE_SPIN)); // idle: turn slowly about its own axis
    }
    body.current.material.opacity = o;
    const u = dots.current.material.uniforms;
    u.uOpacity.value = o;
    u.uScale.value = (state.size.height * state.viewport.dpr) / (2 * Math.tan((state.camera.fov * Math.PI) / 360));
  });
  return (
    <group ref={root} position={GLOBE_CENTER}>
      <group>
        <group ref={spin} quaternion={START}>
          {/* Dark body, drawn first so whatever is behind the globe is hidden by it. */}
          <mesh ref={body} renderOrder={-1}>
            <sphereGeometry args={[GLOBE_R, 64, 48]} />
            <meshBasicMaterial color="#05070f" transparent opacity={0} fog={false} />
          </mesh>
          <points ref={dots} geometry={land}>
            <shaderMaterial
              vertexShader={DOT_VERT}
              fragmentShader={DOT_FRAG}
              uniforms={{ uOpacity: { value: 0 }, uScale: { value: 1 }, uSize: { value: GLOBE_R * 0.0115 } }}
              vertexColors
              transparent
              depthWrite={false}
              toneMapped={false}
            />
          </points>
          {SITES.filter((s) => s.id !== HOME).map((s) => (
            <Arc key={s.id} site={s} home={home} />
          ))}
          {SITES.map((s) => (
            <Site key={s.id} site={s} isHome={s.id === HOME} />
          ))}
          <CityLabelLayout />
        </group>
      </group>
    </group>
  );
}
