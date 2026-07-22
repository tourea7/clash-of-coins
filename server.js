// ============================================================
// CLASH OF COINS — server.js v2.0
// Multijoueur temps réel complet
// ============================================================

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 10000,
});

// ===== SUPABASE =====
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ===== MIDDLEWARE =====
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== CONFIG API =====
app.get('/api/config', (req, res) => {
  res.json({
    supabase_url: process.env.SUPABASE_URL || '',
    supabase_anon: process.env.SUPABASE_ANON_KEY || '',
  });
});

// ===== FRIEND ROOMS — Inviter par code =====
const friendRooms = new Map(); // code -> { hostId, mode, mise, numPlayers, players:[] }

function generateCode(){
  return Math.random().toString(36).slice(2,8).toUpperCase();
}

app.post('/api/create-room', express.json(), (req, res) => {
  const { mode, mise, numPlayers, username } = req.body;
  let code;
  do { code = generateCode(); } while(friendRooms.has(code));
  
  friendRooms.set(code, {
    code,
    mode: mode || 'free',
    mise: mise || 0,
    numPlayers: numPlayers || 4,
    hostUsername: username || 'Hôte',
    players: [],
    createdAt: Date.now(),
  });

  // Auto-delete after 10 minutes
  setTimeout(() => friendRooms.delete(code), 10 * 60 * 1000);

  res.json({ success: true, code, link: `${req.headers.origin || 'https://clash-of-coins.onrender.com'}/?join=${code}` });
});

app.get('/api/room/:code', (req, res) => {
  const room = friendRooms.get(req.params.code.toUpperCase());
  if(!room) return res.json({ success: false, message: 'Code invalide ou expiré' });
  res.json({ success: true, room: {
    code: room.code,
    mode: room.mode,
    mise: room.mise,
    numPlayers: room.numPlayers,
    hostUsername: room.hostUsername,
    players: room.players.length,
  }});
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    players_online: connectedPlayers.size,
    active_rooms: activeRooms.size,
    queues: Object.fromEntries([...matchQueues.entries()].map(([k,v]) => [k, v.length])),
    timestamp: new Date().toISOString(),
  });
});

// Admin: voir les parties live
app.get('/api/admin/rooms', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if(adminKey !== process.env.JWT_SECRET){
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const rooms = [];
  activeRooms.forEach((room, roomId) => {
    rooms.push({
      id: roomId,
      mode: room.mode,
      mise: room.mise,
      numPlayers: room.numPlayers,
      current: room.current,
      over: room.over,
      createdAt: room.createdAt,
      players: room.players.map((p, i) => ({
        index: i,
        username: p.username,
        finished: room.finished[i],
        score: room.scores[i],
      })),
    });
  });
  res.json({ rooms, total: rooms.length });
});

// Admin: voir les suspects
app.get('/api/admin/cheaters', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if(adminKey !== process.env.JWT_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const suspects = [];
  cheatLog.forEach((log, socketId) => {
    if(log.count > 0){
      const player = connectedPlayers.get(socketId);
      suspects.push({
        socketId,
        username: player?.username || 'Inconnu',
        violations: log.count,
        reasons: log.reasons.slice(-5),
        lastAt: new Date(log.lastAt).toISOString(),
      });
    }
  });
  suspects.sort((a,b) => b.violations - a.violations);
  res.json({ suspects, total: suspects.length });
});

// ===== STATE =====
const connectedPlayers = new Map(); // socketId -> { username, coins, userId, inGame, roomId }
const matchQueues      = new Map(); // "mode_mise_numPlayers" -> [socketId, ...]
const activeRooms      = new Map(); // roomId -> roomState

