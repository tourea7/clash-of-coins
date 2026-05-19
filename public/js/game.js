// CLASH OF COINS — game.js v4.0 — Full Ludo King Style
const STATE={coins:15350,username:'Sidick Kone',currentMode:'free',currentMise:500,numPlayers:4,myColor:0,socket:null,mmTimeout:null,
transactions:[
  {type:'gain',desc:'Partie gagnée',date:"12 Mai 2024 · 14:35",amount:2500},
  {type:'loss',desc:'Mise de partie',date:"12 Mai 2024 · 14:30",amount:-1000},
  {type:'gain',desc:'Dépôt (Orange Money)',date:"12 Mai 2024 · 13:20",amount:5000},
  {type:'gain',desc:'Partie gagnée',date:"12 Mai 2024 · 12:10",amount:1800},
  {type:'loss',desc:'Retrait (Wave)',date:"11 Mai 2024 · 18:40",amount:-3000},
]};

const GAME={
  players:4,current:0,dice:1,rolled:false,over:false,
  pieces:[],finished:[],scores:[0,0,0,0],
  movable:[],waitMove:false,
  ranking:[],        // order of finish: [playerIndex, ...]
  eliminated:[],     // players who finished
  activePlayers:4,   // players still in game
};

// Ludo King exact colors
const PC  =['#1a6fff','#ee1111','#00bb33','#ddaa00'];
const PCL =['#77aaff','#ff7777','#44ee77','#ffdd55'];
const PCD =['#0033aa','#aa0000','#007722','#aa7700'];
const PCG =['rgba(26,111,255,.5)','rgba(238,17,17,.5)','rgba(0,187,51,.5)','rgba(221,170,0,.5)'];
const BOARD_BG=['#0033aa','#aa0000','#007722','#aa7700']; // home bg colors
const BOARD_MID=['#3366ee','#dd3333','#22aa44','#ddaa00']; // home mid colors
const AI=['QueenLudo','LuckyStar','KingLudo','DiceKing'];
const DF=['⚀','⚁','⚂','⚃','⚄','⚅'];

// Exact Ludo path
const P52=[
  [1,6],[2,6],[3,6],[4,6],[5,6],
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],
  [7,0],[8,0],
  [8,1],[8,2],[8,3],[8,4],[8,5],
  [9,6],[10,6],[11,6],[12,6],[13,6],
  [14,6],[14,7],[14,8],
  [13,8],[12,8],[11,8],[10,8],[9,8],
  [8,9],[8,10],[8,11],[8,12],[8,13],
  [8,14],[7,14],[6,14],
  [6,13],[6,12],[6,11],[6,10],[6,9],
  [5,8],[4,8],[3,8],[2,8],[1,8],
  [0,8],[0,7],[0,6],
];
const HS=[
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],    // Blue  P0: row7 going right
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],    // Red   P1: col7 going down
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],// Green P2: row7 going left
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],// Yellow P3: col7 going up
];
const BP=[
  [[2,2],[3,2],[2,3],[3,3]],       // Blue: top-left
  [[10,2],[11,2],[10,3],[11,3]],   // Red: top-right
  [[2,10],[3,10],[2,11],[3,11]],   // Green: bottom-left
  [[10,10],[11,10],[10,11],[11,11]], // Yellow: bottom-right
];
const EN=[0,13,26,39];
const SF=new Set(['1,6','8,1','13,8','6,13','1,8','0,7','14,7','7,0']);

let canvas,ctx,C;

function setupCanvas(){
  canvas=document.getElementById('board-canvas');
  const size=Math.min(window.innerWidth-24,window.innerHeight-290,390);
  canvas.width=canvas.height=size; C=size/15;
  ctx=canvas.getContext('2d');
  canvas.addEventListener('click',onBoardClick);
  canvas.addEventListener('touchend',e=>{e.preventDefault();const t=e.changedTouches[0];onBoardClick({clientX:t.clientX,clientY:t.clientY});},{passive:false});
  drawBoard();
}

function initGame(n){
  GAME.players=n;GAME.current=0;GAME.dice=1;GAME.rolled=false;GAME.over=false;GAME.waitMove=false;GAME.movable=[];
  GAME.scores=Array(4).fill(0);GAME.pieces=Array.from({length:4},()=>Array(4).fill(-1));GAME.finished=Array(4).fill(0);
  GAME.ranking=[];GAME.eliminated=[];GAME.activePlayers=n;
}

