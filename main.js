import * as THREE from 'three';

const $ = (id) => document.getElementById(id);
const world = $('world');
const state = {
  x: -2.5, z: 4.4, heading: 0, targetHeading: 0, cameraYaw: 0, cameraPitch: .57,
  keys: new Set(), pad: { x: 0, z: 0 }, gamepad: null, gamepadButtons: [],
  respect: 12, chapter: 0, radioRewarded: false, freeTimeCount: 0,
  clock: 0, toastTimer: 0, modal: false, moving: false, vehicle: null,
  sprint: false, jumping: false, jumpTime: 0, punchTime: 0, punchCombo: 0,
  choiceIndex: 0, paused: false, mapOpen: false, taxiJob: false,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color('#91b4af');
scene.fog = new THREE.Fog('#91b4af', 42, 112);
const camera = new THREE.PerspectiveCamera(47, innerWidth / innerHeight, 0.1, 180);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.domElement.setAttribute('aria-label', 'Three-dimensional Cape Town neighbourhood. Use WASD, arrow keys or the touch pad to walk. Tap a character to interact.');
world.prepend(renderer.domElement);

const hemi = new THREE.HemisphereLight('#e5f3e7', '#45544a', 2.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#ffe0a6', 3.5);
sun.position.set(-24, 35, 18);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -50; sun.shadow.camera.right = 50;
sun.shadow.camera.top = 50; sun.shadow.camera.bottom = -50;
sun.shadow.bias = -0.0005;
scene.add(sun);

const mat = (color, roughness = .9, options = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...options });
const mats = {
  asphalt: mat('#565953'), line: mat('#ded3ad'), curb: mat('#b5a990'), sidewalk: mat('#b9ad93'),
  grass: mat('#718064'), sea: mat('#548b89', .45), sand: mat('#d0b68c'),
  wall: ['#b96f51','#d09b64','#899b78','#8d7868','#a9614d','#719183','#b47d5d','#7c8b78','#ad7650'].map(c=>mat(c)),
  roof: ['#d9ac72','#e6c18c','#a9aa83','#bf9270'].map(c=>mat(c)),
  glass: mat('#344f50', .35, { metalness: .15 }),
  glassLit: mat('#e3c587', .38, { emissive: '#a37e43', emissiveIntensity: .2 }),
  dark: mat('#2b302d'), white: mat('#ede3c9'), leaf: mat('#617b5a'), trunk: mat('#5a4635'),
};
const floor = new THREE.Mesh(new THREE.PlaneGeometry(150, 150), mats.grass);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
const solids = [];

function box(parent, x, y, z, w, h, d, material, opts = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z); mesh.castShadow = opts.castShadow !== false; mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function cylinder(parent, x, y, z, rt, rb, h, material, segments = 10) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, segments), material);
  mesh.position.set(x, y, z); mesh.castShadow = true; parent.add(mesh); return mesh;
}
function groundPatch(x, z, w, d, material, y = .012) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, y, z); mesh.receiveShadow = true; scene.add(mesh); return mesh;
}

// Roads create an open grid so the player can roam without getting boxed in.
const roadSites = [-24, 0, 24];
roadSites.forEach(z => {
  groundPatch(0, z, 126, 9, mats.asphalt, .025);
  groundPatch(0, z - 4.8, 126, 1.1, mats.sidewalk, .04);
  groundPatch(0, z + 4.8, 126, 1.1, mats.sidewalk, .04);
  for (let x = -56; x <= 56; x += 8) {
    groundPatch(x, z, 2.6, .12, mats.line, .045);
  }
});
roadSites.forEach(x => {
  groundPatch(x, 0, 9, 126, mats.asphalt, .03);
  groundPatch(x - 4.8, 0, 1.1, 126, mats.sidewalk, .045);
  groundPatch(x + 4.8, 0, 1.1, 126, mats.sidewalk, .045);
  for (let z = -56; z <= 56; z += 8) groundPatch(x, z, .12, 2.6, mats.line, .05);
});

function addBuilding({ x, z, w = 8, d = 8, h = 5, color = 0, roof = 0, name = 'CORNER SHOP', floors = 2 }) {
  const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
  box(group, 0, h / 2, 0, w, h, d, mats.wall[color % mats.wall.length]);
  box(group, 0, h + .15, 0, w + .28, .3, d + .28, mats.roof[roof % mats.roof.length]);
  // Windows and doors on the street-facing side.
  for (let fl = 0; fl < floors; fl++) {
    const y = 1.25 + fl * 2.05;
    for (const side of [-1, 1]) {
      box(group, side * w * .26, y, d / 2 + .018, 1.18, .88, .05, mats.glassLit, { castShadow: false });
      box(group, side * w * .26, y, d / 2 + .05, .055, .98, .04, mats.dark, { castShadow: false });
    }
    box(group, 0, y, d / 2 + .052, .045, .98, .04, mats.dark, { castShadow: false });
  }
  box(group, 0, .95, d / 2 + .035, .95, 1.9, .12, mats.dark);
  box(group, 0, 2.22, d / 2 + .11, w * .68, .52, .18, mat('#283b35'), { castShadow: false });
  const sign = labelSprite(name, '#f3e7cc', '#2c3932');
  sign.position.set(0, 2.23, d / 2 + .22); sign.scale.set(Math.min(w * .72, 5.5), .42, 1); group.add(sign);
  solids.push({ x, z, w: w / 2 + .35, d: d / 2 + .35 });
  return group;
}