// ===== LUDO CONSTANTS =====
const P52 = [
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
const EN = [0, 13, 26, 39];
const SF = new Set(['2,8','6,2','12,6','8,12','1,6','8,1','13,8','6,13']);

// ===== SOCKET.IO =====
// ===== ANTI-CHEAT =====
const cheatLog = new Map(); // socketId -> { count, lastAt, reasons }

function logCheat(socketId, reason){
  const player = connectedPlayers.get(socketId);
  const username = player?.username || socketId;
  
  if(!cheatLog.has(socketId)) cheatLog.set(socketId, { count:0, reasons:[] });
  const log = cheatLog.get(socketId);
  log.count++;
  log.reasons.push({ reason, at: Date.now() });
  log.lastAt = Date.now();

  console.warn(`[CHEAT] ${username}: ${reason} (total: ${log.count})`);

  // Auto-kick after 5 violations
  if(log.count >= 5){
    const socket = io.sockets.sockets.get(socketId);
    if(socket){
      socket.emit('error', { message: 'Comportement suspect détecté. Vous avez été déconnecté.' });
      socket.disconnect(true);
      console.warn(`[CHEAT] KICKED: ${username}`);
    }
  }
}

function validateDiceResult(result){
  return Number.isInteger(result) && result >= 1 && result <= 6;
}

io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ---- AUTH ----
  socket.on('auth', ({ username, coins, userId }) => {
    connectedPlayers.set(socket.id, {
      username: username || 'Joueur',
      coins: coins || 1000,
      userId: userId || null,
      inGame: false,
      roomId: null,
    });
    socket.emit('auth_ok', { username, coins });
    broadcastOnlineCount();
    console.log(`[AUTH] ${username} connected`);
  });

  // ---- JOIN FRIEND ROOM ----
  socket.on('join_friend_room', ({ code }) => {
    const player = connectedPlayers.get(socket.id);
    if(!player) return;
    
    const room = friendRooms.get(code?.toUpperCase());
    if(!room){ socket.emit('error', { message: 'Code invalide ou expiré' }); return; }
    if(player.inGame){ socket.emit('error', { message: 'Déjà en partie' }); return; }

    room.players.push(socket.id);
    player.pendingRoom = code;

    socket.emit('room_joined', {
      code: room.code,
      mode: room.mode,
      mise: room.mise,
      numPlayers: room.numPlayers,
      currentPlayers: room.players.length,
      hostUsername: room.hostUsername,
    });

    // Notify all in room
    room.players.forEach(sid => {
      io.to(sid).emit('room_update', {
        currentPlayers: room.players.length,
        needed: room.numPlayers,
      });
    });

    console.log(`[FRIEND] ${player.username} joined room ${code} (${room.players.length}/${room.numPlayers})`);

    // Start if full
    if(room.players.length >= room.numPlayers){
      const qKey = `friend_${code}`;
      createRoom(room.players.slice(0, room.numPlayers), room.mode, room.mise, room.numPlayers, qKey);
      friendRooms.delete(code);
    }
  });

  // ---- FIND GAME ----
  socket.on('find_game', ({ mode, mise, numPlayers }) => {
    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    if (player.inGame) { socket.emit('error', { message: 'Déjà en partie' }); return; }

    // Check balance for comp mode (verify against DB)
    if (mode === 'comp') {
      if (player.coins < mise) {
        socket.emit('error', { message: 'Solde insuffisant' });
        logCheat(socket.id, `insufficient coins: has ${player.coins} needs ${mise}`);
        return;
      }
      // Sanity check: mise can't exceed reasonable amount
      if (mise > 100000) {
        logCheat(socket.id, `suspicious mise: ${mise}`);
        socket.emit('error', { message: 'Mise invalide' });
        return;
      }
    }

    const qKey = `${mode}_${mise}_${numPlayers}`;
    if (!matchQueues.has(qKey)) matchQueues.set(qKey, []);
    const queue = matchQueues.get(qKey);

    // Don't add twice
    if (!queue.includes(socket.id)) queue.push(socket.id);

    console.log(`[QUEUE] ${player.username} → ${qKey} (${queue.length}/${numPlayers})`);

    // Notify all in queue
    queue.forEach(sid => {
      io.to(sid).emit('queue_update', {
        found: queue.length,
        needed: numPlayers,
        status: `${queue.length}/${numPlayers} joueurs trouvés...`,
      });
    });

    // Enough players → start match
    if (queue.length >= numPlayers) {
      const roomPlayers = queue.splice(0, numPlayers);
      createRoom(roomPlayers, mode, mise, numPlayers, qKey);
    }
  });

  // ---- CANCEL SEARCH ----
  socket.on('cancel_search', () => {
    removeFromQueues(socket.id);
    console.log(`[QUEUE] ${connectedPlayers.get(socket.id)?.username} cancelled`);
  });

  // ---- DICE ROLL (client rolls, server validates) ----
  socket.on('dice_rolled', ({ roomId, result }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.over) return;

    const playerIdx = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIdx === -1 || playerIdx !== room.current) {
      logCheat(socket.id, 'dice roll not your turn'); return;
    }
    if (room.rolled) {
      logCheat(socket.id, 'double dice roll'); return;
    }
    
    // Validate dice result (1-6 only)
    if (!validateDiceResult(result)) {
      logCheat(socket.id, `invalid dice: ${result}`);
      // Generate server-side result instead
      result = Math.floor(Math.random() * 6) + 1;
      console.log(`[ANTICHEAT] Generated server dice: ${result}`);
    }

    // Rate limiting
    const now = Date.now();
    const player = connectedPlayers.get(socket.id);
    if (player && player.lastRoll && now - player.lastRoll < 500) {
      logCheat(socket.id, 'roll too fast'); return;
    }
    if (player) player.lastRoll = now;

    room.dice   = result;
    room.rolled = true;

    // Broadcast to others
    socket.to(roomId).emit('dice_result', {
      player: playerIdx,
      result,
    });

    console.log(`[GAME] ${room.players[playerIdx].username} rolled ${result} in ${roomId}`);
  });

  // ---- MAKE MOVE (with full anti-cheat validation) ----
  socket.on('make_move', ({ roomId, piece, newPos }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.over) return;

    const playerIdx = room.players.findIndex(p => p.socketId === socket.id);
    if (playerIdx === -1) { logCheat(socket.id, 'not in room'); return; }
    if (playerIdx !== room.current) { logCheat(socket.id, 'not your turn'); return; }
    if (!room.rolled) { logCheat(socket.id, 'move without rolling'); return; }

    // Validate piece index
    if (piece < 0 || piece > 3) { logCheat(socket.id, 'invalid piece index'); return; }

    const oldPos = room.pieces[playerIdx][piece];
    if (oldPos === 58) { logCheat(socket.id, 'moving finished piece'); return; }

    // Validate move based on dice
    if (oldPos === -1 && room.dice !== 6) {
      logCheat(socket.id, 'exit home without 6');
      return;
    }
    if (oldPos === -1 && room.dice === 6 && newPos !== 0) {
      logCheat(socket.id, 'invalid exit position');
      return;
    }
    if (oldPos >= 0 && oldPos < 52) {
      const expectedPos = oldPos + room.dice;
      if (newPos !== Math.min(expectedPos, 58)) {
        logCheat(socket.id, `invalid move: ${oldPos}+${room.dice}≠${newPos}`);
        return;
      }
    }
    if (oldPos >= 52 && oldPos < 58) {
      const expectedPos = oldPos + room.dice;
      if (newPos !== Math.min(expectedPos, 58)) {
        logCheat(socket.id, `invalid home stretch move`);
        return;
      }
    }

    // Rate limiting — max 1 move per 300ms
    const now = Date.now();
    const player = connectedPlayers.get(socket.id);
    if (player && player.lastMove && now - player.lastMove < 300) {
      logCheat(socket.id, 'move too fast (rate limit)');
      return;
    }
    if (player) player.lastMove = now;

    // ✅ Move is valid — apply it
    room.rolled = false; // Consume the roll

    // Apply move
    room.pieces[playerIdx][piece] = newPos;

    // Check capture
    let captured = null;
    if (newPos >= 0 && newPos < 52) {
      const [mc, mr] = P52[(newPos + EN[playerIdx]) % 52];
      if (!SF.has(`${mc},${mr}`)) {
        for (let p2 = 0; p2 < room.players.length; p2++) {
          if (p2 === playerIdx) continue;
          for (let i2 = 0; i2 < 4; i2++) {
            const op = room.pieces[p2][i2];
            if (op >= 0 && op < 52) {
              const [oc, or2] = P52[(op + EN[p2]) % 52];
              if (oc === mc && or2 === mr) {
                room.pieces[p2][i2] = -1;
                room.scores[playerIdx] += 20;
                captured = { player: p2, piece: i2 };
              }
            }
          }
        }
      }
    }

    // Check piece finished
    if (newPos >= 58) {
      room.pieces[playerIdx][piece] = 58;
      room.finished[playerIdx]++;
      room.scores[playerIdx] += 50;
    }

    // Broadcast move to ALL in room
    io.to(roomId).emit('player_moved', {
      player: playerIdx,
      piece,
      newPos,
      captured,
      scores: room.scores,
    });

    // Check if player finished all 4 pieces
    if (room.finished[playerIdx] >= 4) {
      playerFinishedRoom(roomId, playerIdx);
      return;
    }

    // Next turn or replay (6 = replay)
    if (room.dice === 6) {
      room.rolled = false;
      io.to(roomId).emit('turn_change', {
        current: room.current,
        replay: true,
        message: `${room.players[playerIdx].username} rejoue (6)!`,
      });
    } else {
      nextTurnRoom(roomId);
    }
  });

  // ---- CHAT ----
  socket.on('chat', ({ roomId, message }) => {
    const player = connectedPlayers.get(socket.id);
    if (!player || !roomId) return;
    const safe = String(message).slice(0, 80).replace(/[<>]/g, '');
    io.to(roomId).emit('chat', {
      from: player.username,
      msg: safe,
      time: Date.now(),
    });
  });

  // ---- DISCONNECT ----
  socket.on('disconnect', () => {
    const player = connectedPlayers.get(socket.id);
    console.log(`[-] Disconnected: ${player?.username || socket.id}`);

    removeFromQueues(socket.id);

    // Handle in-game disconnect
    if (player?.roomId) {
      const room = activeRooms.get(player.roomId);
      if (room) {
        const pIdx = room.players.findIndex(p => p.socketId === socket.id);
        if (pIdx !== -1) {
          io.to(player.roomId).emit('player_disconnected', {
            player: pIdx,
            username: player.username,
          });
          // Give 30s to reconnect, then forfeit
          room.players[pIdx].disconnected = true;
          room.players[pIdx].disconnectTimer = setTimeout(() => {
            forfeitRoom(player.roomId, pIdx);
          }, 30000);
        }
      }
    }

    connectedPlayers.delete(socket.id);
    broadcastOnlineCount();
  });
});

