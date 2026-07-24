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
  // Multiplayer
  isMultiplayer:false,
  roomId:null,
  myIndex:0,
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
  [[1,1],[4,1],[1,4],[4,4]],           // Blue: 4 corners top-left
  [[10,1],[13,1],[10,4],[13,4]],       // Red: 4 corners top-right
  [[10,10],[13,10],[10,13],[13,13]],   // Green: 4 corners bottom-right
  [[1,10],[4,10],[1,13],[4,13]],       // Yellow: 4 corners bottom-left
];

// Entry indices in P52
const EN=[0,13,26,39];

// Safe squares (star squares)
// Safe squares (star squares - protected from capture)
const SF=new Set(['2,8','6,2','12,6','8,12','1,6','8,1','13,8','6,13']);
const ENTRY=new Set(['1,6','8,1','13,8','6,13']);
const ENTRY_COLORS={'1,6':0,'8,1':1,'13,8':2,'6,13':3};

let canvas,ctx,C;
let animFrame=null;

// ===== CANVAS SETUP =====
function setupCanvas(){
  canvas=document.getElementById('board-canvas');
  
  // Mobile-aware sizing
  const isMobile = window.innerWidth <= 480;
  const headerH = isMobile ? 120 : 140;  // prow top
  const footerH = isMobile ? 100 : 120;  // prow bottom + log
  const padding = isMobile ? 8 : 16;
  
  const maxW = window.innerWidth - padding;
  const maxH = window.innerHeight - headerH - footerH;
  const size = Math.min(maxW, maxH, isMobile ? 380 : 460);
  
  canvas.width = canvas.height = size;
  C = size / 15;
  ctx = canvas.getContext('2d');
  canvas.style.cursor = 'pointer';
  canvas.style.maxWidth = '100%';
  canvas.style.touchAction = 'none';
  
  // Remove old listeners first
  canvas.removeEventListener('click', onBoardClick);
  canvas.addEventListener('click', onBoardClick);
  
  canvas.addEventListener('touchend', e=>{
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    onBoardClick({clientX:t.clientX, clientY:t.clientY, _rect:rect});
  }, {passive:false});
  
  // Redraw on resize
  if(!window._canvasResizeSet){
    window._canvasResizeSet = true;
    window.addEventListener('resize', ()=>{
      if(ctx) setupCanvas();
    });
  }
  
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
  const x=col*C, y=row*C;

  // Skip home corners and center
  if((col<6&&row<6)||(col>8&&row<6)||(col<6&&row>8)||(col>8&&row>8)) return;
  if(col>=6&&col<=8&&row>=6&&row<=8) return;

  // Default cell color
  let fill='#f0e8d0', border='rgba(180,150,100,.15)', bw=.5;

  // Home stretch corridors
  if(row===7&&col>=1&&col<=6)       {fill='#c4d4ff';border='rgba(26,111,255,.3)';bw=.8;}
  else if(col===7&&row>=1&&row<=6)  {fill='#ffc4c4';border='rgba(238,17,17,.3)';bw=.8;}
  else if(row===7&&col>=8&&col<=13) {fill='#c4ffcc';border='rgba(0,204,68,.3)';bw=.8;}
  else if(col===7&&row>=8&&row<=13) {fill='#fff0a0';border='rgba(221,170,0,.3)';bw=.8;}

  // Entry squares — same strong color as home zone
  if(ENTRY.has(`${col},${row}`)){
    const p=ENTRY_COLORS[`${col},${row}`];
    fill=[HOME_MID[0],HOME_MID[1],HOME_MID[2],HOME_MID[3]][p];
    border=['rgba(26,111,255,.6)','rgba(238,17,17,.6)','rgba(0,204,68,.6)','rgba(221,170,0,.6)'][p];
    bw=1.5;
  }

  // Safe squares — cream
  if(SF.has(`${col},${row}`)){
    fill='#fffef5'; border='rgba(180,150,80,.25)'; bw=.8;
  }

  // Draw cell
  ctx.fillStyle=fill;
  ctx.fillRect(x, y, C, C);
  ctx.strokeStyle=border; ctx.lineWidth=bw;
  ctx.strokeRect(x+.5, y+.5, C-1, C-1);

  // 6-pointed star on safe squares
  if(SF.has(`${col},${row}`)){
    const cx=x+C/2, cy=y+C/2;
    const ro=C*.24, ri=C*.11;
    ctx.save();
    ctx.fillStyle='rgba(210,160,0,.85)';
    ctx.shadowColor='rgba(255,200,0,.4)'; ctx.shadowBlur=4;
    ctx.beginPath();
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6 - Math.PI/2;
      const r=i%2===0?ro:ri;
      i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // White triangle arrow on entry squares
  if(ENTRY.has(`${col},${row}`)){
    const dirs={'1,6':'r','8,1':'d','13,8':'l','6,13':'u'};
    const d=dirs[`${col},${row}`];
    const cx=x+C/2, cy=y+C/2, s=C*.28;
    ctx.save();
    ctx.fillStyle='rgba(255,255,255,.88)';
    ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=2;
    ctx.beginPath();
    if(d==='r'){ctx.moveTo(cx-s*.8,cy-s);ctx.lineTo(cx+s,cy);ctx.lineTo(cx-s*.8,cy+s);}
    else if(d==='d'){ctx.moveTo(cx-s,cy-s*.8);ctx.lineTo(cx+s,cy-s*.8);ctx.lineTo(cx,cy+s);}
    else if(d==='l'){ctx.moveTo(cx+s*.8,cy-s);ctx.lineTo(cx-s,cy);ctx.lineTo(cx+s*.8,cy+s);}
    else{ctx.moveTo(cx-s,cy+s*.8);ctx.lineTo(cx+s,cy+s*.8);ctx.lineTo(cx,cy-s);}
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
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
  const cx0=(startCol+1.5)*C, cy0=(startRow+1.5)*C;
  const cx1=(startCol+4.5)*C, cy1=(startRow+1.5)*C;
  const cx2=(startCol+1.5)*C, cy2=(startRow+4.5)*C;
  const cx3=(startCol+4.5)*C, cy3=(startRow+4.5)*C;
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
  const r=C*.27;
  const isActive=(p===GAME.current&&!GAME.rolled&&!GAME.over);

  // Center pawn visually in circle (head is above center, base below)
  const drawY = y + r*0.38;
  ctx.save();
  if(isActive){
    ctx.shadowColor=PC[p];ctx.shadowBlur=14;
  } else {
    ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;
  }
  drawPawnShape(x,drawY,r,PC[p],PCL[p],PCD[p]);
  ctx.restore();

  // Active pulse ring
  if(isActive){
    const t=Date.now()/600;
    const alpha=0.3+0.3*Math.sin(t);
    ctx.beginPath();ctx.arc(x,drawY-r*.4,r+3,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,215,0,${alpha})`;ctx.lineWidth=2;ctx.stroke();
  }
}

function drawPawnShape(x,y,r,color,light,dark){
  const hr=r, bw=r*1.25, bh=r*.6, sh=r*.35;

  // BODY - 3D gradient from top-left bright to bottom-right dark
  const g=ctx.createRadialGradient(x-hr*.4,y-hr*1.0,hr*.02,x+hr*.1,y-hr*.3,hr*1.6);
  g.addColorStop(0,'#fff');
  g.addColorStop(0.15,light);
  g.addColorStop(0.5,color);
  g.addColorStop(0.85,dark);
  g.addColorStop(1,'rgba(0,0,0,.6)');

  ctx.beginPath();
  ctx.arc(x,y-hr*.8,hr,Math.PI,2*Math.PI);
  ctx.lineTo(x+hr*.5,y);
  ctx.bezierCurveTo(x+bw*.8,y+sh*.3,x+bw,y+sh,x+bw*.45,y+sh+bh*.5);
  ctx.bezierCurveTo(x+bw*.25,y+sh+bh,x-bw*.25,y+sh+bh,x-bw*.45,y+sh+bh*.5);
  ctx.bezierCurveTo(x-bw,y+sh,x-bw*.8,y+sh*.3,x-hr*.5,y);
  ctx.lineTo(x-hr,y-hr*.8);
  ctx.fillStyle=g;ctx.fill();

  // Dark outline
  ctx.strokeStyle='rgba(0,0,0,.25)';ctx.lineWidth=1.2;ctx.stroke();

  // White rim highlight (top edge)
  ctx.beginPath();
  ctx.arc(x,y-hr*.8,hr,Math.PI,0);
  ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();

  // Main head shine - large
  const sg=ctx.createRadialGradient(x-hr*.35,y-hr*1.15,0,x-hr*.35,y-hr*1.15,hr*.55);
  sg.addColorStop(0,'rgba(255,255,255,.75)');
  sg.addColorStop(1,'rgba(255,255,255,0)');
  ctx.beginPath();ctx.arc(x-hr*.3,y-hr*1.1,hr*.45,0,Math.PI*2);
  ctx.fillStyle=sg;ctx.fill();

  // Small secondary shine
  ctx.beginPath();ctx.arc(x-hr*.15,y-hr*1.35,hr*.14,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.6)';ctx.fill();

  // Base shadow/highlight
  ctx.beginPath();
  ctx.ellipse(x,y+sh+bh*.8,bw*.4,bh*.15,0,0,Math.PI*2);
  ctx.fillStyle='rgba(0,0,0,.2)';ctx.fill();
}

// ===== GET PIXEL POSITION =====
function getPXY(p,i){
  const pos=GAME.pieces[p][i];
  let col,row;

  if(pos===-1){
    // In home base — use same positions as drawHomeZone circles
    const homeCol=[0,9,9,0][p];
    const homeRow=[0,0,9,9][p];
    const cx0=homeCol+1.5,cy0=homeRow+1.5;
    const cx1=homeCol+4.5,cy1=homeRow+1.5;
    const cx2=homeCol+1.5,cy2=homeRow+4.5;
    const cx3=homeCol+4.5,cy3=homeRow+4.5;
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
    if(pos===58) continue; // Already finished
    if(pos===-1){
      // In home base - need a 6 to exit
      if(dice===6) m.push({player,piece:i,newPos:0});
    } else {
      // On board - check won't overshoot finish
      const np=pos+dice;
      if(np<=58) m.push({player,piece:i,newPos:np});
    }
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
  hideDiceResult();
  if(typeof SFX!=='undefined') SFX.move();
vibrate([30]);
  if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}

  // Send move to server (multiplayer)
  if(GAME.isMultiplayer && STATE.socket && GAME.roomId && player===STATE.myColor){
    STATE.socket.emit('make_move', {roomId:GAME.roomId, piece, newPos});
  }

  // Capture check
  if(newPos>=0&&newPos<52){
    const[myC,myR]=P52[(newPos+EN[player])%52];
    if(SF.has(`${myC},${myR}`)) { if(typeof SFX!=='undefined') SFX.safe(); }
    if(!SF.has(`${myC},${myR}`)){
      for(let p2=0;p2<GAME.players;p2++){
        if(p2===player) continue;
        for(let i2=0;i2<4;i2++){
          const op=GAME.pieces[p2][i2];
          if(op>=0&&op<52){
            const[oc,or2]=P52[(op+EN[p2])%52];
            if(oc===myC&&or2===myR){
              GAME.pieces[p2][i2]=-1;GAME.scores[player]+=20;
              log(`💥 ${player===STATE.myColor?'Vous capturez':'Capture! '}+20 pts`,PC[player]);
              if(GAME.isMultiplayer) addSystemChatMsg(`💥 ${player===STATE.myColor?'Vous avez':''+document.getElementById('pn-'+player)?.textContent+' a'} capturé un pion!`);
              if(typeof SFX!=='undefined') SFX.capture();
vibrate([100,50,100]);
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
    if(typeof SFX!=='undefined') SFX.pieceDone();
    if(GAME.finished[player]>=4){
      if(typeof SFX!=='undefined') SFX.allDone();
      playerFinished(player);return;
    }
  }

  updateSUI();drawBoard();

  if(GAME.dice===6){
    // Replay on 6
    const pName = player===STATE.myColor ? 'Vous rejouez' : (document.getElementById('pn-'+player)?.textContent||'IA')+' rejoue';
    log('🎲 '+pName+' (6)!','#FFD700');
    if(GAME.isMultiplayer){
      // In multiplayer server will send turn_change
      if(player===STATE.myColor){ GAME.rolled=false; enableRoll(); }
      // else wait for server turn_change
    } else {
      if(player!==STATE.myColor) setTimeout(()=>aiTurn(player),900);
      else{ GAME.rolled=false; enableRoll(); }
    }
  } else {
    if(GAME.isMultiplayer){
      // In multiplayer: server sends turn_change - just wait
      // But if it was MY move, server handles next turn
    } else {
      setTimeout(()=>nextTurn(),700);
    }
  }
}


// ===== DICE RESULT PANEL =====
let _drpTimeout = null;
function showDiceResult(result, playerId){
  const panel = document.getElementById('dice-result-panel');
  const numEl = document.getElementById('drp-number');
  const msgEl = document.getElementById('drp-msg');
  const lblEl = document.getElementById('drp-label');
  if(!panel || !numEl || !msgEl) return;

  // Clear any existing timeout
  if(_drpTimeout) clearTimeout(_drpTimeout);

  // Set content
  numEl.textContent = result;

  const isMe = playerId === STATE.myColor;
  const playerName = isMe ? 'Vous' : (document.getElementById(`pn-${playerId}`)?.textContent || 'Adversaire');

  if(result === 6){
    numEl.style.color = '#FFD700';
    numEl.style.textShadow = '0 0 40px rgba(255,215,0,.9)';
    msgEl.textContent = isMe ? 'Bravo ! Encore un tour 🎉' : `${playerName} rejoue !`;
    lblEl.textContent = 'RÉSULTAT ⭐';
    panel.querySelector('div').style.borderColor = 'rgba(255,215,0,.6)';
  } else {
    numEl.style.color = '#fff';
    numEl.style.textShadow = '0 0 20px rgba(255,255,255,.4)';
    msgEl.textContent = isMe ? 'Déplacez un pion ♟️' : `${playerName} joue...`;
    lblEl.textContent = 'RÉSULTAT';
    panel.querySelector('div').style.borderColor = 'rgba(255,255,255,.2)';
  }

  // Animate in
  panel.style.display = 'block';
  panel.style.opacity = '0';
  panel.style.transform = 'translate(-50%,-50%) scale(0.7)';
  panel.style.transition = 'all 0.25s cubic-bezier(.34,1.56,.64,1)';
  requestAnimationFrame(() => {
    panel.style.opacity = '1';
    panel.style.transform = 'translate(-50%,-50%) scale(1)';
  });

  // Auto-hide after delay
  const delay = result === 6 ? 1800 : 1200;
  _drpTimeout = setTimeout(() => hideDiceResult(), delay);
}

function hideDiceResult(){
  const panel = document.getElementById('dice-result-panel');
  if(!panel) return;
  panel.style.opacity = '0';
  panel.style.transform = 'translate(-50%,-50%) scale(0.8)';
  setTimeout(() => { panel.style.display = 'none'; }, 250);
}

function rollDice(){
  if(GAME.rolled||GAME.over||GAME.current!==STATE.myColor) return;
  // In multiplayer, only roll on your turn
  if(GAME.isMultiplayer && GAME.current !== GAME.myIndex) return;
  GAME.rolled=true;disableRoll();

  const diceEl=document.getElementById('dice-el');
  if(diceEl) diceEl.classList.add('rolling');
  if(typeof SFX!=='undefined') SFX.dice();

  let count=0;
  const iv=setInterval(()=>{
    const rand=Math.floor(Math.random()*6);
    if(diceEl) diceEl.textContent=DF[rand];
    if(++count>=16){
      clearInterval(iv);
      if(diceEl){diceEl.classList.remove('rolling');diceEl.style.transform='scale(1)';}
      const result=Math.floor(Math.random()*6)+1;
      GAME.dice=result;
      if(typeof SFX!=='undefined') SFX.diceResult(result);
      if(diceEl){
        diceEl.textContent=DF[result-1];
        diceEl.style.transform='scale(1.4)';
        setTimeout(()=>diceEl.style.transform='scale(1)',300);
      }
      // Show result panel
      showDiceResult(result, STATE.myColor);
      // Send dice result to server (multiplayer)
      if(GAME.isMultiplayer && STATE.socket && GAME.roomId){
        STATE.socket.emit('dice_rolled', { roomId: GAME.roomId, result });
      }
      const movable=getMovable(STATE.myColor,result);
      if(!movable.length){
        // No valid moves
        log(`Vous lancez ${result} — aucun mouvement 😕`,'rgba(255,255,255,.4)');
        if(typeof SFX!=='undefined') SFX.invalid();
        // In multiplayer tell server, in solo go next turn
        if(GAME.isMultiplayer && STATE.socket && GAME.roomId){
          STATE.socket.emit('no_moves', {roomId: GAME.roomId});
        } else {
          setTimeout(nextTurn,1300);
        }
      } else if(movable.length===1 && result!==6){
        // Only one possible move and not a 6 - auto move
        log(`Vous lancez ${result} 🎯`,PC[STATE.myColor]);
        if(typeof SFX!=='undefined') SFX.valid();
        setTimeout(()=>applyMove(movable[0].player,movable[0].piece,movable[0].newPos),500);
      } else if(movable.length===1 && result===6){
        // Only one possible move with a 6
        log(`Vous lancez 6! 🎉`,PC[STATE.myColor]);
        if(typeof SFX!=='undefined') SFX.valid();
        GAME.movable=movable;GAME.waitMove=true;
        log(`Touchez votre pion pour le sortir! ✨`,'#FFD700');
        drawBoard();
      } else {
        // Multiple choices - let player choose
        GAME.movable=movable;GAME.waitMove=true;
        log(`Vous lancez ${result} — touchez un pion ✨`,'#FFD700');
        drawBoard();
      }
    }
  },55);
}

function nextTurn(){
  if(GAME.over) return;
  if(GAME.isMultiplayer) return;

  let next=(GAME.current+1)%GAME.players;
  let safety=0;
  while(GAME.eliminated.includes(next)&&safety<GAME.players){
    next=(next+1)%GAME.players; safety++;
  }

  // All eliminated? End game
  if(safety>=GAME.players){ GAME.over=true; showFinalRanking(); return; }

  GAME.current=next;
  GAME.rolled=false;
  GAME.waitMove=false;
  GAME.movable=[];
  updateAP();
  drawBoard();

  if(GAME.current===STATE.myColor){
    log('🎲 Votre tour!',PC[STATE.myColor]);
    enableRoll();
    if(typeof SFX!=='undefined') SFX.myTurn();
  } else {
    const aiName=document.getElementById('pn-'+GAME.current)?.textContent||AI[GAME.current]||'IA';
    log('Tour de '+aiName+'...',PC[GAME.current]);
    if(typeof SFX!=='undefined') SFX.turnChange();
    disableRoll();
    setTimeout(()=>aiTurn(GAME.current),1000);
  }
}
function aiTurn(player){
  if(GAME.over) return;
  if(GAME.current !== player) return;
  if(GAME.eliminated.includes(player)){ nextTurn(); return; }
  if(player === STATE.myColor) return;

  const result = Math.floor(Math.random()*6)+1;
  GAME.dice = result;
  GAME.rolled = true;
  const diceEl = document.getElementById('dice-el');
  if(diceEl) diceEl.textContent = DF[result-1];
  if(typeof SFX !== 'undefined') SFX.diceResult(result);
  const aiName = document.getElementById('pn-'+player)?.textContent || AI[player] || 'IA';
  log(aiName+' lance '+result, PC[player]);
  showDiceResult(result, player);
  setTimeout(()=>{
    const movable = getMovable(player, result);
    if(movable.length){
      let best = movable[0];
      for(const m of movable){ if(m.newPos > best.newPos) best = m; }
      applyMove(best.player, best.piece, best.newPos);
    } else {
      if(result === 6) setTimeout(()=>aiTurn(player), 800);
      else setTimeout(()=>nextTurn(), 600);
    }
  }, 700);
}


function playerFinished(player){
  if(GAME.eliminated.includes(player)) return;
  // In multiplayer, server handles ranking via player_ranked event
  if(GAME.isMultiplayer) return;
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
      if(typeof SFX!=='undefined') SFX.turnChange();
    disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);
    }
  },1200);
}

function showFinalRanking(){
  const myPos=GAME.ranking.indexOf(STATE.myColor);
  const posLabels=['🥇','🥈','🥉','💀'];
  const posNames=['1er','2ème','3ème','Dernier'];
  const isFirst=myPos===0;
  const isWin=myPos===0;

  // Calculate coins change
  let coinsChange=0;
  if(STATE.currentMode==='comp'){
    const pool=STATE.currentMise*STATE.numPlayers;
    if(myPos===0) coinsChange=Math.floor(pool*.55);
    else if(myPos===1) coinsChange=Math.floor(pool*.25);
    else if(myPos===2) coinsChange=0;
    else coinsChange=-STATE.currentMise;
  } else {
    // Free mode: small bonus for winning
    if(myPos===0) coinsChange=200;
    else if(myPos===1) coinsChange=100;
    else if(myPos===2) coinsChange=50;
  }

  // Update local coins
  STATE.coins = Math.max(0, STATE.coins + coinsChange);
  updateCUI();
loadSettings();
updateBlockedCount();

  // Save transaction
  if(coinsChange !== 0){
    const desc = STATE.currentMode==='comp'
      ? `${posNames[myPos]} place (compétition)`
      : `${posNames[myPos]} place (gratuit)`;
    addTx(coinsChange>0?'gain':'loss', desc, coinsChange);
  }

  // ===== SYNC TO SUPABASE =====
  saveGameStats(myPos, coinsChange);

  // Show modal
  const coinsStr=coinsChange>0?`+${coinsChange.toLocaleString('fr-FR')} 🪙`:coinsChange<0?`${coinsChange.toLocaleString('fr-FR')} 🪙`:'';
  const modal = document.getElementById('modal');
  const box = modal.querySelector('.modal-box');

  if(isFirst){
    // VICTORY
    box.style.background = 'linear-gradient(145deg,#1a0a00,#2a1500,#1a0800)';
    box.style.border = '2px solid rgba(255,215,0,.5)';
    document.getElementById('m-icon').innerHTML = `
      <div style="position:relative;display:inline-block">
        <div style="font-size:70px;filter:drop-shadow(0 0 30px rgba(255,165,0,.8))">🏆</div>
        <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);font-family:'Anton',sans-serif;font-size:11px;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#000;padding:2px 10px;border-radius:10px;white-space:nowrap;letter-spacing:1px">VOUS AVEZ GAGNÉ!</div>
      </div>`;
    document.getElementById('m-title').innerHTML = `<span style="background:linear-gradient(135deg,#FFD700,#FF8C00);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:32px">VICTOIRE !</span>`;
  } else if(myPos===GAME.players-1){
    // DEFEAT
    box.style.background = 'linear-gradient(145deg,#0a0015,#150025,#0a001a)';
    box.style.border = '2px solid rgba(180,100,255,.4)';
    document.getElementById('m-icon').innerHTML = `<div style="font-size:70px">😔</div>`;
    document.getElementById('m-title').innerHTML = `<span style="color:#bb77ff;font-size:28px">DÉFAITE !</span>`;
  } else {
    box.style.background = 'linear-gradient(145deg,#001a0a,#002a15,#001a0a)';
    box.style.border = '2px solid rgba(0,204,68,.3)';
    document.getElementById('m-icon').innerHTML = `<div style="font-size:70px">🎯</div>`;
    document.getElementById('m-title').innerHTML = `<span style="color:#44ff88;font-size:28px">BIEN JOUÉ !</span>`;
  }

  // Rankings
  document.getElementById('m-msg').innerHTML = GAME.ranking.map((p,i)=>{
    const n=p===STATE.myColor?`<b style="color:var(--gold)">Vous</b>`:(AI[p>STATE.myColor?p-1:p]||'IA');
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.06)">
      <span style="font-size:18px">${posLabels[i]}</span>
      <span style="color:${PC[p]};font-weight:700;flex:1">${n}</span>
      <span style="color:rgba(255,255,255,.5);font-size:12px">${GAME.scores[p]} pts</span>
    </div>`;
  }).join('');

  // Coins display - big and prominent
  const mc = document.getElementById('m-coins');
  if(coinsStr){
    mc.style.display='block';
    mc.innerHTML = `<div style="font-size:44px;font-weight:800;color:${coinsChange>0?'var(--gold)':'#ff6666'};text-shadow:0 0 30px ${coinsChange>0?'rgba(255,215,0,.6)':'rgba(255,0,0,.4)'}">
      ${coinsStr}
    </div>
    <div style="display:flex;justify-content:center;gap:4px;margin-top:4px">
      ${coinsChange>0?'🪙🪙🪙':'💸'}
    </div>`;
  } else {
    mc.style.display='none';
  }

  // Buttons
  const btn1 = document.getElementById('m-btn1');
  const btn2 = document.getElementById('m-btn2');
  btn1.textContent = isFirst ? '🔄 REJOUER' : '🔄 RÉESSAYER';
  btn1.onclick = ()=>{ closeModal(); findGame(); };
  btn2.textContent = '🏠 ACCUEIL';
  btn2.onclick = ()=>{ closeModal(); showScreen('home'); };

  if(typeof SFX!=='undefined'){
    setTimeout(()=>{ if(isFirst) SFX.win(); else if(myPos===GAME.players-1) SFX.lose(); }, 300);
    if(isFirst && coinsChange>0) setTimeout(()=>SFX.coinRain(),800);
  }
  modal.classList.add('open');
}

