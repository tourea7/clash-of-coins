// ============================================================
// CLASH OF COINS — game.js v2.0 — Premium Visuals
// ============================================================

const STATE = {
  coins: 15350,
  username: 'Sidick Kone',
  initials: 'SK',
  currentMode: 'free',
  currentMise: 500,
  numPlayers: 4,
  socket: null,
  roomId: null,
  myPlayerIndex: 0,
  transactions: [
    { type:'gain', desc:'Partie gagnée',        date:"Aujourd'hui 14:35", amount:2500  },
    { type:'loss', desc:'Mise de partie',        date:"Aujourd'hui 14:30", amount:-1000 },
    { type:'gain', desc:'Dépôt (Orange Money)',  date:"Aujourd'hui 13:20", amount:5000  },
    { type:'gain', desc:'Partie gagnée',         date:'Hier 12:10',        amount:1800  },
    { type:'loss', desc:'Retrait (Wave)',         date:'Hier 18:40',        amount:-3000 },
    { type:'gain', desc:'Bonus victoire',        date:'Il y a 2j',         amount:950   },
  ],
};

const GAME = {
  players:4, current:0, dice:1, rolled:false, over:false,
  pieces:[], finished:[], scores:[0,0,0,0],
  movable:[], waitMove:false,
};

const COLORS      = ['#4d7fff','#ff4444','#22cc55','#ffcc00'];
const COLORS_DARK = ['#1a3aaa','#991111','#0d6622','#997700'];
const COLORS_GLOW = ['rgba(77,127,255,0.5)','rgba(255,68,68,0.5)','rgba(34,204,85,0.5)','rgba(255,204,0,0.5)'];
const AI_NAMES    = ['QueenLudo','LuckyStar','KingLudo','DiceKing'];
const DICE_FACES  = ['⚀','⚁','⚂','⚃','⚄','⚅'];