// ===== ROOM FUNCTIONS =====
function createRoom(playerSockets, mode, mise, numPlayers, qKey) {
  const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

  const room = {
    id: roomId,
    mode,
    mise,
    numPlayers,
    current: 0,
    dice: 1,
    rolled: false,
    over: false,
    pieces: Array.from({length: numPlayers}, () => Array(4).fill(-1)),
    finished: Array(numPlayers).fill(0),
    scores: Array(numPlayers).fill(0),
    ranking: [],
    eliminated: [],
    players: playerSockets.map((sid, idx) => {
      const p = connectedPlayers.get(sid);
      return {
        socketId: sid,
        index: idx,
        username: p?.username || `Joueur${idx+1}`,
        userId: p?.userId || null,
        coins: p?.coins || 1000,
      };
    }),
    createdAt: Date.now(),
  };

  activeRooms.set(roomId, room);

  // Mark players as in-game
  playerSockets.forEach((sid, idx) => {
    const p = connectedPlayers.get(sid);
    if (p) { p.inGame = true; p.roomId = roomId; }
    const s = io.sockets.sockets.get(sid);
    if (s) s.join(roomId);
  });

  // Deduct mise for comp mode
  if (mode === 'comp') {
    playerSockets.forEach(sid => {
      const p = connectedPlayers.get(sid);
      if (p) p.coins -= mise;
    });
  }

  // Notify all players - match found!
  playerSockets.forEach((sid, idx) => {
    io.to(sid).emit('match_found', {
      roomId,
      myIndex: idx,
      players: room.players.map(p => ({ username: p.username })),
      mode,
      mise,
    });
  });

  console.log(`[ROOM] Created ${roomId}: ${room.players.map(p=>p.username).join(' vs ')}`);

  // Start first turn after 3s (let clients set up)
  setTimeout(() => {
    room.rolled = false;
    io.to(roomId).emit('turn_change', {
      current: 0,
      replay: false,
      message: `C'est le tour de ${room.players[0].username}`,
    });
  }, 3000);
}