// Save game result to Supabase
async function saveGameStats(myPos, coinsChange){
  try {
    if(typeof CURRENT_USER === 'undefined' || !CURRENT_USER) return;
    if(typeof getSupabase !== 'function') return;

    const sb = await getSupabase();
    const isWin = myPos === 0;
    const newCoins = Math.max(0, STATE.coins);
    const newGamesPlayed = (CURRENT_PROFILE?.games_played || 0) + 1;
    const newWins = (CURRENT_PROFILE?.wins || 0) + (isWin ? 1 : 0);
    const newLosses = (CURRENT_PROFILE?.losses || 0) + (!isWin ? 1 : 0);
    const xpGain = isWin ? 100 : myPos===1 ? 60 : myPos===2 ? 30 : 10;
    const newXp = (CURRENT_PROFILE?.xp || 0) + xpGain;
    // Level up every 1000 XP
    const newLevel = Math.floor(newXp / 1000) + 1;

    // Update players table
    const { error } = await sb.from('players').update({
      coins: newCoins,
      games_played: newGamesPlayed,
      wins: newWins,
      losses: newLosses,
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    }).eq('id', CURRENT_USER.id);

    if(error){ console.error('Stats update error:', error); return; }

    // Update local profile
    if(CURRENT_PROFILE){
      CURRENT_PROFILE.coins = newCoins;
      CURRENT_PROFILE.games_played = newGamesPlayed;
      CURRENT_PROFILE.wins = newWins;
      CURRENT_PROFILE.losses = newLosses;
      CURRENT_PROFILE.xp = newXp;
      CURRENT_PROFILE.level = newLevel;
    }

    // Save to game_history table (matching real schema)
    await sb.from('game_history').insert({
      username: CURRENT_PROFILE?.username || '',
      player_index: STATE.myColor,
      score: GAME.scores[STATE.myColor] || 0,
      pieces_done: GAME.finished[STATE.myColor] || 0,
      captures: GAME.scores[STATE.myColor] ? Math.floor(GAME.scores[STATE.myColor]/20) : 0,
      won: myPos === 0,
      coins_change: coinsChange,
      mise: STATE.currentMise,
      mode: STATE.currentMode,
    }).catch(e => console.warn('game_history insert:', e.message));

    // Update UI with new stats
    if(typeof updateAllProfileDisplays === 'function') updateAllProfileDisplays();
    if(typeof renderRealLeaderboard === 'function') renderRealLeaderboard();

    console.log(`✅ Stats saved: pos=${myPos+1}, coins=${newCoins}, wins=${newWins}, xp=${newXp}, level=${newLevel}`);

    // Show level up notification if leveled up
    if(newLevel > (CURRENT_PROFILE?.level || 1)){
      setTimeout(()=> showToast(`🎉 Niveau ${newLevel} atteint!`), 2000);
    }

  } catch(e){
    console.error('saveGameStats error:', e);
  }
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
function enableRoll(){
  const b=document.getElementById('roll-btn');if(b)b.disabled=false;
  const d=document.getElementById('dice-el');
  if(d){ d.classList.remove('rolling'); d.style.transform=''; d.style.opacity='1'; }
}
function disableRoll(){
  const b=document.getElementById('roll-btn');if(b)b.disabled=true;
  const d=document.getElementById('dice-el');
  if(d) d.style.opacity='0.45';
}
function updateAP(){
  for(let i=0;i<4;i++){
    const card=document.getElementById(`pi-${i}`);
    const av=document.getElementById(`pa-${i}`);
    if(!av)continue;
    const isActive=i===GAME.current;
    const isElim=GAME.eliminated&&GAME.eliminated.includes(i);

    // Avatar glow
    av.style.boxShadow=isActive?`0 0 0 3px ${PCL[i]},0 0 16px ${PCG[i]}`:'none';
    av.style.transform=isActive?'scale(1.15)':'scale(1)';
    av.style.opacity=isElim?'0.3':'1';

    // Card highlight
    if(card){
      card.style.borderColor=isActive?PCL[i]:'rgba(255,255,255,.1)';
      card.style.boxShadow=isActive?`0 0 16px ${PCG[i]}`:'none';
      card.style.opacity=isElim?'0.35':'1';
    }

    // My turn hint on dice
    if(i===STATE.myColor){
      const hint=document.getElementById('dice-hint');
      if(hint) hint.textContent=isActive?'LANCER LE DÉ ⚡':'...';
      const diceEl=document.getElementById('dice-el');
      if(diceEl) diceEl.style.opacity=isActive?'1':'0.5';
    }
  }
}
function updateSUI(){
  for(let i=0;i<4;i++){
    const el=document.getElementById(`ps-${i}`);
    if(el){
      // Format: show score as coins
      const score = GAME.scores[i] || 0;
      el.textContent = score > 0 ? score.toLocaleString('fr-FR') : '0';
    }
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
  // Coin sounds
  if(typeof SFX !== 'undefined' && amount > 0){
    if(amount >= 5000) setTimeout(()=>SFX.bigWin(),200);
    else if(amount >= 1000) setTimeout(()=>SFX.coinRain(),100);
    else setTimeout(()=>SFX.coinCling(),50);
  }
  if(typeof SFX !== 'undefined' && amount < 0){
    SFX.betDeducted();
  }
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
  if(name==='wallet'){ try{ renderTx(); if(typeof renderRealTransactions==='function') renderRealTransactions(); }catch(e){console.warn('wallet err:',e);} }
  if(name==='game') updateAP();
  if(name==='profile'){ try{ if(typeof updateProfileScreen==='function') updateProfileScreen(); }catch(e){console.warn('profile err:',e);} }
  if(name==='settings'){ try{ loadSettings(); }catch(e){console.warn('settings err:',e);} }
  if(name==='tournaments'){ try{ loadTournaments(); }catch(e){console.warn('tourn err:',e);} }

  // Music management
  if(typeof SFX !== 'undefined'){
    if(name==='home'){
      SFX.stopGameMusic();
      setTimeout(()=>SFX.startHomeMusic(), 300);
      showNotifBanner();
    } else if(name==='game'){
      SFX.stopHomeMusic();
      setTimeout(()=>SFX.startGameMusic(), 500);
    } else {
      // Other screens - keep home music if coming from home-like screens
      if(name==='mode'||name==='color'||name==='tournaments'||name==='wallet'||name==='profile'){
        // Keep home music playing
      }
    }
  }
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
  [100,500,1000,5000].forEach(x=>{
    const el=document.getElementById(`mb${x}`);
    if(el) el.classList.toggle('active',x===m);
  });
  updateGP();
  if(typeof SFX!=='undefined') SFX.betPlaced();
}
function updateGP(){
  const el=document.getElementById('gp-val');
  if(el) el.textContent=Math.floor(STATE.currentMise*STATE.numPlayers*.95).toLocaleString('fr-FR')+' 🪙';
}

// ===== COLOR PICKER =====
function openColorPicker(){
  // Reset color cards
  for(let i=0;i<4;i++){
    const card=document.getElementById(`cc-${i}`);
    if(card) card.classList.remove('selected','taken');
  }
  selectColor(STATE.myColor);
  showScreen('color');
  // Make sure confirm button works
  const confirmBtn = document.getElementById('btn-confirm-color');
  if(confirmBtn) confirmBtn.onclick = confirmColor;
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
function confirmColor(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  startGameWithColor();
}

// ===== GAME START =====
function findGame(){
  if(STATE.currentMode==='comp'&&STATE.coins<STATE.currentMise){showToast('⚠️ Solde insuffisant!');return;}

  // Check if socket available for real multiplayer
  if(STATE.socket && STATE.socket.connected && STATE.numPlayers >= 2){
    // Real multiplayer - go to matchmaking screen first
    showScreen('matchmaking');
    GAME.isMultiplayer = false; // Will be set true when match found
    const mmMise = document.getElementById('mm-mise');
    if(mmMise) mmMise.textContent = STATE.currentMode==='free' ? 'Gratuit' : STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
    const mmNeeded = document.getElementById('mm-needed');
    if(mmNeeded) mmNeeded.textContent = STATE.numPlayers;

    // Tell server to find a game
    STATE.socket.emit('find_game', {
      mode: STATE.currentMode,
      mise: STATE.currentMise,
      numPlayers: STATE.numPlayers,
    });

    // Timeout after 30s → play vs AI
    STATE.mmTimeout = setTimeout(() => {
      showToast("Pas de joueurs trouves - partie contre l'IA");
      if(STATE.socket) STATE.socket.emit('cancel_search');
      openColorPicker();
    }, 30000);
  } else {
    // No socket or solo - go directly to color picker
    GAME.isMultiplayer = false;
    GAME.roomId = null;
    openColorPicker();
  }
}
function startLocalGame(){startGameWithColor();}
function cancelMatchmaking(){
  if(STATE.mmTimeout){ clearTimeout(STATE.mmTimeout); STATE.mmTimeout = null; }
  if(STATE.socket) STATE.socket.emit('cancel_search');
  GAME.isMultiplayer = false;
  GAME.roomId = null;
  GAME.rolled = false;
  GAME.waitMove = false;
  showScreen('mode');
  showToast('Recherche annulée');
}

function startGameWithColor(){
  // Full reset
  GAME.isMultiplayer = false;
  GAME.roomId = null;
  GAME.rolled = false;
  GAME.waitMove = false;
  GAME.movable = [];
  GAME.over = false;
  GAME.ranking = [];
  GAME.eliminated = [];
  GAME.activePlayers = STATE.numPlayers;
  if(animFrame){ cancelAnimationFrame(animFrame); animFrame = null; }
  
  // Remove old socket listeners to avoid duplicates
  if(STATE.socket){
    STATE.socket.off('match_found');
    STATE.socket.off('turn_change');
    STATE.socket.off('dice_result');
    STATE.socket.off('player_moved');
    STATE.socket.off('player_ranked');
    STATE.socket.off('game_over');
    STATE.socket.off('player_disconnected');
    STATE.socket.off('player_forfeited');
    STATE.socket.off('room_joined');
    STATE.socket.off('room_update');
    STATE.socket.off('tournament_update');
    STATE.socket.off('tournament_started');
    STATE.socket.off('tournament_over');
    STATE.socket.off('chat');
    STATE.socket.off('payment_success');
    // Re-register persistent listeners
    STATE.socket.on('online_count', ({count}) => {
      const el = document.getElementById('online-count');
      if(el) el.textContent = count.toLocaleString('fr-FR');
    });
  }
  
  // Force show game screen
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const gameScreen = document.getElementById('scr-game');
  if(gameScreen){
    gameScreen.classList.add('active');
    gameScreen.style.display = 'flex';
  }
  const gnp=document.getElementById('g-np');if(gnp) gnp.textContent=STATE.numPlayers;
  const gm=document.getElementById('g-mise');
  if(gm) gm.textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  if(STATE.currentMode==='comp' && typeof SFX!=='undefined') SFX.betPlaced();
  initGame(STATE.numPlayers);

  for(let i=0;i<4;i++){
    const piEl=document.getElementById(`pi-${i}`);
    const paEl=document.getElementById(`pa-${i}`);
    const pnEl=document.getElementById(`pn-${i}`);
    const psEl=document.getElementById(`ps-${i}`);
    if(!piEl) continue;
    piEl.style.display=i<STATE.numPlayers?'flex':'none';
    if(i>=STATE.numPlayers) continue;
    if(paEl){
      paEl.style.background=PC[i];
      paEl.style.borderColor=PCL[i];
      paEl.textContent=i===STATE.myColor?'👑':`P${i+1}`;
    }
    if(pnEl) pnEl.textContent=i===STATE.myColor?'Vous':(AI[i>STATE.myColor?i-1:i]||`IA ${i+1}`);
    if(psEl){ psEl.textContent='0'; psEl.style.color=PCL[i]; }
  }

  setupCanvas();
  GAME.current=STATE.myColor;
  GAME.rolled=false;
  updateAP();
  enableRoll();
  log('🎲 Votre tour — lancez le dé!',PC[STATE.myColor]);
  // Reset chat
  _chatOpen = false;
  _unreadCount = 0;
  const chatMsgs = document.getElementById('chat-messages');
  if(chatMsgs) chatMsgs.innerHTML = '<div style="text-align:center;font-size:11px;color:rgba(255,255,255,.2)">Début du chat...</div>';
  const chatPanel = document.getElementById('chat-panel');
  if(chatPanel) chatPanel.classList.remove('open');
  if(typeof SFX!=='undefined') setTimeout(()=>SFX.gameStart(),500);
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
      if(typeof SFX!=='undefined') SFX.menuBack();
      showScreen('home');
    }
  );
}

// ===== WALLET =====
// ===== PAIEMENTS SIMULÉS (CinetPay sera intégré plus tard) =====
const DEPOSIT_OPTIONS = [1000, 2000, 5000, 10000, 25000, 50000];
const WITHDRAW_OPTIONS = [1000, 2000, 5000, 10000];

function openDepositModal(){
  if(typeof SFX !== 'undefined') SFX.btnClick();

  const btns = DEPOSIT_OPTIONS.map(a =>
    `<button onclick="selectSimAmount('dep',${a},this)"
      style="flex:1;min-width:80px;padding:10px;
      background:${a===5000?'linear-gradient(135deg,#FFD700,#FF8C00)':'rgba(255,255,255,.08)'};
      color:${a===5000?'#000':'#fff'};border:1px solid rgba(255,255,255,.15);
      border-radius:12px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer"
      id="dep-btn-${a}">${a.toLocaleString('fr-FR')} 🪙</button>`
  ).join('');

  document.getElementById('m-icon').textContent = '💳';
  document.getElementById('m-title').textContent = 'DÉPOSER DES COINS';
  document.getElementById('m-msg').innerHTML = `
    <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:10px">Choisir le montant</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">${btns}</div>
    <div style="display:flex;gap:8px">
      ${[{ic:'🟠',n:'Orange'},{ic:'🟡',n:'MTN'},{ic:'🔵',n:'Wave'},{ic:'🟢',n:'Moov'}].map(op=>
        `<button style="flex:1;padding:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:11px;font-weight:700;cursor:pointer">${op.ic} ${op.n}</button>`
      ).join('')}
    </div>
    <div style="margin-top:12px;font-size:10px;color:rgba(255,165,0,.7);text-align:center">
      ⚠️ Mode démo — Intégration CinetPay bientôt disponible
    </div>`;

  document.getElementById('m-coins').style.display='none';
  document.getElementById('m-btn1').textContent = '✅ CONFIRMER';
  document.getElementById('m-btn1').onclick = () => confirmDeposit();
  document.getElementById('m-btn2').textContent = '✕ ANNULER';
  document.getElementById('m-btn2').onclick = closeModal;
  document.getElementById('modal').classList.add('open');
  window._simDepAmount = 5000;
}

function selectSimAmount(type, amount, btn){
  const prefix = type === 'dep' ? 'dep-btn-' : 'wd-btn-';
  const options = type === 'dep' ? DEPOSIT_OPTIONS : WITHDRAW_OPTIONS;
  options.forEach(a => {
    const b = document.getElementById(prefix+a);
    if(b){ b.style.background='rgba(255,255,255,.08)'; b.style.color='#fff'; }
  });
  btn.style.background = 'linear-gradient(135deg,#FFD700,#FF8C00)';
  btn.style.color = '#000';
  if(type==='dep') window._simDepAmount = amount;
  else window._simWdAmount = amount;
}

function confirmDeposit(){
  const amount = window._simDepAmount || 5000;
  STATE.coins += amount;
  updateCUI();
  addTx('gain', 'Dépôt (simulation)', amount);
  if(typeof SFX !== 'undefined') SFX.coinRain();
  closeModal();
  showToast(`✅ +${amount.toLocaleString('fr-FR')} coins ajoutés!`);
}

function openWithdrawModal(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  if(STATE.coins < 1000){ showToast('⚠️ Solde minimum: 1 000 coins'); return; }

  const btns = WITHDRAW_OPTIONS.filter(a=>a<=STATE.coins).map(a =>
    `<button onclick="selectSimAmount('wd',${a},this)"
      style="flex:1;padding:10px;
      background:${a===1000?'linear-gradient(135deg,#FFD700,#FF8C00)':'rgba(255,255,255,.08)'};
      color:${a===1000?'#000':'#fff'};border:1px solid rgba(255,255,255,.15);
      border-radius:12px;font-family:'Rajdhani',sans-serif;font-size:14px;font-weight:700;cursor:pointer"
      id="wd-btn-${a}">${a.toLocaleString('fr-FR')} 🪙</button>`
  ).join('');

  document.getElementById('m-icon').textContent = '💸';
  document.getElementById('m-title').textContent = 'RETRAIT';
  document.getElementById('m-msg').innerHTML = `
    <div style="font-size:11px;color:rgba(255,255,255,.4);margin-bottom:10px">Montant à retirer</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px">${btns}</div>
    <div style="font-size:10px;color:rgba(255,165,0,.7);text-align:center">
      ⚠️ Mode démo — Intégration CinetPay bientôt disponible
    </div>`;

  document.getElementById('m-coins').style.display='none';
  document.getElementById('m-btn1').textContent = '💸 RETIRER';
  document.getElementById('m-btn1').onclick = confirmWithdraw;
  document.getElementById('m-btn2').textContent = '✕ ANNULER';
  document.getElementById('m-btn2').onclick = closeModal;
  document.getElementById('modal').classList.add('open');
  window._simWdAmount = 1000;
}

function confirmWithdraw(){
  const amount = window._simWdAmount || 1000;
  if(STATE.coins < amount){ showToast('⚠️ Solde insuffisant'); return; }
  STATE.coins -= amount;
  updateCUI();
  addTx('loss', 'Retrait (simulation)', -amount);
  if(typeof SFX !== 'undefined') SFX.betDeducted();
  closeModal();
  showToast(`💸 ${amount.toLocaleString('fr-FR')} coins retirés (simulation)`);
}

// Legacy aliases
function doDeposit(){ openDepositModal(); }
function doWithdraw(){ openWithdrawModal(); }

// ===== MODAL & TOAST =====
function showModal(icon,title,msg,coins,b1t,b1f,b2t,b2f){
  if(typeof SFX!=='undefined') SFX.modalOpen();
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').textContent=msg;
  const mc=document.getElementById('m-coins');mc.textContent=coins;mc.style.display=coins?'block':'none';
  const b1=document.getElementById('m-btn1'),b2=document.getElementById('m-btn2');
  if(b1){b1.textContent=b1t;b1.onclick=b1f;}
  if(b2){b2.textContent=b2t;b2.onclick=b2f;}
  document.getElementById('modal').classList.add('open');
}
function closeModal(){document.getElementById('modal').classList.remove('open');if(typeof SFX!=='undefined') SFX.modalClose();}
let toastT;
function showToast(msg){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),3000);
}






