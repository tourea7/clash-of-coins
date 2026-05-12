// ============================================================
// CLASH OF COINS — game.js
// Frontend game logic, Ludo engine, Socket.io client
// ============================================================

// ===== STATE =====
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
    { type:'gain', desc:'Partie gagnée', date:'Aujourd\'hui 14:35', amount:2500 },
    { type:'loss', desc:'Mise de partie', date:'Aujourd\'hui 14:30', amount:-1000 },
    { type:'gain', desc:'Dépôt (Orange Money)', date:'Aujourd\'hui 13:20', amount:5000 },
    { type:'gain', desc:'Partie gagnée', date:'Hier 12:10', amount:1800 },
    { type:'loss', desc:'Retrait (Wave)', date:'Hier 18:40', amount:-3000 },
    { type:'gain', desc:'Partie gagnée', date:'Il y a 2j', amount:950 },
  ],
};

// ===== LUDO GAME STATE =====
const GAME = {
  players: 4,
  current: 0,
  dice: 1,
  rolled: false,
  over: false,
  pieces: [],       // [player][piece] = position index (-1=base, 0..51=main, 52..57=homestretch)
  finished: [],     // pieces finished per player
  scores: [0,0,0,0],
  movable: [],
  waitMove: false,
  onlineMode: false,
};

const COLORS = ['#6688ff','#ff5555','#44dd66','#FFD700'];
const COLOR_HOMES = ['#0d1655','#5a0e0e','#0d3d1a','#3a2c00'];
const DICE_FACES = ['⚀','⚁','⚂','⚃','⚄','⚅'];
const AI_NAMES = ['QueenLudo','LuckyStar','KingLudo','DiceKing'];

// Ludo 15×15 grid. Main path: 52 squares, indexed 0–51.
// Piece position: -1 = home base, 0–51 = main track, 52–57 = home stretch, 58 = finished
const G = 15; // grid size
// [col, row] for each of the 52 main path squares
const MAIN_PATH = [
  [6,13],[6,12],[6,11],[6,10],[6,9],[6,8],  // 0-5 col6 going up from bottom
  [5,8],[4,8],[3,8],[2,8],[1,8],[0,8],       // 6-11 row8 going left
  [0,7],[0,6],                                // 12-13 col0 going up
  [1,6],[2,6],[3,6],[4,6],[5,6],[6,6],       // 14-19 row6 going right
  [6,5],[6,4],[6,3],[6,2],[6,1],[6,0],       // 20-25 col6 going up
  [7,0],[8,0],                                // 26-27 row0 going right
  [8,1],[8,2],[8,3],[8,4],[8,5],[8,6],       // 28-33 col8 going down
  [9,6],[10,6],[11,6],[12,6],[13,6],[14,6],  // 34-39 row6 going right
  [14,7],[14,8],                              // 40-41 col14 going down
  [13,8],[12,8],[11,8],[10,8],[9,8],[8,8],   // 42-47 row8 going left
  [8,9],[8,10],[8,11],[8,12],[8,13],[8,14],  // 48-53 -> but we only use 52, so 48-51 then home
];

// Fixed: main path has exactly 52 entries (indices 0-51)
const PATH52 = MAIN_PATH.slice(0,52);

// Home stretches (6 squares toward center), one per player
const HOME_STRETCH = [
  [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],  // blue (P0) going up col7
  [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],       // red (P1) going right row7
  [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],       // green (P2) going down col7
  [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],   // yellow (P3) going left row7
];

// Base positions for 4 pieces per player
const BASE_POS = [
  [[2,2],[3,2],[2,3],[3,3]],
  [[11,2],[12,2],[11,3],[12,3]],
  [[2,11],[3,11],[2,12],[3,12]],
  [[11,11],[12,11],[11,12],[12,12]],
];

// Entry point on main path for each player
const ENTRY = [0, 13, 26, 39];

// Safe squares (star positions) — no captures here
const SAFE = new Set(['1,8','6,2','8,1','13,6','13,8','8,13','6,13','1,6']);

// ===== CANVAS =====
let canvas, ctx, cellSize;

