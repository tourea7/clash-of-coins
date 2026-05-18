// CLASH OF COINS — game.js v3.0 — Ludo King Style
const STATE={coins:15350,username:'Sidick Kone',initials:'SK',currentMode:'free',currentMise:500,numPlayers:4,socket:null,mmTimeout:null,transactions:[{type:'gain',desc:'Partie gagnée',date:"Aujourd'hui 14:35",amount:2500},{type:'loss',desc:'Mise de partie',date:"Aujourd'hui 14:30",amount:-1000},{type:'gain',desc:'Dépôt (Orange Money)',date:"Aujourd'hui 13:20",amount:5000},{type:'gain',desc:'Partie gagnée',date:'Hier 12:10',amount:1800},{type:'loss',desc:'Retrait (Wave)',date:'Hier 18:40',amount:-3000}]};
const GAME={players:4,current:0,dice:1,rolled:false,over:false,pieces:[],finished:[],scores:[0,0,0,0],movable:[],waitMove:false};

// Ludo King color palette
const PC=['#1a6fff','#ff1a1a','#00cc44','#ffcc00'];      // main colors
const PL=['#66aaff','#ff7777','#44ff88','#ffe566'];      // light
const PD=['#0033cc','#cc0000','#008822','#cc8800'];      // dark
const PG=['rgba(26,111,255,.6)','rgba(255,26,26,.6)','rgba(0,204,68,.6)','rgba(255,204,0,.6)'];
const HB=['#0a1840','#400a0a','#0a3318','#3a2800'];      // home bg
const AI_NAMES=['QueenLudo','LuckyStar','KingLudo','DiceKing'];
const DICE_FACES=['⚀','⚁','⚂','⚃','⚄','⚅'];