// ===== CHAT EN PARTIE =====
let _chatOpen = false;
let _unreadCount = 0;

// Filtre anti-insultes basique
const BAD_WORDS = ['merde','putain','connard','idiot','nul','con','enfoiré','salope','bâtard'];
function filterMsg(msg){
  let filtered = msg;
  BAD_WORDS.forEach(w => {
    const re = new RegExp(w, 'gi');
    filtered = filtered.replace(re, '***');
  });
  return filtered;
}

function toggleChat(){
  _chatOpen = !_chatOpen;
  const panel = document.getElementById('chat-panel');
  const btn = document.getElementById('chat-toggle-btn');
  const dot = document.getElementById('chat-notif-dot');

  if(_chatOpen){
    panel.classList.add('open');
    btn.style.background = 'linear-gradient(135deg,#333,#111)';
    _unreadCount = 0;
    if(dot) dot.style.display = 'none';
    // Scroll to bottom
    setTimeout(() => {
      const msgs = document.getElementById('chat-messages');
      if(msgs) msgs.scrollTop = msgs.scrollHeight;
    }, 100);
    if(typeof SFX !== 'undefined') SFX.modalOpen();
  } else {
    panel.classList.remove('open');
    btn.style.background = 'linear-gradient(135deg,#1a5fff,#0033cc)';
    if(typeof SFX !== 'undefined') SFX.modalClose();
  }
}