// ===== LUDO KING STYLE BOARD =====
function drawBoard(){
  if(!ctx)return;
  const W=canvas.width;
  ctx.clearRect(0,0,W,W);

  // Board shadow
  ctx.save();ctx.shadowColor='rgba(0,0,0,.9)';ctx.shadowBlur=24;
  ctx.fillStyle='#f5f0e8';rFill(0,0,W,W,12);
  ctx.restore();

  // Board background
  ctx.fillStyle='#f5f0e8';rFill(0,0,W,W,12);

  // Draw all path/board cells
  for(let r=0;r<15;r++) for(let c=0;c<15;c++) drawCell(c,r);

  // Home zones (colored 6x6 squares in corners)
  drawHomeZone(0,0,0,BOARD_BG[0],BOARD_MID[0],'#6699ff');
  drawHomeZone(1,9,0,BOARD_BG[1],BOARD_MID[1],'#ff9999');
  drawHomeZone(2,0,9,BOARD_BG[2],BOARD_MID[2],'#99ffbb');
  drawHomeZone(3,9,9,BOARD_BG[3],BOARD_MID[3],'#ffee99');

  // Center star
  drawCenterStar();

  // All pieces
  for(let p=0;p<GAME.players;p++) for(let i=0;i<4;i++) drawPiece(p,i);

  // Movable highlights
  if(GAME.waitMove){
    const pulse=.5+.5*Math.sin(Date.now()/250);
    GAME.movable.forEach(m=>{
      const{x,y}=getPXY(m.player,m.piece);
      ctx.save();
      ctx.beginPath();ctx.arc(x,y,C*.55+pulse*5,0,Math.PI*2);
      ctx.strokeStyle=`rgba(255,215,0,${.6+pulse*.4})`;ctx.lineWidth=3;ctx.stroke();
      ctx.restore();
    });
    requestAnimationFrame(drawBoard);
  }
}