// Board path 52 squares
const PATH52=[[1,6],[2,6],[3,6],[4,6],[5,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0],[7,0],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],[14,7],[14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[7,14],[6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8]];
const HOME_STRETCH=[[[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],[[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],[[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],[[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]]];
const BASE_POS=[[[2,2],[3,2],[2,3],[3,3]],[[10,2],[11,2],[10,3],[11,3]],[[2,10],[3,10],[2,11],[3,11]],[[10,10],[11,10],[10,11],[11,11]]];
const ENTRY=[0,13,39,26];
const SAFE=new Set(['1,8','6,2','8,1','13,6','13,8','8,13','6,13','1,6']);

let canvas,ctx,C;

function setupCanvas(){
  canvas=document.getElementById('board-canvas');
  const size=Math.min(window.innerWidth-24,window.innerHeight-290,400);
  canvas.width=canvas.height=size; C=size/15;
  ctx=canvas.getContext('2d');
  canvas.addEventListener('click',onBoardClick);
  canvas.addEventListener('touchend',e=>{e.preventDefault();const t=e.changedTouches[0];onBoardClick({clientX:t.clientX,clientY:t.clientY});},{passive:false});
  drawBoard();
}

function initGame(n){
  GAME.players=n;GAME.current=0;GAME.dice=1;GAME.rolled=false;GAME.over=false;GAME.waitMove=false;GAME.movable=[];GAME.scores=Array(4).fill(0);
  GAME.pieces=Array.from({length:4},()=>Array(4).fill(-1));GAME.finished=Array(4).fill(0);
}

// ===== LUDO KING STYLE BOARD =====
function drawBoard(){
  if(!ctx)return;
  const W=canvas.width;
  ctx.clearRect(0,0,W,W);

  // Board shadow/background
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.8)';ctx.shadowBlur=30;
  ctx.fillStyle='#1a1a2e';
  rFill(0,0,W,W,14);
  ctx.restore();

  // Draw each cell
  for(let r=0;r<15;r++) for(let c=0;c<15;c++) drawCell(c,r);

  // Home zones (big colored squares)
  drawHome(0,'#0033bb','#1144ee','#4488ff'); // blue top-left
  drawHome(1,'#cc0000','#ee1111','#ff5555'); // red top-right
  drawHome(2,'#008822','#00aa33','#44dd66'); // green bot-left
  drawHome(3,'#cc8800','#eebb00','#ffe566'); // yellow bot-right

  // Center star
  drawStar();

  // Pieces
  for(let p=0;p<GAME.players;p++) for(let i=0;i<4;i++) drawPiece(p,i);

  // Movable highlight
  if(GAME.waitMove){
    const t=Date.now()/300;
    const alpha=0.5+0.5*Math.sin(t*Math.PI*2);
    GAME.movable.forEach(m=>{
      const{x,y}=getPXY(m.player,m.piece);
      ctx.save();
      ctx.beginPath();ctx.arc(x,y,C*0.55+alpha*6,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${0.6+alpha*0.4})`;ctx.lineWidth=3;ctx.stroke();
      ctx.beginPath();ctx.arc(x,y,C*0.62+alpha*6,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${0.2+alpha*0.2})`;ctx.lineWidth=5;ctx.stroke();
      ctx.restore();
    });
    requestAnimationFrame(drawBoard);
  }
}

function drawCell(col,row){
  const x=col*C,y=row*C,s=C;
  // Skip home zone cells — drawn separately
  if((col<6&&row<6)||(col>8&&row<6)||(col<6&&row>8)||(col>8&&row>8)) return;

  let fill='#e8e0d0',stroke='rgba(0,0,0,.15)',sw=0.5;

  // Colored path columns/rows (home stretches)
  if(col===7&&row>=1&&row<=6)       {fill='#b3ccff';stroke='#6699ff';sw=0.8;}
  else if(col===7&&row>=8&&row<=13) {fill='#b3ffcc';stroke='#44cc77';sw=0.8;}
  else if(row===7&&col>=1&&col<=6)  {fill='#ffe0b3';stroke='#ffaa44';sw=0.8;}
  else if(row===7&&col>=8&&col<=13) {fill='#fff3b3';stroke='#ffdd44';sw=0.8;}
  // Main path cells
  else if(isOnPath(col,row))        {fill='#f5f0e8';stroke='rgba(0,0,0,.12)';}

  // Safe star cells
  if(SAFE.has(`${col},${row}`)){
    fill='#fffde0'; stroke='#FFD700'; sw=1;
  }

  ctx.fillStyle=fill;
  ctx.fillRect(x+0.5,y+0.5,s-1,s-1);
  ctx.strokeStyle=stroke;ctx.lineWidth=sw;
  ctx.strokeRect(x+0.5,y+0.5,s-1,s-1);

  // Star symbol on safe cells
  if(SAFE.has(`${col},${row}`)&&col!==7&&row!==7){
    ctx.fillStyle='rgba(255,215,0,.7)';
    ctx.font=`bold ${Math.floor(C*0.48)}px serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('★',x+C/2,y+C/2+1);
  }

  // Arrow on colored path entry cells
  if(col===1&&row===6){drawArrow(x,y,'right','#1a6fff');}
  else if(col===8&&row===1){drawArrow(x,y,'down','#ff1a1a');}
  else if(col===13&&row===8){drawArrow(x,y,'left','#00cc44');}
  else if(col===6&&row===13){drawArrow(x,y,'up','#ffcc00');}
}

function isOnPath(col,row){
  return PATH52.some(([c,r])=>c===col&&r===row)||
    HOME_STRETCH.some(s=>s.some(([c,r])=>c===col&&r===row));
}

function drawArrow(x,y,dir,color){
  ctx.save();
  ctx.fillStyle=color;
  ctx.globalAlpha=0.5;
  const cx=x+C/2,cy=y+C/2,s=C*0.22;
  ctx.beginPath();
  if(dir==='right'){ctx.moveTo(cx-s,cy-s);ctx.lineTo(cx+s,cy);ctx.lineTo(cx-s,cy+s);}
  else if(dir==='down'){ctx.moveTo(cx-s,cy-s);ctx.lineTo(cx,cy+s);ctx.lineTo(cx+s,cy-s);}
  else if(dir==='left'){ctx.moveTo(cx+s,cy-s);ctx.lineTo(cx-s,cy);ctx.lineTo(cx+s,cy+s);}
  else if(dir==='up'){ctx.moveTo(cx-s,cy+s);ctx.lineTo(cx,cy-s);ctx.lineTo(cx+s,cy+s);}
  ctx.closePath();ctx.fill();
  ctx.restore();
}

function drawHome(player,dark,mid,light){
  const corners=[[0,0],[9,0],[0,9],[9,9]];
  const [col,row]=corners[player];
  const x=col*C,y=row*C,w=6*C,h=6*C;

  // Outer colored square
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,dark);g.addColorStop(0.5,mid);g.addColorStop(1,dark);
  ctx.fillStyle=g;
  rFill(x,y,w,h,10);

  // Inner white rounded square
  const m=C*0.6;
  ctx.fillStyle='rgba(255,255,255,.12)';
  rFill(x+m,y+m,w-m*2,h-m*2,8);

  // 4 piece circles
  BASE_POS[player].forEach(([bc,br])=>{
    const bx=(bc+0.5)*C,by=(br+0.5)*C,r=C*0.36;
    // Shadow
    ctx.beginPath();ctx.arc(bx,by+2,r,0,Math.PI*2);
    ctx.fillStyle='rgba(0,0,0,.3)';ctx.fill();
    // Circle bg
    const cg=ctx.createRadialGradient(bx-r*.3,by-r*.3,r*.05,bx,by,r);
    cg.addColorStop(0,'rgba(255,255,255,.3)');cg.addColorStop(1,'rgba(0,0,0,.2)');
    ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);
    ctx.fillStyle=cg;ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();
  });

  // Player label
  const labels=['BLEU','ROUGE','VERT','JAUNE'];
  ctx.fillStyle='rgba(255,255,255,.4)';
  ctx.font=`bold ${Math.floor(C*0.32)}px Rajdhani,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(labels[player],(col+3)*C,(row+3)*C);
}

function drawStar(){
  const cx=7.5*C,cy=7.5*C,s=1.7*C;

  // Background square
  ctx.fillStyle='#fff';
  rFill(6*C,6*C,3*C,3*C,6);

  // 4 colored triangles
  const drawTri=(x1,y1,x2,y2,x3,y3,c,a=0.9)=>{
    ctx.save();ctx.globalAlpha=a;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);
    ctx.closePath();ctx.fillStyle=c;ctx.fill();ctx.restore();
  };
  drawTri(cx,cy-s,cx-s*.68,cy,cx+s*.68,cy,'#1a6fff');
  drawTri(cx+s,cy,cx,cy-s*.68,cx,cy+s*.68,'#ff1a1a');
  drawTri(cx,cy+s,cx+s*.68,cy,cx-s*.68,cy,'#00cc44');
  drawTri(cx-s,cy,cx,cy+s*.68,cx,cy-s*.68,'#ffcc00');

  // Dividing lines
  ctx.strokeStyle='rgba(255,255,255,.6)';ctx.lineWidth=1;
  [[cx,cy-s,cx,cy+s],[cx-s,cy,cx+s,cy]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });

  // Center jewel
  const r=C*0.72;
  const cg=ctx.createRadialGradient(cx-r*.3,cy-r*.3,r*.05,cx,cy,r);
  cg.addColorStop(0,'#fff9cc');cg.addColorStop(0.4,'#FFD700');cg.addColorStop(1,'#FF8C00');
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);
  ctx.fillStyle=cg;ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();

  // C letter
  ctx.fillStyle='#000';
  ctx.font=`bold ${Math.floor(C*.78)}px 'Cinzel Decorative',serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('C',cx,cy+1);
}

function drawPiece(p,i){
  const{x,y}=getPXY(p,i);
  const pos=GAME.pieces[p][i];
  const r=C*.33;
  const color=PC[p],light=PL[p],dark=PD[p];

  // Drop shadow
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;

  // Body gradient (3D sphere effect)
  const g=ctx.createRadialGradient(x-r*.4,y-r*.4,r*.05,x,y,r);
  g.addColorStop(0,light);g.addColorStop(0.45,color);g.addColorStop(1,dark);
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=g;ctx.fill();
  ctx.restore();

  // Border
  ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();

  // Shine highlight
  ctx.beginPath();ctx.arc(x-r*.32,y-r*.32,r*.28,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.55)';ctx.fill();

  // Small secondary shine
  ctx.beginPath();ctx.arc(x-r*.15,y-r*.55,r*.12,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.3)';ctx.fill();

  // Number
  ctx.fillStyle='#fff';
  ctx.font=`bold ${Math.floor(r*1.05)}px Rajdhani,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(i+1,x,y+.5);

  // Active player pulse ring
  if(p===GAME.current&&!GAME.rolled){
    ctx.save();
    ctx.shadowColor=color;ctx.shadowBlur=16;
    ctx.beginPath();ctx.arc(x,y,r+3,0,Math.PI*2);
    ctx.strokeStyle=`${color}cc`;ctx.lineWidth=2.5;ctx.stroke();
    ctx.restore();
  }
}