function sendChatMsg(){
  const input = document.getElementById('chat-input');
  const raw = input?.value?.trim();
  if(!raw) return;

  const filtered = filterMsg(raw);
  input.value = '';

  // Send via socket
  if(STATE.socket && GAME.roomId){
    STATE.socket.emit('chat', { roomId: GAME.roomId, message: filtered });
  }

  // Display immediately (mine)
  addChatMsg(STATE.username, filtered, true);
  if(typeof SFX !== 'undefined') SFX.btnClick();
}

function sendQuickMsg(msg){
  if(STATE.socket && GAME.roomId){
    STATE.socket.emit('chat', { roomId: GAME.roomId, message: msg });
  }
  addChatMsg(STATE.username, msg, true);
  if(typeof SFX !== 'undefined') SFX.btnClick();
}

function addChatMsg(from, msg, isMe=false, isSystem=false){
  const container = document.getElementById('chat-messages');
  if(!container) return;

  // Remove "début du chat" placeholder
  const placeholder = container.querySelector('div[style*="text-align:center"]');
  if(placeholder) placeholder.remove();

  const div = document.createElement('div');
  div.className = `chat-msg ${isSystem ? '' : isMe ? 'chat-msg-me' : 'chat-msg-other'}`;

  if(isSystem){
    div.innerHTML = `<div class="chat-bubble chat-bubble-system">${msg}</div>`;
  } else {
    const playerColor = (() => {
      for(let i=0; i<4; i++){
        const pn = document.getElementById(`pn-${i}`);
        if(pn?.textContent === from || (isMe && i === STATE.myColor)) return PC[i];
      }
      return '#fff';
    })();

    div.innerHTML = `
      ${!isMe ? `<div class="chat-name" style="color:${playerColor}">${from}</div>` : ''}
      <div class="chat-bubble ${isMe ? 'chat-bubble-me' : 'chat-bubble-other'}">${msg}</div>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;

  // Unread badge if chat closed
  if(!_chatOpen && !isMe){
    _unreadCount++;
    const dot = document.getElementById('chat-notif-dot');
    if(dot) dot.style.display = 'block';
    const btn = document.getElementById('chat-toggle-btn');
    if(btn) btn.textContent = `💬`;
    if(typeof SFX !== 'undefined') SFX.chatMsg();
  }
}

function addSystemChatMsg(msg){
  addChatMsg('', msg, false, true);
}

// ===== TOURNAMENTS =====
let _myTournaments = [];

async function loadTournaments(){
  const list = document.getElementById('tournaments-list');
  if(!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3)">⏳ Chargement...</div>';

  try {
    const res = await fetch('/api/tournaments');
    const data = await res.json();
    const tourneys = data.tournaments || [];

    if(!tourneys.length){
      list.innerHTML = '<div style="text-align:center;padding:30px;color:rgba(255,255,255,.3)">Aucun tournoi disponible</div>';
      return;
    }

    list.innerHTML = tourneys.map(t => {
      const isFull = t.currentPlayers >= t.maxPlayers;
      const pct = Math.round((t.currentPlayers / t.maxPlayers) * 100);
      const statusLabel = t.status === 'open' ? 'OUVERT' : t.status === 'in_progress' ? 'EN COURS' : 'TERMINÉ';
      const statusClass = t.status === 'open' ? 'tourn-open' : t.status === 'in_progress' ? 'tourn-progress' : 'tourn-finished';
      const isJoined = _myTournaments.includes(t.id);

      return `<div class="tourn-card" onclick="if(event.target.tagName!=='BUTTON'){}">
        <div class="tourn-header">
          <div class="tourn-name">${t.name}</div>
          <div class="tourn-status ${statusClass}">${statusLabel}</div>
        </div>
        <div class="tourn-info">
          <div class="tourn-info-item">
            <div class="tourn-info-val">${t.mise > 0 ? t.mise.toLocaleString('fr-FR') : 'GRATUIT'}</div>
            <div class="tourn-info-lbl">🪙 Mise</div>
          </div>
          <div class="tourn-info-item">
            <div class="tourn-info-val" style="color:#00cc44">${t.prizePool.toLocaleString('fr-FR')}</div>
            <div class="tourn-info-lbl">💰 Prize Pool</div>
          </div>
          <div class="tourn-info-item">
            <div class="tourn-info-val">${t.currentPlayers}/${t.maxPlayers}</div>
            <div class="tourn-info-lbl">👥 Joueurs</div>
          </div>
        </div>
        <div class="tourn-progress-bar">
          <div class="tourn-progress-fill" style="width:${pct}%"></div>
        </div>
        ${t.status === 'open' ? `
          ${isJoined
            ? '<button class="tourn-btn" style="background:rgba(0,200,68,.15);color:#00cc44;border:1px solid rgba(0,200,68,.3);cursor:default">✅ INSCRIT - En attente...</button>'
            : isFull
              ? '<button class="tourn-btn tourn-btn-full" disabled>COMPLET</button>'
              : `<button class="tourn-btn tourn-btn-join" onclick="joinTournament('${t.id}','${t.name}',${t.mise})">🏆 S'INSCRIRE — ${t.mise > 0 ? t.mise.toLocaleString('fr-FR')+' 🪙' : 'GRATUIT'}</button>`
          }
        ` : `<button class="tourn-btn" style="background:rgba(255,255,255,.05);color:rgba(255,255,255,.3);cursor:default">${t.status === 'in_progress' ? '🎮 EN COURS...' : '🏁 TERMINÉ'}</button>`}
      </div>`;
    }).join('');

  } catch(e) {
    list.innerHTML = `<div style="text-align:center;padding:20px;color:#ff4444">❌ Erreur: ${e.message}</div>`;
  }
}

