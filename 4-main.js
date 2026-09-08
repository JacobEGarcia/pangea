import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ============================== renderer / scene ============================== */
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x131a26, 0.0055);

const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(0, 26, 74);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 8;
controls.maxDistance = 160;
controls.target.set(0, 4, 0);

/* ============================== sky / light ============================== */
const skyGeo = new THREE.SphereGeometry(600, 32, 20);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color(0x0a1024) }, mid: { value: new THREE.Color(0x27395e) }, low: { value: new THREE.Color(0xd4693a) } },
  vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `varying vec3 vP; uniform vec3 top,mid,low;
    void main(){ float h=normalize(vP).y;
      vec3 c = h>0.12 ? mix(mid,top,smoothstep(0.12,0.7,h)) : mix(low,mid,smoothstep(-0.08,0.12,h));
      gl_FragColor=vec4(c,1.0); }`
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

{ // stars
  const n = 900, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.random() * Math.PI * 2, p = Math.acos(Math.random() * 0.85 + 0.12);
    const r = 560;
    pos[i*3]   = r * Math.sin(p) * Math.cos(t);
    pos[i*3+1] = r * Math.cos(p);
    pos[i*3+2] = r * Math.sin(p) * Math.sin(t);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xcdd8ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.75 })));
}
{ // low amber moon-sun on the horizon
  const moon = new THREE.Mesh(new THREE.SphereGeometry(18, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false }));
  moon.position.set(-260, 42, -420); scene.add(moon);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xff9c50, transparent: true, opacity: 0.28, fog: false }));
  glow.position.copy(moon.position); scene.add(glow);
}

const hemi = new THREE.HemisphereLight(0x4a5f8f, 0x2a2016, 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffb27a, 1.5);
sun.position.set(-90, 60, -140);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -110; sun.shadow.camera.right = 110;
sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110;
sun.shadow.camera.far = 400; sun.shadow.bias = -0.0006;
scene.add(sun);
const fill = new THREE.DirectionalLight(0x3d5a8f, 0.4);
fill.position.set(80, 40, 90); scene.add(fill);

/* ============================== ground ============================== */
const GROUND_R = 150;
{
  const g = new THREE.CircleGeometry(GROUND_R, 72);
  const m = new THREE.MeshStandardMaterial({ color: 0x2e3d2a, roughness: 1 });
  const ground = new THREE.Mesh(g, m);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
}
// mottled clearings
for (let i = 0; i < 40; i++) {
  const r = 4 + Math.random() * 12;
  const c = new THREE.Mesh(new THREE.CircleGeometry(r, 20),
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(0.26 + Math.random() * 0.06, 0.28, 0.16 + Math.random() * 0.07), roughness: 1 }));
  const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (GROUND_R - 14);
  c.position.set(Math.cos(a) * d, 0.02 + Math.random() * 0.02, Math.sin(a) * d);
  c.rotation.x = -Math.PI / 2; c.receiveShadow = true; scene.add(c);
}
// visitor path ring + spurs (visual only)
{
  const ring = new THREE.Mesh(new THREE.RingGeometry(20, 25, 72),
    new THREE.MeshStandardMaterial({ color: 0x6b5b45, roughness: 1 }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; ring.receiveShadow = true; scene.add(ring);
}
// pond
{
  const pond = new THREE.Mesh(new THREE.CircleGeometry(10, 36),
    new THREE.MeshStandardMaterial({ color: 0x1d3a4a, roughness: 0.15, metalness: 0.4 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(8, 0.06, 30); scene.add(pond);
}

/* ---------- vegetation ---------- */
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 });
const cycadMat = new THREE.MeshStandardMaterial({ color: 0x2f5527, roughness: 1, side: THREE.DoubleSide });
const conifMat = new THREE.MeshStandardMaterial({ color: 0x24331f, roughness: 1 });
function conifer(x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25*s, 0.4*s, 3*s, 6), trunkMat);
  trunk.position.y = 1.5*s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry((2.4 - i*0.6)*s, 2.6*s, 8), conifMat);
    cone.position.y = (3 + i*1.7)*s; cone.castShadow = true; g.add(cone);
  }
  g.position.set(x, 0, z); scene.add(g);
}
function cycad(x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3*s, 0.45*s, 1.2*s, 6), trunkMat);
  trunk.position.y = 0.6*s; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28*s, 3.2*s, 4), cycadMat);
    leaf.position.y = 1.3*s;
    const a = (i / 7) * Math.PI * 2;
    leaf.rotation.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
    leaf.rotation.order = 'YXZ'; leaf.rotation.y = a;
    leaf.castShadow = true; g.add(leaf);
  }
  g.position.set(x, 0, z); scene.add(g);
}
for (let i = 0; i < 26; i++) {
  const a = Math.random() * Math.PI * 2, d = 100 + Math.random() * 44;
  conifer(Math.cos(a) * d, Math.sin(a) * d, 0.8 + Math.random() * 1.3);
}
for (let i = 0; i < 30; i++) {
  const a = Math.random() * Math.PI * 2, d = 28 + Math.random() * 70;
  if (Math.random() < 0.5) cycad(Math.cos(a) * d, Math.sin(a) * d, 0.7 + Math.random());
  else conifer(Math.cos(a) * d, Math.sin(a) * d, 0.5 + Math.random() * 0.6);
}
// rocks
const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5f58, roughness: 1, flatShading: true });
for (let i = 0; i < 24; i++) {
  const r = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 1.6, 0), rockMat);
  const a = Math.random() * Math.PI * 2, d = 15 + Math.random() * 125;
  r.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d);
  r.rotation.set(Math.random()*3, Math.random()*3, Math.random()*3);
  r.castShadow = r.receiveShadow = true; scene.add(r);
}

