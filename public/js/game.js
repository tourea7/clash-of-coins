// CLASH OF COINS — game.js v5.0 — Ludo King Style Fixed
const STATE={coins:1000,username:'Joueur',currentMode:'free',currentMise:500,numPlayers:4,myColor:0,socket:null,mmTimeout:null,
transactions:[
  {type:'gain',desc:'Partie gagnée',date:"12 Mai 2024 · 14:35",amount:2500},
  {type:'loss',desc:'Mise de partie',date:"12 Mai 2024 · 14:30",amount:-1000},
  {type:'gain',desc:'Dépôt (Orange Money)',date:"12 Mai 2024 · 13:20",amount:5000},
]};

const GAME={
  players:4,current:0,dice:1,rolled:false,over:false,
  pieces:[],finished:[],scores:[0,0,0,0],
  movable:[],waitMove:false,
  ranking:[],eliminated:[],activePlayers:4,
};

// Colors: P0=Blue P1=Red P2=Green P3=Yellow
const PC  =['#1a6fff','#ee1111','#00cc44','#ddaa00'];
const PCL =['#88bbff','#ff8888','#66ff88','#ffdd66'];
const PCD =['#0033cc','#cc0000','#008822','#997700'];
const PCG =['rgba(26,111,255,.6)','rgba(238,17,17,.6)','rgba(0,204,68,.6)','rgba(221,170,0,.6)'];

// Home zone colors
const HOME_DARK =['#1144cc','#cc1111','#008833','#bb8800'];
const HOME_MID  =['#2255ee','#ee2222','#00aa44','#ddaa00'];

const AI=['QueenLudo','LuckyStar','KingLudo','DiceKing'];
const DF=['⚀','⚁','⚂','⚃','⚄','⚅'];
const COLOR_NAMES=['Bleu','Rouge','Vert','Jaune'];
const COLOR_PAWNS=['🔵','🔴','🟢','🟡'];

// ===== BOARD PATH (52 squares clockwise) =====
// P0(Blue) enters at index 0=(1,6), P1(Red) at 13=(8,1), P2(Green) at 26=(13,8), P3(Yellow) at 39=(6,13)
const P52=[
  [1,6],[2,6],[3,6],[4,6],[5,6],           // Blue entry → right
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],     // col6 up
  [7,0],[8,0],                              // row0 right
  [8,1],[8,2],[8,3],[8,4],[8,5],           // Red entry ↓ col8
  [9,6],[10,6],[11,6],[12,6],[13,6],       // row6 right
  [14,6],[14,7],[14,8],                    // col14 down
  [13,8],[12,8],[11,8],[10,8],[9,8],       // Green entry ← row8
  [8,9],[8,10],[8,11],[8,12],[8,13],       // col8 down
  [8,14],[7,14],[6,14],                    // row14 left
  [6,13],[6,12],[6,11],[6,10],[6,9],       // Yellow entry ↑ col6
  [5,8],[4,8],[3,8],[2,8],[1,8],           // row8 left
  [0,8],[0,7],[0,6],                       // col0 up
];

// Home stretches (6 squares toward center)
const HS=[
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],     // Blue: row7 →
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],     // Red: col7 ↓
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]], // Green: row7 ←
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]], // Yellow: col7 ↑
];

// Base positions in home zones
const BP=[
  [[2,2],[3,2],[2,3],[3,3]],           // Blue: top-left
  [[10,2],[11,2],[10,3],[11,3]],       // Red: top-right
  [[10,10],[11,10],[10,11],[11,11]],   // Green: bottom-RIGHT (enters from right side)
  [[2,10],[3,10],[2,11],[3,11]],       // Yellow: bottom-LEFT (enters from bottom)
];

// Entry indices in P52
const EN=[0,13,26,39];

// Safe squares (star squares)
// Safe squares (star squares - protected from capture)
const SF=new Set(['2,6','6,2','12,6','6,12','8,2','2,8','8,12','12,8']);
const ENTRY=new Set(['1,6','8,1','13,8','6,13']);
const ENTRY_COLORS={'1,6':0,'8,1':1,'13,8':2,'6,13':3};

let canvas,ctx,C;
let animFrame=null;

// ===== CANVAS SETUP =====
function setupCanvas(){
  canvas=document.getElementById('board-canvas');
  const maxW=window.innerWidth-16;
  const maxH=window.innerHeight-220;
  const size=Math.min(maxW,maxH,460);
  canvas.width=canvas.height=size;
  C=size/15;
  ctx=canvas.getContext('2d');
  canvas.style.cursor='pointer';
  canvas.addEventListener('click',onBoardClick);
  canvas.addEventListener('touchend',e=>{
    e.preventDefault();
    const t=e.changedTouches[0];
    const rect=canvas.getBoundingClientRect();
    onBoardClick({clientX:t.clientX,clientY:t.clientY,_rect:rect});
  },{passive:false});
  drawBoard();
}

function initGame(n){
  GAME.players=n;GAME.current=0;GAME.dice=1;GAME.rolled=false;GAME.over=false;
  GAME.waitMove=false;GAME.movable=[];
  GAME.scores=Array(4).fill(0);
  GAME.pieces=Array.from({length:4},()=>Array(4).fill(-1));
  GAME.finished=Array(4).fill(0);
  GAME.ranking=[];GAME.eliminated=[];GAME.activePlayers=n;
}