async function joinTournament(tournId, name, mise){
  if(typeof SFX !== 'undefined') SFX.btnClick();

  if(mise > 0 && STATE.coins < mise){
    showToast('⚠️ Solde insuffisant!');
    return;
  }

  const msg = mise > 0
    ? `S'inscrire au ${name} pour ${mise.toLocaleString('fr-FR')} 🪙?`
    : `S'inscrire au ${name} gratuitement?`;

  showModal('🏆', 'INSCRIPTION TOURNOI', msg,
    mise > 0 ? `-${mise.toLocaleString('fr-FR')} 🪙` : '',
    '✅ CONFIRMER', async () => {
      closeModal();
      try {
        const res = await fetch(`/api/tournaments/${tournId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: typeof CURRENT_USER !== 'undefined' ? CURRENT_USER?.id : null,
            username: STATE.username,
            socketId: STATE.socket?.id,
          })
        });
        const data = await res.json();
        if(data.success){
          _myTournaments.push(tournId);
          if(mise > 0){
            STATE.coins -= mise;
            updateCUI();
            addTx('loss', `Inscription ${name}`, -mise);
          }
          if(typeof SFX !== 'undefined') SFX.reward();
          showToast(`✅ Inscrit! Position ${data.position}/${data.maxPlayers}`);
          loadTournaments();

          // Listen for tournament events
          if(STATE.socket){
            STATE.socket.on('tournament_update', ({message}) => {
              showToast(`🏆 ${message}`);
            });
            STATE.socket.on('tournament_started', ({opponent, message}) => {
              showToast(`🎮 ${message}`);
              if(typeof SFX !== 'undefined') SFX.gameStart();
            });
            STATE.socket.on('tournament_over', ({winner, isWinner, prize, message}) => {
              showToast(`🏆 ${message}`);
              if(isWinner && prize > 0){
                STATE.coins += prize;
                updateCUI();
                addTx('gain', `Victoire tournoi ${name}`, prize);
                if(typeof SFX !== 'undefined') SFX.bigWin();
              } else {
                if(typeof SFX !== 'undefined') SFX.lose();
              }
              _myTournaments = _myTournaments.filter(id => id !== tournId);
            });
          }
        } else {
          showToast('⚠️ ' + data.message);
        }
      } catch(e) {
        showToast('❌ Erreur: ' + e.message);
      }
    },
    '❌ ANNULER', closeModal
  );
}

// ===== SETTINGS =====
const SETTINGS_KEY = 'clash_settings';

function loadSettings(){
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if(!saved) return;
    const s = JSON.parse(saved);

    // Apply volume
    if(s.sfxVol !== undefined){
      document.getElementById('sfx-volume') && (document.getElementById('sfx-volume').value = s.sfxVol*100);
      if(typeof SFX !== 'undefined') SFX.setVol(s.sfxVol);
    }
    if(s.musicVol !== undefined){
      document.getElementById('music-volume') && (document.getElementById('music-volume').value = s.musicVol*100);
    }
    if(s.muted){
      const el = document.getElementById('toggle-mute');
      if(el) el.checked = true;
      if(typeof SFX !== 'undefined') SFX.setVol(0);
    }
    if(s.vibration !== undefined){
      const el = document.getElementById('toggle-vibration');
      if(el) el.checked = s.vibration;
    }
    if(s.notif !== undefined){
      const el = document.getElementById('toggle-notif');
      if(el) el.checked = s.notif;
    }
    if(s.publicProfile !== undefined){
      const el = document.getElementById('toggle-public');
      if(el) el.checked = s.publicProfile;
    }
    if(s.lang){
      const el = document.getElementById('lang-select');
      if(el) el.value = s.lang;
    }
    if(s.aiDiff){
      const el = document.getElementById('ai-difficulty');
      if(el) el.value = s.aiDiff;
    }
    if(s.theme) applyTheme(s.theme, true);

  } catch(e){ console.warn('Settings load error:', e); }
}

function saveSettings(){
  try {
    const s = {
      sfxVol: (document.getElementById('sfx-volume')?.value || 65) / 100,
      musicVol: (document.getElementById('music-volume')?.value || 28) / 100,
      muted: document.getElementById('toggle-mute')?.checked || false,
      vibration: document.getElementById('toggle-vibration')?.checked ?? true,
      notif: document.getElementById('toggle-notif')?.checked || false,
      publicProfile: document.getElementById('toggle-public')?.checked ?? true,
      lang: document.getElementById('lang-select')?.value || 'fr',
      aiDiff: document.getElementById('ai-difficulty')?.value || 'medium',
      theme: document.getElementById('theme-select')?.value || 'dark',
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch(e){ console.warn('Settings save error:', e); }
}

function setSFXVolume(val){
  const vol = val / 100;
  if(typeof SFX !== 'undefined') SFX.setVol(vol);
  saveSettings();
}

function setMusicVolume(val){
  const vol = val / 100;
  // Update music volume
  saveSettings();
}

function toggleAllSound(muted){
  if(typeof SFX !== 'undefined'){
    if(muted) SFX.setVol(0);
    else SFX.setVol((document.getElementById('sfx-volume')?.value || 65) / 100);
  }
  const btn = document.getElementById('sound-btn');
  if(btn) btn.textContent = muted ? '🔇' : '🔊';
  saveSettings();
}

function toggleNotifications(enabled){
  if(enabled) requestNotifPermission();
  saveSettings();
}

function applyTheme(theme, silent=false){
  const root = document.documentElement;
  if(theme === 'gold'){
    root.style.setProperty('--bg', '#0d0800');
    root.style.setProperty('--panel', '#1a1200');
  } else if(theme === 'blue'){
    root.style.setProperty('--bg', '#000d1a');
    root.style.setProperty('--panel', '#001228');
  } else {
    root.style.setProperty('--bg', '#0a0a0f');
    root.style.setProperty('--panel', '#111118');
  }
  const el = document.getElementById('theme-select');
  if(el) el.value = theme;
  if(!silent) saveSettings();
}

// Vibrate helper
function vibrate(pattern=[50]){
  const el = document.getElementById('toggle-vibration');
  if(el?.checked && navigator.vibrate) navigator.vibrate(pattern);
}

async function changePassword(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  const email = CURRENT_USER?.email;
  if(!email){ showToast('⚠️ Aucun email associé'); return; }
  try {
    const sb = await getSupabase();
    await sb.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/auth.html'
    });
    showToast('✅ Email de réinitialisation envoyé à ' + email);
  } catch(e){ showToast('⚠️ Erreur: ' + e.message); }
}

// Blocked players
let _blockedPlayers = JSON.parse(localStorage.getItem('blocked_players') || '[]');

function blockPlayer(username){
  if(!_blockedPlayers.includes(username)){
    _blockedPlayers.push(username);
    localStorage.setItem('blocked_players', JSON.stringify(_blockedPlayers));
    showToast('Joueur bloque: ' + username);
    updateBlockedCount();
  }
}

function unblockPlayer(username){
  _blockedPlayers = _blockedPlayers.filter(u => u !== username);
  localStorage.setItem('blocked_players', JSON.stringify(_blockedPlayers));
  showToast('Joueur debloque: ' + username);
  updateBlockedCount();
}

function updateBlockedCount(){
  const el = document.getElementById('blocked-count-lbl');
  if(el) el.textContent = _blockedPlayers.length > 0
    ? `${_blockedPlayers.length} joueur(s) bloqué(s)`
    : 'Gérer les blocages';
}

function showBlockedPlayers(){
  if(!_blockedPlayers.length){
    showToast('Aucun joueur bloqué');
    return;
  }
  const list = _blockedPlayers.map(u =>
    `• ${u} <button onclick="unblockPlayer('${u}')" style="color:#00cc44;background:none;border:none;cursor:pointer;font-size:12px">Débloquer</button>`
  ).join('<br>');
  showModal('🚫','JOUEURS BLOQUÉS', list, '',
    'FERMER', closeModal, '', null);
}

function showHelp(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  var rules = [
    'Lance le de en cliquant dessus',
    'Touche un pion pour le deplacer',
    'Sors tes pions avec un 6',
    'Les etoiles sont des zones safe',
    'Capture les pions adverses',
    'Le 1er a rentrer ses 4 pions gagne!'
  ].join(' | ');
  showModal('?','COMMENT JOUER', rules, '', 'COMPRIS!', closeModal, '', null);
}

function contactSupport(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  const email = 'horizonmanagement24@gmail.com';
  const subject = 'Support Clash of Coins';
  const body = `Bonjour,\n\nJoueur: ${CURRENT_PROFILE?.username || 'Inconnu'}\nProblème: `;
  window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

async function deleteAccount(){
  if(typeof SFX !== 'undefined') SFX.btnClick();
  showModal('🗑️','SUPPRIMER LE COMPTE',
    'Action irreversible - donnees supprimees definitivement.',
    '',
    '❌ ANNULER', closeModal,
    '🗑️ SUPPRIMER', async () => {
      closeModal();
      try {
        const sb = await getSupabase();
        // Delete from players table
        await sb.from('players').delete().eq('id', CURRENT_USER.id);
        // Sign out
        await sb.auth.signOut();
        showToast('Compte supprimé. Au revoir!');
        setTimeout(() => window.location.href = '/auth.html', 2000);
      } catch(e){ showToast('⚠️ Erreur: ' + e.message); }
    }
  );
}

// ===== PUSH NOTIFICATIONS =====
async function requestNotifPermission(){
  document.getElementById('notif-banner').style.display = 'none';
  if(!('Notification' in window)){ showToast('⚠️ Notifications non supportées'); return; }
  const perm = await Notification.requestPermission();
  if(perm === 'granted'){
    showToast('✅ Notifications activées!');
    // Register push subscription if service worker available
    if('serviceWorker' in navigator){
      const reg = await navigator.serviceWorker.ready;
      console.log('SW ready for push:', reg);
    }
  } else {
    showToast('⚠️ Notifications refusées');
  }
}

function sendLocalNotif(title, body){
  if(Notification.permission !== 'granted') return;
  if(document.visibilityState === 'visible') return; // App is focused
  new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'clash-coins-turn',
    vibrate: [200,100,200],
  });
}

// Show notification banner after login
function showNotifBanner(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default'){
    setTimeout(()=>{
      const banner = document.getElementById('notif-banner');
      if(banner) banner.style.display = 'flex';
    }, 5000);
  }
}


// ===== FRIEND ROOM FUNCTIONS =====
let _currentRoomCode = null;

async function createFriendRoom(){
  const btn = document.getElementById('btn-create-room');
  if(btn){ btn.disabled=true; btn.textContent='Création...'; }

  try {
    const res = await fetch('/api/create-room', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        mode: STATE.currentMode,
        mise: STATE.currentMise,
        numPlayers: STATE.numPlayers,
        username: STATE.username,
      })
    });
    const data = await res.json();
    if(!data.success) throw new Error(data.message);

    _currentRoomCode = data.code;

    // Show code display
    const codeEl = document.getElementById('friend-code-val');
    if(codeEl) codeEl.textContent = data.code;
    const display = document.getElementById('friend-code-display');
    if(display) display.style.display = 'block';
    if(btn){ btn.style.display='none'; }

    // Join the room ourselves via socket
    if(STATE.socket){
      STATE.socket.emit('join_friend_room', { code: data.code });

      STATE.socket.on('room_update', ({currentPlayers, needed}) => {
        const status = document.getElementById('friend-room-status');
        if(status) status.textContent = `${currentPlayers}/${needed} joueurs connectés`;
      });
    }

    showToast(`🎮 Code créé: ${data.code}`);
    if(typeof SFX !== 'undefined') SFX.reward();

  } catch(e) {
    showToast('⚠️ Erreur: ' + e.message);
    if(btn){ btn.disabled=false; btn.textContent='🎮 CRÉER LA PARTIE'; }
  }
}

async function joinFriendRoom(){
  const input = document.getElementById('join-code-input');
  const status = document.getElementById('join-status');
  const code = input?.value?.trim().toUpperCase();

  if(!code || code.length < 4){
    if(status) status.textContent = '⚠️ Entre un code valide';
    return;
  }

  if(status) status.textContent = '⏳ Vérification...';

  try {
    // Check room exists
    const res = await fetch(`/api/room/${code}`);
    const data = await res.json();

    if(!data.success){
      if(status) status.textContent = '❌ ' + data.message;
      return;
    }

    const room = data.room;
    if(status) status.textContent = `✅ Partie de ${room.hostUsername} trouvée! Connexion...`;

    // Update game state
    STATE.currentMode = room.mode;
    STATE.currentMise = room.mise;
    STATE.numPlayers = room.numPlayers;

    // Join via socket
    if(STATE.socket){
      STATE.socket.emit('join_friend_room', { code });
      showToast(`🎮 Connexion à la partie de ${room.hostUsername}...`);
      if(typeof SFX !== 'undefined') SFX.playerJoin();
    } else {
      if(status) status.textContent = '❌ Connexion socket requise';
    }

  } catch(e) {
    if(status) status.textContent = '❌ Erreur de connexion';
  }
}

function shareRoomCode(){
  if(!_currentRoomCode) return;
  const link = `https://clash-of-coins.onrender.com/?join=${_currentRoomCode}`;
  const text = `🎮 Rejoins ma partie Clash of Coins!\nCode: ${_currentRoomCode}\nLien: ${link}`;
  if(navigator.share){
    navigator.share({ title: 'Clash of Coins', text, url: link });
  } else {
    navigator.clipboard?.writeText(text).then(() => showToast('✅ Lien copié!'));
  }
}

function copyRoomCode(){
  if(!_currentRoomCode) return;
  navigator.clipboard?.writeText(_currentRoomCode).then(() => showToast(`✅ Code ${_currentRoomCode} copié!`));
}

// ===== SOCKET.IO MULTIPLAYER =====
function initSocket(){
  try{
    STATE.socket = io({transports:['websocket','polling'], timeout:8000});

    // Connected
    STATE.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      // Send auth with userId for DB sync
      STATE.socket.emit('auth', {
        username: STATE.username,
        coins: STATE.coins,
        userId: typeof CURRENT_USER !== 'undefined' ? CURRENT_USER?.id : null,
      });
    });

    // Online count
    STATE.socket.on('online_count', ({count}) => {
      const el = document.getElementById('online-count');
      if(el) el.textContent = count.toLocaleString('fr-FR');
    });

    // Queue update
    STATE.socket.on('queue_update', ({found, needed, status}) => {
      const mmFound = document.getElementById('mm-found');
      const mmNeeded = document.getElementById('mm-needed');
      const mmStatus = document.getElementById('mm-status');
      if(mmFound) mmFound.textContent = found;
      if(mmNeeded) mmNeeded.textContent = needed;
      if(mmStatus) mmStatus.textContent = status || `Recherche de joueurs...`;
    });

    // Match found!
    STATE.socket.on('match_found', ({roomId, myIndex, players, mode, mise}) => {
      clearTimeout(STATE.mmTimeout);
      console.log(`🎮 Match found! Room: ${roomId}, myIndex: ${myIndex}`);

      GAME.isMultiplayer = true;
      GAME.roomId = roomId;
      GAME.myIndex = myIndex;
      STATE.myColor = myIndex;

      showToast('🎮 Partie trouvée! Démarrage...');
      if(typeof SFX!=='undefined') SFX.playerJoin();

      // Start game with real players
      showScreen('game');
      const gnp = document.getElementById('g-np');
      if(gnp) gnp.textContent = players.length;
      const gm = document.getElementById('g-mise');
      if(gm) gm.textContent = mode === 'free' ? 'Gratuit' : (mise||0).toLocaleString('fr-FR') + ' 🪙';

      initGame(players.length);
      STATE.numPlayers = players.length;

      // Set player names
      players.forEach((p, idx) => {
        const piEl = document.getElementById(`pi-${idx}`);
        const paEl = document.getElementById(`pa-${idx}`);
        const pnEl = document.getElementById(`pn-${idx}`);
        const psEl = document.getElementById(`ps-${idx}`);
        if(!piEl) return;
        piEl.style.display = 'flex';
        if(paEl){ paEl.style.background = PC[idx]; paEl.textContent = idx === myIndex ? 'MOI' : `P${idx+1}`; }
        if(pnEl) pnEl.textContent = idx === myIndex ? 'Vous' : p.username;
        if(psEl){ psEl.textContent = '0 pts'; psEl.style.color = PCL[idx]; }
      });

      setupCanvas();
      GAME.current = -1; // Wait for server to say who goes first
      disableRoll();
      log('🎮 Partie multijoueur! En attente...', '#FFD700');
    });

    // Turn change (server authoritative)
    STATE.socket.on('turn_change', ({current, replay, message}) => {
      // Full reset for new turn
      GAME.current = current;
      GAME.rolled = false;
      GAME.waitMove = false;
      GAME.movable = [];
      GAME.dice = 1;
      if(animFrame){ cancelAnimationFrame(animFrame); animFrame = null; }
      
      // Reset dice visual
      const dEl = document.getElementById('dice-el');
      if(dEl){ dEl.textContent='⚀'; dEl.style.opacity='1'; dEl.style.transform=''; }
      
      updateAP();
      drawBoard();

      if(message) log(message, PC[current] || '#FFD700');

      if(current === STATE.myColor){
        // MY TURN
        log('🎲 Votre tour!', PC[STATE.myColor]);
        enableRoll();
        if(typeof SFX !== 'undefined') SFX.myTurn();
        sendLocalNotif('Clash of Coins', "C'est ton tour! Lance le dé!");
      } else {
        disableRoll();
        log(`Tour de ${document.getElementById(`pn-${current}`)?.textContent || 'adversaire'}...`, PC[current]);
      }
    });

    // Someone rolled dice
    STATE.socket.on('dice_result', ({player, result}) => {
      if(player === STATE.myColor) return; // Already handled locally
      GAME.dice = result;
      const diceEl = document.getElementById('dice-el');
      if(diceEl) diceEl.textContent = DF[result-1];
      if(typeof SFX !== 'undefined') SFX.diceResult(result);
      log(`${document.getElementById(`pn-${player}`)?.textContent||'Adversaire'} lance ${result}`, PC[player]);
      showDiceResult(result, player);
    });

    // Someone moved a pawn
    STATE.socket.on('player_moved', ({player, piece, newPos, captured, scores}) => {
      if(player === STATE.myColor) return; // Already applied locally

      // Apply opponent move
      GAME.pieces[player][piece] = newPos;
      if(scores) GAME.scores = [...scores];

      if(typeof SFX !== 'undefined') SFX.move();
      hideDiceResult();

      if(captured){
        GAME.pieces[captured.player][captured.piece] = -1;
        if(typeof SFX !== 'undefined') SFX.capture();
        log('💥 Capture!', PC[player]);
      }

      // Check if piece finished
      if(newPos >= 58){
        GAME.finished[player] = (GAME.finished[player]||0) + 1;
        if(typeof SFX !== 'undefined') SFX.pieceDone();
      }

      updateSUI();
      drawBoard();
      // Server will send turn_change next
    });

    // Player ranked
    STATE.socket.on('player_ranked', ({player, position, username}) => {
      const labels = ['🥇','🥈','🥉','💀'];
      log(`${labels[position-1]||`${position}e`} — ${player === STATE.myColor ? 'Vous' : username}!`, PC[player]);
      GAME.ranking.push(player);
      GAME.eliminated.push(player);
    });

    // Game over
    STATE.socket.on('game_over', ({myPosition, ranking, players, scores, prize, mode}) => {
      GAME.ranking = ranking;
      GAME.scores = scores;
      GAME.over = true;
      GAME.isMultiplayer = false;
      GAME.roomId = null;

      // Update coins if prize
      if(prize > 0){
        STATE.coins += prize;
        updateCUI();
        addTx('gain', `${myPosition===0?'1er':'2ème'} place (multi)`, prize);
      }

      // Show final ranking modal
      setTimeout(() => showMultiplayerResult(myPosition, ranking, players, scores, prize, mode), 500);
    });

    // Player disconnected
    STATE.socket.on('player_disconnected', ({player, username}) => {
      showToast(username + ' s est deconnecte(e)');
      if(typeof SFX!=='undefined') SFX.playerLeave();
      log(`⚠️ ${username} déconnecté - 30s pour revenir`, '#ff8888');
    });

    // Player forfeited
    STATE.socket.on('player_forfeited', ({player, username}) => {
      showToast(`🏳️ ${username} a abandonné`);
      GAME.eliminated.push(player);
      GAME.ranking.push(player);
    });

    // Chat received
    STATE.socket.on('chat', ({from, msg}) => {
      const isMe = from === STATE.username;
      if(!isMe) addChatMsg(from, msg, false);
    });

    // Error
    STATE.socket.on('error', ({message}) => {
      showToast(`⚠️ ${message}`);
      showScreen('home');
    });

    STATE.socket.on('disconnect', () => {
      showToast('⚠️ Connexion perdue - reconnexion...');
      GAME.isMultiplayer = false;
    });

  } catch(e) {
    console.warn('Socket.io not available:', e);
    STATE.socket = null;
  }

  // Simulate online count if no socket
  if(!STATE.socket){
    const el = document.getElementById('online-count');
    if(el){ let b=247; setInterval(()=>{ b+=Math.floor(Math.random()*20-8); el.textContent=Math.max(50,b).toLocaleString('fr-FR'); }, 6000); }
  }
}

// Show multiplayer end result
function showMultiplayerResult(myPos, ranking, players, scores, prize, mode){
  const posLabels = ['🥇','🥈','🥉','💀'];
  const isFirst = myPos === 0;
  const coinsStr = prize > 0 ? `+${prize.toLocaleString('fr-FR')} 🪙` : '';

  document.getElementById('m-icon').textContent = isFirst ? '🏆' : myPos === players.length-1 ? '😤' : '🎯';
  document.getElementById('m-title').textContent = isFirst ? 'VICTOIRE!' : myPos === players.length-1 ? 'DÉFAITE' : 'BIEN JOUÉ!';
  document.getElementById('m-msg').innerHTML = ranking.map((p,i) => {
    const name = p === STATE.myColor ? '<b style="color:#FFD700">Vous</b>' : (players[p]?.username || `Joueur${p+1}`);
    return `${posLabels[i]} <span style="color:${PC[p]}">${name}</span> — ${scores[p]||0} pts`;
  }).join('<br>');
  const mc = document.getElementById('m-coins');
  mc.textContent = coinsStr; mc.style.display = coinsStr ? 'block' : 'none';
  document.getElementById('m-btn1').textContent = 'REJOUER';
  document.getElementById('m-btn1').onclick = () => { closeModal(); findGame(); };
  document.getElementById('m-btn2').textContent = 'ACCUEIL';
  document.getElementById('m-btn2').onclick = () => { closeModal(); showScreen('home'); };

  if(typeof SFX !== 'undefined'){
    setTimeout(() => { if(isFirst) SFX.win(); else SFX.lose(); }, 300);
  }
  document.getElementById('modal').classList.add('open');
  saveGameStats(myPos, prize);
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


// ===== ANIMATED BACKGROUND =====
function initBackground(){
  const canvas = document.getElementById('bg-canvas');
  if(!canvas) return;
  const ctx2 = canvas.getContext('2d');
  
  function resize(){ canvas.width=window.innerWidth; canvas.height=window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  // Falling elements
  const EMOJIS = ['🪙','🎲','👑','⭐','💎','🃏','🎯'];
  const particles = Array.from({length:35}, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    size: 14 + Math.random() * 22,
    speed: 0.4 + Math.random() * 1.2,
    rot: Math.random() * Math.PI * 2,
    rotSpeed: (Math.random() - 0.5) * 0.04,
    sway: Math.random() * 0.8,
    swayOffset: Math.random() * Math.PI * 2,
    opacity: 0.06 + Math.random() * 0.12,
    emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
  }));

  // Background gradient colors - cycle slowly
  let hue = 240;
  let frame = 0;

  function drawBg(){
    const w = canvas.width, h = canvas.height;
    frame++;

    // Dynamic gradient background
    hue = 220 + Math.sin(frame * 0.003) * 20;
    const grad = ctx2.createRadialGradient(w*.5, h*.3, 0, w*.5, h*.5, Math.max(w,h));
    grad.addColorStop(0, `hsl(${hue},45%,10%)`);
    grad.addColorStop(0.5, `hsl(${hue+20},35%,7%)`);
    grad.addColorStop(1, `hsl(${hue-20},50%,4%)`);
    ctx2.fillStyle = grad;
    ctx2.fillRect(0, 0, w, h);

    // Subtle gold shimmer at top
    const shimmer = ctx2.createLinearGradient(0,0,w,0);
    shimmer.addColorStop(0,'transparent');
    shimmer.addColorStop(0.3+0.2*Math.sin(frame*.01),'rgba(255,215,0,.03)');
    shimmer.addColorStop(1,'transparent');
    ctx2.fillStyle = shimmer;
    ctx2.fillRect(0, 0, w, h*.4);

    // Falling particles
    ctx2.save();
    particles.forEach(p => {
      p.y += p.speed;
      p.x += Math.sin(frame * 0.02 + p.swayOffset) * p.sway;
      p.rot += p.rotSpeed;
      if(p.y > h + 40){ p.y = -40; p.x = Math.random() * w; }

      ctx2.save();
      ctx2.globalAlpha = p.opacity;
      ctx2.translate(p.x, p.y);
      ctx2.rotate(p.rot);
      ctx2.font = `${p.size}px serif`;
      ctx2.textAlign = 'center';
      ctx2.textBaseline = 'middle';
      ctx2.fillText(p.emoji, 0, 0);
      ctx2.restore();
    });
    ctx2.restore();

    requestAnimationFrame(drawBg);
  }
  drawBg();
}

// ===== SOUND TOGGLE =====
function toggleSound(){
  if(typeof SFX !== 'undefined') SFX.toggleMute();
}

// ===== INIT =====
updateCUI();
// Init background after DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{
    initBackground();
    initParticles();
  });
} else {
  initBackground();
  initParticles();
}

// Check URL for friend room code (?join=CODE)
const _urlParams = new URLSearchParams(window.location.search);
const _joinCode = _urlParams.get('join');
if(_joinCode){
  // Wait for socket connection then join
  setTimeout(()=>{
    if(STATE.socket?.connected){
      document.getElementById('join-code-input') && (document.getElementById('join-code-input').value = _joinCode);
      showScreen('friends');
      showToast(`🎮 Code détecté: ${_joinCode}`);
    }
  }, 2000);
}

// Start home music after first user interaction
document.addEventListener('click', function startMusicOnce(){
  if(typeof SFX !== 'undefined'){
    // Small delay to let AudioContext unlock
    setTimeout(()=>{
      const currentScreen = document.querySelector('.screen.active');
      if(currentScreen && currentScreen.id === 'scr-home'){
        SFX.startHomeMusic();
      }
    }, 500);
  }
  document.removeEventListener('click', startMusicOnce);
}, {once: true});