/* ============================== creature factory ============================== */
/* Every creature is built from primitives, then rigged: hips/shoulders are
   pivots, knees animate, the spine chain sways, the tail counter-sways.
   A gait phase offset per leg gives diagonal (quad) or alternating (biped) steps. */

function mat(color, rough = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, flatShading: true });
}
function ball(m, r, sx = 1, sy = 1, sz = 1) {
  const b = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m);
  b.scale.set(sx, sy, sz); b.castShadow = true; return b;
}
function limbSeg(m, r1, r2, len) {
  const s = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, len, 6), m);
  s.position.y = -len / 2; s.castShadow = true; return s;
}

/* spec: {
  body:{r,sx,sy,sz,y}, head:{r,sx,sy,sz,x,y,z?}, neck:{segs,len,r} | null,
  tail:{segs,len,r}, legs:[{x,z,len,r,phase}] (hip pivots),
  color, belly, extras(group,mats), gait:{legAmp,kneeAmp,bob,neckSway,tailSway,freq},
  wing?:{span,chord} } */
function buildCreature(spec) {
  const m = mat(spec.color), mb = mat(spec.belly || spec.color, 1);
  const root = new THREE.Group();          // moves along path
  const body = new THREE.Group();          // bobs + rolls
  root.add(body);

  const torso = ball(m, spec.body.r, spec.body.sx, spec.body.sy, spec.body.sz);
  torso.position.y = spec.body.y; body.add(torso);
  const belly = ball(mb, spec.body.r * 0.86, spec.body.sx * 0.92, spec.body.sy * 0.88, spec.body.sz * 0.9);
  belly.position.set(0, spec.body.y - spec.body.r * 0.28, spec.body.r * 0.1);
  body.add(belly);

  const parts = { legs: [], tail: [], neck: [], body, root };

  // neck + head (head points +z, creature walks +z)
  let neckBase = body;
  if (spec.neck) {
    const nz = spec.body.r * spec.body.sz * 0.82;
    let parent = body, py = spec.body.y + spec.body.r * spec.body.sy * 0.45;
    for (let i = 0; i < spec.neck.segs; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, i === 0 ? py : spec.neck.len, i === 0 ? nz : 0.12);
      const seg = limbSeg(m, spec.neck.r * (1 - i * 0.12), spec.neck.r * (1 - (i + 1) * 0.12), spec.neck.len);
      seg.rotation.x = Math.PI; seg.position.y = spec.neck.len / 2;
      piv.add(seg); parent.add(piv); parent = piv; parts.neck.push(piv);
    }
    neckBase = parent;
  }
  const headPiv = new THREE.Group();
  if (spec.neck) headPiv.position.set(0, spec.neck.len, 0.15);
  else headPiv.position.set(0, spec.head.y ?? spec.body.y + spec.body.r * 0.5, spec.body.r * spec.body.sz * 0.85);
  const head = ball(m, spec.head.r, spec.head.sx, spec.head.sy, spec.head.sz);
  headPiv.add(head);
  if (spec.head.snout) {
    const sn = ball(m, spec.head.r * 0.55, spec.head.snout[0], spec.head.snout[1], spec.head.snout[2]);
    sn.position.set(0, -spec.head.r * 0.18, spec.head.r * spec.head.sz * 0.85);
    headPiv.add(sn);
  }
  // eyes
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x0c0a08 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(spec.head.r * 0.13, 6, 6), eyeM);
    e.position.set(s * spec.head.r * spec.head.sx * 0.55, spec.head.r * 0.2, spec.head.r * spec.head.sz * 0.55);
    headPiv.add(e);
  }
  neckBase.add(headPiv); parts.head = headPiv;

  // tail (trails -z)
  {
    let parent = body, pz = -spec.body.r * spec.body.sz * 0.85, py = spec.body.y + spec.body.r * 0.15;
    for (let i = 0; i < spec.tail.segs; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, i === 0 ? py : 0, i === 0 ? pz : -spec.tail.len * 0.92);
      const r = spec.tail.r * (1 - i / (spec.tail.segs + 1));
      const seg = limbSeg(m, r, Math.max(r * 0.7, 0.03), spec.tail.len);
      seg.rotation.x = -Math.PI / 2; seg.position.set(0, 0, -spec.tail.len / 2);
      piv.add(seg); parent.add(piv); parent = piv; parts.tail.push(piv);
    }
    parts.tailTip = parent;
  }

  // legs
  for (const L of spec.legs) {
    const hip = new THREE.Group();
    hip.position.set(L.x, L.hipY ?? spec.body.y * 0.9, L.z);
    const upperLen = L.len * 0.52, lowerLen = L.len * 0.48;
    hip.add(limbSeg(m, L.r, L.r * 0.75, upperLen));
    const knee = new THREE.Group(); knee.position.y = -upperLen; hip.add(knee);
    knee.add(limbSeg(m, L.r * 0.72, L.r * 0.45, lowerLen));
    const foot = ball(m, L.r * 0.62, 1.15, 0.5, 1.5);
    foot.position.set(0, -lowerLen, L.r * 0.35); knee.add(foot);
    body.add(hip);
    parts.legs.push({ hip, knee, phase: L.phase || 0 });
  }

  // optional wings (pterosaur): pivot at shoulder
  if (spec.wing) {
    parts.wings = [];
    for (const s of [-1, 1]) {
      const piv = new THREE.Group();
      piv.position.set(s * spec.body.r * spec.body.sx * 0.55, spec.body.y + spec.body.r * 0.4, 0);
      const w = new THREE.Mesh(new THREE.PlaneGeometry(spec.wing.span, spec.wing.chord, 4, 1), mat(spec.wing.color || spec.color, 0.95));
      w.material.side = THREE.DoubleSide;
      w.position.x = s * spec.wing.span / 2; w.castShadow = true;
      // taper the wing
      const pos = w.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = Math.abs(pos.getX(i)) / (spec.wing.span / 2);
        pos.setY(i, pos.getY(i) * (1 - x * 0.75) - x * 0.15 * spec.wing.chord);
      }
      pos.needsUpdate = true; w.geometry.computeVertexNormals();
      piv.add(w); body.add(piv); parts.wings.push({ piv, side: s });
    }
  }

  if (spec.extras) spec.extras(body, m, mb, spec, parts);
  root.traverse(o => { if (o.isMesh) o.receiveShadow = true; });
  return parts;
}