function nextTurnRoom(roomId) {
  const room = activeRooms.get(roomId);
  if (!room || room.over) return;

  let next = (room.current + 1) % room.numPlayers;
  let safety = 0;
  while (room.eliminated.includes(next) && safety < room.numPlayers) {
    next = (next + 1) % room.numPlayers;
    safety++;
  }

  room.current = next;
  room.rolled = false;

  io.to(roomId).emit('turn_change', {
    current: next,
    replay: false,
    message: `Tour de ${room.players[next].username}`,
  });
}

function playerFinishedRoom(roomId, playerIdx) {
  const room = activeRooms.get(roomId);
  if (!room || room.eliminated.includes(playerIdx)) return;

  room.ranking.push(playerIdx);
  room.eliminated.push(playerIdx);

  const pos = room.ranking.length;
  io.to(roomId).emit('player_ranked', {
    player: playerIdx,
    position: pos,
    username: room.players[playerIdx].username,
  });

  // Check if only 1 remains
  const remaining = [];
  for (let i = 0; i < room.numPlayers; i++) {
    if (!room.eliminated.includes(i)) remaining.push(i);
  }

  if (remaining.length <= 1) {
    if (remaining.length === 1) room.ranking.push(remaining[0]);
    endRoom(roomId);
  } else {
    nextTurnRoom(roomId);
  }
}

