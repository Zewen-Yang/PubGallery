import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { MAP_CENTER } from '../lib/papers.js';
import { SITES, SITE_BY_ID, COUNTRY_BY_ISO, HOME, focusOf } from '../lib/collab.js';
import { siteObjects } from './registry.js';
import { useStore, anim } from '../store.js';
import { FONT } from './fonts.js';

export const GLOBE_R = 2.25;
// The globe hangs below the star clusters.
export const GLOBE_CENTER = [MAP_CENTER[0], MAP_CENTER[1] - 2.55, MAP_CENTER[2]];
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

    const N = 30000;
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
    const o = fade();
    const k = THREE.MathUtils.damp(dot.current.userData.k ?? 1, hot ? 1.7 : 1, 8, dt);
    dot.current.userData.k = k;
    dot.current.scale.setScalar(Math.max(size * k * o, 1e-4));
    const t = (state.clock.elapsedTime * 0.6 + site.lon * 0.01) % 1;
    ring.current.scale.setScalar(size * (1.4 + t * (isHome ? 2.2 : 3)) * o + 1e-4);
    ring.current.material.opacity = (1 - t) * 0.7 * o;
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

// One label per city, floating just above the surface; hidden once it turns to the far side.
const LABEL_TWEAK = { 'Hong Kong': { anchorY: 'top', y: -0.05 }, Guangzhou: { y: 0.02 }, Nottingham: { anchorY: 'top', y: -0.05 } };
const _w = new THREE.Vector3();
const _c = new THREE.Vector3();
function CityLabels() {
  const refs = useRef([]);
  const anchors = useRef([]);
  const cities = useMemo(() => {
    const m = new Map();
    for (const s of SITES) if (!m.has(s.city)) m.set(s.city, { city: s.city, lat: s.lat, lon: s.lon });
    return [...m.values()];
  }, []);
  useFrame((state) => {
    const o = THREE.MathUtils.smoothstep(anim.map, 0.75, 1);
    const root = anchors.current[0]?.parent?.parent; // the spinning group
    if (!root) return;
    root.getWorldPosition(_c);
    refs.current.forEach((t, i) => {
      const g = anchors.current[i];
      if (!t || !g) return;
      g.getWorldPosition(_w);
      const n = _w.clone().sub(_c).normalize();
      const v = state.camera.position.clone().sub(_w).normalize();
      const face = THREE.MathUtils.smoothstep(n.dot(v), 0.15, 0.4);
      t.fillOpacity = o * face * 0.92;
      t.outlineOpacity = o * face * 0.8;
      t.visible = o * face > 0.01;
    });
  });
  return cities.map((c, i) => {
    const tw = LABEL_TWEAK[c.city] || {};
    return (
      <group key={c.city} ref={(el) => (anchors.current[i] = el)} position={sph(c.lat, c.lon, GLOBE_R * 1.01)}>
        <Billboard>
          <Text
            ref={(el) => (refs.current[i] = el)}
            font={FONT}
            fontSize={0.12}
            letterSpacing={0.06}
            color="#f3e9d2"
            anchorX="left"
            anchorY={tw.anchorY || 'bottom'}
            position={[0.06, tw.y ?? 0.04, 0]}
            outlineWidth={0.012}
            outlineColor="#03040b"
            renderOrder={10}
            material-depthTest={false}
          >
            {c.city}
          </Text>
        </Billboard>
      </group>
    );
  });
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
      q.multiply(_q.setFromAxisAngle(Y_AXIS, dt * 0.05)); // idle: turn slowly about its own axis
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
              uniforms={{ uOpacity: { value: 0 }, uScale: { value: 1 }, uSize: { value: GLOBE_R * 0.017 } }}
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
          <CityLabels />
        </group>
      </group>
    </group>
  );
}