function getPXY(p,i){
  const pos=GAME.pieces[p][i];
  let col,row;
  if(pos===-1)[col,row]=BASE_POS[p][i];
  else if(pos>=52){const si=pos-52;if(si<6)[col,row]=HOME_STRETCH[p][si];else{col=7;row=7;}}
  else[col,row]=PATH52[(pos+ENTRY[p])%52];
  // Stack offset
  const stk=[];
  for(let p2=0;p2<GAME.players;p2++)for(let i2=0;i2<4;i2++){
    if(p2===p&&i2===i)continue;
    const op=GAME.pieces[p2][i2];let oc,or2;
    if(op===-1)[oc,or2]=BASE_POS[p2][i2];
    else if(op>=52){const si=op-52;if(si<6)[oc,or2]=HOME_STRETCH[p2][si];else{oc=7;or2=7;}}
    else[oc,or2]=PATH52[(op+ENTRY[p2])%52];
    if(oc===col&&or2===row)stk.push(1);
  }
  const offs=[[0,0],[.3,-.15],[-.3,-.15],[0,.3]];
  const o=offs[Math.min(stk.length,3)];
  return{x:(col+.5+o[0]*.45)*C,y:(row+.5+o[1]*.45)*C};
}

function rFill(x,y,w,h,r){
  ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();ctx.fill();
}