function drawCell(col,row){
  const x=col*C,y=row*C,s=C;

  // Skip corner home zones - drawn separately as big colored squares
  if((col<6&&row<6)||(col>8&&row<6)||(col<6&&row>8)||(col>8&&row>8))return;
  // Skip center 3x3 - drawn separately
  if(col>=6&&col<=8&&row>=6&&row<=8)return;

  // Non-playable cells at path intersections - draw as board background
  // These are cells that look like they are on corners of the cross but are NOT on path
  const onMainPath=P52.some(([c,r])=>c===col&&r===row);
  const onHomeStretch=HS.some(s=>s.some(([c,r])=>c===col&&r===row));
  const isPlayable=onMainPath||onHomeStretch;

  // Non-playable cross junction cells (the "empty" looking corner cells)
  // These are in cross shape but not actually path squares
  const isCrossJunction=(
    (col===6&&row===6)||(col===8&&row===6)||
    (col===6&&row===8)||(col===8&&row===8)||
    (col===0&&row===6)||(col===14&&row===6)||
    (col===0&&row===8)||(col===14&&row===8)||
    (col===6&&row===0)||(col===8&&row===0)||
    (col===6&&row===14)||(col===8&&row===14)
  );

  let fill='#f0ede0',border='rgba(180,160,120,.25)',bw=.5;

  if(!isPlayable&&!isCrossJunction){
    // Off-path cells in the cross arms - light beige
    fill='#e8e4d4';
  }

  // Colored home stretch lanes (correct colors per player)
  // Blue (P0) home stretch: row7, cols 1-6 going right
  if(row===7&&col>=1&&col<=6)   {fill='#aaccff';border='rgba(26,111,255,.4)';bw=.8;}
  // Red (P1) home stretch: col7, rows 1-6 going down
  else if(col===7&&row>=1&&row<=6)  {fill='#ffaaaa';border='rgba(238,17,17,.4)';bw=.8;}
  // Green (P2) home stretch: row7, cols 8-13 going left
  else if(row===7&&col>=8&&col<=13) {fill='#aaffbb';border='rgba(0,187,51,.4)';bw=.8;}
  // Yellow (P3) home stretch: col7, rows 8-13 going up
  else if(col===7&&row>=8&&row<=13) {fill='#ffeeaa';border='rgba(221,170,0,.4)';bw=.8;}

  // Safe/star squares
  if(SF.has(`${col},${row}`)){fill='#fffde0';border='rgba(200,170,0,.5)';bw=1.2;}

  ctx.fillStyle=fill;
  ctx.fillRect(x+.5,y+.5,s-1,s-1);
  ctx.strokeStyle=border;ctx.lineWidth=bw;
  ctx.strokeRect(x+.5,y+.5,s-1,s-1);

  // Star symbol on safe squares
  if(SF.has(`${col},${row}`)&&col!==7&&row!==7){
    ctx.fillStyle='rgba(180,140,0,.65)';
    ctx.font=`bold ${Math.floor(C*.46)}px serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText('★',x+C/2,y+C/2+1);
  }

  // Entry arrows
  const arrows={'1,6':['→','#1a6fff'],'8,1':['↓','#ee1111'],'13,8':['←','#00bb33'],'6,13':['↑','#ddaa00']};
  if(arrows[`${col},${row}`]){
    const[arrow,color]=arrows[`${col},${row}`];
    ctx.fillStyle=color;ctx.globalAlpha=.5;
    ctx.font=`bold ${Math.floor(C*.55)}px sans-serif`;
    ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillText(arrow,x+C/2,y+C/2+1);
    ctx.globalAlpha=1;
  }
}

function drawHomeZone(player,col,row,dark,mid,light){
  const x=col*C,y=row*C,w=6*C,h=6*C;

  // Main colored background
  const bg=ctx.createLinearGradient(x,y,x+w,y+h);
  bg.addColorStop(0,dark);bg.addColorStop(.5,mid);bg.addColorStop(1,dark);
  ctx.fillStyle=bg;rFill(x,y,w,h,player===0?'12px 0 0 0':player===1?'0 12px 0 0':player===2?'0 0 0 12px':'0 0 12px 0');

  // Inner white rounded square
  const m=C*.55;
  ctx.fillStyle='rgba(255,255,255,.18)';
  rFill(x+m,y+m,w-m*2,h-m*2,8);

  // 4 piece base circles
  BP[player].forEach(([bc,br])=>{
    const bx=(bc+.5)*C,by=(br+.5)*C,r=C*.38;
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.4)';ctx.shadowBlur=6;ctx.shadowOffsetY=2;
    // Circle
    ctx.beginPath();ctx.arc(bx,by,r,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,.25)';ctx.fill();
    ctx.strokeStyle='rgba(255,255,255,.5)';ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  });
}

// roundFill with radius string support
function rFill(x,y,w,h,r){
  const rv=typeof r==='string'?r:''+r+'px '+r+'px '+r+'px '+r+'px';
  const parts=String(r).split(' ').map(p=>parseFloat(p)||0);
  const [tl,tr,br,bl]=parts.length===1?[parts[0],parts[0],parts[0],parts[0]]:
    parts.length===4?parts:[parts[0]||0,parts[1]||0,parts[0]||0,parts[1]||0];
  ctx.beginPath();
  ctx.moveTo(x+tl,y);ctx.lineTo(x+w-tr,y);ctx.arcTo(x+w,y,x+w,y+tr,tr);
  ctx.lineTo(x+w,y+h-br);ctx.arcTo(x+w,y+h,x+w-br,y+h,br);
  ctx.lineTo(x+bl,y+h);ctx.arcTo(x,y+h,x,y+h-bl,bl);
  ctx.lineTo(x,y+tl);ctx.arcTo(x,y,x+tl,y,tl);
  ctx.closePath();ctx.fill();
}

function drawCenterStar(){
  const cx=7.5*C,cy=7.5*C,s=1.7*C;

  // White background
  ctx.fillStyle='#fff';
  ctx.beginPath();ctx.rect(6*C,6*C,3*C,3*C);ctx.fill();

  // 4 triangles
  const T=(x1,y1,x2,y2,x3,y3,color,a=.85)=>{
    ctx.save();ctx.globalAlpha=a;
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);
    ctx.closePath();ctx.fillStyle=color;ctx.fill();ctx.restore();
  };
  T(cx,cy-s,cx-s*.68,cy,cx+s*.68,cy,PC[0]);
  T(cx+s,cy,cx,cy-s*.68,cx,cy+s*.68,PC[1]);
  T(cx,cy+s,cx+s*.68,cy,cx-s*.68,cy,PC[2]);
  T(cx-s,cy,cx,cy+s*.68,cx,cy-s*.68,PC[3]);

  // Dividing lines
  ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=1.5;
  ctx.beginPath();ctx.moveTo(cx,cy-s);ctx.lineTo(cx,cy+s);ctx.stroke();
  ctx.beginPath();ctx.moveTo(cx-s,cy);ctx.lineTo(cx+s,cy);ctx.stroke();

  // Center jewel
  const r=C*.7;
  const cg=ctx.createRadialGradient(cx-r*.35,cy-r*.35,r*.05,cx,cy,r);
  cg.addColorStop(0,'#fff9cc');cg.addColorStop(.4,'#FFD700');cg.addColorStop(1,'#FF8C00');
  ctx.save();ctx.shadowColor='rgba(255,165,0,.5)';ctx.shadowBlur=12;
  ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle=cg;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=2;ctx.stroke();
  ctx.restore();

  // C letter
  ctx.fillStyle='#1a0800';
  ctx.font=`bold ${Math.floor(C*.78)}px 'Cinzel Decorative',serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText('C',cx,cy+1);
}

// Draw Ludo King style teardrop/pawn shape
function drawPiece(p,i){
  const{x,y}=getPXY(p,i);
  const color=PC[p],light=PCL[p],dark=PCD[p];
  const r=C*.3;

  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.7)';ctx.shadowBlur=8;ctx.shadowOffsetY=3;

  // Pawn teardrop body
  drawPawnShape(x,y,r,color,light,dark);

  ctx.restore();

  // Number inside
  ctx.fillStyle='rgba(0,0,0,.7)';
  ctx.font=`bold ${Math.floor(r*.9)}px Rajdhani,sans-serif`;
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(i+1,x,y-r*.2);

  // Active glow
  if(p===GAME.current&&!GAME.rolled){
    ctx.save();
    ctx.shadowColor=color;ctx.shadowBlur=18;
    drawPawnOutline(x,y,r+2.5);
    ctx.strokeStyle=`${color}cc`;ctx.lineWidth=2.5;ctx.stroke();
    ctx.restore();
  }
}