function labelSprite(text, color = '#f4e9cf', background = '#23312c') {
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const c = canvas.getContext('2d'); c.fillStyle = background; c.fillRect(0, 0, 512, 96);
  c.fillStyle = color; c.font = '600 34px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 256, 49, 486);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
}

[
  {x:-12,z:-12,w:8,d:8,h:6,color:0,roof:0,name:'THE OLD CINEMA',floors:2},
  {x:12,z:-12,w:8,d:8,h:5,color:1,roof:1,name:'KHALID STORES',floors:2},
  {x:-12,z:12,w:8,d:8,h:7,color:2,roof:2,name:'COMMUNITY HALL',floors:2},
  {x:12,z:12,w:8,d:8,h:4.4,color:3,roof:3,name:'MAMA’S KITCHEN',floors:1},
  {x:-36,z:-12,w:10,d:9,h:8,color:4,roof:1,name:'RADIO 101.9',floors:3},
  {x:36,z:-12,w:10,d:9,h:6,color:5,roof:2,name:'TAXI RANK',floors:2},
  {x:-36,z:12,w:10,d:9,h:5,color:6,roof:0,name:'CORNER CAFE',floors:2},
  {x:36,z:12,w:10,d:9,h:7,color:7,roof:1,name:'HARBOUR GYM',floors:2},
  {x:-12,z:-36,w:9,d:9,h:5,color:8,roof:2,name:'TAILOR & SONS',floors:2},
  {x:12,z:-36,w:9,d:9,h:6,color:2,roof:0,name:'BAZAAR',floors:2},
  {x:-12,z:36,w:9,d:9,h:7,color:5,roof:3,name:'THE FLATS',floors:3},
  {x:12,z:36,w:9,d:9,h:5,color:1,roof:1,name:'FISH & CHIPS',floors:2},
  {x:-48,z:12,w:8,d:9,h:6,color:3,roof:0,name:'LAUNDROMAT',floors:2},
  {x:48,z:-12,w:8,d:9,h:8,color:6,roof:2,name:'CIVIC OFFICE',floors:3},
].forEach(addBuilding);

// Mountain ridge on the northern horizon and the Atlantic edge to the west.
const ridge = new THREE.Shape();
ridge.moveTo(-35, 0); ridge.lineTo(-33, 5); ridge.lineTo(-29, 8); ridge.lineTo(-26, 7);
ridge.lineTo(-21, 14); ridge.lineTo(-18, 15); ridge.lineTo(-13, 12); ridge.lineTo(-9, 17);
ridge.lineTo(-6, 15); ridge.lineTo(-2, 20); ridge.lineTo(3, 16); ridge.lineTo(8, 18);
ridge.lineTo(13, 11); ridge.lineTo(18, 13); ridge.lineTo(25, 7); ridge.lineTo(31, 8); ridge.lineTo(36, 0); ridge.closePath();
const mountain = new THREE.Mesh(new THREE.ExtrudeGeometry(ridge, { depth: 2, bevelEnabled: false }), mat('#657a6e'));
mountain.position.set(0, 0, -62); mountain.receiveShadow = true; scene.add(mountain);
groundPatch(-59, 0, 32, 145, mats.sea, .02);
groundPatch(-44, 0, 4, 145, mats.sand, .03);
for (let z = -50; z < 54; z += 5) {
  const wave = box(scene, -57, .07, z, 13, .025, .12, mat('#8dc4b1', .5, { transparent: true, opacity: .55 }), { castShadow: false });
}