// ===== GAME LOGIC =====
function getMovable(player,dice){
  const moves=[];
  for(let i=0;i<4;i++){
    const pos=GAME.pieces[player][i];
    if(pos===58)continue;
    if(pos===-1){if(dice===6)moves.push({player,piece:i,newPos:0});}
    else{const np=pos+dice;if(np<=58)moves.push({player,piece:i,newPos:np});}
  }
  return moves;
}

function onBoardClick(e){
  if(!GAME.waitMove)return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
  const my=(e.clientY-rect.top)*(canvas.height/rect.height);
  for(const m of GAME.movable){
    const{x,y}=getPXY(m.player,m.piece);
    if(Math.hypot(mx-x,my-y)<C*.6){applyMove(m.player,m.piece,m.newPos);return;}
  }
}

function applyMove(player,piece,newPos){
  GAME.pieces[player][piece]=newPos;GAME.waitMove=false;GAME.movable=[];
  if(newPos>=0&&newPos<52){
    const[myC,myR]=PATH52[(newPos+ENTRY[player])%52];
    if(!SAFE.has(`${myC},${myR}`)){
      for(let p2=0;p2<GAME.players;p2++){
        if(p2===player)continue;
        for(let i2=0;i2<4;i2++){
          const op=GAME.pieces[p2][i2];
          if(op>=0&&op<52){
            const[oc,or2]=PATH52[(op+ENTRY[p2])%52];
            if(oc===myC&&or2===myR){GAME.pieces[p2][i2]=-1;GAME.scores[player]+=20;flashLog(`💥 Capture! +20 pts`,PC[player]);}
          }
        }
      }
    }
  }
  if(newPos>=58){
    GAME.pieces[player][piece]=58;GAME.finished[player]++;GAME.scores[player]+=50;
    flashLog(`⭐ Pièce ${piece+1} arrivée! +50 pts`,PC[player]);
    if(GAME.finished[player]>=4){endGame(player);return;}
  }
  updateScoreUI();drawBoard();
  if(GAME.dice===6){
    flashLog(`🎲 ${player===0?'Vous rejouez':AI_NAMES[player-1]+' rejoue'} (6)!`,'#FFD700');
    if(player!==0)setTimeout(()=>aiTurn(player),900);
    else{GAME.rolled=false;enableRoll();}
  }else setTimeout(nextTurn,700);
}