/* extras builders */
function frillAndHorns(scale) {
  return (body, m) => {
    const frill = new THREE.Mesh(new THREE.CircleGeometry(0.85 * scale, 12, Math.PI * 0.05, Math.PI * 0.9),
      new THREE.MeshStandardMaterial({ color: 0x7a4a35, roughness: 1, flatShading: true, side: THREE.DoubleSide }));
    frill.position.set(0, 2.15 * scale, 1.1 * scale);
    frill.rotation.x = -0.5; frill.rotation.z = Math.PI / 2 + Math.PI * 0.45;
    frill.castShadow = true; body.add(frill);
    const hornM = mat(0xd8cdb4, 0.7);
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.7 * scale, 6), hornM);
      h.position.set(s * 0.28 * scale, 2.3 * scale, 1.55 * scale);
      h.rotation.x = 1.1; h.castShadow = true; body.add(h);
    }
    const nh = new THREE.Mesh(new THREE.ConeGeometry(0.07 * scale, 0.4 * scale, 6), hornM);
    nh.position.set(0, 2.15 * scale, 1.8 * scale); nh.rotation.x = 1.4; body.add(nh);
  };
}
function stegoPlates(scale) {
  return (body) => {
    const pm = mat(0xb0623a, 1);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const p = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale * (1 - Math.abs(t - 0.5) * 0.8), 1.1 * scale * (1 - Math.abs(t - 0.5) * 0.9), 4), pm);
      p.scale.z = 0.18;
      p.position.set(0, (1.75 + Math.sin(t * Math.PI) * 0.5) * scale, (1.15 - t * 2.3) * scale);
      p.castShadow = true; body.add(p);
    }
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.55 * scale, 5), mat(0xd8cdb4, 0.7));
      sp.position.set(s * 0.2 * scale, 1.4 * scale, -1.75 * scale);
      sp.rotation.x = -1.2; sp.rotation.z = s * 0.4; body.add(sp);
    }
  };
}
function ankyArmor(scale) {
  return (body) => {
    const am = mat(0x4c4438, 1);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.3 * scale, 4), am);
      b.position.set(Math.cos(a) * 0.75 * scale, (1.35 + Math.sin(a) * 0.12) * scale, (Math.sin(a * 2)) * 0.9 * scale);
      b.castShadow = true; body.add(b);
    }
    const club = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3 * scale, 0), am);
    club.scale.set(1.3, 0.8, 1);
    club.position.set(0, 0.55 * scale, -2.5 * scale); club.castShadow = true; body.add(club);
  };
}
function paraCrest(scale) {
  return (body, m) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.1 * scale, 0.9 * scale, 6), m);
    c.position.set(0, 2.5 * scale, 0.75 * scale);
    c.rotation.x = -1.9; c.castShadow = true; body.add(c);
  };
}
function tuskFace(scale) { // lystrosaurus: beak + two tusks
  return (body) => {
    const tm = mat(0xe8ddc4, 0.6);
    for (const s of [-1, 1]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.06 * scale, 0.3 * scale, 6), tm);
      t.position.set(s * 0.16 * scale, 0.62 * scale, 1.05 * scale);
      t.rotation.x = Math.PI; t.castShadow = true; body.add(t);
    }
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.3 * scale, 6), mat(0x6b5b45, 0.8));
    beak.position.set(0, 0.78 * scale, 1.12 * scale); beak.rotation.x = 1.57; body.add(beak);
  };
}