function setupCanvas() {
  canvas = document.getElementById('board-canvas');
  const maxSize = Math.min(
    window.innerWidth - 24,
    window.innerHeight - 280,
    380
  );
  canvas.width = maxSize;
  canvas.height = maxSize;
  cellSize = maxSize / G;
  ctx = canvas.getContext('2d');
  canvas.addEventListener('click', onBoardClick);
  drawBoard();
}

function initGame(nPlayers) {
  GAME.players = nPlayers;
  GAME.current = 0;
  GAME.dice = 1;
  GAME.rolled = false;
  GAME.over = false;
  GAME.waitMove = false;
  GAME.movable = [];
  GAME.scores = Array(4).fill(0);
  GAME.pieces = Array.from({length:4}, () => Array(4).fill(-1));
  GAME.finished = Array(4).fill(0);
}

// ===== DRAWING =====
function drawBoard() {
  if (!ctx) return;
  const W = canvas.width;
  const c = cellSize;

  ctx.clearRect(0, 0, W, W);
  ctx.fillStyle = '#0a0a16';
  ctx.fillRect(0, 0, W, W);

  // Draw all cells
  for (let r = 0; r < G; r++) {
    for (let col = 0; col < G; col++) {
      const x = col * c, y = r * c;
      let fill = '#13132a';
      let stroke = '#1e1e3a';
      let sw = 0.5;

      // Home zones (corners 6×6 → actually 5×5 inner rect at 1..5, 1..5)
      if (col < 6 && r < 6) fill = '#0b1045';
      else if (col > 8 && r < 6) fill = '#45080b';
      else if (col < 6 && r > 8) fill = '#0b3518';
      else if (col > 8 && r > 8) fill = '#3a2c00';
      // Blue home stretch
      else if (col === 7 && r >= 1 && r <= 6) { fill = '#1a2066'; stroke = '#3a5aff'; }
      // Red home stretch
      else if (r === 7 && col >= 1 && col <= 6) { fill = '#661515'; stroke = '#cc2222'; }
      // Green home stretch
      else if (col === 7 && r >= 8 && r <= 13) { fill = '#0d3318'; stroke = '#22aa44'; }
      // Yellow home stretch
      else if (r === 7 && col >= 8 && col <= 13) { fill = '#3a2800'; stroke = '#D4AF37'; }
      // Safe squares
      else if (SAFE.has(`${col},${r}`)) { fill = '#1a1a0a'; stroke = '#D4AF37'; sw = 1; }

      ctx.fillStyle = fill;
      roundRect(ctx, x + 0.5, y + 0.5, c - 1, c - 1, 2);
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = sw;
      ctx.stroke();
    }
  }

  // Inner home squares (raised)
  drawHomeSquare(1, 1, '#0d1660', '#3a5aff');    // blue
  drawHomeSquare(9, 1, '#601010', '#cc2222');    // red
  drawHomeSquare(1, 9, '#0d4020', '#22aa44');    // green
  drawHomeSquare(9, 9, '#4a3800', '#D4AF37');    // yellow

  // Center star
  drawCenterStar();

  // Draw pieces
  for (let p = 0; p < GAME.players; p++) {
    for (let i = 0; i < 4; i++) {
      drawPiece(p, i);
    }
  }

  // Highlight movable pieces
  if (GAME.waitMove) {
    GAME.movable.forEach(m => {
      const {x, y} = getPieceXY(m.player, m.piece);
      ctx.beginPath();
      ctx.arc(x, y, c * 0.42, 0, Math.PI * 2);
      ctx.strokeStyle = '#FFD700';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Pulsing glow
      ctx.beginPath();
      ctx.arc(x, y, c * 0.48, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,215,0,0.3)';
      ctx.lineWidth = 3;
      ctx.stroke();
    });
  }
}