function rollDice(){
  if(GAME.rolled||GAME.over)return;
  GAME.rolled=true;disableRoll();
  const el=document.getElementById('dice-el');
  el.classList.add('rolling');
  let count=0;
  const iv=setInterval(()=>{
    el.textContent=DICE_FACES[Math.floor(Math.random()*6)];
    if(++count>=14){
      clearInterval(iv);el.classList.remove('rolling');
      const result=Math.floor(Math.random()*6)+1;
      GAME.dice=result;el.textContent=DICE_FACES[result-1];
      el.style.transform='scale(1.3)';
      setTimeout(()=>el.style.transform='scale(1)',250);
      const movable=getMovable(0,result);
      if(movable.length===0){flashLog(`Vous lancez ${result} — aucun mouvement 😕`,'#888');setTimeout(nextTurn,1300);}
      else if(movable.length===1){flashLog(`Vous lancez ${result} 🎯`,PC[0]);setTimeout(()=>applyMove(movable[0].player,movable[0].piece,movable[0].newPos),500);}
      else{GAME.movable=movable;GAME.waitMove=true;flashLog(`Vous lancez ${result} — touchez un pion ✨`,'#FFD700');drawBoard();}
    }
  },60);
}

function nextTurn(){
  GAME.current=(GAME.current+1)%GAME.players;GAME.rolled=false;updateActivePlayer();
  if(GAME.current===0){flashLog('🎲 Votre tour!',PC[0]);enableRoll();}
  else{flashLog(`Tour de ${AI_NAMES[GAME.current-1]}...`,PC[GAME.current]);disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);}
}

function aiTurn(player){
  if(GAME.over||GAME.current!==player)return;
  const result=Math.floor(Math.random()*6)+1;
  GAME.dice=result;document.getElementById('dice-el').textContent=DICE_FACES[result-1];
  flashLog(`${AI_NAMES[player-1]} lance ${result}`,PC[player]);
  setTimeout(()=>{
    const movable=getMovable(player,result);
    if(movable.length>0){
      let best=movable[0];
      for(const m of movable)if(m.newPos>best.newPos)best=m;
      applyMove(best.player,best.piece,best.newPos);
    }else{if(result===6)setTimeout(()=>aiTurn(player),800);else setTimeout(nextTurn,600);}
  },700);
}

function endGame(winner){
  GAME.over=true;
  const isMe=winner===0;
  const prize=isMe?Math.floor(STATE.currentMise*STATE.numPlayers*.95):0;
  if(STATE.currentMode==='comp'){
    if(isMe){STATE.coins+=prize;addTx('gain','Partie gagnée',prize);}
    else{STATE.coins-=STATE.currentMise;addTx('loss','Partie perdue',-STATE.currentMise);}
    updateCoinsUI();
  }else if(isMe){STATE.coins+=200;addTx('gain','Bonus gratuit',200);updateCoinsUI();}
  setTimeout(()=>{
    showModal(isMe?'🏆':'😤',isMe?'VICTOIRE!':'DÉFAITE',
      isMe?'Félicitations! Vous avez dominé!':`${winner===0?'Vous':AI_NAMES[winner-1]} a gagné!`,
      isMe?(STATE.currentMode==='comp'?`+${prize.toLocaleString('fr-FR')} 🪙`:'+200 🪙'):(STATE.currentMode==='comp'?`-${STATE.currentMise.toLocaleString('fr-FR')} 🪙`:''),
      'Rejouer',()=>{closeModal();findGame();},'Quitter',()=>{closeModal();showScreen('home');}
    );
  },600);
}