function drawPawnShape(x,y,r,color,light,dark){
  // Draw a Ludo King style pawn: dome top + wider base
  const headR=r;
  const baseW=r*1.4;
  const baseH=r*.7;
  const stemH=r*.5;

  // Main gradient
  const g=ctx.createRadialGradient(x-headR*.35,y-headR*.8-headR*.3,headR*.05,x,y-headR*.8,headR);
  g.addColorStop(0,light);g.addColorStop(.5,color);g.addColorStop(1,dark);

  ctx.beginPath();
  // Head (circle top)
  ctx.arc(x,y-headR*.8,headR,Math.PI,2*Math.PI);
  // Stem going down
  ctx.lineTo(x+headR*.6,y);
  // Base (wider)
  ctx.bezierCurveTo(x+baseW*.8,y+stemH*.3,x+baseW,y+stemH,x+baseW*.5,y+stemH+baseH*.5);
  ctx.bezierCurveTo(x+baseW*.3,y+stemH+baseH,x-baseW*.3,y+stemH+baseH,x-baseW*.5,y+stemH+baseH*.5);
  ctx.bezierCurveTo(x-baseW,y+stemH,x-baseW*.8,y+stemH*.3,x-headR*.6,y);
  ctx.lineTo(x-headR,y-headR*.8);

  ctx.fillStyle=g;ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,.4)';ctx.lineWidth=1.2;ctx.stroke();

  // Shine on head
  ctx.beginPath();ctx.arc(x-headR*.3,y-headR*1.1,headR*.3,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.45)';ctx.fill();

  // Small secondary shine
  ctx.beginPath();ctx.arc(x-headR*.1,y-headR*1.3,headR*.14,0,Math.PI*2);
  ctx.fillStyle='rgba(255,255,255,.3)';ctx.fill();
}

function drawPawnOutline(x,y,r){
  const headR=r,baseW=r*1.4,baseH=r*.7,stemH=r*.5;
  ctx.beginPath();
  ctx.arc(x,y-headR*.8,headR,Math.PI,2*Math.PI);
  ctx.lineTo(x+headR*.6,y);
  ctx.bezierCurveTo(x+baseW*.8,y+stemH*.3,x+baseW,y+stemH,x+baseW*.5,y+stemH+baseH*.5);
  ctx.bezierCurveTo(x+baseW*.3,y+stemH+baseH,x-baseW*.3,y+stemH+baseH,x-baseW*.5,y+stemH+baseH*.5);
  ctx.bezierCurveTo(x-baseW,y+stemH,x-baseW*.8,y+stemH*.3,x-headR*.6,y);
  ctx.lineTo(x-headR,y-headR*.8);
}

function getPXY(p,i){
  const pos=GAME.pieces[p][i];
  let col,row;
  if(pos===-1)[col,row]=BP[p][i];
  else if(pos>=52){const si=pos-52;if(si<6)[col,row]=HS[p][si];else{col=7;row=7;}}
  else[col,row]=P52[(pos+EN[p])%52];
  // Stack
  const stk=[];
  for(let p2=0;p2<GAME.players;p2++)for(let i2=0;i2<4;i2++){
    if(p2===p&&i2===i)continue;
    const op=GAME.pieces[p2][i2];let oc,or2;
    if(op===-1)[oc,or2]=BP[p2][i2];
    else if(op>=52){const si=op-52;if(si<6)[oc,or2]=HS[p2][si];else{oc=7;or2=7;}}
    else[oc,or2]=P52[(op+EN[p2])%52];
    if(oc===col&&or2===row)stk.push(1);
  }
  const offs=[[0,0],[.3,-.15],[-.3,-.15],[0,.28]];
  const o=offs[Math.min(stk.length,3)];
  return{x:(col+.5+o[0]*.42)*C,y:(row+.5+o[1]*.42)*C};
}

// ===== GAME LOGIC =====
function getMovable(player,dice){
  const m=[];
  for(let i=0;i<4;i++){
    const pos=GAME.pieces[player][i];
    if(pos===58)continue;
    if(pos===-1){if(dice===6)m.push({player,piece:i,newPos:0});}
    else{const np=pos+dice;if(np<=58)m.push({player,piece:i,newPos:np});}
  }
  return m;
}

function onBoardClick(e){
  if(!GAME.waitMove)return;
  const rect=canvas.getBoundingClientRect();
  const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
  const my=(e.clientY-rect.top)*(canvas.height/rect.height);
  for(const m of GAME.movable){
    const{x,y}=getPXY(m.player,m.piece);
    if(Math.hypot(mx-x,my-y)<C*.65){applyMove(m.player,m.piece,m.newPos);return;}
  }
}