function drawHomeSquare(col, row, fill, stroke) {
  const c = cellSize, m = c * 0.12;
  ctx.fillStyle = fill;
  roundRect(ctx, col * c + m, row * c + m, c * 4 - m * 2, c * 4 - m * 2, 8);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawCenterStar() {
  const c = cellSize;
  const cx = 7.5 * c, cy = 7.5 * c, s = 1.5 * c;

  ctx.fillStyle = '#0a0a16';
  roundRect(ctx, 6 * c + 1, 6 * c + 1, 3 * c - 2, 3 * c - 2, 6);
  ctx.fill();

  const tri = (x1,y1,x2,y2,x3,y3,color) => {
    ctx.beginPath();
    ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.lineTo(x3,y3);
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  };
  tri(cx, cy-s, cx-s*0.7, cy, cx+s*0.7, cy, 'rgba(102,136,255,0.75)'); // top blue
  tri(cx+s, cy, cx, cy-s*0.7, cx, cy+s*0.7, 'rgba(204,34,34,0.75)');   // right red
  tri(cx, cy+s, cx+s*0.7, cy, cx-s*0.7, cy, 'rgba(68,221,102,0.75)');  // bottom green
  tri(cx-s, cy, cx, cy+s*0.7, cx, cy-s*0.7, 'rgba(255,215,0,0.75)');   // left yellow

  ctx.beginPath();
  ctx.arc(cx, cy, c * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0a16'; ctx.fill();
  ctx.strokeStyle = '#D4AF37'; ctx.lineWidth = 1.5; ctx.stroke();

  ctx.fillStyle = '#D4AF37';
  ctx.font = `bold ${Math.floor(c * 0.7)}px Rajdhani, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('C', cx, cy + 1);
}

function drawPiece(player, piece) {
  const {x, y} = getPieceXY(player, piece);
  const c = cellSize;
  const r = c * 0.32;
  const color = COLORS[player];

  // Shadow
  ctx.beginPath();
  ctx.arc(x, y + 1.5, r, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  // Piece body
  const grad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.1, x, y, r);
  grad.addColorStop(0, lighten(color, 50));
  grad.addColorStop(1, color);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = darken(color, 40);
  ctx.lineWidth = 1; ctx.stroke();

  // Piece number
  ctx.fillStyle = '#fff';
  ctx.font = `bold ${Math.floor(r)}px Rajdhani, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(piece + 1, x, y + 0.5);

  // Current player glow
  if (player === GAME.current && !GAME.rolled) {
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = `${color}66`;
    ctx.lineWidth = 2; ctx.stroke();
  }
}

function getPieceXY(player, piece) {
  const pos = GAME.pieces[player][piece];
  const c = cellSize;
  let col, row;

  if (pos === -1) {
    [col, row] = BASE_POS[player][piece];
  } else if (pos >= 52) {
    const si = pos - 52;
    if (si < 6) [col, row] = HOME_STRETCH[player][si];
    else { col = 7; row = 7; }
  } else {
    const main = (pos + ENTRY[player]) % 52;
    [col, row] = PATH52[main];
  }

  // Offset multiple pieces on same cell
  const sameCell = [];
  for (let p = 0; p < GAME.players; p++) {
    for (let i = 0; i < 4; i++) {
      if (p === player && i === piece) continue;
      const opos = GAME.pieces[p][i];
      let oc, or2;
      if (opos === -1) [oc, or2] = BASE_POS[p][i];
      else if (opos >= 52) {
        const si = opos - 52;
        if (si < 6) [oc, or2] = HOME_STRETCH[p][si];
        else { oc = 7; or2 = 7; }
      } else {
        const main = (opos + ENTRY[p]) % 52;
        [oc, or2] = PATH52[main];
      }
      if (oc === col && or2 === row) sameCell.push({p, i});
    }
  }

  const offsets = [[0,0],[0.3,0],[-0.3,0],[0,0.3]];
  const myIdx = sameCell.length < 3 ? 0 : sameCell.indexOf({player,piece});
  const off = offsets[Math.min(myIdx, 3)];

  return {
    x: (col + 0.5 + off[0] * 0.35) * c,
    y: (row + 0.5 + off[1] * 0.35) * c,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function lighten(hex, amt) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + amt);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + amt);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + amt);
  return `rgb(${r},${g},${b})`;
}