// Cape Town street details: shade trees, painted crossings, benches and parked taxis.
function addTree(x, z, size = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  cylinder(g, 0, .8 * size, 0, .2 * size, .28 * size, 1.6 * size, mats.trunk, 8);
  for (const [dx, dy, dz, r] of [[0,2,0,1.05],[-.55,1.9,.1,.65],[.5,2.15,-.1,.72]]) {
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r * size, 1), mats.leaf);
    leaf.position.set(dx * size, dy * size, dz * size); leaf.castShadow = true; g.add(leaf);
  }
}
[[-8,7],[-9,-7],[8,7],[9,-8],[-28,6],[29,5],[-29,-6],[28,-7],[-8,29],[8,29],[-29,29],[29,30],[-47,8]].forEach((p,i)=>addTree(p[0],p[1],i%3===0?1.15:.9));
function addCrossing(x,z,vertical=false) {
  for (let i=-3;i<=3;i++) {
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(vertical?1.25:.8, vertical?.8:1.25), mats.white);
    stripe.rotation.x=-Math.PI/2; stripe.position.set(x+(vertical?0:i*1.2),.055,z+(vertical?i*1.2:0)); scene.add(stripe);
  }
}
addCrossing(0, 0, false); addCrossing(0,0,true);
const vehicles=[];
function addTaxi(x,z,rotation=0) {
  const g=new THREE.Group();g.position.set(x,.05,z);g.rotation.y=rotation;scene.add(g);
  box(g,0,.58,0,2.1,.58,3.6,mat('#d5bd64'));
  box(g,0,1.04,-.16,1.72,.55,1.68,mat('#b3c8bc',.35,{metalness:.12}));
  box(g,0,1.36,-.2,.62,.16,.5,mat('#f1e8cb'));
  for(const xx of [-.78,.78])for(const zz of [-1.1,1.1])cylinder(g,xx,.28,zz,.34,.34,.16,mats.dark,12).rotation.x=Math.PI/2;
  const vehicle={group:g,speed:0,heading:rotation,parkedX:x,parkedZ:z};vehicles.push(vehicle);return vehicle;
}
addTaxi(-8,1,Math.PI/2); addTaxi(7,-1,Math.PI/2); addTaxi(26,-20,0);

function makeActor({ id, name, role, x, z, shirt, hair, active = true, player = false }) {
  const root = new THREE.Group(); root.position.set(x, 0, z); scene.add(root);
  const skin=mat('#ad754f'), shirtMat=mat(shirt), trousers=mat('#323c36'), hairMat=mat(hair);
  const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.34,.72,4,8),shirtMat); torso.position.y=1.18;torso.castShadow=true;root.add(torso);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.28,14,12),skin); head.position.y=1.91;head.castShadow=true;root.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.29,12,8,0,Math.PI*2,0,Math.PI*.58),hairMat);hairCap.position.y=2.02;hairCap.castShadow=true;root.add(hairCap);
  const armL=new THREE.Group(); armL.position.set(-.43,1.48,0);root.add(armL);
  const armR=new THREE.Group(); armR.position.set(.43,1.48,0);root.add(armR);
  for(const arm of [armL,armR]){const limb=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.54,3,7),shirtMat);limb.position.y=-.35;limb.castShadow=true;arm.add(limb);const hand=new THREE.Mesh(new THREE.SphereGeometry(.11,8,8),skin);hand.position.y=-.65;arm.add(hand)}
  const legL=new THREE.Group();legL.position.set(-.17,.62,0);root.add(legL);const legR=new THREE.Group();legR.position.set(.17,.62,0);root.add(legR);
  for(const leg of [legL,legR]){const limb=new THREE.Mesh(new THREE.CapsuleGeometry(.13,.58,3,7),trousers);limb.position.y=-.31;limb.castShadow=true;leg.add(limb)}
  const label=labelSprite(player?'THABO':name.toUpperCase(),player?'#15211c':(active?'#f2e9d6':'#b6c1b4'),player?'#c7f36a':(active?'#293a33':'#3d4a42'));
  label.position.y=2.7;label.scale.set(2.45,.46,1);root.add(label);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(.78,.045,8,36),mat(player?'#c7f36a':'#ef8759',.5,{emissive:player?'#72913b':'#6b3824',emissiveIntensity:.25}));
  ring.rotation.x=Math.PI/2;ring.position.y=.08;root.add(ring);
  if(!active)ring.visible=false;
  return {id,name,role,root,ring,label,active,legs:[legL,legR],arms:[armL,armR],player};
}

const actors = [
  makeActor({id:'zanele',name:'Aunty Zanele',role:'Garden organiser',x:-1.7,z:2.25,shirt:'#d38751',hair:'#302421'}),
  makeActor({id:'lwazi',name:'Lwazi',role:'Bike courier',x:5.2,z:-2.2,shirt:'#668b7d',hair:'#292421'}),
  makeActor({id:'nomsa',name:'Nomsa',role:'Community radio host',x:-6,z:-14,shirt:'#c56c53',hair:'#342723'}),
  makeActor({id:'petersen',name:'Mr Petersen',role:'City records clerk',x:15.3,z:3,shirt:'#566f67',hair:'#43372b',active:false}),
];
const player = makeActor({id:'player',name:'Thabo',x:state.x,z:state.z,shirt:'#2e6557',hair:'#282522',player:true});
const actorMeshes=[];actors.forEach(a=>a.root.traverse(o=>{if(o.isMesh)actorMeshes.push(o)}));
const actorById=Object.fromEntries(actors.map(a=>[a.id,a]));