function applyMove(player,piece,newPos){
  GAME.pieces[player][piece]=newPos;GAME.waitMove=false;GAME.movable=[];
  // Capture check
  if(newPos>=0&&newPos<52){
    const[myC,myR]=P52[(newPos+EN[player])%52];
    if(!SF.has(`${myC},${myR}`)){
      for(let p2=0;p2<GAME.players;p2++){
        if(p2===player)continue;
        for(let i2=0;i2<4;i2++){
          const op=GAME.pieces[p2][i2];
          if(op>=0&&op<52){
            const[oc,or2]=P52[(op+EN[p2])%52];
            if(oc===myC&&or2===myR){GAME.pieces[p2][i2]=-1;GAME.scores[player]+=20;log(`💥 Capture! +20 pts`,PC[player]);}
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
    log(`🎲 ${player===0?'Vous rejouez':AI[player-1]+' rejoue'} (6)!`,'#FFD700');
    if(player!==0)setTimeout(()=>aiTurn(player),900);
    else{GAME.rolled=false;enableRoll();}
  }else setTimeout(nextTurn,700);
}

function rollDice(){
  if(GAME.rolled||GAME.over||GAME.current!==STATE.myColor)return;
  GAME.rolled=true;disableRoll();
  const el=document.getElementById('dice-el');
  el.classList.add('rolling');
  let count=0;
  const iv=setInterval(()=>{
    el.textContent=DF[Math.floor(Math.random()*6)];
    if(++count>=14){
      clearInterval(iv);el.classList.remove('rolling');
      const result=Math.floor(Math.random()*6)+1;
      GAME.dice=result;el.textContent=DF[result-1];
      el.style.transform='scale(1.3)';setTimeout(()=>el.style.transform='scale(1)',250);
      const movable=getMovable(STATE.myColor,result);
      if(!movable.length){log(`Vous lancez ${result} — aucun mouvement 😕`,'rgba(255,255,255,.4)');setTimeout(nextTurn,1300);}
      else if(movable.length===1){log(`Vous lancez ${result} 🎯`,PC[STATE.myColor]);setTimeout(()=>applyMove(movable[0].player,movable[0].piece,movable[0].newPos),500);}
      else{GAME.movable=movable;GAME.waitMove=true;log(`Vous lancez ${result} — touchez un pion ✨`,'#FFD700');drawBoard();}
    }
  },60);
}

function nextTurn(){
  if(GAME.over) return;
  let next=(GAME.current+1)%GAME.players;
  // Skip eliminated players
  let safety=0;
  while(GAME.eliminated.includes(next)&&safety<GAME.players){next=(next+1)%GAME.players;safety++;}
  GAME.current=next;GAME.rolled=false;updateAP();
  if(GAME.current===STATE.myColor){log('🎲 Votre tour!',PC[STATE.myColor]);enableRoll();}
  else{
    const aiIdx=GAME.current>STATE.myColor?GAME.current-1:GAME.current;
    log(`Tour de ${AI[aiIdx]||'IA'}...`,PC[GAME.current]);
    disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);
  }
}

function aiTurn(player){
  if(GAME.over||GAME.current!==player||GAME.eliminated.includes(player))return;
  const result=Math.floor(Math.random()*6)+1;
  GAME.dice=result;document.getElementById('dice-el').textContent=DF[result-1];
  const aiIdx=player>STATE.myColor?player-1:player;
  log(`${AI[aiIdx]||'IA'} lance ${result}`,PC[player]);
  setTimeout(()=>{
    const movable=getMovable(player,result);
    if(movable.length){
      let best=movable[0];
      for(const m of movable)if(m.newPos>best.newPos)best=m;
      applyMove(best.player,best.piece,best.newPos);
    }else{if(result===6)setTimeout(()=>aiTurn(player),800);else setTimeout(nextTurn,600);}
  },700);
}

// Called when a player finishes all 4 pieces
function playerFinished(player){
  if(GAME.eliminated.includes(player)) return;
  GAME.ranking.push(player);
  GAME.eliminated.push(player);
  GAME.activePlayers--;

  const pos=GAME.ranking.length;
  const posLabels=['🥇 1er','🥈 2e','🥉 3e','💀 Dernier'];
  const posLabel=posLabels[pos-1]||`${pos}e`;
  const name=player===STATE.myColor?'Vous':AI[player>STATE.myColor?player-1:player];

  // Score bonus by finish position
  const bonuses=[200,100,50,0];
  GAME.scores[player]+=(bonuses[pos-1]||0);

  log(`${posLabel} — ${player===STATE.myColor?'Vous':name} a terminé!`,PC[player]);
  updateSUI();

  // Check if only 1 player left → game over
  const remaining=[];
  for(let i=0;i<GAME.players;i++){
    if(!GAME.eliminated.includes(i)) remaining.push(i);
  }

  if(remaining.length<=1){
    // Last player gets last place
    if(remaining.length===1) GAME.ranking.push(remaining[0]);
    GAME.over=true;
    setTimeout(()=>showFinalRanking(),800);
    return;
  }

  // Continue game — next turn
  // Skip eliminated players in nextTurn
  setTimeout(()=>{
    // Move to next non-eliminated player
    let next=(GAME.current+1)%GAME.players;
    while(GAME.eliminated.includes(next)) next=(next+1)%GAME.players;
    GAME.current=next;
    GAME.rolled=false;
    updateAP();
    if(GAME.current===STATE.myColor){log('🎲 Votre tour!',PC[STATE.myColor]);enableRoll();}
    else{log(`Tour de ${AI[GAME.current>STATE.myColor?GAME.current-1:GAME.current]}...`,PC[GAME.current]);disableRoll();setTimeout(()=>aiTurn(GAME.current),1000);}
  },1200);
}

function showFinalRanking(){
  const posLabels=['🥇','🥈','🥉','💀'];
  const posNames=['1er','2ème','3ème','Dernier'];
  const myPos=GAME.ranking.indexOf(STATE.myColor);
  const isFirst=myPos===0;
  const isLast=myPos===GAME.ranking.length-1&&GAME.players>2;

  // Calculate coins based on position
  let coinsChange=0;
  if(STATE.currentMode==='comp'){
    const pool=STATE.currentMise*STATE.numPlayers;
    if(myPos===0) coinsChange=Math.floor(pool*.55);       // 1er: 55%
    else if(myPos===1) coinsChange=Math.floor(pool*.25);  // 2e: 25%
    else if(myPos===2) coinsChange=0;                     // 3e: break even
    else coinsChange=-STATE.currentMise;                   // dernier: perd la mise
    STATE.coins+=coinsChange;
    if(coinsChange>0) addTx('gain',`${posNames[myPos]} place`,coinsChange);
    else if(coinsChange<0) addTx('loss',`${posNames[myPos]} place`,coinsChange);
    updateCUI();
  }

  // Build ranking display
  const rankLines=GAME.ranking.map((p,i)=>{
    const n=p===STATE.myColor?'Vous':AI[p>STATE.myColor?p-1:p];
    return `${posLabels[i]} ${posNames[i]}: ${n} (${GAME.scores[p]} pts)`;
  }).join('\n');

  const icon=isFirst?'🏆':isLast&&GAME.players>2?'😤':'🎯';
  const title=isFirst?'VICTOIRE!':isLast&&GAME.players>2?'DÉFAITE':'PARTIE TERMINÉE';
  const coinsStr=coinsChange>0?`+${coinsChange.toLocaleString('fr-FR')} 🪙`:coinsChange<0?`${coinsChange.toLocaleString('fr-FR')} 🪙`:'';

  // Show ranking in modal
  document.getElementById('m-icon').textContent=icon;
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').innerHTML=GAME.ranking.map((p,i)=>{
    const n=p===STATE.myColor?'<b style="color:#FFD700">Vous</b>':(AI[p>STATE.myColor?p-1:p]||'IA');
    return `${posLabels[i]} <span style="color:${PC[p]}">${n}</span> — ${GAME.scores[p]} pts`;
  }).join('<br>');
  const mc=document.getElementById('m-coins');
  mc.textContent=coinsStr;mc.style.display=coinsStr?'block':'none';
  const b1=document.getElementById('m-btn1'),b2=document.getElementById('m-btn2');
  b1.textContent='REJOUER';b1.onclick=()=>{closeModal();findGame();};
  b2.textContent='ACCUEIL';b2.onclick=()=>{closeModal();showScreen('home');};
  document.getElementById('modal').classList.add('open');
}

function endGame(winner){
  playerFinished(winner);
}

let logT;
function log(msg,color='rgba(255,255,255,.5)'){
  const el=document.getElementById('game-log');if(!el)return;
  el.textContent=msg;el.style.color=color;el.style.transform='scale(1.08)';
  clearTimeout(logT);logT=setTimeout(()=>el.style.transform='scale(1)',300);
}
function enableRoll(){document.getElementById('roll-btn').disabled=false;}
function disableRoll(){document.getElementById('roll-btn').disabled=true;}
function updateAP(){
  for(let i=0;i<4;i++){
    const av=document.getElementById(`pa-${i}`);if(!av)continue;
    const isActive=i===GAME.current;
    const isElim=GAME.eliminated&&GAME.eliminated.includes(i);
    av.style.boxShadow=isActive?`0 0 0 3px ${PCL[i]},0 0 18px ${PCG[i]}`:`0 0 8px ${PCG[i].replace('.5','.2')}`;
    av.style.transform=isActive?'scale(1.22)':'scale(1)';
    av.style.opacity=isElim?'0.4':'1';
    av.classList.toggle('myturn',isActive);
  }
}
function updateSUI(){for(let i=0;i<4;i++){const el=document.getElementById(`ps-${i}`);if(el)el.textContent=`${GAME.scores[i]} pts`;}}
function updateCUI(){
  const fmt=n=>Math.max(0,Math.round(n)).toLocaleString('fr-FR');
  STATE.coins=Math.max(0,STATE.coins);
  ['coins-display','bal-display-num','wallet-amount-num'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=fmt(STATE.coins);});
  const e1=document.getElementById('my-lb-coins');if(e1)e1.textContent=fmt(STATE.coins)+' 🪙';
  const e2=document.getElementById('profile-coins');if(e2)e2.textContent=fmt(STATE.coins);
}
function addTx(type,desc,amount){
  const now=new Date();
  STATE.transactions.unshift({type,desc,date:`${now.getDate()} Mai 2024 · ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`,amount});
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
  if(name==='wallet')renderTx();if(name==='game')updateAP();
}
function navTo(name,btn){
  showScreen(name);
  document.querySelectorAll('.ni').forEach(n=>n.classList.remove('active'));
  if(btn)btn.classList.add('active');
}
function startMode(mode){
  STATE.currentMode=mode;showScreen('mode');
  const ms=document.getElementById('mise-section'),gp=document.getElementById('gain-preview');
  if(mode==='free'){ms.style.display='none';gp.style.display='none';}
  else{ms.style.display='block';gp.style.display='block';updateGP();}
}
function setModeTab(t){document.getElementById('tab-rapide').classList.toggle('active',t==='rapide');document.getElementById('tab-amis').classList.toggle('active',t==='amis');}
function setPlayers(n){STATE.numPlayers=n;[2,3,4].forEach(x=>document.getElementById(`pb${x}`).classList.toggle('active',x===n));updateGP();}
function setMise(m){STATE.currentMise=m;[100,500,1000,5000].forEach(x=>document.getElementById(`mb${x}`).classList.toggle('active',x===m));updateGP();}
function updateGP(){document.getElementById('gp-val').textContent=Math.floor(STATE.currentMise*STATE.numPlayers*.95).toLocaleString('fr-FR')+' 🪙';}