function darken(hex, amt) {
  const r = Math.max(0, parseInt(hex.slice(1,3),16) - amt);
  const g = Math.max(0, parseInt(hex.slice(3,5),16) - amt);
  const b = Math.max(0, parseInt(hex.slice(5,7),16) - amt);
  return `rgb(${r},${g},${b})`;
}

// ===== GAME LOGIC =====
function getMovable(player, dice) {
  const moves = [];
  for (let i = 0; i < 4; i++) {
    const pos = GAME.pieces[player][i];
    if (pos === 58) continue; // already finished
    if (pos === -1) {
      if (dice === 6) moves.push({ player, piece: i, newPos: 0 });
    } else {
      const newPos = pos + dice;
      if (newPos <= 58) moves.push({ player, piece: i, newPos });
    }
  }
  return moves;
}

function onBoardClick(e) {
  if (!GAME.waitMove) return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);

  for (let idx = 0; idx < GAME.movable.length; idx++) {
    const m = GAME.movable[idx];
    const {x, y} = getPieceXY(m.player, m.piece);
    if (Math.hypot(mx - x, my - y) < cellSize * 0.5) {
      applyMove(m.player, m.piece, m.newPos);
      return;
    }
  }
}

function applyMove(player, piece, newPos) {
  GAME.pieces[player][piece] = newPos;
  GAME.waitMove = false;
  GAME.movable = [];

  // Check capture
  if (newPos >= 0 && newPos < 52) {
    const [myCol, myRow] = PATH52[(newPos + ENTRY[player]) % 52];
    if (!SAFE.has(`${myCol},${myRow}`)) {
      for (let p2 = 0; p2 < GAME.players; p2++) {
        if (p2 === player) continue;
        for (let i2 = 0; i2 < 4; i2++) {
          const opos = GAME.pieces[p2][i2];
          if (opos >= 0 && opos < 52) {
            const [oc, or2] = PATH52[(opos + ENTRY[p2]) % 52];
            if (oc === myCol && or2 === myRow) {
              GAME.pieces[p2][i2] = -1;
              GAME.scores[player] += 20;
              const pname = player === 0 ? 'Vous capturez' : `${AI_NAMES[player-1]} capture`;
              setLog(`${pname} une pièce! +20 pts`);
            }
          }
        }
      }
    }
  }

  // Check finish
  if (newPos >= 58) {
    GAME.pieces[player][piece] = 58;
    GAME.finished[player]++;
    GAME.scores[player] += 50;
    setLog(`Pièce ${piece+1} de ${player === 0 ? 'Vous' : AI_NAMES[player-1]} arrive! +50 pts`);
    if (GAME.finished[player] >= 4) {
      endGame(player);
      return;
    }
  }

  updateScoreUI();
  drawBoard();

  // Bonus turn on 6
  if (GAME.dice === 6) {
    setLog(`${player === 0 ? 'Vous rejouez' : AI_NAMES[player-1]+' rejoue'} (6)!`);
    if (player !== 0) setTimeout(() => aiTurn(player), 900);
    else { GAME.rolled = false; enableRoll(); }
  } else {
    setTimeout(nextTurn, 700);
  }
}

function rollDice() {
  if (GAME.rolled || GAME.over) return;
  GAME.rolled = true;
  disableRoll();

  const diceEl = document.getElementById('dice-el');
  diceEl.classList.add('rolling');

  let count = 0;
  const anim = setInterval(() => {
    diceEl.textContent = DICE_FACES[Math.floor(Math.random() * 6)];
    if (++count >= 10) {
      clearInterval(anim);
      diceEl.classList.remove('rolling');
      const result = Math.floor(Math.random() * 6) + 1;
      GAME.dice = result;
      diceEl.textContent = DICE_FACES[result - 1];

      const movable = getMovable(0, result);
      if (movable.length === 0) {
        setLog(`Vous lancez ${result} — aucun mouvement possible`);
        setTimeout(nextTurn, 1200);
      } else if (movable.length === 1) {
        setLog(`Vous lancez ${result}`);
        setTimeout(() => applyMove(movable[0].player, movable[0].piece, movable[0].newPos), 400);
      } else {
        GAME.movable = movable;
        GAME.waitMove = true;
        setLog(`Vous lancez ${result} — touchez une pièce pour la déplacer`);
        drawBoard();
      }
    }
  }, 70);
}