function makeMarker(x,z,color,label,type) {
  const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
  const circle=new THREE.Mesh(new THREE.TorusGeometry(1.15,.055,8,40),mat(color,.5,{emissive:color,emissiveIntensity:.26}));circle.rotation.x=Math.PI/2;circle.position.y=.08;group.add(circle);
  const pole=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,2.6,8),mat(color,.5,{transparent:true,opacity:.45}));pole.position.y=1.35;group.add(pole);
  const pin=new THREE.Mesh(new THREE.OctahedronGeometry(.32),mat(color,.35,{emissive:color,emissiveIntensity:.45}));pin.position.y=2.9;group.add(pin);
  const text=labelSprite(label,'#fff0cf','#304139');text.position.y=3.7;text.scale.set(3.2,.5,1);group.add(text);
  return {x,z,label,type,group,circle,pin};
}
const gym=makeMarker(24,8,'#e8c26a','HARBOUR STREET GYM','gym');
const beach=makeMarker(-36,30,'#8dd4c4','SEA POINT PROMENADE','beach');
const freePlaces=[gym,beach];
const missionBeacon=makeMarker(-1.7,2.25,'#c7f36a','START HERE','mission');
missionBeacon.group.scale.setScalar(.72);

// Small park garden, raised beds and a painted community mural.
groundPatch(-12, 4, 7.5, 5.5, mat('#87986b'), .055);
for(let i=0;i<3;i++){
  const bed=box(scene,-14+i*2, .35, 4.7, 1.45,.65,1.2,mat('#72523b'));
  for(let j=0;j<4;j++){
    const shrub=new THREE.Mesh(new THREE.IcosahedronGeometry(.25,0),mat(j%2?'#647e55':'#87a160'));
    shrub.position.set(-14.45+i*2+j*.25,.85,4.5+(j%2)*.4);scene.add(shrub);
  }
}
box(scene,-15,2.6,8.3,4.8,2.4,.16,mat('#bd7d5e'));
box(scene,-15,2.6,8.4,3.8,1.7,.08,mat('#e5ba75'));
// Wooden benches along the promenade.
for(let i=0;i<5;i++){
  const x=-38,z=18+i*6;
  box(scene,x,.42,z,1.9,.14,.65,mat('#936745'));
  box(scene,x,.78,z+.25,1.9,.72,.13,mat('#936745'));
  for(const dx of [-.72,.72])box(scene,x+dx,.19,z,.12,.4,.12,mats.dark);
}

const destinations={mission:actors[0],courier:actors[1],contractor:actors[3]};
function objectiveActor(){return state.chapter===0?destinations.mission:state.chapter===1?destinations.courier:state.chapter===2?destinations.contractor:null}
function setChapter(n){
  state.chapter=n;
  actors[3].active=n>=2;actors[3].ring.visible=n>=2;
  missionBeacon.group.visible=n===0;
  $('progress').style.width=['18%','47%','75%','100%'][n];
  if(n===0){$('mission-title').textContent='A CITY IN THE MIST';$('mission-copy').textContent='A community garden’s title deeds have gone missing. Aunty Zanele is right here—tap her to hear what happened.';$('objective-copy').textContent='Talk to Aunty Zanele · learn about the missing deeds'}
  if(n===1){$('mission-title').textContent='FOLLOW THE BLUE FOLDER';$('mission-copy').textContent='Aunty Zanele shared the story. Lwazi the bike courier saw the folder last near the old cinema.';$('objective-copy').textContent='Find Lwazi · ask about the courier route'}
  if(n===2){$('mission-title').textContent='THE LAST DELIVERY';$('mission-copy').textContent='Lwazi traced the folder to the city records clerk by the Community Hall.';$('objective-copy').textContent='Speak with Mr Petersen · decide what to do with the deeds'}
  if(n===3){$('mission-title').textContent='A GARDEN FOR EVERYONE';$('mission-copy').textContent='The garden is safe and the ward knows the truth. Salt River is still yours to explore.';$('objective-copy').textContent='Chapter complete · enjoy free time around the city'}
}

function distance(a,b){return Math.hypot(a.root.position.x-b.root.position.x,a.root.position.z-b.root.position.z)}
function nearestContact(){
  for(const a of actors){if(a.player)continue;if(a.id==='petersen'&&state.chapter<2)continue;if(a.id==='zanele'&&state.chapter!==0)continue;if(a.id==='lwazi'&&state.chapter!==1)continue;if(a.id==='nomsa'&&state.chapter<3&&state.chapter!==0)continue;if(distance(player,a)<3.4)return{kind:'person',actor:a}}
  for(const p of freePlaces)if(Math.hypot(player.root.position.x-p.x,player.root.position.z-p.z)<4)return{kind:p.type,place:p};
  return null;
}