// ===== COLOR PICKER =====
const COLOR_NAMES = ['Bleu','Rouge','Vert','Jaune'];
const COLOR_PAWNS = ['🔵','🔴','🟢','🟡'];

function openColorPicker(){
  // Reset all cards
  for(let i=0;i<4;i++){
    const card=document.getElementById(`cc-${i}`);
    if(card){
      card.classList.remove('selected','taken');
      const status=document.getElementById(`cc-status-${i}`);
      if(status) status.textContent='Disponible';
    }
  }
  // Pre-select current color
  selectColor(STATE.myColor);
  // Mark colors not available based on player count (optional: all available for now)
  showScreen('color');
}

function selectColor(idx){
  // Deselect all
  for(let i=0;i<4;i++){
    const card=document.getElementById(`cc-${i}`);
    if(card) card.classList.remove('selected');
  }
  // Select chosen
  const chosen=document.getElementById(`cc-${idx}`);
  if(chosen) chosen.classList.add('selected');
  STATE.myColor=idx;
  // Update preview
  const pawn=document.getElementById('cp-pawn');
  if(pawn) pawn.textContent=COLOR_PAWNS[idx];
  const name=document.getElementById('cp-name');
  if(name){name.textContent=COLOR_NAMES[idx];name.style.color=PC[idx];}
}