// ===== DRAW BOARD =====
function drawBoard(){
  if(!ctx)return;
  const W=canvas.width;

  // Board background - Ludo King warm cream
  const bgGrad = ctx.createLinearGradient(0,0,W,W);
  bgGrad.addColorStop(0,'#f8f2e0');
  bgGrad.addColorStop(1,'#f0e8cc');
  ctx.fillStyle=bgGrad;
  roundRect(ctx,0,0,W,W,14);ctx.fill();
  // Subtle grid background
  ctx.strokeStyle='rgba(180,150,100,.08)';ctx.lineWidth=.5;
  for(let i=1;i<15;i++){
    ctx.beginPath();ctx.moveTo(i*C,0);ctx.lineTo(i*C,W);ctx.stroke();
    ctx.beginPath();ctx.moveTo(0,i*C);ctx.lineTo(W,i*C);ctx.stroke();
  }

  // Draw all path cells
  for(let r=0;r<15;r++)for(let c=0;c<15;c++) drawCell(c,r);

  // Draw home zones (colored corners)
  drawHomeZone(0,0,0);   // Blue: top-left
  drawHomeZone(1,9,0);   // Red: top-right
  drawHomeZone(2,9,9);   // Green: bottom-RIGHT
  drawHomeZone(3,0,9);   // Yellow: bottom-LEFT

  // Draw center star
  drawCenter();

  // Draw all pieces
  for(let p=0;p<GAME.players;p++)
    for(let i=0;i<4;i++) drawPiece(p,i);

  // Draw movable highlights
  if(GAME.waitMove){
    const t=Date.now()/400;
    const alpha=0.4+0.4*Math.sin(t);
    GAME.movable.forEach(m=>{
      const{x,y}=getPXY(m.player,m.piece);
      ctx.save();
      ctx.beginPath();ctx.arc(x,y,C*.6,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${alpha})`;
      ctx.lineWidth=3;ctx.stroke();
      // Glow
      ctx.shadowColor='#FFD700';ctx.shadowBlur=12;
      ctx.beginPath();ctx.arc(x,y,C*.55,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${alpha*.6})`;
      ctx.lineWidth=2;ctx.stroke();
      ctx.restore();
    });
    animFrame=requestAnimationFrame(drawBoard);
  }
}

