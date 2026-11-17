import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import * as THREE from 'three';
import { geoEquirectangular, geoPath, geoGraticule10 } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { MAP_CENTER } from '../lib/papers.js';
import { SITES, SITE_BY_ID, COUNTRY_BY_ISO, HOME } from '../lib/collab.js';
import { useStore, anim } from '../store.js';
import { FONT } from './fonts.js';

export const GLOBE_R = 3.7;
const TILT = 0.5; // tip the north towards the viewer
const FACE_LON = 62; // longitude that faces the camera at rest (between Europe and China)
// Spin (about the globe's axis) that brings longitude `lon` to face the camera.
const spinFor = (lon) => -Math.atan2(Math.cos((lon * Math.PI) / 180), -Math.sin((lon * Math.PI) / 180));
const BASE_SPIN = spinFor(FACE_LON);

const HOT = '#e8b94a';
const ARC = new THREE.Color('#ffcf6b');

// lat/lon → point on the unit sphere, matching three's SphereGeometry UVs (u=0 at lon −180).
export function sph(lat, lon, r = 1) {
  const a = THREE.MathUtils.degToRad(lat);
  const b = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(Math.cos(a) * Math.cos(b) * r, Math.sin(a) * r, -Math.cos(a) * Math.sin(b) * r);
}

const fade = () => THREE.MathUtils.smoothstep(anim.map, 0.45, 1);

// Equirectangular map painted onto a canvas: dim land, lit collaborator countries.
function useMapTextures() {
  return useMemo(() => {
    const W = 4096;
    const H = 2048;
    const countries = feature(world, world.objects.countries).features;
    const borders = mesh(world, world.objects.countries, (a, b) => a !== b);
    const maxP = Math.max(...Object.values(COUNTRY_BY_ISO).map((c) => c.papers.length));
    const proj = geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]);

    const base = document.createElement('canvas');
    base.width = W;
    base.height = H;
    let ctx = base.getContext('2d');
    let path = geoPath(proj, ctx);
    ctx.fillStyle = '#070b16';
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    path(geoGraticule10());
    ctx.strokeStyle = 'rgba(120,150,210,0.10)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    for (const f of countries) {
      const c = COUNTRY_BY_ISO[f.id];
      ctx.beginPath();
      path(f);
      if (c) {
        const k = 0.38 + 0.4 * Math.sqrt(c.papers.length / maxP);
        ctx.fillStyle = `rgba(214,160,62,${k})`;
      } else ctx.fillStyle = '#1a2233';
      ctx.fill();
    }
    ctx.beginPath();
    path(borders);
    ctx.strokeStyle = 'rgba(160,180,220,0.28)';
    ctx.lineWidth = 1.6;
    ctx.stroke();

    // Lit countries only, for the bloom layer.
    const glow = document.createElement('canvas');
    glow.width = W / 2;
    glow.height = H / 2;
    ctx = glow.getContext('2d');
    path = geoPath(geoEquirectangular().scale(W / 2 / (2 * Math.PI)).translate([W / 4, H / 4]), ctx);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W / 2, H / 2);
    for (const f of countries) {
      const c = COUNTRY_BY_ISO[f.id];
      if (!c) continue;
      ctx.beginPath();
      path(f);
      ctx.fillStyle = `rgba(255,180,70,${0.45 + 0.55 * Math.sqrt(c.papers.length / maxP)})`;
      ctx.fill();
    }

    const t1 = new THREE.CanvasTexture(base);
    t1.colorSpace = THREE.SRGBColorSpace;
    t1.anisotropy = 8;
    const t2 = new THREE.CanvasTexture(glow);
    t2.colorSpace = THREE.SRGBColorSpace;
    return [t1, t2];
  }, []);
}