/* ============================== species & enclosures ============================== */
const EXHIBITS = [
  {
    id: 'trex', no: 'EXHIBIT 01', name: 'Tyrannosaurus rex', pron: 'tih-RAN-oh-SORE-us  ·  "tyrant lizard king"',
    period: 'Late Cretaceous · 68–66 Ma', diet: 'Carnivore', size: '12.3 m · ~8.8 t', found: 'Hell Creek, Montana, USA',
    blurb: 'The park\'s apex resident. Its bite could crush bone, and it walked at a purposeful 8 km/h — which is exactly the pace it keeps here, all night, every night.',
    pos: [-38, -34], padR: 17, speed: 0.55, scale: 1.55,
    spec: {
      color: 0x6e5a43, belly: 0x8a7a5c,
      body: { r: 1.5, sx: 1.05, sy: 1.1, sz: 1.6, y: 3.1 },
      head: { r: 0.85, sx: 0.85, sy: 0.95, sz: 1.25, snout: [1, 0.8, 1.4] },
      neck: { segs: 1, len: 0.7, r: 0.55 },
      tail: { segs: 4, len: 1.25, r: 0.6 },
      legs: [
        { x: -0.85, z: -0.4, len: 3.0, r: 0.5, phase: 0, hipY: 3.0 },
        { x:  0.85, z: -0.4, len: 3.0, r: 0.5, phase: Math.PI, hipY: 3.0 },
      ],
      gait: { legAmp: 0.62, kneeAmp: 0.9, bob: 0.1, neckSway: 0.08, tailSway: 0.3, freq: 2.6 },
    },
  },
  {
    id: 'trike', no: 'EXHIBIT 02', name: 'Triceratops horridus', pron: 'try-SER-ah-tops  ·  "three-horned face"',
    period: 'Late Cretaceous · 68–66 Ma', diet: 'Herbivore', size: '9 m · ~6 t', found: 'Wyoming, USA',
    blurb: 'A pair grazes the meadow in slow circuits. The frill is solid bone; the horns are for rivals and, occasionally, for reminding the rex across the park why it eats alone.',
    pos: [40, -30], padR: 16, speed: 0.3, scale: 1.1, count: 2,
    spec: {
      color: 0x74685a, belly: 0x948a76,
      body: { r: 1.5, sx: 1.1, sy: 1.05, sz: 1.55, y: 2.2 },
      head: { r: 0.8, sx: 0.9, sy: 0.9, sz: 1.15, y: 2.3, snout: [0.9, 0.7, 1.1] },
      neck: null,
      tail: { segs: 3, len: 0.85, r: 0.5 },
      legs: [
        { x: -0.95, z:  0.8, len: 2.1, r: 0.42, phase: 0 },
        { x:  0.95, z:  0.8, len: 2.1, r: 0.42, phase: Math.PI },
        { x: -0.95, z: -0.8, len: 2.1, r: 0.46, phase: Math.PI },
        { x:  0.95, z: -0.8, len: 2.1, r: 0.46, phase: 0 },
      ],
      gait: { legAmp: 0.45, kneeAmp: 0.6, bob: 0.06, neckSway: 0.05, tailSway: 0.18, freq: 2.2 },
      extras: null, // set below (needs scale)
    },
  },
  {
    id: 'brach', no: 'EXHIBIT 03', name: 'Brachiosaurus altithorax', pron: 'BRAK-ee-oh-SORE-us  ·  "arm lizard"',
    period: 'Late Jurassic · 154–150 Ma', diet: 'Herbivore', size: '21 m · ~35 t', found: 'Colorado, USA',
    blurb: 'The tallest thing in the park by a wide margin. It browses the tree line and its heart — the size of a bathtub — pushes blood eight metres uphill to its head.',
    pos: [42, 32], padR: 18, speed: 0.16, scale: 2.0,
    spec: {
      color: 0x5d6b52, belly: 0x77856a,
      body: { r: 1.7, sx: 1.05, sy: 1.0, sz: 1.5, y: 3.4 },
      head: { r: 0.45, sx: 0.8, sy: 0.85, sz: 1.2, snout: [0.9, 0.7, 1] },
      neck: { segs: 3, len: 1.15, r: 0.5 },
      tail: { segs: 4, len: 1.0, r: 0.55 },
      legs: [
        { x: -0.95, z:  0.9, len: 3.2, r: 0.45, phase: 0 },
        { x:  0.95, z:  0.9, len: 3.2, r: 0.45, phase: Math.PI },
        { x: -0.95, z: -0.9, len: 2.9, r: 0.42, phase: Math.PI * 0.9 },
        { x:  0.95, z: -0.9, len: 2.9, r: 0.42, phase: Math.PI * 1.9 },
      ],
      gait: { legAmp: 0.32, kneeAmp: 0.4, bob: 0.05, neckSway: 0.16, tailSway: 0.2, freq: 1.4 },
    },
  },
  {
    id: 'stego', no: 'EXHIBIT 04', name: 'Stegosaurus stenops', pron: 'STEG-oh-SORE-us  ·  "roofed lizard"',
    period: 'Late Jurassic · 155–150 Ma', diet: 'Herbivore', size: '9 m · ~5 t', found: 'Morrison Fm., USA',
    blurb: 'The plates flush with blood when it is alarmed — blush-red billboards along the spine. The four tail spikes, the thagomizer, are not for show.',
    pos: [-44, 22], padR: 15, speed: 0.22, scale: 1.15,
    spec: {
      color: 0x6b6152, belly: 0x857a67,
      body: { r: 1.4, sx: 0.95, sy: 1.15, sz: 1.5, y: 1.9 },
      head: { r: 0.42, sx: 0.7, sy: 0.7, sz: 1.1, y: 1.4, snout: [0.8, 0.6, 1] },
      neck: { segs: 1, len: 0.5, r: 0.35 },
      tail: { segs: 3, len: 0.95, r: 0.42 },
      legs: [
        { x: -0.75, z:  0.75, len: 1.35, r: 0.3, phase: 0 },
        { x:  0.75, z:  0.75, len: 1.35, r: 0.3, phase: Math.PI },
        { x: -0.8, z: -0.75, len: 1.7, r: 0.36, phase: Math.PI },
        { x:  0.8, z: -0.75, len: 1.7, r: 0.36, phase: 0 },
      ],
      gait: { legAmp: 0.4, kneeAmp: 0.5, bob: 0.05, neckSway: 0.06, tailSway: 0.24, freq: 2.0 },
      extras: null,
    },
  },
  {
    id: 'raptor', no: 'EXHIBIT 05', name: 'Velociraptor mongoliensis', pron: 'veh-LOSS-ih-RAP-tor  ·  "swift thief"',
    period: 'Late Cretaceous · 75–71 Ma', diet: 'Carnivore', size: '2 m · ~15 kg', found: 'Gobi Desert, Mongolia',
    blurb: 'Turkey-sized, feathered, and much too clever. The three of them patrol the paddock fence line in formation, testing it. They are always testing it.',
    pos: [-8, -52], padR: 13, speed: 0.9, scale: 0.5, count: 3,
    spec: {
      color: 0x7a6248, belly: 0x99805e,
      body: { r: 1.2, sx: 0.7, sy: 0.75, sz: 1.5, y: 2.0 },
      head: { r: 0.55, sx: 0.7, sy: 0.75, sz: 1.3, snout: [0.8, 0.55, 1.5] },
      neck: { segs: 2, len: 0.5, r: 0.32 },
      tail: { segs: 4, len: 0.85, r: 0.32 },
      legs: [
        { x: -0.42, z: -0.3, len: 1.9, r: 0.26, phase: 0 },
        { x:  0.42, z: -0.3, len: 1.9, r: 0.26, phase: Math.PI },
      ],
      gait: { legAmp: 0.8, kneeAmp: 1.1, bob: 0.12, neckSway: 0.1, tailSway: 0.22, freq: 4.4 },
    },
  },
  {
    id: 'anky', no: 'EXHIBIT 06', name: 'Ankylosaurus magniventris', pron: 'ang-KY-loh-SORE-us  ·  "fused lizard"',
    period: 'Late Cretaceous · 68–66 Ma', diet: 'Herbivore', size: '8 m · ~6 t', found: 'Montana, USA',
    blurb: 'A living bunker. Armour over every inch of its back, armoured eyelids, and a tail club that could shatter an anklebone. Nothing in the park bothers it. Nothing dares.',
    pos: [10, 52], padR: 14, speed: 0.18, scale: 1.2,
    spec: {
      color: 0x59503f, belly: 0x746a55,
      body: { r: 1.4, sx: 1.35, sy: 0.85, sz: 1.4, y: 1.5 },
      head: { r: 0.5, sx: 1.0, sy: 0.75, sz: 1.0, y: 1.1, snout: [0.9, 0.6, 0.9] },
      neck: null,
      tail: { segs: 3, len: 0.8, r: 0.3 },
      legs: [
        { x: -1.0, z:  0.7, len: 1.1, r: 0.36, phase: 0 },
        { x:  1.0, z:  0.7, len: 1.1, r: 0.36, phase: Math.PI },
        { x: -1.0, z: -0.7, len: 1.1, r: 0.36, phase: Math.PI },
        { x:  1.0, z: -0.7, len: 1.1, r: 0.36, phase: 0 },
      ],
      gait: { legAmp: 0.35, kneeAmp: 0.45, bob: 0.04, neckSway: 0.04, tailSway: 0.16, freq: 1.8 },
      extras: null,
    },
  },
  {
    id: 'para', no: 'EXHIBIT 07', name: 'Parasaurolophus walkeri', pron: 'para-SAW-roh-LOAF-us  ·  "near-crested lizard"',
    period: 'Late Cretaceous · 76–73 Ma', diet: 'Herbivore', size: '9.5 m · ~3 t', found: 'New Mexico, USA',
    blurb: 'The crest is a trombone of bone — it honks across the pond at dusk in a register you feel in your sternum. The herd answers from the far paddock.',
    pos: [-14, 6], padR: 12, speed: 0.28, scale: 1.2,
    spec: {
      color: 0x6f7a5a, belly: 0x8d9678,
      body: { r: 1.4, sx: 0.95, sy: 1.0, sz: 1.55, y: 2.5 },
      head: { r: 0.5, sx: 0.7, sy: 0.75, sz: 1.2, snout: [0.8, 0.55, 1.3] },
      neck: { segs: 2, len: 0.6, r: 0.4 },
      tail: { segs: 4, len: 0.95, r: 0.42 },
      legs: [
        { x: -0.8, z:  0.7, len: 2.2, r: 0.34, phase: 0 },
        { x:  0.8, z:  0.7, len: 2.2, r: 0.34, phase: Math.PI },
        { x: -0.8, z: -0.7, len: 2.4, r: 0.4, phase: Math.PI * 0.85 },
        { x:  0.8, z: -0.7, len: 2.4, r: 0.4, phase: Math.PI * 1.85 },
      ],
      gait: { legAmp: 0.5, kneeAmp: 0.65, bob: 0.07, neckSway: 0.12, tailSway: 0.2, freq: 2.4 },
      extras: null,
    },
  },
  {
    id: 'lystro', no: 'EXHIBIT 08', name: 'Lystrosaurus murrayi', pron: 'LISS-troh-SORE-us  ·  "shovel lizard"',
    period: 'Early Triassic · 250–248 Ma', diet: 'Herbivore', size: '1 m · ~45 kg', found: 'Antarctica → everywhere',
    blurb: 'Not a dinosaur — a synapsid, closer to you than to the rex. It survived the worst extinction Earth has ever had, then became 95% of all land vertebrates. Our homage to the motion study that inspired this park.',
    pos: [18, -8], padR: 9, speed: 0.25, scale: 0.85, count: 2,
    spec: {
      color: 0x7a6a58, belly: 0x8f8070,
      body: { r: 0.75, sx: 1.0, sy: 0.95, sz: 1.35, y: 0.72 },
      head: { r: 0.42, sx: 0.85, sy: 0.9, sz: 1.0, y: 0.72, snout: [0.85, 0.7, 0.9] },
      neck: null,
      tail: { segs: 2, len: 0.3, r: 0.18 },
      legs: [
        { x: -0.55, z:  0.35, len: 0.62, r: 0.14, phase: 0 },
        { x:  0.55, z:  0.35, len: 0.62, r: 0.14, phase: Math.PI },
        { x: -0.5, z: -0.35, len: 0.62, r: 0.13, phase: Math.PI },
        { x:  0.5, z: -0.35, len: 0.62, r: 0.13, phase: 0 },
      ],
      gait: { legAmp: 0.55, kneeAmp: 0.6, bob: 0.05, neckSway: 0.03, tailSway: 0.12, freq: 3.2 },
      extras: null,
    },
  },
];
// extras that need scale wired after table definition
const byId = Object.fromEntries(EXHIBITS.map(e => [e.id, e]));
byId.trike.spec.extras  = frillAndHorns(1.0);
byId.stego.spec.extras  = stegoPlates(1.0);
byId.anky.spec.extras   = ankyArmor(1.0);
byId.para.spec.extras   = paraCrest(1.0);
byId.lystro.spec.extras = tuskFace(1.0);