function updateContact(){
  const contact=nearestContact(),button=$('action');
  button.disabled=!contact;button.textContent=contact?(contact.kind==='person'?'Talk':'Visit')+' ↗':'Talk ↗';
  const target=objectiveActor();
  $('direction').classList.toggle('active',!!target&&!contact&&Math.hypot(target.root.position.x-player.root.position.x,target.root.position.z-player.root.position.z)>5);
  if(contact){$('hint').innerHTML='<b>'+ (contact.kind==='person'?'TAP TALK':'TAP VISIT')+'</b> · '+(contact.kind==='person'?contact.actor.name:contact.place.label)}
  else $('hint').innerHTML='<b>MOVE</b> WASD / arrows &nbsp; · &nbsp; <b>TAP</b> a person to speak';
  return contact;
}

function showToast(text){const el=$('toast');el.textContent=text;el.classList.add('show');clearTimeout(state.toastTimer);state.toastTimer=setTimeout(()=>el.classList.remove('show'),2300)}
function giveRespect(amount,reason){state.respect+=amount;$('respect').textContent=String(state.respect).padStart(3,'0');showToast('+'+amount+' RESPECT · '+reason)}
function openDialog(id){
  const modal=$('dialog'),choices=$('choices');choices.innerHTML='';
  const content={
    zanele:{kicker:'AUNTY ZANELE · GARDEN ORGANISER',title:'“You look like you know how to listen.”',copy:'The deeds were in a blue folder. Last I saw it, a courier was asking questions by the old cinema. Folks say he left in a hurry when the trains started.',options:[['01 · Build trust','“Let’s retrace what happened. I’ll ask around and bring the folder back.”','trust'],['02 · Make a deal','“I can find the courier. Tell me what the garden means to the ward.”','deal']]},
    lwazi:{kicker:'LWAZI · BIKE COURIER',title:'“I didn’t take your folder.”',copy:'Lwazi remembers a city contractor near the Community Hall. He can show you the route, but his bike chain is a mess and he has a delivery to make.',options:[['01 · Help out','Fix his chain and walk the route together. Get the full story.','help'],['02 · Negotiate','Offer to cover the delivery. Get the clerk’s address now.','negotiate']]},
    petersen:{kicker:'MR PETERSEN · CITY RECORDS CLERK',title:'“These deeds were filed under the wrong ward.”',copy:'The blue folder was misrouted during a boundary update. The garden is safe, but the community should decide what happens next.',options:[['01 · Return the deeds','Take them straight back to Aunty Zanele and the garden crew.','return'],['02 · Put it on the record','Ask Nomsa to broadcast the correction so the whole ward knows.','publish']]},
    nomsa:{kicker:'NOMSA · COMMUNITY RADIO HOST',title:'“Good to see you out here.”',copy:'Nomsa is collecting voices for the morning show. She’s heard the garden deeds story too. “People will show up for a place they believe in.”',options:[[state.radioRewarded?'KEEP IN TOUCH':'JOIN THE CONVERSATION','Share the garden story on air and rally the neighbourhood.','radio'],['KEEP MOVING','There’s more to explore around Salt River.','later']]},
  }[id];
  if(!content)return;
  if((id==='zanele'&&state.chapter!==0)||(id==='lwazi'&&state.chapter!==1)||(id==='petersen'&&state.chapter!==2)){showToast('They are busy. Follow the current story lead.');return}
  $('dialog-kicker').textContent=content.kicker;$('dialog-title').textContent=content.title;$('dialog-copy').textContent=content.copy;
  state.choiceIndex=0;content.options.forEach(([label,copy,choice],i)=>{const btn=document.createElement('button');btn.className='choice';btn.style.outline=i===0?'2px solid #c7f36a':'';btn.innerHTML='<span>'+label+'</span>'+copy;btn.addEventListener('click',()=>choose(id,choice));choices.append(btn)});
  state.modal=true;modal.classList.add('open');
}
function choose(id,choice){
  $('dialog').classList.remove('open');state.modal=false;
  if(id==='zanele'){giveRespect(5,'Aunty Zanele trusts you');setChapter(1)}
  if(id==='lwazi'){giveRespect(choice==='help'?8:5,'New lead unlocked');setChapter(2)}
  if(id==='petersen'){giveRespect(choice==='publish'?15:12,'Chapter complete');setChapter(3)}
  if(id==='nomsa'){if(!state.radioRewarded){state.radioRewarded=true;giveRespect(4,'Your story travels')}else showToast('Nomsa is back on air after the break.')}
  if(choice==='later')showToast('Salt River has plenty more stories.');updateContact();
}