function confirmColor(){
  // Now go to actual game
  startGameWithColor();
}

function startGameWithColor(){
  showScreen('game');
  document.getElementById('g-np').textContent=STATE.numPlayers;
  document.getElementById('g-mise').textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';

  initGame(STATE.numPlayers);

  // Assign player labels based on chosen color
  // myColor = index of the color the human player uses
  // All other colors are AI
  const colorLabels=COLOR_NAMES;
  for(let i=0;i<4;i++){
    const piEl=document.getElementById(`pi-${i}`);
    const paEl=document.getElementById(`pa-${i}`);
    const pnEl=document.getElementById(`pn-${i}`);
    const psEl=document.getElementById(`ps-${i}`);
    if(!piEl) continue;
    piEl.style.display=i<STATE.numPlayers?'flex':'none';
    if(paEl){
      paEl.style.background=PC[i];
      paEl.style.boxShadow=`0 0 10px ${PCG[i].replace('.5','.3')}`;
      paEl.textContent=i===STATE.myColor?'MOI':`P${i+1}`;
    }
    if(pnEl) pnEl.textContent=i===STATE.myColor?'Vous':(AI[i>STATE.myColor?i-1:i]||`IA ${i+1}`);
    if(psEl){psEl.textContent='0 pts';psEl.style.color=PCL[i];}
  }

  setupCanvas();
  GAME.rolled=false;

  // Start with human player's color
  GAME.current=STATE.myColor;
  updateAP();

  if(GAME.current===STATE.myColor){
    enableRoll();
    log('🎲 Votre tour — lancez le dé!',PC[STATE.myColor]);
  } else {
    disableRoll();
    setTimeout(()=>aiTurn(GAME.current),1000);
  }
}