/* ============================== enclosures ============================== */
const postMat = new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: 1 });
const railMat = new THREE.MeshStandardMaterial({ color: 0x54473a, roughness: 1 });
function buildEnclosure(cx, cz, r) {
  const g = new THREE.Group();
  const posts = Math.max(10, Math.round(r * 1.1));
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.7, 6), postMat);
    p.position.set(cx + Math.cos(a) * r, 0.85, cz + Math.sin(a) * r);
    p.castShadow = true; g.add(p);
  }
  for (const h of [0.7, 1.35]) {
    const rail = new THREE.Mesh(new THREE.TorusGeometry(r, 0.05, 5, 64), railMat);
    rail.rotation.x = Math.PI / 2; rail.position.set(cx, h, cz); g.add(rail);
  }
  // subtle dirt interior
  const dirt = new THREE.Mesh(new THREE.CircleGeometry(r - 0.4, 40),
    new THREE.MeshStandardMaterial({ color: 0x51432f, roughness: 1 }));
  dirt.rotation.x = -Math.PI / 2; dirt.position.set(cx, 0.04, cz);
  dirt.receiveShadow = true; g.add(dirt);
  scene.add(g);
}
function signTexture(name) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const x = c.getContext('2d');
  x.fillStyle = '#1a1610'; x.fillRect(0, 0, 512, 160);
  x.strokeStyle = '#ffb454'; x.lineWidth = 5; x.strokeRect(8, 8, 496, 144);
  x.fillStyle = '#ffb454'; x.font = '600 15px Helvetica'; x.textAlign = 'center';
  x.fillText('P A N G E A', 256, 44);
  x.fillStyle = '#e8ddc9'; x.font = 'italic 600 34px Georgia';
  x.fillText(name, 256, 96);
  x.fillStyle = 'rgba(232,221,201,.55)'; x.font = '12px Helvetica';
  x.fillText('L I V E   E X H I B I T', 256, 130);
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