function openActivity(place){
  const gymPlace=place.type==='gym';
  $('activity-kicker').textContent='FREE TIME · '+place.label;
  $('activity-title').textContent=gymPlace?'A GOOD SWEAT, A CLEAR HEAD':'SALT AIR, NO RUSH';
  $('activity-copy').textContent=gymPlace?'The neighbourhood gym is loud, warm and full of people who know everybody. Get a quick session in and feel your strength return.':'Take a moment by the Atlantic. Listen to the gulls and let your shoulders drop.';
  $('do-activity').textContent=gymPlace?'Start training ↗':'Take a breather ↗';
  $('activity').classList.add('open');state.modal=true;
}
function closeActivity(){ $('activity').classList.remove('open');state.modal=false; }
$('do-activity').addEventListener('click',()=>{const gymPlace=$('activity-kicker').textContent.includes('GYM');closeActivity();state.freeTimeCount++;giveRespect(gymPlace?2:1,gymPlace?'Strength +1 · Free time well spent':'A moment to reset')});
$('leave-activity').addEventListener('click',closeActivity);

function interact(contact=nearestContact()){
  if(state.modal)return;
  if(!contact){showToast('Walk closer or tap a character in the scene.');return}
  if(contact.kind==='person')openDialog(contact.actor.id);else openActivity(contact.place);
}
function punch(){
  if(state.modal||state.vehicle)return;
  state.punchCombo=state.clock-state.punchTime<.75?(state.punchCombo%3)+1:1;
  state.punchTime=state.clock;state.punching=true;
  showToast(['JAB','CROSS','HOOK'][state.punchCombo-1]+' · COMBO '+state.punchCombo);
}
function jump(){if(!state.modal&&!state.vehicle&&!state.jumping){state.jumping=true;state.jumpTime=0}}
function nearestVehicle(){return vehicles.map(v=>({v,d:Math.hypot(state.x-v.group.position.x,state.z-v.group.position.z)})).sort((a,b)=>a.d-b.d)[0]}
function toggleVehicle(){
  if(state.vehicle){const v=state.vehicle;state.x=v.group.position.x+Math.cos(state.heading)*2;state.z=v.group.position.z-Math.sin(state.heading)*2;state.vehicle=null;player.root.visible=true;showToast('You stepped out of the taxi.');return}
  const nearest=nearestVehicle();
  if(!nearest||nearest.d>4.5){showToast('Walk up to a yellow taxi and press Y.');return}
  state.vehicle=nearest.v;state.x=nearest.v.group.position.x;state.z=nearest.v.group.position.z;
  state.heading=nearest.v.heading;state.targetHeading=state.heading;player.root.visible=false;showToast('Taxi ready · RT to drive, LT to reverse.');
}
function horn(){showToast('BEEP BEEP · Taxi horn')}
function startTaxiJob(){
  state.taxiJob=!state.taxiJob;
  showToast(state.taxiJob?'Taxi shift started · pick up a passenger around Salt River.':'Taxi shift ended.');
}
function openMap(){if(state.paused)togglePause();state.mapOpen=!state.mapOpen;$('map-panel').classList.toggle('open',state.mapOpen);state.modal=state.mapOpen}
function togglePause(){if(state.mapOpen)openMap();state.paused=!state.paused;$('pause-panel').classList.toggle('open',state.paused);state.modal=state.paused}
function closeTopLayer(){
  if(state.mapOpen){openMap();return}
  if(state.paused){togglePause();return}
  if(state.modal){$('dialog').classList.remove('open');closeActivity();state.modal=false;return}
}
function confirmChoice(){
  if(state.paused){togglePause();return}
  if(state.mapOpen){openMap();return}
  if($('dialog').classList.contains('open')){$('choices').querySelectorAll('.choice')[state.choiceIndex]?.click();return}
  if($('activity').classList.contains('open')){$('do-activity').click();return}
  interact();
}
function moveChoice(step){
  if(!$('dialog').classList.contains('open'))return;
  const choices=[...$('choices').querySelectorAll('.choice')];if(!choices.length)return;
  state.choiceIndex=(state.choiceIndex+step+choices.length)%choices.length;
  choices.forEach((choice,i)=>choice.style.outline=i===state.choiceIndex?'2px solid #c7f36a':'');
}
function pressGamepadButton(index){
  const buttons=state.gamepad?.buttons||[];return !!buttons[index]?.pressed;
}
function gamepadEdge(index){const now=pressGamepadButton(index),was=!!state.gamepadButtons[index];state.gamepadButtons[index]=now;return now&&!was}
function pollGamepad(dt=0){
  const pads=navigator.getGamepads?.()||[];const pad=[...pads].find(g=>g&&g.connected);
  state.gamepad=pad||null;
  $('gamepad-status').textContent=pad?'CONNECTED · '+(pad.id.split(' (')[0].slice(0,34)):'CONNECT AN XBOX STYLE CONTROLLER';
  if(!pad){state.gamepadButtons=[];state.pad={x:0,z:0};return}
  const edges=Array.from({length:16},(_,i)=>gamepadEdge(i));
  const dead=.18,axis=(n)=>Math.abs(pad.axes[n]||0)>dead?pad.axes[n]:0;
  const leftX=axis(0),leftY=axis(1),rightX=axis(2),rightY=axis(3);
  state.pad={x:leftX,z:-leftY};state.cameraInput={x:rightX,y:rightY};
  state.sprint=pressGamepadButton(0);
  if(edges[0])confirmChoice();
  if(edges[1]){if(state.modal)closeTopLayer();else punch()}
  if(edges[2])jump();
  if(edges[3])toggleVehicle();
  if(edges[4])interact();
  if(pressGamepadButton(5)&&state.vehicle){state.vehicle.speed*=.82;if(Math.abs(state.vehicle.speed)<.12)state.vehicle.speed=0}
  if(edges[8])openMap();
  if(edges[9])togglePause();
  if(edges[10])horn();
  if(edges[11]){state.cameraYaw=state.heading;state.cameraPitch=.57;showToast('Camera snapped behind Thabo.');}
  if(edges[12])moveChoice(-1);
  if(edges[13]){if($('dialog').classList.contains('open'))moveChoice(1);else startTaxiJob()}
  if(edges[14])showToast('Radio · Cape Town community station');
  if(edges[15])showToast('Taxi radio tuned · local traffic updates');
  const lt=pad.buttons[6]?.value||0,rt=pad.buttons[7]?.value||0;
  if(state.vehicle&&!state.modal){state.vehicle.speed+=(rt-lt*.8)*dt*16;state.vehicle.speed=THREE.MathUtils.clamp(state.vehicle.speed,-5,12)}
  else if(rt>.62&&edges[7])punch();
}
window.addEventListener('gamepadconnected',()=>showToast('Controller connected · Xbox controls ready'));
window.addEventListener('gamepaddisconnected',()=>{state.gamepad=null;state.pad={x:0,z:0};showToast('Controller disconnected')});
$('guide-toggle').addEventListener('click',()=>$('controller-guide').classList.toggle('open'));
$('guide-close').addEventListener('click',()=>$('controller-guide').classList.remove('open'));
$('close-map').addEventListener('click',()=>{if(state.mapOpen)openMap()});
$('resume-game').addEventListener('click',()=>{if(state.paused)togglePause()});
$('choices').addEventListener('click',()=>{state.choiceIndex=0});
$('action').addEventListener('click',()=>interact());
$('explore').addEventListener('click',()=>showToast('Follow the street. Tap people to hear their stories.'));
$('close-dialog').addEventListener('click',()=>{$('dialog').classList.remove('open');state.modal=false});