const PATH52 = [
  [1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],[8,6],
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
  [14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
  [7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],[6,8],
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
];

const HOME_STRETCH = [
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
];

const BASE_POS = [
  [[2,2],[3,2],[2,3],[3,3]],
  [[10,2],[11,2],[10,3],[11,3]],
  [[2,10],[3,10],[2,11],[3,11]],
  [[10,10],[11,10],[10,11],[11,11]],
];

const ENTRY = [0, 13, 39, 26];
const SAFE  = new Set(['1,8','6,2','8,1','13,6','13,8','8,13','6,13','1,6']);

let canvas, ctx, C;

function setupCanvas(){
  canvas = document.getElementById('board-canvas');
  const size = Math.min(window.innerWidth-24, window.innerHeight-280, 420);
  canvas.width = canvas.height = size;
  C = size / 15;
  ctx = canvas.getContext('2d');
  canvas.addEventListener('click', onBoardClick);
  canvas.addEventListener('touchend', e=>{
    e.preventDefault();
    const t=e.changedTouches[0];
    onBoardClick({clientX:t.clientX,clientY:t.clientY});
  },{passive:false});
  drawBoard();
}

function initGame(n){
  GAME.players=n; GAME.current=0; GAME.dice=1;
  GAME.rolled=false; GAME.over=false; GAME.waitMove=false;
  GAME.movable=[]; GAME.scores=Array(4).fill(0);
  GAME.pieces=Array.from({length:4},()=>Array(4).fill(-1));
  GAME.finished=Array(4).fill(0);
}

// ===== DRAWING =====
function drawBoard(){
  if(!ctx) return;
  const W=canvas.width;
  ctx.clearRect(0,0,W,W);
  ctx.fillStyle='#08080f';
  rFill(0,0,W,W,10);
  for(let r=0;r<15;r++) for(let c=0;c<15;c++) drawCell(c,r);
  [0,1,2,3].forEach(drawHomeZone);
  drawCenterStar();
  for(let p=0;p<GAME.players;p++) for(let i=0;i<4;i++) drawPiece(p,i);
  if(GAME.waitMove){
    const pulse=0.5+0.5*Math.sin(Date.now()/250);
    GAME.movable.forEach(m=>{
      const {x,y}=getPieceXY(m.player,m.piece);
      ctx.beginPath();
      ctx.arc(x,y,C*0.52+pulse*5,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${0.5+pulse*0.5})`;
      ctx.lineWidth=3; ctx.stroke();
    });
    requestAnimationFrame(drawBoard);
  }
}

function drawCell(col,row){
  const x=col*C,y=row*C,s=C-0.5;
  let fill='#0e0e22',stroke='#1a1a38',sw=0.5;
  if(col<6&&row<6)         fill='#0b1045';
  else if(col>8&&row<6)    fill='#42080a';
  else if(col<6&&row>8)    fill='#093318';
  else if(col>8&&row>8)    fill='#3a2c00';
  else if(col===7&&row>=1&&row<=6)  {fill='#12185a';stroke='#3a55dd';sw=0.8;}
  else if(row===7&&col>=1&&col<=6)  {fill='#3d2000';stroke='#cc8800';sw=0.8;}
  else if(col===7&&row>=8&&row<=13) {fill='#0a2810';stroke='#228833';sw=0.8;}
  else if(row===7&&col>=8&&col<=13) {fill='#3a2800';stroke='#ccaa00';sw=0.8;}
  else if(SAFE.has(`${col},${row}`)){fill='#18160a';stroke='#D4AF37';sw=1.2;}
  ctx.fillStyle=fill; rFill(x+0.5,y+0.5,s,s,3);
  ctx.strokeStyle=stroke; ctx.lineWidth=sw;
  ctx.strokeRect(x+0.5,y+0.5,s,s);
  if(SAFE.has(`${col},${row}`)&&!(col===7||row===7)){
    ctx.fillStyle='#D4AF3755';
    ctx.font=`${Math.floor(C*0.42)}px serif`;
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('★',x+C/2,y+C/2);
  }
}

function drawHomeZone(p){
  const corners=[[1,1],[9,1],[1,9],[9,9]];
  const [col,row]=corners[p];
  const color=COLORS[p], dark=COLORS_DARK[p];
  const x=col*C,y=row*C,w=4*C,h=4*C,m=C*0.14;
  ctx.save();
  ctx.shadowColor=color; ctx.shadowBlur=16;
  ctx.strokeStyle=color; ctx.lineWidth=2;
  rStroke(x+m,y+m,w-m*2,h-m*2,10);
  ctx.restore();
  ctx.fillStyle=dark; rFill(x+m,y+m,w-m*2,h-m*2,10);
  // Inner circle spots
  BASE_POS[p].forEach(([bc,br])=>{
    const bx=(bc+0.5)*C, by=(br+0.5)*C;
    const g=ctx.createRadialGradient(bx-C*0.1,by-C*0.1,0,bx,by,C*0.38);
    g.addColorStop(0,`${color}44`);
    g.addColorStop(1,`${color}11`);
    ctx.beginPath(); ctx.arc(bx,by,C*0.38,0,Math.PI*2);
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle=`${color}55`; ctx.lineWidth=1.5; ctx.stroke();
  });
}

function drawCenterStar(){
  const cx=7.5*C, cy=7.5*C, s=1.65*C;
  ctx.fillStyle='#08080f'; rFill(6*C+1,6*C+1,3*C-2,3*C-2,8);
  const drawTri=(x1,y1,x2,y2,x3,y3,color)=>{
    ctx.save(); ctx.globalAlpha=0.82;
    ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3);
    ctx.closePath(); ctx.fillStyle=color; ctx.fill();
    ctx.restore();
  };
  drawTri(cx,cy-s, cx-s*0.65,cy, cx+s*0.65,cy, COLORS[0]);
  drawTri(cx+s,cy, cx,cy-s*0.65, cx,cy+s*0.65, COLORS[1]);
  drawTri(cx,cy+s, cx+s*0.65,cy, cx-s*0.65,cy, COLORS[2]);
  drawTri(cx-s,cy, cx,cy+s*0.65, cx,cy-s*0.65, COLORS[3]);
  const g=ctx.createRadialGradient(cx-C*0.22,cy-C*0.22,0,cx,cy,C*0.7);
  g.addColorStop(0,'#ffe566'); g.addColorStop(0.5,'#D4AF37'); g.addColorStop(1,'#8B6914');
  ctx.beginPath(); ctx.arc(cx,cy,C*0.7,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();
  ctx.strokeStyle='#FFD700'; ctx.lineWidth=2; ctx.stroke();
  ctx.fillStyle='#000';
  ctx.font=`bold ${Math.floor(C*0.78)}px 'Cinzel Decorative',serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('C',cx,cy+1);
}

function drawPiece(p,i){
  const {x,y}=getPieceXY(p,i);
  const color=COLORS[p], dark=COLORS_DARK[p];
  const r=C*0.34;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,0.8)'; ctx.shadowBlur=8; ctx.shadowOffsetY=2;
  const g=ctx.createRadialGradient(x-r*0.38,y-r*0.38,r*0.04,x,y,r);
  g.addColorStop(0,lighten(color,65)); g.addColorStop(0.55,color); g.addColorStop(1,dark);
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=g; ctx.fill();
  ctx.restore();
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle=lighten(color,40); ctx.lineWidth=1.8; ctx.stroke();
  ctx.beginPath(); ctx.arc(x-r*0.3,y-r*0.3,r*0.3,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.fill();
  ctx.fillStyle='#fff';
  ctx.font=`bold ${Math.floor(r*1.05)}px Rajdhani,sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(i+1,x,y+0.5);
  if(p===GAME.current&&!GAME.rolled){
    ctx.save();
    ctx.shadowColor=color; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.arc(x,y,r+3,0,Math.PI*2);
    ctx.strokeStyle=`${color}99`; ctx.lineWidth=2.5; ctx.stroke();
    ctx.restore();
  }
}

function getPieceXY(p,i){
  const pos=GAME.pieces[p][i];
  let col,row;
  if(pos===-1) [col,row]=BASE_POS[p][i];
  else if(pos>=52){ const si=pos-52; if(si<6)[col,row]=HOME_STRETCH[p][si]; else{col=7;row=7;} }
  else [col,row]=PATH52[(pos+ENTRY[p])%52];
  const stack=[];
  for(let p2=0;p2<GAME.players;p2++) for(let i2=0;i2<4;i2++){
    if(p2===p&&i2===i) continue;
    const op=GAME.pieces[p2][i2]; let oc,or2;
    if(op===-1)[oc,or2]=BASE_POS[p2][i2];
    else if(op>=52){const si=op-52;if(si<6)[oc,or2]=HOME_STRETCH[p2][si];else{oc=7;or2=7;}}
    else[oc,or2]=PATH52[(op+ENTRY[p2])%52];
    if(oc===col&&or2===row) stack.push(1);
  }
  const offs=[[0,0],[0.3,-0.15],[-0.3,-0.15],[0,0.3]];
  const o=offs[Math.min(stack.length,3)];
  return{x:(col+0.5+o[0]*0.45)*C,y:(row+0.5+o[1]*0.45)*C};
}

function rFill(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); ctx.fill();
}
function rStroke(x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath(); ctx.stroke();
}
function lighten(hex,amt){
  return `rgb(${Math.min(255,parseInt(hex.slice(1,3),16)+amt)},${Math.min(255,parseInt(hex.slice(3,5),16)+amt)},${Math.min(255,parseInt(hex.slice(5,7),16)+amt)})`;
}

// ===== GAME LOGIC =====
function getMovable(player,dice){
  const moves=[];
  for(let i=0;i<4;i++){
    const pos=GAME.pieces[player][i];
    if(pos===58) continue;
    if(pos===-1){if(dice===6)moves.push({player,piece:i,newPos:0});}
    else{const np=pos+dice;if(np<=58)moves.push({player,piece:i,newPos:np});}
  }
  return moves;
}

function onBoardClick(e){
  if(!GAME.waitMove) return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
  const my=(e.clientY-rect.top)*(canvas.height/rect.height);
  for(const m of GAME.movable){
    const {x,y}=getPieceXY(m.player,m.piece);
    if(Math.hypot(mx-x,my-y)<C*0.55){applyMove(m.player,m.piece,m.newPos);return;}
  }
}

function applyMove(player,piece,newPos){
  GAME.pieces[player][piece]=newPos;
  GAME.waitMove=false; GAME.movable=[];
  if(newPos>=0&&newPos<52){
    const[myC,myR]=PATH52[(newPos+ENTRY[player])%52];
    if(!SAFE.has(`${myC},${myR}`)){
      for(let p2=0;p2<GAME.players;p2++){
        if(p2===player) continue;
        for(let i2=0;i2<4;i2++){
          const op=GAME.pieces[p2][i2];
          if(op>=0&&op<52){
            const[oc,or2]=PATH52[(op+ENTRY[p2])%52];
            if(oc===myC&&or2===myR){
              GAME.pieces[p2][i2]=-1;
              GAME.scores[player]+=20;
              flashLog(`Capture! +20 pts`,COLORS[player]);
            }
          }
        }
      }
    }
  }
  if(newPos>=58){
    GAME.pieces[player][piece]=58; GAME.finished[player]++;
    GAME.scores[player]+=50;
    flashLog(`Pièce ${piece+1} arrivée! +50 pts`,COLORS[player]);
    if(GAME.finished[player]>=4){endGame(player);return;}
  }
  updateScoreUI(); drawBoard();
  if(GAME.dice===6){
    flashLog(`${player===0?'Vous rejouez':AI_NAMES[player-1]+' rejoue'} (6)!`,'#FFD700');
    if(player!==0) setTimeout(()=>aiTurn(player),900);
    else{GAME.rolled=false;enableRoll();}
  } else setTimeout(nextTurn,700);
}

function rollDice(){
  if(GAME.rolled||GAME.over) return;
  GAME.rolled=true; disableRoll();
  const el=document.getElementById('dice-el');
  el.classList.add('rolling');
  let count=0;
  const iv=setInterval(()=>{
    el.textContent=DICE_FACES[Math.floor(Math.random()*6)];
    if(++count>=12){
      clearInterval(iv); el.classList.remove('rolling');
      const result=Math.floor(Math.random()*6)+1;
      GAME.dice=result; el.textContent=DICE_FACES[result-1];
      el.style.transform='scale(1.25)';
      setTimeout(()=>el.style.transform='scale(1)',200);
      const movable=getMovable(0,result);
      if(movable.length===0){flashLog(`Vous lancez ${result} — aucun mouvement`,'#888');setTimeout(nextTurn,1200);}
      else if(movable.length===1){flashLog(`Vous lancez ${result}`,COLORS[0]);setTimeout(()=>applyMove(movable[0].player,movable[0].piece,movable[0].newPos),500);}
      else{GAME.movable=movable;GAME.waitMove=true;flashLog(`Vous lancez ${result} — touchez un pion`,'#FFD700');drawBoard();}
    }
  },65);
}

function nextTurn(){
  GAME.current=(GAME.current+1)%GAME.players;
  GAME.rolled=false; updateActivePlayer();
  if(GAME.current===0){flashLog('Votre tour — lancez le dé!',COLORS[0]);enableRoll();}
  else{flashLog(`Tour de ${AI_NAMES[GAME.current-1]}...`,COLORS[GAME.current]);disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);}
}

function aiTurn(player){
  if(GAME.over||GAME.current!==player) return;
  const result=Math.floor(Math.random()*6)+1;
  GAME.dice=result; document.getElementById('dice-el').textContent=DICE_FACES[result-1];
  flashLog(`${AI_NAMES[player-1]} lance ${result}`,COLORS[player]);
  setTimeout(()=>{
    const movable=getMovable(player,result);
    if(movable.length>0){
      let best=movable[0];
      for(const m of movable) if(m.newPos>best.newPos) best=m;
      applyMove(best.player,best.piece,best.newPos);
    } else {
      if(result===6) setTimeout(()=>aiTurn(player),800);
      else setTimeout(nextTurn,600);
    }
  },700);
}

function endGame(winner){
  GAME.over=true;
  const isMe=winner===0;
  const prize=isMe?Math.floor(STATE.currentMise*STATE.numPlayers*0.95):0;
  if(STATE.currentMode==='comp'){
    if(isMe){STATE.coins+=prize;addTx('gain','Partie gagnée',prize);}
    else{STATE.coins-=STATE.currentMise;addTx('loss','Partie perdue',-STATE.currentMise);}
    updateCoinsUI();
  } else if(isMe){STATE.coins+=200;addTx('gain','Bonus gratuit',200);updateCoinsUI();}
  setTimeout(()=>{
    showModal(
      isMe?'🏆':'😤',isMe?'VICTOIRE!':'DÉFAITE',
      isMe?'Félicitations! Vous avez dominé!':`${winner===0?'Vous':AI_NAMES[winner-1]} a gagné!`,
      isMe?(STATE.currentMode==='comp'?`+${prize.toLocaleString('fr-FR')} 🪙`:'+200 🪙'):(STATE.currentMode==='comp'?`-${STATE.currentMise.toLocaleString('fr-FR')} 🪙`:''),
      'Rejouer',()=>{closeModal();findGame();},'Quitter',()=>{closeModal();showScreen('home');}
    );
  },600);
}

let logTimer;
function flashLog(msg,color='#e8e0d0'){
  const el=document.getElementById('game-log');
  if(!el) return;
  el.textContent=msg; el.style.color=color;
  el.style.transform='scale(1.06)';
  clearTimeout(logTimer);
  logTimer=setTimeout(()=>el.style.transform='scale(1)',300);
}
function enableRoll(){document.getElementById('roll-btn').disabled=false;}
function disableRoll(){document.getElementById('roll-btn').disabled=true;}
function updateActivePlayer(){
  for(let i=0;i<4;i++){
    const av=document.getElementById(`pa-${i}`);
    if(av){
      av.style.boxShadow=i===GAME.current?`0 0 0 3px ${COLORS[i]},0 0 14px ${COLORS_GLOW[i]}`:'none';
      av.style.transform=i===GAME.current?'scale(1.18)':'scale(1)';
    }
  }
}
function updateScoreUI(){for(let i=0;i<4;i++){const el=document.getElementById(`ps-${i}`);if(el)el.textContent=`${GAME.scores[i]} pts`;}}
function updateCoinsUI(){
  const fmt=n=>Math.max(0,Math.round(n)).toLocaleString('fr-FR');
  STATE.coins=Math.max(0,STATE.coins);
  ['coins-display','bal-display-num','wallet-amount-num'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fmt(STATE.coins);});
  const myLb=document.getElementById('my-lb-coins');if(myLb)myLb.textContent=fmt(STATE.coins)+' 🪙';
  const pc=document.getElementById('profile-coins');if(pc)pc.textContent=fmt(STATE.coins);
}
function addTx(type,desc,amount){
  const now=new Date();
  STATE.transactions.unshift({type,desc,date:`Aujourd'hui ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,amount});
}
function renderTransactions(){
  const list=document.getElementById('tx-list');
  if(!list) return;
  list.innerHTML=STATE.transactions.slice(0,10).map(t=>`
    <div class="tx-row">
      <div class="tx-icon ${t.amount>0?'tx-gain':'tx-loss'}">${t.amount>0?'↑':'↓'}</div>
      <div style="flex:1"><div class="tx-desc">${t.desc}</div><div class="tx-date">${t.date}</div></div>
      <div class="tx-amount ${t.amount>0?'tx-pos':'tx-neg'}">${t.amount>0?'+':''}${t.amount.toLocaleString('fr-FR')} 🪙</div>
    </div>`).join('');
}

function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('scr-'+name);
  if(el) el.classList.add('active');
  if(name==='wallet') renderTransactions();
  if(name==='game') updateActivePlayer();
}
function navTo(name,btn){
  showScreen(name);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  if(btn) btn.classList.add('active');
}
function startMode(mode){
  STATE.currentMode=mode; showScreen('mode');
  const ms=document.getElementById('mise-section'),gp=document.getElementById('gain-preview');
  if(mode==='free'){ms.style.display='none';gp.style.display='none';}
  else{ms.style.display='block';gp.style.display='block';updateGainPreview();}
}
function setModeTab(t){document.getElementById('tab-rapide').classList.toggle('active',t==='rapide');document.getElementById('tab-amis').classList.toggle('active',t==='amis');}
function setPlayers(n){STATE.numPlayers=n;[2,3,4].forEach(x=>document.getElementById(`pb${x}`).classList.toggle('active',x===n));updateGainPreview();}
function setMise(m){STATE.currentMise=m;[100,500,1000,5000].forEach(x=>document.getElementById(`mb${x}`).classList.toggle('active',x===m));updateGainPreview();}
function updateGainPreview(){document.getElementById('gp-val').textContent=Math.floor(STATE.currentMise*STATE.numPlayers*0.95).toLocaleString('fr-FR')+' 🪙';}

function findGame(){
  if(STATE.currentMode==='comp'&&STATE.coins<STATE.currentMise){showToast('⚠️ Solde insuffisant!');return;}
  if(STATE.socket&&STATE.socket.connected) startMatchmaking(); else startLocalGame();
}
function startLocalGame(){
  showScreen('game');
  document.getElementById('g-np').textContent=STATE.numPlayers;
  document.getElementById('g-mise').textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  initGame(STATE.numPlayers);
  for(let i=0;i<4;i++){const pi=document.getElementById(`pi-${i}`);if(pi)pi.style.display=i<STATE.numPlayers?'flex':'none';}
  setupCanvas(); GAME.rolled=false; enableRoll();
  flashLog('Votre tour — lancez le dé!',COLORS[0]);
}
function startMatchmaking(){
  showScreen('matchmaking');
  document.getElementById('mm-needed').textContent=STATE.numPlayers;
  document.getElementById('mm-mise').textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  document.getElementById('mm-found').textContent='1';
  STATE.socket.emit('find_game',{mode:STATE.currentMode,mise:STATE.currentMise,players:STATE.numPlayers});
  STATE.mmTimeout=setTimeout(()=>{showToast('Mode IA activé');startLocalGame();},15000);
}
function cancelMatchmaking(){if(STATE.mmTimeout)clearTimeout(STATE.mmTimeout);if(STATE.socket)STATE.socket.emit('cancel_search');showScreen('mode');}
function confirmQuit(){
  showModal('⚠️','QUITTER?',STATE.currentMode==='comp'?'Vous perdrez votre mise.':'Quitter?',STATE.currentMode==='comp'?`-${STATE.currentMise.toLocaleString('fr-FR')} 🪙`:'',
    'Continuer',closeModal,'Quitter',()=>{closeModal();if(STATE.currentMode==='comp'&&!GAME.over){STATE.coins-=STATE.currentMise;addTx('loss','Abandon',-STATE.currentMise);updateCoinsUI();}showScreen('home');}
  );
}
function doDeposit(){STATE.coins+=5000;addTx('gain','Dépôt (Orange Money)',5000);updateCoinsUI();renderTransactions();showToast('✅ +5 000 coins déposés!');}
function doWithdraw(){if(STATE.coins<1000){showToast('⚠️ Solde insuffisant!');return;}STATE.coins-=1000;addTx('loss','Retrait vers Wave',-1000);updateCoinsUI();renderTransactions();showToast('💸 1 000 coins retirés vers Wave');}
function selectPM(pm){const n={orange:'Orange Money',moov:'Moov Money',mtn:'MTN Money',wave:'Wave'};showToast(`💳 ${n[pm]} sélectionné`);}
function joinTournament(){showModal('🏅','REJOINDRE','Confirmer l\'inscription?','-1 000 🪙','Confirmer',()=>{STATE.coins-=1000;addTx('loss','Inscription tournoi',-1000);updateCoinsUI();closeModal();showToast('🏅 Inscrit!');},'Annuler',closeModal);}
function showHistorique(){showScreen('wallet');}
function logout(){showModal('🚪','DÉCONNEXION','Se déconnecter?','','Déconnecter',()=>{closeModal();showScreen('login');},'Annuler',closeModal);}

function login(){
  showLoading();
  let i=0,prog=0;
  const bar=document.getElementById('ld-bar'),txt=document.getElementById('ld-text');
  const msgs=['Connexion...','Chargement du profil...','Sync du wallet...','Prêt!'];
  const iv=setInterval(()=>{
    prog+=Math.random()*18+7;if(prog>100)prog=100;
    bar.style.width=prog+'%';
    if(prog>30&&i===0){txt.textContent=msgs[1];i=1;}
    if(prog>60&&i===1){txt.textContent=msgs[2];i=2;}
    if(prog>85&&i===2){txt.textContent=msgs[3];i=3;}
    if(prog>=100){clearInterval(iv);setTimeout(()=>{hideLoading();showScreen('home');updateCoinsUI();initSocket();},400);}
  },100);
}

function initSocket(){
  try{
    STATE.socket=io({transports:['websocket','polling'],timeout:5000});
    STATE.socket.on('connect',()=>STATE.socket.emit('auth',{username:STATE.username,coins:STATE.coins}));
    STATE.socket.on('online_count',({count})=>{const el=document.getElementById('online-count');if(el)el.textContent=count.toLocaleString('fr-FR');});
    STATE.socket.on('match_found',({roomId,players,myIndex})=>{
      clearTimeout(STATE.mmTimeout);STATE.roomId=roomId;STATE.myPlayerIndex=myIndex;
      players.forEach((p,idx)=>{const nm=document.getElementById(`pn-${idx}`);if(nm)nm.textContent=idx===myIndex?'Vous':p.username;});
      showToast('🎮 Partie trouvée!');startLocalGame();
    });
    STATE.socket.on('disconnect',()=>showToast('⚠️ Connexion perdue'));
  }catch(e){STATE.socket=null;}
  const el=document.getElementById('online-count');
  if(el){let b=247;setInterval(()=>{el.textContent=(b+Math.floor(Math.random()*20-8)).toLocaleString('fr-FR');},6000);}
}

function showModal(icon,title,msg,coins,b1txt,b1fn,b2txt,b2fn){
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').textContent=msg;
  const mc=document.getElementById('m-coins');mc.textContent=coins;mc.style.display=coins?'block':'none';
  const b1=document.getElementById('m-btn1'),b2=document.getElementById('m-btn2');
  b1.textContent=b1txt;b1.onclick=b1fn;b2.textContent=b2txt;b2.onclick=b2fn;
  document.getElementById('modal').classList.add('open');
}
function closeModal(){document.getElementById('modal').classList.remove('open');}

let toastTimer;
function showToast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('show'),3000);
}
function showLoading(){document.getElementById('loading').classList.remove('hidden');}
function hideLoading(){document.getElementById('loading').classList.add('hidden');}

function initParticles(){
  const c=document.getElementById('particles');if(!c)return;
  c.width=window.innerWidth;c.height=window.innerHeight;
  const ctx2=c.getContext('2d');
  const pts=Array.from({length:30},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+0.5,vx:(Math.random()-0.5)*0.3,vy:-(Math.random()*0.5+0.1),op:Math.random()*0.35+0.05}));
  (function loop(){
    ctx2.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-5){p.y=c.height+5;p.x=Math.random()*c.width;}ctx2.save();ctx2.globalAlpha=p.op;ctx2.beginPath();ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);ctx2.fillStyle='#D4AF37';ctx2.fill();ctx2.restore();});
    requestAnimationFrame(loop);
  })();
  window.addEventListener('resize',()=>{c.width=window.innerWidth;c.height=window.innerHeight;});
}

initParticles();
updateCoinsUI();
hideLoading();