/* ============================== instantiate ============================== */
const animals = [];      // {parts, spec, exhibit, pathR, ang, speed, offset, grazeT}
const hitTargets = [];   // invisible spheres for raycast

for (const ex of EXHIBITS) {
  const [cx, cz] = ex.pos;
  buildEnclosure(cx, cz, ex.padR);

  // sign at fence edge facing park center
  const sign = new THREE.Group();
  const sa = Math.atan2(-cz, -cx);
  const sx = cx + Math.cos(sa) * (ex.padR + 1.2), sz = cz + Math.sin(sa) * (ex.padR + 1.2);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.05),
    new THREE.MeshStandardMaterial({ map: signTexture(ex.name), side: THREE.DoubleSide }));
  board.position.y = 1.5; sign.add(board);
  for (const o of [-1.4, 1.4]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.5, 6), postMat);
    leg.position.set(o, 0.75, 0); sign.add(leg);
  }
  sign.position.set(sx, 0, sz);
  sign.rotation.y = -sa - Math.PI / 2;
  scene.add(sign);

  // invisible click target over the paddock
  const hit = new THREE.Mesh(new THREE.SphereGeometry(ex.padR, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(cx, 3, cz); hit.userData.exhibit = ex;
  scene.add(hit); hitTargets.push(hit);

  const n = ex.count || 1;
  for (let i = 0; i < n; i++) {
    const parts = buildCreature(ex.spec);
    parts.root.scale.setScalar(ex.scale * (n > 1 ? 0.9 + Math.random() * 0.2 : 1));
    scene.add(parts.root);
    animals.push({
      parts, ex,
      pathR: ex.padR * (0.35 + (i % 3) * 0.18),
      ang: Math.random() * Math.PI * 2,
      dir: Math.random() < 0.5 ? 1 : -1,
      speed: ex.speed * (0.85 + Math.random() * 0.3),
      phase: Math.random() * 10,
      graze: Math.random() * 8,   // countdown to graze pause
      grazing: 0,
    });
  }
}

/* flying pteranodons overhead (aviary of the sky) */
const flyers = [];
{
  const pteroSpec = {
    color: 0x5a4a52, belly: 0x746270,
    body: { r: 0.5, sx: 0.8, sy: 0.8, sz: 1.4, y: 0 },
    head: { r: 0.3, sx: 0.6, sy: 0.6, sz: 1.1, snout: [0.7, 0.4, 2.2] },
    neck: { segs: 1, len: 0.25, r: 0.18 },
    tail: { segs: 1, len: 0.4, r: 0.12 },
    legs: [], wing: { span: 3.4, chord: 1.0, color: 0x6a5660 },
    gait: { legAmp: 0, kneeAmp: 0, bob: 0, neckSway: 0.03, tailSway: 0.05, freq: 1 },
  };
  for (let i = 0; i < 3; i++) {
    const parts = buildCreature(pteroSpec);
    scene.add(parts.root);
    flyers.push({ parts, r: 34 + i * 14, h: 34 + i * 7, ang: (i / 3) * Math.PI * 2, speed: 0.14 + i * 0.03, flap: Math.random() * 7 });
  }
}

/* entrance gate arch at park south */
{
  const gm = new THREE.MeshStandardMaterial({ color: 0x3d3428, roughness: 1 });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 7, 8), gm);
    p.position.set(s * 4, 3.5, 66); p.castShadow = true; scene.add(p);
  }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(9.6, 1.0, 0.8), gm);
  beam.position.set(0, 7, 66); beam.castShadow = true; scene.add(beam);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 0.78),
    new THREE.MeshStandardMaterial({ map: signTexture('Z O O'), side: THREE.DoubleSide }));
  board.position.set(0, 7, 66.45); scene.add(board);
}