const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerup',(event)=>{
  if(state.moving||state.modal)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.x=((event.clientX-rect.left)/rect.width)*2-1;
  pointer.y=-((event.clientY-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(actorMeshes,false);
  for(const hit of hits){let node=hit.object;while(node&&node!==scene&&!node.userData.actorId)node=node.parent;if(node?.userData.actorId){interact({kind:'person',actor:actorById[node.userData.actorId]});return}}
  const markerHits=raycaster.intersectObjects(freePlaces.flatMap(p=>p.group.children),true);
  if(markerHits.length){const p=freePlaces.find(p=>p.group===markerHits[0].object.parent||p.group.children.includes(markerHits[0].object));if(p)interact({kind:p.type,place:p})}
});
actors.forEach(a=>{a.root.userData.actorId=a.id;a.root.traverse(o=>o.userData.actorId=a.id)});

const touchpad=$('touchpad');
const dirs={up:[0,1],down:[0,-1],left:[-1,0],right:[1,0]};
touchpad.querySelectorAll('button').forEach(btn=>{
  btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);state.pad={x:dirs[btn.dataset.dir][0],z:dirs[btn.dataset.dir][1]}});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(name,()=>{state.pad={x:0,z:0}});
});
window.addEventListener('keydown',e=>{
  if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
  const key=e.key.toLowerCase(),fresh=!state.keys.has(key);state.keys.add(key);
  if(!fresh)return;
  if(key==='e')interact();
  if(key===' '){if(state.modal)confirmChoice();else jump()}
  if(key==='x')jump();if(key==='b')punch();if(key==='y')toggleVehicle();if(key==='r')horn();
  if(key==='m')openMap();if(key==='p')togglePause();
  if(key==='escape')closeTopLayer();
  if(key==='arrowup')moveChoice(-1);if(key==='arrowdown')moveChoice(1);
});
window.addEventListener('keyup',e=>state.keys.delete(e.key.toLowerCase()));
window.addEventListener('blur',()=>state.keys.clear());