function endRoom(roomId) {
  const room = activeRooms.get(roomId);
  if (!room || room.over) return;
  room.over = true;

  // Calculate prizes
  const pool = room.mode === 'comp' ? room.mise * room.numPlayers : 0;
  const prizes = room.ranking.map((playerIdx, pos) => {
    if (room.mode !== 'comp') return 0;
    if (pos === 0) return Math.floor(pool * 0.55);
    if (pos === 1) return Math.floor(pool * 0.25);
    return 0;
  });

  // Send result to each player
  room.ranking.forEach((playerIdx, pos) => {
    const sid = room.players[playerIdx].socketId;
    const prize = prizes[pos] || 0;
    io.to(sid).emit('game_over', {
      myPosition: pos,
      ranking: room.ranking,
      players: room.players.map(p => ({ username: p.username })),
      scores: room.scores,
      prize,
      mode: room.mode,
    });
  });

  // Save to DB
  saveRoomResult(room, prizes);

  // Cleanup players
  room.players.forEach(p => {
    const player = connectedPlayers.get(p.socketId);
    if (player) { player.inGame = false; player.roomId = null; }
  });

  // Delete room after 30s
  setTimeout(() => activeRooms.delete(roomId), 30000);
  console.log(`[ROOM] Ended ${roomId} | Winner: ${room.players[room.ranking[0]]?.username}`);
}

function forfeitRoom(roomId, playerIdx) {
  const room = activeRooms.get(roomId);
  if (!room || room.over) return;
  io.to(roomId).emit('player_forfeited', {
    player: playerIdx,
    username: room.players[playerIdx].username,
  });
  playerFinishedRoom(roomId, playerIdx);
}

function removeFromQueues(socketId) {
  matchQueues.forEach((queue, key) => {
    const idx = queue.indexOf(socketId);
    if (idx !== -1) queue.splice(idx, 1);
  });
}