/* ============================== animation ============================== */
function animateAnimal(a, t, dt) {
  const { parts, ex } = a;
  const g = ex.spec.gait;

  // graze pauses: stand still and drop the head
  a.graze -= dt;
  if (a.graze <= 0) { a.grazing = 2.5 + Math.random() * 3; a.graze = 6 + Math.random() * 10; }
  const moving = a.grazing > 0 ? 0 : 1;
  if (a.grazing > 0) a.grazing -= dt;

  // walk the loop
  if (moving) a.ang += (a.speed * dt / a.pathR) * a.dir;
  const [cx, cz] = ex.pos;
  const x = cx + Math.cos(a.ang) * a.pathR;
  const z = cz + Math.sin(a.ang) * a.pathR;
  parts.root.position.set(x, 0, z);
  const heading = a.ang + a.dir * Math.PI / 2;
  parts.root.rotation.y = -heading + (a.dir > 0 ? 0 : Math.PI);

  const f = g.freq * (moving ? 1 : 0.12), ph = t * f + a.phase;

  // legs
  for (const leg of parts.legs) {
    const s = Math.sin(ph + leg.phase);
    leg.hip.rotation.x = s * g.legAmp * (moving ? 1 : 0.05);
    leg.knee.rotation.x = Math.max(0, Math.sin(ph + leg.phase - 1.1)) * g.kneeAmp * (moving ? 1 : 0.05);
  }
  // body bob & roll
  parts.body.position.y = Math.abs(Math.sin(ph)) * g.bob * (moving ? 1 : 0.3);
  parts.body.rotation.z = Math.sin(ph) * g.bob * 0.35;
  // breathing
  const br = 1 + Math.sin(t * 1.4 + a.phase) * 0.012;
  parts.body.scale.set(br, br, 1);

  // neck sway; graze dips the whole neck chain
  const dip = a.grazing > 0 ? Math.min(1, (2.5 + 3 - a.grazing) * 0.8, a.grazing * 0.8) * 0.5 : 0;
  parts.neck.forEach((piv, i) => {
    piv.rotation.x = Math.sin(ph * 0.5 + i) * g.neckSway + dip * 0.55;
    piv.rotation.z = Math.sin(t * 0.6 + i + a.phase) * g.neckSway * 0.5;
  });
  parts.head.rotation.y = Math.sin(t * 0.4 + a.phase * 2) * 0.3;
  parts.head.rotation.x = dip * 0.4 + Math.sin(t * 0.9 + a.phase) * 0.05;

  // tail counter-sway
  parts.tail.forEach((piv, i) => {
    piv.rotation.y = Math.sin(ph * 0.5 - i * 0.7) * g.tailSway;
    piv.rotation.x = Math.sin(t * 0.8 + i) * 0.04;
  });
}