function drawCell(col,row){
  const x=col*C,y=row*C;

  // Skip home zone corners (drawn separately)
  if((col<6&&row<6)||(col>8&&row<6)||(col<6&&row>8)||(col>8&&row>8))return;
  // Skip center (drawn separately)
  if(col>=6&&col<=8&&row>=6&&row<=8)return;

  // Determine cell type
  let fill='#f0e8d0',border='rgba(180,150,100,.2)',bw=.5;

  // Home stretch lanes (colored corridors toward center)
  if(row===7&&col>=1&&col<=6)       {fill='#c4d4ff';border='rgba(26,111,255,.3)';bw=.8;}  // Blue corridor
  else if(col===7&&row>=1&&row<=6)  {fill='#ffc4c4';border='rgba(238,17,17,.3)';bw=.8;}   // Red corridor
  else if(row===7&&col>=8&&col<=13) {fill='#c4ffcc';border='rgba(0,204,68,.3)';bw=.8;}    // Green corridor
  else if(col===7&&row>=8&&row<=13) {fill='#fff0a0';border='rgba(221,170,0,.3)';bw=.8;}   // Yellow corridor
  // First step out of home = same color as home zone (no arrow, just colored)
  else if(col===1&&row===6)  {fill=HOME_MID[0];border='rgba(26,111,255,.4)';bw=1;}   // Blue exit
  else if(col===8&&row===1)  {fill=HOME_MID[1];border='rgba(238,17,17,.4)';bw=1;}    // Red exit
  else if(col===13&&row===8) {fill=HOME_MID[2];border='rgba(0,204,68,.4)';bw=1;}     // Green exit
  else if(col===6&&row===13) {fill=HOME_MID[3];border='rgba(221,170,0,.4)';bw=1;}    // Yellow exit

  // Entry squares - same color as home
  if(ENTRY.has(`${col},${row}`)){
    const pc=ENTRY_COLORS[`${col},${row}`];
    const hc=['#4488ff','#ff4444','#44cc66','#ffcc22'];
    const hb=['rgba(26,111,255,.7)','rgba(238,17,17,.7)','rgba(0,204,68,.7)','rgba(221,170,0,.7)'];
    fill=hc[pc];border=hb[pc];bw=1.5;
  }
  // Safe/star squares
  if(SF.has(`${col},${row}`)){
    fill='#fffef5';border='rgba(180,150,80,.25)';bw=.8;
  }

  ctx.fillStyle=fill;
  ctx.fillRect(x+.5,y+.5,C-1,C-1);
  ctx.strokeStyle=border;ctx.lineWidth=bw;
  ctx.strokeRect(x+.5,y+.5,C-1,C-1);

    // Star - 6-pointed Ludo King style
  if(SF.has(`${col},${row}`)){
    const cx3=x+C/2, cy3=y+C/2;
    const outerR=C*.26, innerR=C*.12;
    const pts=6;
    ctx.save();
    ctx.fillStyle='rgba(210,160,0,.85)';
    ctx.shadowColor='rgba(255,200,0,.4)';ctx.shadowBlur=4;
    ctx.beginPath();
    for(let i=0;i<pts*2;i++){
      const angle=i*Math.PI/pts - Math.PI/2;
      const r=i%2===0?outerR:innerR;
      const px=cx3+r*Math.cos(angle);
      const py=cy3+r*Math.sin(angle);
      if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
    }
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
    // Actually draw a proper 12-point star
    ctx.restore();
    // Use emoji star for crisp look
    ctx.save();
    ctx.fillStyle='rgba(200,155,0,.75)';
    ctx.font=`bold ${Math.floor(C*.5)}px serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.shadowColor='rgba(255,220,0,.3)';ctx.shadowBlur=3;
    ctx.fillText('★',cx3,cy3+1);
    ctx.restore();
  }

    // Entry arrows - white triangle on colored entry square
  if(ENTRY.has(`${col},${row}`)){
    const dirs={'1,6':'right','8,1':'down','13,8':'left','6,13':'up'};
    const dir=dirs[`${col},${row}`];
    const cx2=x+C/2, cy2=y+C/2, s=C*.26;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.9)';
    ctx.shadowColor='rgba(0,0,0,.3)';ctx.shadowBlur=2;
    ctx.beginPath();
    if(dir==='right'){ctx.moveTo(cx2-s*.8,cy2-s);ctx.lineTo(cx2+s,cy2);ctx.lineTo(cx2-s*.8,cy2+s);}
    else if(dir==='down'){ctx.moveTo(cx2-s,cy2-s*.8);ctx.lineTo(cx2+s,cy2-s*.8);ctx.lineTo(cx2,cy2+s);}
    else if(dir==='left'){ctx.moveTo(cx2+s*.8,cy2-s);ctx.lineTo(cx2-s,cy2);ctx.lineTo(cx2+s*.8,cy2+s);}
    else{ctx.moveTo(cx2-s,cy2+s*.8);ctx.lineTo(cx2+s,cy2+s*.8);ctx.lineTo(cx2,cy2-s);}
    ctx.closePath();ctx.fill();
    ctx.restore();
  }


function drawHomeZone(p,startCol,startRow){
  const x=startCol*C,y=startRow*C,w=6*C,h=6*C;

  // Gradient background
  const g=ctx.createLinearGradient(x,y,x+w,y+h);
  g.addColorStop(0,HOME_DARK[p]);
  g.addColorStop(.5,HOME_MID[p]);
  g.addColorStop(1,HOME_DARK[p]);
  ctx.fillStyle=g;
  roundRect(ctx,x,y,w,h,p===0?'12 0 0 0':p===1?'0 12 0 0':p===2?'0 0 0 12':'0 0 12 0');
  ctx.fill();

  // Inner lighter area for the 4 circles
  const m=C*.5;
  ctx.fillStyle='rgba(255,255,255,.12)';
  roundRect(ctx,x+m,y+m,w-m*2,h-m*2,10);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.2)';ctx.lineWidth=1;
  ctx.stroke();

  // 4 base circles — properly centered in 2x2 grid
  // Grid centers within the 6x6 zone
  const cx0=startCol*C+C*1.75, cy0=startRow*C+C*1.75;
  const cx1=startCol*C+C*4.25, cy1=startRow*C+C*1.75;
  const cx2=startCol*C+C*1.75, cy2=startRow*C+C*4.25;
  const cx3=startCol*C+C*4.25, cy3=startRow*C+C*4.25;
  const centers=[[cx0,cy0],[cx1,cy1],[cx2,cy2],[cx3,cy3]];
  const r=C*.52;

  centers.forEach(([bx,by])=>{
    // Shadow
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=6;ctx.shadowOffsetY=3;
    // Outer ring
    ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.2)';ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=2;ctx.stroke();
    ctx.restore();
  });
}

function drawCenter(){
  const cx=7.5*C,cy=7.5*C,s=1.8*C;

  // White background
  ctx.fillStyle='#fff';
  ctx.fillRect(6*C,6*C,3*C,3*C);

  // 4 triangles pointing toward each home corner
  const tri=(x1,y1,x2,y2,x3,y3,color)=>{
    ctx.save();ctx.globalAlpha=.92;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();
  };
  // Blue top-left → triangle points UP-LEFT
  tri(cx,cy, cx-s,cy-s, cx,cy-s*.8, PC[0]);
  tri(cx,cy, cx-s,cy-s, cx-s*.8,cy, PC[0]);
  // Red top-right → triangle points UP-RIGHT  
  tri(cx,cy, cx+s,cy-s, cx,cy-s*.8, PC[1]);
  tri(cx,cy, cx+s,cy-s, cx+s*.8,cy, PC[1]);
  // Green bottom-right → triangle points DOWN-RIGHT
  tri(cx,cy, cx+s,cy+s, cx,cy+s*.8, PC[2]);
  tri(cx,cy, cx+s,cy+s, cx+s*.8,cy, PC[2]);
  // Yellow bottom-left → triangle points DOWN-LEFT
  tri(cx,cy, cx-s,cy+s, cx,cy+s*.8, PC[3]);
  tri(cx,cy, cx-s,cy+s, cx-s*.8,cy, PC[3]);

  // Dividers
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;
  [[cx,cy-s,cx,cy+s],[cx-s,cy,cx+s,cy]].forEach(([x1,y1,x2,y2])=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  });

  // Gold center jewel
  const gr=ctx.createRadialGradient(cx-C*.25,cy-C*.25,C*.05,cx,cy,C*.7);
  gr.addColorStop(0,'#fffde0');gr.addColorStop(.4,'#FFD700');gr.addColorStop(1,'#FF8C00');
  ctx.save();ctx.shadowColor='rgba(255,165,0,.6)';ctx.shadowBlur=16;
  ctx.beginPath();ctx.arc(cx,cy,C*.68,0,Math.PI*2);ctx.fillStyle=gr;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.stroke();ctx.restore();

  // C letter
  ctx.fillStyle='#1a0800';
  ctx.font=`bold ${Math.floor(C*.72)}px 'Cinzel Decorative',serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('C',cx,cy+2);
}

// ===== DRAW PAWN (Ludo King style teardrop) =====
function drawPiece(p,i){
  if(GAME.pieces[p][i]===58) return; // finished
  const{x,y}=getPXY(p,i);
  const r=C*.3;
  const isActive=(p===GAME.current&&!GAME.rolled&&!GAME.over);

  ctx.save();
  if(isActive){
    ctx.shadowColor=PC[p];ctx.shadowBlur=14;
  } else {
    ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;
  }
  drawPawnShape(x,y,r,PC[p],PCL[p],PCD[p]);
  ctx.restore();

  // Active pulse ring
  if(isActive){
    const t=Date.now()/600;
    const alpha=0.3+0.3*Math.sin(t);
    ctx.beginPath();ctx.arc(x,y-r*.6,r+3,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,215,0,${alpha})`;ctx.lineWidth=2;ctx.stroke();
  }
}

function drawPawnShape(x,y,r,color,light,dark){
  const hr=r,bw=r*1.3,bh=r*.65,sh=r*.4;

  const g=ctx.createRadialGradient(x-hr*.35,y-hr*.9,hr*.05,x,y-hr*.8,hr*1.1);
  g.addColorStop(0,light);g.addColorStop(.5,color);g.addColorStop(1,dark);

  ctx.beginPath();
  ctx.arc(x,y-hr*.8,hr,Math.PI,2*Math.PI);
  ctx.lineTo(x+hr*.55,y);
  ctx.bezierCurveTo(x+bw*.8,y+sh*.3,x+bw,y+sh,x+bw*.5,y+sh+bh*.5);
  ctx.bezierCurveTo(x+bw*.3,y+sh+bh,x-bw*.3,y+sh+bh,x-bw*.5,y+sh+bh*.5);
  ctx.bezierCurveTo(x-bw,y+sh,x-bw*.8,y+sh*.3,x-hr*.55,y);
  ctx.lineTo(x-hr,y-hr*.8);
  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.stroke();

  // Head shine
  ctx.beginPath();ctx.arc(x-hr*.3,y-hr*1.1,hr*.28,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.5)';ctx.fill();
}

// ===== GET PIXEL POSITION =====
function getPXY(p,i){
  const pos=GAME.pieces[p][i];
  let col,row;

  if(pos===-1){
    // In home base — use the 4 circle positions we calculated
    const homeCol=[0,9,0,9][p];
    const homeRow=[0,0,9,9][p];
    const cx0=homeCol+1.75,cy0=homeRow+1.75;
    const cx1=homeCol+4.25,cy1=homeRow+1.75;
    const cx2=homeCol+1.75,cy2=homeRow+4.25;
    const cx3=homeCol+4.25,cy3=homeRow+4.25;
    const bases=[[cx0,cy0],[cx1,cy1],[cx2,cy2],[cx3,cy3]];
    return{x:bases[i][0]*C,y:bases[i][1]*C};
  } else if(pos>=52){
    const si=pos-52;
    if(si<6)[col,row]=HS[p][si];
    else{col=7;row=7;}
  } else {
    [col,row]=P52[(pos+EN[p])%52];
  }

  // Stack offset for multiple pieces on same cell
  let stackIdx=0;
  for(let p2=0;p2<GAME.players;p2++)for(let i2=0;i2<4;i2++){
    if(p2===p&&i2===i) break;
    if(p2===p&&i2<i){
      const op=GAME.pieces[p2][i2];
      if(op>=0&&op<52){
        const[oc,or2]=P52[(op+EN[p2])%52];
        if(oc===col&&or2===row) stackIdx++;
      }
    }
  }
  const offsets=[[0,0],[.25,-.15],[-.25,-.15],[0,.25]];
  const o=offsets[Math.min(stackIdx,3)];
  return{x:(col+.5+o[0]*.38)*C,y:(row+.5+o[1]*.38)*C};
}

// ===== HELPER: roundRect =====
function roundRect(ctx,x,y,w,h,r){
  const rv=typeof r==='string'?r.split(' ').map(v=>parseFloat(v)||0):[r,r,r,r];
  const[tl,tr,br,bl]=rv.length===4?rv:[rv[0],rv[0],rv[0],rv[0]];
  ctx.beginPath();
  ctx.moveTo(x+tl,y);ctx.lineTo(x+w-tr,y);ctx.arcTo(x+w,y,x+w,y+tr,tr);
  ctx.lineTo(x+w,y+h-br);ctx.arcTo(x+w,y+h,x+w-br,y+h,br);
  ctx.lineTo(x+bl,y+h);ctx.arcTo(x,y+h,x,y+h-bl,bl);
  ctx.lineTo(x,y+tl);ctx.arcTo(x,y,x+tl,y,tl);
  ctx.closePath();
}

// ===== GAME LOGIC =====
function getMovable(player,dice){
  const m=[];
  for(let i=0;i<4;i++){
    const pos=GAME.pieces[player][i];
    if(pos===58) continue;
    if(pos===-1){if(dice===6) m.push({player,piece:i,newPos:0});}
    else{const np=pos+dice;if(np<=58) m.push({player,piece:i,newPos:np});}
  }
  return m;
}

function onBoardClick(e){
  if(!GAME.waitMove) return;
  const rect=e._rect||canvas.getBoundingClientRect();
  const scaleX=canvas.width/rect.width;
  const scaleY=canvas.height/rect.height;
  const mx=(e.clientX-rect.left)*scaleX;
  const my=(e.clientY-rect.top)*scaleY;

  for(const m of GAME.movable){
    const{x,y}=getPXY(m.player,m.piece);
    if(Math.hypot(mx-x,my-y)<C*.8){
      applyMove(m.player,m.piece,m.newPos);
      return;
    }
  }
}

function applyMove(player,piece,newPos){
  GAME.pieces[player][piece]=newPos;
  GAME.waitMove=false;GAME.movable=[];
  if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}

  // Capture check
  if(newPos>=0&&newPos<52){
    const[myC,myR]=P52[(newPos+EN[player])%52];
    if(!SF.has(`${myC},${myR}`)){
      for(let p2=0;p2<GAME.players;p2++){
        if(p2===player) continue;
        for(let i2=0;i2<4;i2++){
          const op=GAME.pieces[p2][i2];
          if(op>=0&&op<52){
            const[oc,or2]=P52[(op+EN[p2])%52];
            if(oc===myC&&or2===myR){
              GAME.pieces[p2][i2]=-1;GAME.scores[player]+=20;
              log(`💥 Capture! +20 pts`,PC[player]);
            }
          }
        }
      }
    }
  }

  // Finish check
  if(newPos>=58){
    GAME.pieces[player][piece]=58;GAME.finished[player]++;GAME.scores[player]+=50;
    log(`⭐ Pièce ${piece+1} arrivée! +50 pts`,PC[player]);
    if(GAME.finished[player]>=4){playerFinished(player);return;}
  }

  updateSUI();drawBoard();

  if(GAME.dice===6){
    log(`🎲 ${player===STATE.myColor?'Vous rejouez':AI[player>STATE.myColor?player-1:player]+' rejoue'} (6)!`,'#FFD700');
    if(player!==STATE.myColor) setTimeout(()=>aiTurn(player),900);
    else{GAME.rolled=false;enableRoll();}
  } else {
    setTimeout(nextTurn,700);
  }
}

function rollDice(){
  if(GAME.rolled||GAME.over||GAME.current!==STATE.myColor) return;
  GAME.rolled=true;disableRoll();

  const diceEl=document.getElementById('dice-el');
  if(diceEl){
    diceEl.classList.add('rolling');
    diceEl.style.transform='scale(1.3)';
  }

  let count=0;
  const iv=setInterval(()=>{
    const rand=Math.floor(Math.random()*6);
    if(diceEl) diceEl.textContent=DF[rand];
    if(++count>=16){
      clearInterval(iv);
      if(diceEl){diceEl.classList.remove('rolling');diceEl.style.transform='scale(1)';}
      const result=Math.floor(Math.random()*6)+1;
      GAME.dice=result;
      if(diceEl){
        diceEl.textContent=DF[result-1];
        diceEl.style.transform='scale(1.4)';
        setTimeout(()=>diceEl.style.transform='scale(1)',300);
      }
      const movable=getMovable(STATE.myColor,result);
      if(!movable.length){
        log(`Vous lancez ${result} — aucun mouvement 😕`,'rgba(255,255,255,.4)');
        setTimeout(nextTurn,1300);
      } else if(movable.length===1){
        log(`Vous lancez ${result} 🎯`,PC[STATE.myColor]);
        setTimeout(()=>applyMove(movable[0].player,movable[0].piece,movable[0].newPos),500);
      } else {
        GAME.movable=movable;GAME.waitMove=true;
        log(`Vous lancez ${result} — touchez un pion ✨`,'#FFD700');
        drawBoard();
      }
    }
  },55);
}

function nextTurn(){
  if(GAME.over) return;
  let next=(GAME.current+1)%GAME.players;
  let safety=0;
  while(GAME.eliminated.includes(next)&&safety<GAME.players){
    next=(next+1)%GAME.players;safety++;
  }
  GAME.current=next;GAME.rolled=false;updateAP();
  if(GAME.current===STATE.myColor){
    log('🎲 Votre tour!',PC[STATE.myColor]);enableRoll();
  } else {
    const aiIdx=GAME.current>STATE.myColor?GAME.current-1:GAME.current;
    log(`Tour de ${AI[aiIdx]||'IA'}...`,PC[GAME.current]);
    disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);
  }
}

function aiTurn(player){
  if(GAME.over||GAME.current!==player||GAME.eliminated.includes(player)) return;
  const result=Math.floor(Math.random()*6)+1;
  GAME.dice=result;
  const diceEl=document.getElementById('dice-el');
  if(diceEl) diceEl.textContent=DF[result-1];
  const aiIdx=player>STATE.myColor?player-1:player;
  log(`${AI[aiIdx]||'IA'} lance ${result}`,PC[player]);
  setTimeout(()=>{
    const movable=getMovable(player,result);
    if(movable.length){
      let best=movable[0];
      // Prefer captures > furthest advancement
      for(const m of movable){
        if(m.newPos>best.newPos) best=m;
      }
      applyMove(best.player,best.piece,best.newPos);
    } else {
      if(result===6) setTimeout(()=>aiTurn(player),800);
      else setTimeout(nextTurn,600);
    }
  },700);
}

// ===== RANKING SYSTEM =====
function playerFinished(player){
  if(GAME.eliminated.includes(player)) return;
  GAME.ranking.push(player);GAME.eliminated.push(player);GAME.activePlayers--;
  const pos=GAME.ranking.length;
  const posLabels=['🥇 1er','🥈 2e','🥉 3e','💀 Dernier'];
  const name=player===STATE.myColor?'Vous':(AI[player>STATE.myColor?player-1:player]||'IA');
  log(`${posLabels[pos-1]||`${pos}e`} — ${name} a terminé!`,PC[player]);
  updateSUI();
  const remaining=[];
  for(let i=0;i<GAME.players;i++) if(!GAME.eliminated.includes(i)) remaining.push(i);
  if(remaining.length<=1){
    if(remaining.length===1) GAME.ranking.push(remaining[0]);
    GAME.over=true;
    setTimeout(()=>showFinalRanking(),800);
    return;
  }
  setTimeout(()=>{
    let next=(GAME.current+1)%GAME.players;
    while(GAME.eliminated.includes(next)) next=(next+1)%GAME.players;
    GAME.current=next;GAME.rolled=false;updateAP();
    if(GAME.current===STATE.myColor){log('🎲 Votre tour!',PC[STATE.myColor]);enableRoll();}
    else{
      const aiIdx=GAME.current>STATE.myColor?GAME.current-1:GAME.current;
      log(`Tour de ${AI[aiIdx]||'IA'}...`,PC[GAME.current]);
      disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);
    }
  },1200);
}

function showFinalRanking(){
  const myPos=GAME.ranking.indexOf(STATE.myColor);
  const posLabels=['🥇','🥈','🥉','💀'];
  const posNames=['1er','2ème','3ème','Dernier'];
  let coinsChange=0;
  if(STATE.currentMode==='comp'){
    const pool=STATE.currentMise*STATE.numPlayers;
    if(myPos===0) coinsChange=Math.floor(pool*.55);
    else if(myPos===1) coinsChange=Math.floor(pool*.25);
    else if(myPos===2) coinsChange=0;
    else coinsChange=-STATE.currentMise;
    STATE.coins+=coinsChange;
    if(coinsChange>0) addTx('gain',`${posNames[myPos]} place`,coinsChange);
    else if(coinsChange<0) addTx('loss',`${posNames[myPos]} place`,coinsChange);
    updateCUI();
  }
  const isFirst=myPos===0;
  const coinsStr=coinsChange>0?`+${coinsChange.toLocaleString('fr-FR')} 🪙`:coinsChange<0?`${coinsChange.toLocaleString('fr-FR')} 🪙`:'';
  document.getElementById('m-icon').textContent=isFirst?'🏆':'🎯';
  document.getElementById('m-title').textContent=isFirst?'VICTOIRE!':'PARTIE TERMINÉE';
  document.getElementById('m-msg').innerHTML=GAME.ranking.map((p,i)=>{
    const n=p===STATE.myColor?'<b style="color:#FFD700">Vous</b>':(AI[p>STATE.myColor?p-1:p]||'IA');
    return `${posLabels[i]} <span style="color:${PC[p]}">${n}</span> — ${GAME.scores[p]} pts`;
  }).join('<br>');
  const mc=document.getElementById('m-coins');
  mc.textContent=coinsStr;mc.style.display=coinsStr?'block':'none';
  document.getElementById('m-btn1').textContent='REJOUER';
  document.getElementById('m-btn1').onclick=()=>{closeModal();findGame();};
  document.getElementById('m-btn2').textContent='ACCUEIL';
  document.getElementById('m-btn2').onclick=()=>{closeModal();showScreen('home');};
  document.getElementById('modal').classList.add('open');
}

function endGame(winner){playerFinished(winner);}

// ===== UI HELPERS =====
let logT;
function log(msg,color='rgba(255,255,255,.5)'){
  const el=document.getElementById('game-log');if(!el)return;
  el.textContent=msg;el.style.color=color;
  el.style.transform='scale(1.08)';
  clearTimeout(logT);logT=setTimeout(()=>el.style.transform='scale(1)',300);
}
function enableRoll(){const b=document.getElementById('roll-btn');if(b)b.disabled=false;}
function disableRoll(){const b=document.getElementById('roll-btn');if(b)b.disabled=true;}
function updateAP(){
  for(let i=0;i<4;i++){
    const av=document.getElementById(`pa-${i}`);if(!av)continue;
    const isActive=i===GAME.current;
    const isElim=GAME.eliminated&&GAME.eliminated.includes(i);
    av.style.boxShadow=isActive?`0 0 0 3px ${PCL[i]},0 0 20px ${PCG[i]}`:'none';
    av.style.transform=isActive?'scale(1.25)':'scale(1)';
    av.style.opacity=isElim?'0.35':'1';
    av.classList.toggle('myturn',isActive);
  }
}
function updateSUI(){
  for(let i=0;i<4;i++){
    const el=document.getElementById(`ps-${i}`);
    if(el) el.textContent=`${GAME.scores[i]} pts`;
  }
}
function updateCUI(){
  const fmt=n=>Math.max(0,Math.round(n)).toLocaleString('fr-FR');
  STATE.coins=Math.max(0,STATE.coins);
  ['bal-display-num','wallet-amount-num'].forEach(id=>{
    const el=document.getElementById(id);if(el)el.textContent=fmt(STATE.coins);
  });
  const e1=document.getElementById('my-lb-coins');if(e1)e1.textContent=fmt(STATE.coins)+' 🪙';
  const e2=document.getElementById('profile-coins');if(e2)e2.textContent=fmt(STATE.coins);
}
// Alias
function updateCoinsUI(){updateCUI();}

function addTx(type,desc,amount){
  const now=new Date();
  const months=['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
  const date=`${now.getDate()} ${months[now.getMonth()]} · ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  STATE.transactions.unshift({type,desc,date,amount});
  if(typeof saveTransaction==='function') saveTransaction(type,desc,amount);
  if(typeof syncCoinsToDb==='function') syncCoinsToDb(STATE.coins);
}
function renderTx(){
  const list=document.getElementById('tx-list');if(!list)return;
  list.innerHTML=STATE.transactions.slice(0,8).map(t=>`
    <div class="tx-row">
      <div class="tx-icon ${t.amount>0?'tx-g':'tx-l'}">${t.amount>0?'↑':'↓'}</div>
      <div class="tx-info"><div class="tx-desc">${t.desc}</div><div class="tx-date">${t.date}</div></div>
      <div class="tx-amt ${t.amount>0?'tx-pos':'tx-neg'}">${t.amount>0?'+':''}${t.amount.toLocaleString('fr-FR')} 🪙</div>
    </div>`).join('');
}

// ===== NAVIGATION =====
function showScreen(name){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  const el=document.getElementById('scr-'+name);if(el)el.classList.add('active');
  if(name==='wallet') renderTx();
  if(name==='game') updateAP();
}
function navTo(name,btn){
  showScreen(name);
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  if(btn) btn.classList.add('active');
}

// ===== MODE SELECTION =====
function startMode(mode){
  STATE.currentMode=mode;showScreen('mode');
  const ms=document.getElementById('mise-section');
  const gp=document.getElementById('gain-preview');
  if(mode==='free'){if(ms)ms.style.display='none';if(gp)gp.style.display='none';}
  else{if(ms)ms.style.display='block';if(gp)gp.style.display='block';updateGP();}
}
function setModeTab(t){
  document.getElementById('tab-rapide').classList.toggle('active',t==='rapide');
  document.getElementById('tab-amis').classList.toggle('active',t==='amis');
}
function setPlayers(n){
  STATE.numPlayers=n;
  [2,3,4].forEach(x=>document.getElementById(`pb${x}`).classList.toggle('active',x===n));
  updateGP();
}
function setMise(m){
  STATE.currentMise=m;
  [100,500,1000,5000].forEach(x=>document.getElementById(`mb${x}`).classList.toggle('active',x===m));
  updateGP();
}
function updateGP(){
  const el=document.getElementById('gp-val');
  if(el) el.textContent=Math.floor(STATE.currentMise*STATE.numPlayers*.95).toLocaleString('fr-FR')+' 🪙';
}

// ===== COLOR PICKER =====
function openColorPicker(){
  for(let i=0;i<4;i++){
    const card=document.getElementById(`cc-${i}`);
    if(card) card.classList.remove('selected','taken');
  }
  selectColor(STATE.myColor);
  showScreen('color');
}
function selectColor(idx){
  for(let i=0;i<4;i++){
    const card=document.getElementById(`cc-${i}`);
    if(card) card.classList.remove('selected');
  }
  const chosen=document.getElementById(`cc-${idx}`);
  if(chosen) chosen.classList.add('selected');
  STATE.myColor=idx;
  const pawn=document.getElementById('cp-pawn');if(pawn) pawn.textContent=COLOR_PAWNS[idx];
  const name=document.getElementById('cp-name');if(name){name.textContent=COLOR_NAMES[idx];name.style.color=PC[idx];}
}
function confirmColor(){startGameWithColor();}

// ===== GAME START =====
function findGame(){
  if(STATE.currentMode==='comp'&&STATE.coins<STATE.currentMise){showToast('⚠️ Solde insuffisant!');return;}
  openColorPicker();
}
function startLocalGame(){startGameWithColor();}
function cancelMatchmaking(){
  if(STATE.mmTimeout) clearTimeout(STATE.mmTimeout);
  if(STATE.socket) STATE.socket.emit('cancel_search');
  showScreen('mode');
}

function startGameWithColor(){
  showScreen('game');
  const gnp=document.getElementById('g-np');if(gnp) gnp.textContent=STATE.numPlayers;
  const gm=document.getElementById('g-mise');
  if(gm) gm.textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  initGame(STATE.numPlayers);

  for(let i=0;i<4;i++){
    const piEl=document.getElementById(`pi-${i}`);
    const paEl=document.getElementById(`pa-${i}`);
    const pnEl=document.getElementById(`pn-${i}`);
    const psEl=document.getElementById(`ps-${i}`);
    if(!piEl) continue;
    piEl.style.display=i<STATE.numPlayers?'flex':'none';
    if(paEl){
      paEl.style.background=PC[i];
      paEl.textContent=i===STATE.myColor?'MOI':`P${i+1}`;
    }
    if(pnEl) pnEl.textContent=i===STATE.myColor?'Vous':(AI[i>STATE.myColor?i-1:i]||`IA ${i+1}`);
    if(psEl){psEl.textContent='0 pts';psEl.style.color=PCL[i];}
  }

  setupCanvas();
  GAME.current=STATE.myColor;
  GAME.rolled=false;
  updateAP();
  enableRoll();
  log('🎲 Votre tour — lancez le dé!',PC[STATE.myColor]);
}

function confirmQuit(){
  showModal('⚠️','QUITTER?',
    STATE.currentMode==='comp'?'Vous perdrez votre mise.':'Quitter la partie?',
    STATE.currentMode==='comp'?`-${STATE.currentMise.toLocaleString('fr-FR')} 🪙`:'',
    'CONTINUER',closeModal,
    'QUITTER',()=>{
      closeModal();
      if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}
      if(STATE.currentMode==='comp'&&!GAME.over){
        STATE.coins-=STATE.currentMise;addTx('loss','Abandon',-STATE.currentMise);updateCUI();
      }
      showScreen('home');
    }
  );
}

// ===== WALLET =====
function doDeposit(){
  STATE.coins+=5000;addTx('gain','Dépôt (Orange Money)',5000);updateCUI();renderTx();
  showToast('✅ +5 000 coins déposés!');
}
function doWithdraw(){
  if(STATE.coins<1000){showToast('⚠️ Solde insuffisant!');return;}
  STATE.coins-=1000;addTx('loss','Retrait vers Wave',-1000);updateCUI();renderTx();
  showToast('💸 1 000 coins retirés vers Wave');
}
function selectPM(pm){
  const n={orange:'Orange Money',moov:'Moov Money',mtn:'MTN Money',wave:'Wave'};
  showToast(`💳 ${n[pm]} sélectionné`);
}
function joinTournament(){
  showModal('🏅','REJOINDRE','Confirmer votre inscription?','-1 000 🪙',
    'CONFIRMER',()=>{STATE.coins-=1000;addTx('loss','Inscription tournoi',-1000);updateCUI();closeModal();showToast('🏅 Inscrit au tournoi!');},'ANNULER',closeModal
  );
}
function showHistorique(){showScreen('wallet');}
function logout(){
  showModal('🚪','DÉCONNEXION','Se déconnecter de Clash of Coins?','',
    'DÉCONNECTER',()=>{closeModal();if(typeof doLogout==='function')doLogout();else window.location.href='/auth.html';},'ANNULER',closeModal
  );
}

// ===== MODAL & TOAST =====
function showModal(icon,title,msg,coins,b1t,b1f,b2t,b2f){
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').textContent=msg;
  const mc=document.getElementById('m-coins');mc.textContent=coins;mc.style.display=coins?'block':'none';
  const b1=document.getElementById('m-btn1'),b2=document.getElementById('m-btn2');
  if(b1){b1.textContent=b1t;b1.onclick=b1f;}
  if(b2){b2.textContent=b2t;b2.onclick=b2f;}
  document.getElementById('modal').classList.add('open');
}
function closeModal(){document.getElementById('modal').classList.remove('open');}
let toastT;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3000);
}