function nextTurn() {
  GAME.current = (GAME.current + 1) % GAME.players;
  GAME.rolled = false;
  updateActivePlayer();

  if (GAME.current === 0) {
    setLog('Votre tour — lancez le dé!');
    enableRoll();
  } else {
    const name = AI_NAMES[GAME.current - 1];
    setLog(`Tour de ${name}...`);
    disableRoll();
    setTimeout(() => aiTurn(GAME.current), 1000);
  }
}

function aiTurn(player) {
  if (GAME.over || GAME.current !== player) return;
  const result = Math.floor(Math.random() * 6) + 1;
  GAME.dice = result;
  document.getElementById('dice-el').textContent = DICE_FACES[result - 1];
  setLog(`${AI_NAMES[player-1]} lance ${result}`);

  setTimeout(() => {
    const movable = getMovable(player, result);
    if (movable.length > 0) {
      // AI strategy: prefer captures, then advancing, then entering
      let best = movable[0];
      for (const m of movable) {
        if (m.newPos > best.newPos) best = m;
      }
      applyMove(best.player, best.piece, best.newPos);
    } else {
      if (result === 6) setTimeout(() => aiTurn(player), 800);
      else setTimeout(nextTurn, 600);
    }
  }, 600);
}

function endGame(winner) {
  GAME.over = true;
  const isMe = winner === 0;
  const prize = isMe
    ? Math.floor(STATE.currentMise * STATE.numPlayers * 0.95)
    : 0;

  if (STATE.currentMode === 'comp') {
    if (isMe) {
      STATE.coins += prize;
      addTransaction('gain', 'Partie gagnée', prize);
    } else {
      STATE.coins -= STATE.currentMise;
      addTransaction('loss', 'Partie perdue', -STATE.currentMise);
    }
    updateCoinsUI();
  } else if (isMe) {
    const freeReward = 200;
    STATE.coins += freeReward;
    addTransaction('gain', 'Bonus partie gratuite', freeReward);
    updateCoinsUI();
  }

  setTimeout(() => {
    const name = winner === 0 ? 'Vous' : AI_NAMES[winner - 1];
    showModal(
      isMe ? '🏆' : '😤',
      isMe ? 'VICTOIRE!' : 'DÉFAITE',
      isMe ? `Félicitations! Vous avez dominé la partie!` : `${name} a gagné. Prenez votre revanche!`,
      isMe
        ? (STATE.currentMode === 'comp' ? `+${prize.toLocaleString()} 🪙` : '+200 🪙')
        : (STATE.currentMode === 'comp' ? `-${STATE.currentMise.toLocaleString()} 🪙` : ''),
      'Rejouer', () => { closeModal(); findGame(); },
      'Quitter', () => { closeModal(); showScreen('home'); }
    );
  }, 500);
}

// ===== UI HELPERS =====
function setLog(msg) { document.getElementById('game-log').textContent = msg; }
function enableRoll() { document.getElementById('roll-btn').disabled = false; }
function disableRoll() { document.getElementById('roll-btn').disabled = true; }

function updateActivePlayer() {
  for (let i = 0; i < 4; i++) {
    const av = document.getElementById(`pa-${i}`);
    if (av) av.classList.toggle('my-turn', i === GAME.current);
  }
}

function updateScoreUI() {
  for (let i = 0; i < 4; i++) {
    const el = document.getElementById(`ps-${i}`);
    if (el) el.textContent = `${GAME.scores[i]} pts`;
  }
}