const ATMO_VERT = /* glsl */ `
  varying vec3 vN; varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const ATMO_FRAG = /* glsl */ `
  uniform float uOpacity; varying vec3 vN; varying vec3 vV;
  void main() {
    // Back faces of a slightly larger shell: brightest at the globe's rim, fading outwards.
    float f = pow(smoothstep(0.0, 0.5, abs(dot(vN, vV))), 4.0);
    gl_FragColor = vec4(vec3(0.3, 0.5, 1.0), f * 0.16 * uOpacity);
  }`;

const ARC_VERT = /* glsl */ `
  varying float vU;
  void main() { vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const ARC_FRAG = /* glsl */ `
  uniform float uTime; uniform float uOpacity; uniform float uHot; uniform vec3 uColor; uniform float uSeed;
  varying float vU;
  void main() {
    float head = fract(uTime * 0.28 + uSeed);
    float d = vU - head; if (d > 0.0) d -= 1.0; // trail behind the head
    float pulse = exp(d * 9.0);
    float ends = smoothstep(0.0, 0.04, vU) * smoothstep(1.0, 0.96, vU);
    float a = (0.22 + 0.25 * uHot + pulse * 0.9) * ends * uOpacity;
    gl_FragColor = vec4(uColor * (1.0 + pulse * 2.2 + uHot * 0.8), a);
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
    const r = 0.006 + Math.min(site.papers.length, 20) * 0.0012;
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, r, 6, false);
  }, [site, home]);
  const seed = useMemo(() => (site.lon * 0.013) % 1, [site]);
  useFrame((state, dt) => {
    const { hoveredSite, country } = useStore.getState();
    const hot = hoveredSite === site.id || country === site.iso ? 1 : 0;
    const u = mat.current.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uOpacity.value = fade();
    u.uHot.value = THREE.MathUtils.damp(u.uHot.value, hot, 6, dt);
  });
  return (
    <mesh geometry={geom}>
      <shaderMaterial
        ref={mat}
        vertexShader={ARC_VERT}
        fragmentShader={ARC_FRAG}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
        uniforms={{ uTime: { value: 0 }, uOpacity: { value: 0 }, uHot: { value: 0 }, uColor: { value: ARC }, uSeed: { value: seed } }}
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
  const size = (isHome ? 0.07 : 0.04) + Math.sqrt(site.papers.length) * 0.008;
  const color = useMemo(() => new THREE.Color(isHome ? '#fff1c9' : HOT).multiplyScalar(isHome ? 3 : 2.4), [isHome]);
  const hover = useStore((s) => s.hoverSite);
  const pick = useStore((s) => s.pickCountry);
  useFrame((state, dt) => {
    const { hoveredSite, country, mode } = useStore.getState();
    const hot = hoveredSite === site.id || country === site.iso;
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
    <group position={pos} quaternion={quat}>
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
        <sphereGeometry args={[0.2, 8, 8]} />
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
            fontSize={0.15}
            letterSpacing={0.06}
            color="#f3e9d2"
            anchorX="left"
            anchorY={tw.anchorY || 'bottom'}
            position={[0.08, tw.y ?? 0.05, 0]}
            outlineWidth={0.014}
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
  const surface = useRef();
  const glow = useRef();
  const atmo = useRef();
  const [map, glowMap] = useMapTextures();
  const home = SITE_BY_ID[HOME];
  useFrame((_, dt) => {
    const o = fade();
    root.current.visible = o > 0.001;
    root.current.scale.setScalar(0.55 + 0.45 * THREE.MathUtils.smoothstep(anim.map, 0.3, 1));
    // A pinned country turns to face the viewer (its paper-weighted mean longitude).
    const iso = useStore.getState().country;
    if (iso && Math.abs(anim.dragV) < 0.002) {
      const c = COUNTRY_BY_ISO[iso];
      const lon = c.sites.reduce((a, s) => a + s.lon * s.papers.length, 0) / c.sites.reduce((a, s) => a + s.papers.length, 0);
      let goal = spinFor(lon) - BASE_SPIN;
      goal += Math.round((anim.rotY - goal) / (Math.PI * 2)) * Math.PI * 2;
      anim.rotY = THREE.MathUtils.damp(anim.rotY, goal, 2.5, dt);
    }
    spin.current.rotation.y = BASE_SPIN + anim.rotY;
    surface.current.material.opacity = o;
    glow.current.material.opacity = o * 0.22;
    atmo.current.material.uniforms.uOpacity.value = o;
  });
  return (
    <group ref={root} position={MAP_CENTER}>
      <group rotation-x={TILT}>
        <group ref={spin}>
          <mesh ref={surface}>
            <sphereGeometry args={[GLOBE_R, 96, 64]} />
            <meshBasicMaterial map={map} transparent opacity={0} fog={false} />
          </mesh>
          <mesh ref={glow} scale={1.0015}>
            <sphereGeometry args={[GLOBE_R, 96, 64]} />
            <meshBasicMaterial
              map={glowMap}
              color={new THREE.Color(1.5, 1.2, 0.8)}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          {SITES.filter((s) => s.id !== HOME).map((s) => (
            <Arc key={s.id} site={s} home={home} />
          ))}
          {SITES.map((s) => (
            <Site key={s.id} site={s} isHome={s.id === HOME} />
          ))}
          <CityLabels />
        </group>
      </group>
      <mesh ref={atmo} scale={1.15}>
        <sphereGeometry args={[GLOBE_R, 64, 48]} />
        <shaderMaterial
          vertexShader={ATMO_VERT}
          fragmentShader={ATMO_FRAG}
          uniforms={{ uOpacity: { value: 0 } }}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