function findGame(){
  if(STATE.currentMode==='comp'&&STATE.coins<STATE.currentMise){showToast('⚠️ Solde insuffisant!');return;}
  // Show color picker before starting
  openColorPicker();
}
function startLocalGame(){
  // Called from matchmaking or directly - uses current myColor
  startGameWithColor();
}
function startMM(){
  showScreen('matchmaking');
  document.getElementById('mm-needed').textContent=STATE.numPlayers;
  document.getElementById('mm-mise').textContent=STATE.currentMode==='free'?'Gratuit':STATE.currentMise.toLocaleString('fr-FR')+' 🪙';
  document.getElementById('mm-found').textContent='1';
  STATE.socket.emit('find_game',{mode:STATE.currentMode,mise:STATE.currentMise,players:STATE.numPlayers});
  STATE.mmTimeout=setTimeout(()=>{showToast('Mode IA activé');startLocalGame();},15000);
}
function cancelMatchmaking(){if(STATE.mmTimeout)clearTimeout(STATE.mmTimeout);if(STATE.socket)STATE.socket.emit('cancel_search');showScreen('mode');}
function confirmQuit(){
  showModal('⚠️','QUITTER?',STATE.currentMode==='comp'?'Vous perdrez votre mise.':'Quitter la partie?',
    STATE.currentMode==='comp'?`-${STATE.currentMise.toLocaleString('fr-FR')} 🪙`:'',
    'CONTINUER',closeModal,'QUITTER',()=>{closeModal();if(STATE.currentMode==='comp'&&!GAME.over){STATE.coins-=STATE.currentMise;addTx('loss','Abandon',-STATE.currentMise);updateCUI();}showScreen('home');}
  );
}
function doDeposit(){STATE.coins+=5000;addTx('gain','Dépôt (Orange Money)',5000);updateCUI();renderTx();showToast('✅ +5 000 coins déposés!');}
function doWithdraw(){if(STATE.coins<1000){showToast('⚠️ Solde insuffisant!');return;}STATE.coins-=1000;addTx('loss','Retrait vers Wave',-1000);updateCUI();renderTx();showToast('💸 1 000 coins retirés vers Wave');}
function selectPM(pm){const n={orange:'Orange Money',moov:'Moov Money',mtn:'MTN Money',wave:'Wave'};showToast(`💳 ${n[pm]} sélectionné`);}
function joinTournament(){showModal('🏅','REJOINDRE','Confirmer votre inscription?','-1 000 🪙','CONFIRMER',()=>{STATE.coins-=1000;addTx('loss','Inscription tournoi',-1000);updateCUI();closeModal();showToast('🏅 Inscrit au tournoi!');},'ANNULER',closeModal);}
function showHistorique(){showScreen('wallet');}
function logout(){showModal('🚪','DÉCONNEXION','Se déconnecter de Clash of Coins?','','DÉCONNECTER',()=>{closeModal();showScreen('login');},'ANNULER',closeModal);}

function login(){
  showLoading();let i=0,prog=0;
  const bar=document.getElementById('ld-bar'),txt=document.getElementById('ld-text');
  const msgs=['Connexion...','Chargement du profil...','Synchronisation...','Prêt! 🎉'];
  const iv=setInterval(()=>{
    prog+=Math.random()*18+7;if(prog>100)prog=100;bar.style.width=prog+'%';
    if(prog>30&&i===0){txt.textContent=msgs[1];i=1;}if(prog>60&&i===1){txt.textContent=msgs[2];i=2;}if(prog>85&&i===2){txt.textContent=msgs[3];i=3;}
    if(prog>=100){clearInterval(iv);setTimeout(()=>{hideLoading();showScreen('home');updateCUI();initSocket();},400);}
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
  document.getElementById('m-icon').textContent=icon;document.getElementById('m-title').textContent=title;
  document.getElementById('m-msg').textContent=msg;
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

// Animated login coins
function initLoginCoins(){
  const wrap=document.getElementById('login-coins');if(!wrap)return;
  const items=['🪙','⭐','✨','🎲','💰'];
  for(let i=0;i<15;i++){
    const el=document.createElement('div');
    el.className='lc';el.textContent=items[Math.floor(Math.random()*items.length)];
    el.style.left=Math.random()*100+'%';
    el.style.animationDelay=Math.random()*8+'s';
    el.style.animationDuration=(4+Math.random()*8)+'s';
    el.style.fontSize=(14+Math.random()*16)+'px';
    wrap.appendChild(el);
  }
}

// Particles
function initParticles(){
  const c=document.getElementById('particles');if(!c)return;
  c.width=window.innerWidth;c.height=window.innerHeight;
  const ctx2=c.getContext('2d');
  const pts=Array.from({length:25},()=>({x:Math.random()*c.width,y:Math.random()*c.height,r:Math.random()*2+.5,vx:(Math.random()-.5)*.35,vy:-(Math.random()*.5+.1),op:Math.random()*.3+.04}));
  (function loop(){
    ctx2.clearRect(0,0,c.width,c.height);
    pts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.y<-8){p.y=c.height+8;p.x=Math.random()*c.width;}ctx2.save();ctx2.globalAlpha=p.op;ctx2.beginPath();ctx2.arc(p.x,p.y,p.r,0,Math.PI*2);ctx2.fillStyle='#FFD700';ctx2.fill();ctx2.restore();});
    requestAnimationFrame(loop);
  })();
  window.addEventListener('resize',()=>{c.width=window.innerWidth;c.height=window.innerHeight;});
}

initParticles();initLoginCoins();updateCUI();hideLoading();