function collides(x,z){return solids.some(s=>Math.abs(x-s.x)<s.w+.45&&Math.abs(z-s.z)<s.d+.45)}
const clock=new THREE.Clock();
function animate(){
  requestAnimationFrame(animate);
  const dt=Math.min(clock.getDelta(),.04);state.clock+=dt;
  pollGamepad(dt);
  const k=state.keys;
  let forward=(k.has('w')||k.has('arrowup')?1:0)-(k.has('s')||k.has('arrowdown')?1:0)+state.pad.z;
  let side=(k.has('d')||k.has('arrowright')?1:0)-(k.has('a')||k.has('arrowleft')?1:0)+state.pad.x;
  const cameraInput=state.cameraInput||{x:0,y:0};
  if(!state.modal){state.cameraYaw-=cameraInput.x*dt*2.2;state.cameraPitch=THREE.MathUtils.clamp(state.cameraPitch-cameraInput.y*dt*1.2,.2,1.15)}
  state.sprint=!!(k.has('shift')||state.gamepad&&pressGamepadButton(0));
  if(state.vehicle&&!state.modal){state.vehicle.speed+=(k.has('w')?7:0)*dt-(k.has('s')?8:0)*dt;state.vehicle.speed=THREE.MathUtils.clamp(state.vehicle.speed,-5,12)}
  const mag=Math.hypot(forward,side);state.moving=(mag>.08||state.vehicle&&Math.abs(state.vehicle.speed)>.08)&&!state.modal;
  if(state.moving){
    forward/=Math.max(1,mag);side/=Math.max(1,mag);
    if(state.vehicle){
      state.heading+=side*dt*1.65;
      const speed=state.vehicle.speed;
      const nx=THREE.MathUtils.clamp(state.x+Math.sin(state.heading)*speed*dt,-52,57);
      const nz=THREE.MathUtils.clamp(state.z-Math.cos(state.heading)*speed*dt,-56,56);
      if(!collides(nx,state.z))state.x=nx;else state.vehicle.speed=0;
      if(!collides(state.x,nz))state.z=nz;else state.vehicle.speed=0;
      state.vehicle.group.position.set(state.x,.05,state.z);state.vehicle.heading=state.heading;state.vehicle.group.rotation.y=state.heading;
    }else{
      // Walk relative to the view direction so the left stick remains natural while looking around.
      const speed=6.1*(state.sprint?1.7:1);
      const vx=(side*Math.cos(state.cameraYaw)+forward*Math.sin(state.cameraYaw))*speed*dt;
      const vz=(-side*Math.sin(state.cameraYaw)-forward*Math.cos(state.cameraYaw))*speed*dt;
      const nx=THREE.MathUtils.clamp(state.x+vx,-52,57),nz=THREE.MathUtils.clamp(state.z+vz,-56,56);
      if(!collides(nx,state.z))state.x=nx;if(!collides(state.x,nz))state.z=nz;
      state.targetHeading=Math.atan2(vx,-vz);
    }
  }
  const turnDelta=Math.atan2(Math.sin(state.targetHeading-state.heading),Math.cos(state.targetHeading-state.heading));
  state.heading+=turnDelta*(1-Math.exp(-10*dt));
  if(state.jumping){state.jumpTime+=dt;if(state.jumpTime>.75)state.jumping=false}
  const hop=state.jumping?Math.sin(Math.min(state.jumpTime/.75,1)*Math.PI)*1.35:0;
  player.root.position.set(state.x,Math.sin(state.clock*10)*.025+hop, state.z);player.root.rotation.y=state.heading;
  const swing=state.moving?Math.sin(state.clock*11)*.52:0;
  const punchPose=state.clock-state.punchTime<.3?Math.sin((state.clock-state.punchTime)/.3*Math.PI):0;
  player.legs[0].rotation.x=swing;player.legs[1].rotation.x=-swing;
  player.arms[0].rotation.x=-swing*.68-punchPose*1.4;player.arms[1].rotation.x=swing*.68-punchPose*1.4;
  actors.forEach((a,i)=>{
    if(a.id==='lwazi'&&state.chapter<1)a.label.material.opacity=.8;
    a.root.position.y=Math.sin(state.clock*1.7+i)*.018;
    a.ring.rotation.z=state.clock*.3;
  });
  freePlaces.forEach(p=>{p.pin.rotation.y=state.clock*.65;p.pin.position.y=2.88+Math.sin(state.clock*2)*.14;p.circle.rotation.z=state.clock*.12});
  missionBeacon.pin.rotation.y=state.clock*.65;missionBeacon.pin.position.y=2.88+Math.sin(state.clock*2)*.14;missionBeacon.circle.rotation.z=state.clock*.12;
  const radius=10,cp=Math.cos(state.cameraPitch),sp=Math.sin(state.cameraPitch);
  const follow=new THREE.Vector3(state.x+Math.sin(state.cameraYaw)*radius*cp,1+radius*sp,state.z+Math.cos(state.cameraYaw)*radius*cp);
  camera.position.lerp(follow,1-Math.exp(-5*dt));camera.lookAt(state.x,1,state.z);
  updateContact();renderer.render(scene,camera);
}

window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.setSize(innerWidth,innerHeight)});
camera.position.set(state.x,1+10*Math.sin(state.cameraPitch),state.z+10*Math.cos(state.cameraPitch));camera.lookAt(state.x,1,state.z);
player.root.userData.actorId='player';
setChapter(0);updateContact();$('loading').classList.add('hidden');animate();