function animateFlyer(f, t, dt) {
  f.ang += f.speed * dt;
  const x = Math.cos(f.ang) * f.r, z = Math.sin(f.ang) * f.r * 0.8;
  const y = f.h + Math.sin(t * 0.5 + f.r) * 3;
  f.parts.root.position.set(x, y, z);
  f.parts.root.rotation.y = -f.ang - Math.PI / 2 + Math.PI;
  f.parts.root.rotation.z = 0.18; // bank into the circle
  const flap = Math.sin(t * 5 + f.flap);
  for (const w of f.parts.wings) w.piv.rotation.z = w.side * flap * 0.55;
  f.parts.tail.forEach(p => { p.rotation.y = Math.sin(t * 2) * 0.1; });
}

/* ============================== ui / interaction ============================== */
const placard = document.getElementById('placard');
const navEl = document.getElementById('exhibits');
let focusTarget = null, focusDist = null;

function showPlacard(ex) {
  placard.hidden = false;
  placard.querySelector('.no').textContent = ex.no + (ex.count ? `  ·  ${ex.count} IN RESIDENCE` : '');
  placard.querySelector('h2').textContent = ex.name;
  placard.querySelector('.pron').textContent = ex.pron;
  placard.querySelector('dl').innerHTML =
    `<dt>Period</dt><dd>${ex.period}</dd><dt>Diet</dt><dd>${ex.diet}</dd>` +
    `<dt>Size</dt><dd>${ex.size}</dd><dt>Found</dt><dd>${ex.found}</dd>`;
  placard.querySelector('p').textContent = ex.blurb;
  focusTarget = new THREE.Vector3(ex.pos[0], 3.5, ex.pos[1]);
  focusDist = ex.padR + 16;
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.id === ex.id));
}
placard.querySelector('.close').onclick = () => { placard.hidden = true; focusTarget = null; };

for (const ex of EXHIBITS) {
  const b = document.createElement('button');
  b.dataset.id = ex.id;
  b.innerHTML = `${ex.no.slice(-2)} · ${ex.name.split(' ')[0]}<em>${ex.period.split('·')[1] || ''}</em>`;
  b.onclick = () => showPlacard(ex);
  navEl.appendChild(b);
}

const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let downAt = 0;
renderer.domElement.addEventListener('pointerdown', () => downAt = performance.now());
renderer.domElement.addEventListener('pointerup', e => {
  if (performance.now() - downAt > 250) return; // was a drag
  ptr.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(hitTargets)[0];
  if (hit) showPlacard(hit.object.userData.exhibit);
});

/* guided tour */
let touring = false, tourIdx = -1, tourTimer = 0;
const tourBtn = document.getElementById('tour');
tourBtn.onclick = () => {
  touring = !touring;
  tourBtn.classList.toggle('on', touring);
  tourBtn.textContent = touring ? 'END TOUR' : 'GUIDED TOUR';
  tourTimer = 0;
};

/* park clock — a park minute is a real second-ish; show "park time" racing */
const clockEl = document.getElementById('clock');
let parkMins = 20 * 60; // opens at dusk, 20:00
setInterval(() => {
  parkMins = (parkMins + 1) % (24 * 60);
  const h = String(Math.floor(parkMins / 60)).padStart(2, '0');
  const m = String(parkMins % 60).padStart(2, '0');
  clockEl.textContent = `${h}:${m}`;
}, 1000);

/* intro */
const intro = document.getElementById('intro');
intro.addEventListener('click', () => {
  intro.style.opacity = '0';
  setTimeout(() => intro.remove(), 1300);
});

/* ============================== loop ============================== */
const clk = new THREE.Clock();
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clk.getDelta(), 0.05), t = clk.elapsedTime;

  for (const a of animals) animateAnimal(a, t, dt);
  for (const f of flyers) animateFlyer(f, t, dt);

  if (touring) {
    tourTimer -= dt;
    if (tourTimer <= 0) {
      tourIdx = (tourIdx + 1) % EXHIBITS.length;
      showPlacard(EXHIBITS[tourIdx]);
      tourTimer = 9;
    }
  }
  if (focusTarget) {
    controls.target.lerp(focusTarget, 0.04);
    const dir = camera.position.clone().sub(controls.target).normalize();
    const want = focusTarget.clone().add(dir.multiplyScalar(focusDist));
    camera.position.lerp(want, 0.03);
  }
  controls.update();
  renderer.render(scene, camera);
}
frame();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