// ===== SOCKET.IO =====
function initSocket(){
  try{
    STATE.socket=io({transports:['websocket','polling'],timeout:5000});
    STATE.socket.on('connect',()=>STATE.socket.emit('auth',{username:STATE.username,coins:STATE.coins}));
    STATE.socket.on('online_count',({count})=>{
      const el=document.getElementById('online-count');if(el)el.textContent=count.toLocaleString('fr-FR');
    });
    STATE.socket.on('match_found',({players,myIndex})=>{
      clearTimeout(STATE.mmTimeout);
      players.forEach((p,idx)=>{
        const nm=document.getElementById(`pn-${idx}`);
        if(nm) nm.textContent=idx===myIndex?'Vous':p.username;
      });
      showToast('🎮 Partie trouvée!');startLocalGame();
    });
    STATE.socket.on('disconnect',()=>showToast('⚠️ Connexion perdue'));
  }catch(e){STATE.socket=null;}
  // Simulate online count
  const el=document.getElementById('online-count');
  if(el){let b=247;setInterval(()=>{b+=Math.floor(Math.random()*20-8);el.textContent=Math.max(50,b).toLocaleString('fr-FR');},6000);}
}

// ===== PARTICLES =====
function initParticles(){
  const c=document.getElementById('particles');if(!c)return;
  c.width=window.innerWidth;c.height=window.innerHeight;
  const ctx2=c.getContext('2d');
  const pts=Array.from({length:20},()=>({
    x:Math.random()*c.width,y:Math.random()*c.height,
    r:Math.random()*1.5+.5,vx:(Math.random()-.5)*.3,vy:-(Math.random()*.4+.1),
    op:Math.random()*.2+.03
  }));
  (function loop(){
    ctx2.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.y<-8){p.y=c.height+8;p.x=Math.random()*c.width;}
      ctx2.save();ctx2.globalAlpha=p.op;
      ctx2.beginPath();ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx2.fillStyle='#FFD700';ctx2.fill();
      ctx2.restore();
    });
    requestAnimationFrame(loop);
  })();
  window.addEventListener('resize',()=>{c.width=window.innerWidth;c.height=window.innerHeight;});
}

// ===== INIT =====
updateCUI();
initParticles();