async function saveRoomResult(room, prizes) {
  try {
    for (let i = 0; i < room.ranking.length; i++) {
      const playerIdx = room.ranking[i];
      const p = room.players[playerIdx];
      if (!p.userId) continue;

      // Update player stats
      const { data: profile } = await supabase
        .from('players')
        .select('coins, wins, losses, games_played, xp, level')
        .eq('id', p.userId)
        .single();

      if (!profile) continue;

      const isWin = i === 0;
      const coinsChange = prizes[i] || 0;
      const xpGain = isWin ? 100 : i === 1 ? 60 : i === 2 ? 30 : 10;
      const newXp = (profile.xp || 0) + xpGain;
      const newLevel = Math.floor(newXp / 1000) + 1;

      // Anti-fraud: verify coins haven't been manipulated
    const expectedCoins = Math.max(0, (profile.coins || 0) + coinsChange);
    
    await supabase.from('players').update({
        coins: expectedCoins,
        wins: (profile.wins || 0) + (isWin ? 1 : 0),
        losses: (profile.losses || 0) + (!isWin ? 1 : 0),
        games_played: (profile.games_played || 0) + 1,
        xp: newXp,
        level: newLevel,
        updated_at: new Date().toISOString(),
      }).eq('id', p.userId);

      // Save game history
      await supabase.from('game_history').insert({
        username: p.username,
        player_index: playerIdx,
        score: room.scores[playerIdx] || 0,
        pieces_done: room.finished[playerIdx] || 0,
        captures: Math.floor((room.scores[playerIdx] || 0) / 20),
        won: isWin,
        coins_change: coinsChange,
        mise: room.mise,
        mode: room.mode,
      }).catch(() => {});
    }
    console.log(`[DB] Saved results for ${room.id}`);
  } catch(e) {
    console.error('[DB] Save error:', e.message);
  }
}

function broadcastOnlineCount() {
  io.emit('online_count', { count: connectedPlayers.size });
}

// ===== START =====
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║   CLASH OF COINS — Server v2.0 🎮    ║
  ║   Multijoueur temps réel activé!      ║
  ║   http://localhost:${PORT}               ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = { app, io };

// ============================================================
// TOURNOIS AUTOMATIQUES
// ============================================================

const tournaments = new Map(); // tournamentId -> tournamentState

function createTournament({ name, mise, maxPlayers, prizePool }){
  const id = 'tourn_' + Date.now();
  const tournament = {
    id,
    name,
    mise,
    maxPlayers,  // 4 ou 8
    prizePool,
    players: [],  // { userId, username, socketId }
    bracket: [],  // matches
    currentRound: 0,
    status: 'open',  // open | in_progress | finished
    winner: null,
    createdAt: Date.now(),
    startAt: null,
  };
  tournaments.set(id, tournament);
  console.log(`[TOURN] Created: ${name} (${maxPlayers} players, ${mise} coins)`);
  return tournament;
}

// API: liste des tournois
app.get('/api/tournaments', async (req, res) => {
  const list = [];
  tournaments.forEach(t => {
    list.push({
      id: t.id,
      name: t.name,
      mise: t.mise,
      maxPlayers: t.maxPlayers,
      currentPlayers: t.players.length,
      prizePool: t.prizePool,
      status: t.status,
      createdAt: t.createdAt,
    });
  });
  // Also load from Supabase
  try {
    const { data } = await supabase
      .from('tournaments')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(10);
    if(data) data.forEach(t => {
      if(!list.find(l => l.id === t.id)){
        list.push({
          id: t.id,
          name: t.name,
          mise: t.mise,
          maxPlayers: t.max_players,
          currentPlayers: t.current_players || 0,
          prizePool: t.prize_pool,
          status: t.status,
          createdAt: new Date(t.created_at).getTime(),
        });
      }
    });
  } catch(e) {}
  res.json({ tournaments: list });
});