let logT;
function flashLog(msg,color='#ccc'){
  const el=document.getElementById('game-log');if(!el)return;
  el.textContent=msg;el.style.color=color;el.style.transform='scale(1.06)';
  clearTimeout(logT);logT=setTimeout(()=>el.style.transform='scale(1)',300);
}
function enableRoll(){document.getElementById('roll-btn').disabled=false;}
function disableRoll(){document.getElementById('roll-btn').disabled=true;}
function updateActivePlayer(){
  for(let i=0;i<4;i++){
    const av=document.getElementById(`pa-${i}`);if(!av)continue;
    av.style.boxShadow=i===GAME.current?`0 0 0 3px ${PL[i]},0 0 20px ${PG[i]}`:'0 0 10px '+PG[i].replace('.6','.3');
    av.style.transform=i===GAME.current?'scale(1.2)':'scale(1)';
  }
}
function updateScoreUI(){for(let i=0;i<4;i++){const el=document.getElementById(`ps-${i}`);if(el)el.textContent=`${GAME.scores[i]} pts`;}}
function updateCoinsUI(){
  const fmt=n=>Math.max(0,Math.round(n)).toLocaleString('fr-FR');
  STATE.coins=Math.max(0,STATE.coins);
  ['coins-display','bal-display-num','wallet-amount-num'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fmt(STATE.coins);});
  const e1=document.getElementById('my-lb-coins');if(e1)e1.textContent=fmt(STATE.coins)+' 🪙';
  const e2=document.getElementById('profile-coins');if(e2)e2.textContent=fmt(STATE.coins);
}
function addTx(type,desc,amount){const now=new Date();STATE.transactions.unshift({type,desc,date:`Aujourd'hui ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,amount});}
function renderTransactions(){
  const list=document.getElementById('tx-list');if(!list)return;
  list.innerHTML=STATE.transactions.slice(0,10).map(t=>`<div class="tx-row"><div class="tx-icon ${t.amount>0?'tx-gain':'tx-loss'}">${t.amount>0?'↑':'↓'}</div><div style="flex:1"><div class="tx-desc">${t.desc}</div><div class="tx-date">${t.date}</div></div><div class="tx-amount ${t.amount>0?'tx-pos':'tx-neg'}">${t.amount>0?'+':''}${t.amount.toLocaleString('fr-FR')} 🪙</div></div>`).join('');
}

// ===== NAV =====
function showScreen(name){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));const el=document.getElementById('scr-'+name);if(el)el.classList.add('active');if(name==='wallet')renderTransactions();if(name==='game')updateActivePlayer();}
function navTo(name,btn){showScreen(name);document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));if(btn)btn.classList.add('active');}
function startMode(mode){STATE.currentMode=mode;showScreen('mode');const ms=document.getElementById('mise-section'),gp=document.getElementById('gain-preview');if(mode==='free'){ms.style.display='none';gp.style.display='none';}else{ms.style.display='block';gp.style.display='block';updateGainPreview();}}
function setModeTab(t){document.getElementById('tab-rapide').classList.toggle('active',t==='rapide');document.getElementById('tab-amis').classList.toggle('active',t==='amis');}
function setPlayers(n){STATE.numPlayers=n;[2,3,4].forEach(x=>document.getElementById(`pb${x}`).classList.toggle('active',x===n));updateGainPreview();}
function setMise(m){STATE.currentMise=m;[100,500,1000,5000].forEach(x=>document.getElementById(`mb${x}`).classList.toggle('active',x===m));updateGainPreview();}
function updateGainPreview(){document.getElementById('gp-val').textContent=Math.floor(STATE.currentMise*STATE.numPlayers*.95).toLocaleString('fr-FR')+' 🪙';}
function findGame(){
  if(STATE.currentMode==='comp'&&STATE.coins<STATE.currentMise){showToast('⚠️ Solde insuffisant!');return;}
  if(STATE.socket&&STATE.socket.connected)startMatchmaking();else startLocalGame();
}
function startLocalGame(){
  showScreen('game');
  document.getElementById('g-np').textContent=STATE.numPlayers;
  document.getElementById('g-mise').textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  initGame(STATE.numPlayers);
  for(let i=0;i<4;i++){const pi=document.getElementById(`pi-${i}`);if(pi)pi.style.display=i<STATE.numPlayers?'flex':'none';}
  setupCanvas();GAME.rolled=false;enableRoll();flashLog('🎲 Votre tour — lancez le dé!',PC[0]);
}
function startMatchmaking(){
  showScreen('matchmaking');document.getElementById('mm-needed').textContent=STATE.numPlayers;
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
  showLoading();let i=0,prog=0;
  const bar=document.getElementById('ld-bar'),txt=document.getElementById('ld-text');
  const msgs=['Connexion...','Chargement du profil...','Sync du wallet...','Prêt! 🎉'];
  const iv=setInterval(()=>{
    prog+=Math.random()*18+7;if(prog>100)prog=100;bar.style.width=prog+'%';
    if(prog>30&&i===0){txt.textContent=msgs[1];i=1;}if(prog>60&&i===1){txt.textContent=msgs[2];i=2;}if(prog>85&&i===2){txt.textContent=msgs[3];i=3;}
    if(prog>=100){clearInterval(iv);setTimeout(()=>{hideLoading();showScreen('home');updateCoinsUI();initSocket();},400);}
  },100);
}

function initSocket(){
  try{
    STATE.socket=io({transports:['websocket','polling'],timeout:5000});
    STATE.socket.on('connect',()=>STATE.socket.emit('auth',{username:STATE.username,coins:STATE.coins}));
    STATE.socket.on('online_count',({count})=>{const el=document.getElementById('online-count');if(el)el.textContent=count.toLocaleString('fr-FR');});
    STATE.socket.on('match_found',({roomId,players,myIndex})=>{clearTimeout(STATE.mmTimeout);players.forEach((p,idx)=>{const nm=document.getElementById(`pn-${idx}`);if(nm)nm.textContent=idx===myIndex?'Vous':p.username;});showToast('🎮 Partie trouvée!');startLocalGame();});
    STATE.socket.on('disconnect',()=>showToast('⚠️ Connexion perdue'));
  }catch(e){STATE.socket=null;}
  const el=document.getElementById('online-count');if(el){let b=247;setInterval(()=>{el.textContent=(b+Math.floor(Math.random()*20-8)).toLocaleString('fr-FR');},6000);}
}

function showModal(icon,title,msg,coins,b1t,b1f,b2t,b2f){
  document.getElementById('m-icon').textContent=icon;document.getElementById('m-title').textContent=title;document.getElementById('m-msg').textContent=msg;
  const mc=document.getElementById('m-coins');mc.textContent=coins;mc.style.display=coins?'block':'none';
  const b1=document.getElementById('m-btn1'),b2=document.getElementById('m-btn2');
  b1.textContent=b1t;b1.onclick=b1f;b2.textContent=b2t;b2.onclick=b2f;
  document.getElementById('modal').classList.add('open');
}
function closeModal(){document.getElementById('modal').classList.remove('open');}

let toastT;
function showToast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3000);}
function showLoading(){document.getElementById('loading').classList.remove('hidden');}
function hideLoading(){document.getElementById('loading').classList.add('hidden');}

function initParticles(){
  const c=document.getElementById('particles');if(!c)return;
  c.width=window.innerWidth;c.height=window.innerHeight;
  const ctx2=c.getContext('2d');
  const pts=Array.from({length:35},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2.5+.5,vx:(Math.random()-.5)*.4,vy:-(Math.random()*.6+.15),op:Math.random()*.4+.05,type:Math.floor(Math.random()*3)}));
  (function loop(){
    ctx2.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;if(p.y<-8){p.y=c.height+8;p.x=Math.random()*c.width;}
      ctx2.save();ctx2.globalAlpha=p.op;
      if(p.type===0){ctx2.beginPath();ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);ctx2.fillStyle='#FFD700';ctx2.fill();}
      else if(p.type===1){ctx2.fillStyle='#FFD700';ctx2.font=`${Math.floor(p.r*4)}px serif`;ctx2.textAlign='center';ctx2.fillText('★',p.x,p.y);}
      else{ctx2.fillStyle='#FFA500';ctx2.fillRect(p.x,p.y,p.r*1.5,p.r*1.5);}
      ctx2.restore();
    });
    requestAnimationFrame(loop);
  })();
  window.addEventListener('resize',()=>{c.width=window.innerWidth;c.height=window.innerHeight;});
}

initParticles();updateCoinsUI();hideLoading();