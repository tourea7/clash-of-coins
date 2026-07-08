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
  if(typeof SFX!=='undefined') SFX.move();
  if(animFrame){cancelAnimationFrame(animFrame);animFrame=null;}

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
              log(`💥 Capture! +20 pts`,PC[player]);
              if(typeof SFX!=='undefined') SFX.capture();
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
    if(typeof SFX!=='undefined') SFX.myTurn();
  } else {
    const aiIdx=GAME.current>STATE.myColor?GAME.current-1:GAME.current;
    log(`Tour de ${AI[aiIdx]||'IA'}...`,PC[GAME.current]);
    disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);
  }
}

function aiTurn(player){
  if(GAME.over||GAME.current!==player||GAME.eliminated.includes(player)) return;
  if(player===STATE.myColor) return; // Never run AI for human player
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
  document.getElementById('m-icon').textContent=isFirst?'🏆':myPos===GAME.players-1?'😤':'🎯';
  document.getElementById('m-title').textContent=isFirst?'VICTOIRE!':myPos===GAME.players-1?'DÉFAITE':'BIEN JOUÉ!';
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
  // Play win or lose sound
  if(typeof SFX!=='undefined'){
    setTimeout(()=>{ if(isFirst) SFX.win(); else SFX.lose(); }, 300);
  }
  document.getElementById('modal').classList.add('open');
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
let soundEnabled = true;
function toggleSound(){
  soundEnabled = !soundEnabled;
  const btn = document.getElementById('sound-btn');
  if(btn) btn.textContent = soundEnabled ? '🔊' : '🔇';
  if(soundEnabled && typeof SFX !== 'undefined') SFX.click();
  // Patch SFX to respect toggle
  if(typeof SFX !== 'undefined') SFX.setVol(soundEnabled ? 0.5 : 0);
}

// ===== INIT =====
updateCUI();
// Init background after DOM ready
if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{initBackground();initParticles();});
} else {
  initBackground();
  initParticles();
}