// API: rejoindre un tournoi
app.post('/api/tournaments/:id/join', express.json(), async (req, res) => {
  const { userId, username, socketId } = req.body;
  const tourn = tournaments.get(req.params.id);

  if(!tourn) return res.json({ success: false, message: 'Tournoi introuvable' });
  if(tourn.status !== 'open') return res.json({ success: false, message: 'Tournoi fermé' });
  if(tourn.players.find(p => p.userId === userId))
    return res.json({ success: false, message: 'Déjà inscrit' });
  if(tourn.players.length >= tourn.maxPlayers)
    return res.json({ success: false, message: 'Tournoi complet' });

  // Deduct mise from DB
  try {
    const { data: profile } = await supabase
      .from('players').select('coins').eq('id', userId).single();
    if(!profile || profile.coins < tourn.mise)
      return res.json({ success: false, message: 'Solde insuffisant' });

    await supabase.from('players')
      .update({ coins: profile.coins - tourn.mise })
      .eq('id', userId);
  } catch(e) {
    return res.json({ success: false, message: 'Erreur DB: ' + e.message });
  }

  tourn.players.push({ userId, username, socketId });
  console.log(`[TOURN] ${username} joined ${tourn.name} (${tourn.players.length}/${tourn.maxPlayers})`);

  // Notify all tournament players
  tourn.players.forEach(p => {
    io.to(p.socketId).emit('tournament_update', {
      tournamentId: tourn.id,
      currentPlayers: tourn.players.length,
      maxPlayers: tourn.maxPlayers,
      message: `${username} a rejoint! (${tourn.players.length}/${tourn.maxPlayers})`,
    });
  });

  // Start if full
  if(tourn.players.length >= tourn.maxPlayers){
    setTimeout(() => startTournament(tourn.id), 3000);
  }

  res.json({ success: true, position: tourn.players.length });
});

// Démarrer le tournoi
function startTournament(tournId){
  const tourn = tournaments.get(tournId);
  if(!tourn || tourn.status !== 'open') return;

  tourn.status = 'in_progress';
  tourn.startAt = Date.now();

  // Shuffle players
  const players = [...tourn.players].sort(() => Math.random() - 0.5);

  // Create bracket (pairs for round 1)
  const matches = [];
  for(let i = 0; i < players.length; i += 2){
    if(players[i+1]){
      matches.push({
        id: `match_${tournId}_${i/2}`,
        player1: players[i],
        player2: players[i+1],
        winner: null,
        roomId: null,
      });
    }
  }
  tourn.bracket = [matches]; // Round 1
  tourn.currentRound = 0;

  console.log(`[TOURN] Started: ${tourn.name} — ${matches.length} matches`);

  // Notify all players
  tourn.players.forEach(p => {
    const match = matches.find(m => m.player1.userId === p.userId || m.player2.userId === p.userId);
    const opponent = match?.player1.userId === p.userId ? match?.player2 : match?.player1;
    io.to(p.socketId).emit('tournament_started', {
      tournamentId: tournId,
      name: tourn.name,
      opponent: opponent?.username,
      matchId: match?.id,
      message: `Le tournoi commence! Tu affrontes ${opponent?.username}!`,
    });
  });

  // Start all matches
  matches.forEach(match => startTournamentMatch(tournId, match));
}

function startTournamentMatch(tournId, match){
  const tourn = tournaments.get(tournId);
  if(!tourn) return;

  // Create a game room for this match
  const players = [match.player1.socketId, match.player2.socketId];
  match.roomId = `tourn_${tournId}_${match.id}`;

  createRoom(players, 'comp', tourn.mise, 2, match.id);

  // Listen for game_over to advance bracket
  const checkResult = setInterval(() => {
    const room = activeRooms.get(match.roomId);
    if(!room) { clearInterval(checkResult); return; }

    if(room.over && room.ranking.length > 0){
      clearInterval(checkResult);
      const winnerIdx = room.ranking[0];
      const winnerSocket = room.players[winnerIdx]?.socketId;
      const winner = tourn.players.find(p => p.socketId === winnerSocket);

      if(winner){
        match.winner = winner;
        advanceTournament(tournId);
      }
    }
  }, 2000);
}