function updateCoinsUI() {
  const fmt = n => Math.round(n).toLocaleString('fr-FR');
  STATE.coins = Math.max(0, STATE.coins);
  document.getElementById('coins-display').textContent = fmt(STATE.coins);
  document.getElementById('bal-display').textContent = fmt(STATE.coins) + ' 🪙';
  document.getElementById('wallet-amount').textContent = fmt(STATE.coins) + ' 🪙';
  const profCoins = document.getElementById('profile-coins');
  if (profCoins) profCoins.textContent = fmt(STATE.coins);
  const myLb = document.getElementById('my-lb-coins');
  if (myLb) myLb.textContent = fmt(STATE.coins) + ' 🪙';
}

function addTransaction(type, desc, amount) {
  const now = new Date();
  const date = `Aujourd'hui ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  STATE.transactions.unshift({ type, desc, date, amount });
}

function renderTransactions() {
  const list = document.getElementById('tx-list');
  if (!list) return;
  list.innerHTML = STATE.transactions.slice(0, 10).map(t => `
    <div class="tx-row">
      <div class="tx-icon ${t.amount > 0 ? 'tx-gain' : 'tx-loss'}">${t.amount > 0 ? '✅' : '❌'}</div>
      <div style="flex:1">
        <div class="tx-desc">${t.desc}</div>
        <div class="tx-date">${t.date}</div>
      </div>
      <div class="tx-amount ${t.amount > 0 ? 'tx-pos' : 'tx-neg'}">${t.amount > 0 ? '+' : ''}${t.amount.toLocaleString('fr-FR')} 🪙</div>
    </div>
  `).join('');
}

// ===== NAVIGATION =====
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('scr-' + name);
  if (el) {
    el.classList.add('active');
    if (name === 'wallet') renderTransactions();
    if (name === 'game') updateActivePlayer();
  }
}

function navTo(name, btn) {
  showScreen(name);
  const navs = document.querySelectorAll('.nav-item');
  navs.forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function startMode(mode) {
  STATE.currentMode = mode;
  showScreen('mode');
  const ms = document.getElementById('mise-section');
  const gp = document.getElementById('gain-preview');
  if (mode === 'free') { ms.style.display = 'none'; gp.style.display = 'none'; }
  else { ms.style.display = 'block'; gp.style.display = 'block'; updateGainPreview(); }
}

function setModeTab(t) {
  document.getElementById('tab-rapide').classList.toggle('active', t === 'rapide');
  document.getElementById('tab-amis').classList.toggle('active', t === 'amis');
}

function setPlayers(n) {
  STATE.numPlayers = n;
  [2,3,4].forEach(x => document.getElementById(`pb${x}`).classList.toggle('active', x === n));
  updateGainPreview();
}

function setMise(m) {
  STATE.currentMise = m;
  [100,500,1000,5000].forEach(x => document.getElementById(`mb${x}`).classList.toggle('active', x === m));
  updateGainPreview();
}

function updateGainPreview() {
  const potential = Math.floor(STATE.currentMise * STATE.numPlayers * 0.95);
  document.getElementById('gp-val').textContent = potential.toLocaleString('fr-FR') + ' 🪙';
}

function findGame() {
  if (STATE.currentMode === 'comp' && STATE.coins < STATE.currentMise) {
    showToast('⚠️ Solde insuffisant pour cette mise!');
    return;
  }
  // Try real matchmaking via socket, fall back to local AI
  if (STATE.socket && STATE.socket.connected) {
    startMatchmaking();
  } else {
    startLocalGame();
  }
}

function startLocalGame() {
  showScreen('game');
  document.getElementById('g-np').textContent = STATE.numPlayers;
  document.getElementById('g-mise').textContent =
    STATE.currentMode === 'free' ? 'Gratuit' : STATE.currentMise.toLocaleString('fr-FR') + ' 🪙';

  initGame(STATE.numPlayers);
  setupCanvas();

  // Hide unused player cards
  for (let i = 0; i < 4; i++) {
    const pi = document.getElementById(`pi-${i}`);
    if (pi) pi.style.display = i < STATE.numPlayers ? 'flex' : 'none';
  }

  GAME.rolled = false;
  enableRoll();
  setLog('Votre tour — lancez le dé!');
}

function startMatchmaking() {
  showScreen('matchmaking');
  document.getElementById('mm-needed').textContent = STATE.numPlayers;
  document.getElementById('mm-mise').textContent =
    STATE.currentMode === 'free' ? 'Gratuit' : STATE.currentMise.toLocaleString('fr-FR') + ' 🪙';
  document.getElementById('mm-status').textContent = 'Recherche de joueurs...';
  document.getElementById('mm-found').textContent = '1';

  STATE.socket.emit('find_game', {
    mode: STATE.currentMode,
    mise: STATE.currentMise,
    players: STATE.numPlayers,
  });

  // Timeout: fall back to AI after 15 seconds
  STATE.mmTimeout = setTimeout(() => {
    showToast('Pas assez de joueurs — mode IA activé');
    startLocalGame();
  }, 15000);
}

function cancelMatchmaking() {
  if (STATE.mmTimeout) clearTimeout(STATE.mmTimeout);
  if (STATE.socket) STATE.socket.emit('cancel_search');
  showScreen('mode');
}

function confirmQuit() {
  showModal(
    '⚠️', 'QUITTER?',
    STATE.currentMode === 'comp' ? 'Vous perdrez votre mise si vous quittez maintenant.' : 'Voulez-vous vraiment quitter?',
    STATE.currentMode === 'comp' ? `-${STATE.currentMise.toLocaleString('fr-FR')} 🪙` : '',
    'Continuer', closeModal,
    'Quitter', () => {
      closeModal();
      if (STATE.currentMode === 'comp' && !GAME.over) {
        STATE.coins -= STATE.currentMise;
        addTransaction('loss', 'Abandon de partie', -STATE.currentMise);
        updateCoinsUI();
      }
      showScreen('home');
    }
  );
}

// ===== WALLET ACTIONS =====
function doDeposit() {
  const amount = 5000;
  STATE.coins += amount;
  addTransaction('gain', 'Dépôt (Orange Money)', amount);
  updateCoinsUI();
  renderTransactions();
  showToast(`✅ +${amount.toLocaleString('fr-FR')} coins déposés!`);
}

function doWithdraw() {
  if (STATE.coins < 1000) {
    showToast('⚠️ Solde insuffisant pour un retrait!');
    return;
  }
  const amount = 1000;
  STATE.coins -= amount;
  addTransaction('loss', 'Retrait vers Wave', -amount);
  updateCoinsUI();
  renderTransactions();
  showToast(`💸 ${amount.toLocaleString('fr-FR')} coins retirés vers Wave`);
}

function selectPM(pm) {
  const names = { orange:'Orange Money', moov:'Moov Money', mtn:'MTN Money', wave:'Wave' };
  showToast(`💳 ${names[pm]} sélectionné`);
}

function joinTournament(id) {
  showModal(
    '🏅', 'REJOINDRE LE TOURNOI',
    'Confirmez votre inscription à ce tournoi.',
    '-1 000 🪙',
    'Confirmer', () => {
      STATE.coins -= 1000;
      addTransaction('loss', 'Inscription tournoi', -1000);
      updateCoinsUI();
      closeModal();
      showToast('🏅 Inscrit au tournoi!');
    },
    'Annuler', closeModal
  );
}

function showHistorique() {
  showScreen('wallet');
}

function logout() {
  showModal(
    '🚪', 'DÉCONNEXION',
    'Voulez-vous vous déconnecter?', '',
    'Se déconnecter', () => { closeModal(); showScreen('login'); },
    'Annuler', closeModal
  );
}

// ===== LOGIN =====
function login(method) {
  showLoading();
  const msgs = ['Connexion...', 'Chargement du profil...', 'Synchronisation du wallet...', 'Prêt!'];
  let i = 0, prog = 0;
  const bar = document.getElementById('ld-bar');
  const txt = document.getElementById('ld-text');
  const iv = setInterval(() => {
    prog += Math.random() * 18 + 7;
    if (prog > 100) prog = 100;
    bar.style.width = prog + '%';
    if (prog > 30 && i === 0) { txt.textContent = msgs[1]; i = 1; }
    if (prog > 60 && i === 1) { txt.textContent = msgs[2]; i = 2; }
    if (prog > 85 && i === 2) { txt.textContent = msgs[3]; i = 3; }
    if (prog >= 100) {
      clearInterval(iv);
      setTimeout(() => {
        hideLoading();
        showScreen('home');
        updateCoinsUI();
        initSocket();
      }, 400);
    }
  }, 100);
}

// ===== SOCKET.IO =====
function initSocket() {
  // Try to connect to server
  try {
    STATE.socket = io({ transports: ['websocket', 'polling'], timeout: 5000 });

    STATE.socket.on('connect', () => {
      STATE.socket.emit('auth', { username: STATE.username, coins: STATE.coins });
      updateOnlineCount();
    });

    STATE.socket.on('online_count', ({ count }) => {
      const el = document.getElementById('online-count');
      if (el) el.textContent = count.toLocaleString('fr-FR');
    });

    STATE.socket.on('match_found', ({ roomId, players, myIndex }) => {
      clearTimeout(STATE.mmTimeout);
      STATE.roomId = roomId;
      STATE.myPlayerIndex = myIndex;
      // Update player names from real players
      players.forEach((p, idx) => {
        const nm = document.getElementById(`pn-${idx}`);
        if (nm) nm.textContent = idx === myIndex ? 'Vous' : p.username;
        const av = document.getElementById(`pa-${idx}`);
        if (av) av.textContent = p.username.slice(0,2).toUpperCase();
      });
      showToast('🎮 Partie trouvée!');
      startLocalGame();
    });

    STATE.socket.on('player_moved', ({ player, piece, newPos }) => {
      if (player !== STATE.myPlayerIndex) {
        applyMove(player, piece, newPos);
      }
    });

    STATE.socket.on('disconnect', () => {
      showToast('⚠️ Connexion perdue — mode hors ligne activé');
    });

  } catch (e) {
    // No server available, play offline
    STATE.socket = null;
  }
}

function updateOnlineCount() {
  // Animate random online count for demo
  const el = document.getElementById('online-count');
  if (el && !STATE.socket?.connected) {
    setInterval(() => {
      const base = 247;
      el.textContent = (base + Math.floor(Math.random() * 30 - 10)).toLocaleString('fr-FR');
    }, 5000);
  }
}

// ===== MODAL =====
function showModal(icon, title, msg, coins, btn1txt, btn1fn, btn2txt, btn2fn) {
  document.getElementById('m-icon').textContent = icon;
  document.getElementById('m-title').textContent = title;
  document.getElementById('m-msg').textContent = msg;
  document.getElementById('m-coins').textContent = coins;
  document.getElementById('m-coins').style.display = coins ? 'block' : 'none';
  const b1 = document.getElementById('m-btn1');
  const b2 = document.getElementById('m-btn2');
  b1.textContent = btn1txt; b1.onclick = btn1fn;
  b2.textContent = btn2txt; b2.onclick = btn2fn;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

// ===== TOAST =====
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ===== LOADING =====
function showLoading() { document.getElementById('loading').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading').classList.add('hidden'); }

// ===== PARTICLES =====
function initParticles() {
  const c = document.getElementById('particles');
  if (!c) return;
  c.width = window.innerWidth;
  c.height = window.innerHeight;
  const ctx2 = c.getContext('2d');
  const pts = Array.from({length:25}, () => ({
    x: Math.random() * c.width,
    y: Math.random() * c.height,
    r: Math.random() * 2 + 0.5,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(Math.random() * 0.4 + 0.1),
    op: Math.random() * 0.35 + 0.05,
  }));
  (function loop() {
    ctx2.clearRect(0, 0, c.width, c.height);
    pts.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5) { p.y = c.height + 5; p.x = Math.random() * c.width; }
      ctx2.beginPath();
      ctx2.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx2.fillStyle = `rgba(212,175,55,${p.op})`;
      ctx2.fill();
    });
    requestAnimationFrame(loop);
  })();
  window.addEventListener('resize', () => {
    c.width = window.innerWidth;
    c.height = window.innerHeight;
  });
}

// ===== INIT =====
initParticles();
updateCoinsUI();
hideLoading(); // Will show on login