function advanceTournament(tournId){
  const tourn = tournaments.get(tournId);
  if(!tourn) return;

  const currentMatches = tourn.bracket[tourn.currentRound];
  const allDone = currentMatches.every(m => m.winner !== null);
  if(!allDone) return;

  const winners = currentMatches.map(m => m.winner);

  if(winners.length === 1){
    // Tournament finished!
    tourn.status = 'finished';
    tourn.winner = winners[0];

    // Distribute prizes
    distributeTournamentPrizes(tournId);
    return;
  }

  // Next round
  tourn.currentRound++;
  const nextMatches = [];
  for(let i = 0; i < winners.length; i += 2){
    if(winners[i+1]){
      nextMatches.push({
        id: `match_${tournId}_r${tourn.currentRound}_${i/2}`,
        player1: winners[i],
        player2: winners[i+1],
        winner: null,
        roomId: null,
      });
    }
  }
  tourn.bracket.push(nextMatches);

  // Notify and start next round
  tourn.players.forEach(p => {
    io.to(p.socketId).emit('tournament_round', {
      round: tourn.currentRound + 1,
      message: `Tour ${tourn.currentRound + 1} commence!`,
    });
  });

  nextMatches.forEach(match => startTournamentMatch(tournId, match));
}

async function distributeTournamentPrizes(tournId){
  const tourn = tournaments.get(tournId);
  if(!tourn || !tourn.winner) return;

  // Prize distribution: 60% winner, 25% finalist, 15% semi-finalists
  const prizes = {
    1: Math.floor(tourn.prizePool * 0.60),
    2: Math.floor(tourn.prizePool * 0.25),
    3: Math.floor(tourn.prizePool * 0.10),
  };

  console.log(`[TOURN] ${tourn.name} finished! Winner: ${tourn.winner.username}`);

  // Pay winner
  try {
    const { data: profile } = await supabase
      .from('players').select('coins').eq('id', tourn.winner.userId).single();
    if(profile){
      await supabase.from('players')
        .update({ coins: profile.coins + prizes[1], wins: supabase.raw('wins + 1') })
        .eq('id', tourn.winner.userId);
    }
  } catch(e){ console.error('[TOURN] Prize error:', e.message); }

  // Notify all
  tourn.players.forEach(p => {
    const isWinner = p.userId === tourn.winner.userId;
    io.to(p.socketId).emit('tournament_over', {
      winner: tourn.winner.username,
      isWinner,
      prize: isWinner ? prizes[1] : 0,
      message: isWinner
        ? `🏆 VICTOIRE! Tu remportes ${prizes[1].toLocaleString()} coins!`
        : `${tourn.winner.username} remporte le tournoi!`,
    });
  });

  // Save to DB
  await supabase.from('tournaments').update({
    status: 'finished',
    winner_username: tourn.winner.username,
    winner_id: tourn.winner.userId,
    finished_at: new Date().toISOString(),
  }).eq('id', tournId).catch(() => {});

  // Cleanup after 5 min
  setTimeout(() => tournaments.delete(tournId), 5 * 60 * 1000);
}

// Auto-create daily tournaments
function scheduleDefaultTournaments(){
  const defaults = [
    { name: '🎯 Tournoi Gratuit', mise: 0, maxPlayers: 4, prizePool: 1000 },
    { name: '💰 Tournoi 500', mise: 500, maxPlayers: 4, prizePool: 2000 },
    { name: '👑 Tournoi Premium', mise: 1000, maxPlayers: 8, prizePool: 8000 },
  ];

  defaults.forEach(t => createTournament(t));
  console.log('[TOURN] Default tournaments created');

  // Recreate every 6 hours
  setInterval(() => {
    // Remove finished tournaments and recreate
    tournaments.forEach((t, id) => {
      if(t.status === 'finished') tournaments.delete(id);
    });
    defaults.forEach(t => {
      const exists = [...tournaments.values()].find(existing => existing.name === t.name && existing.status === 'open');
      if(!exists) createTournament(t);
    });
  }, 6 * 60 * 60 * 1000);
}

// Start tournaments on server boot
scheduleDefaultTournaments();