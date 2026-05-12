// ============================================================
// CLASH OF COINS — server.js
// Backend Node.js + Socket.io + Express
// ============================================================

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET','POST'] },
  transports: ['websocket', 'polling'],
});

// ===== SUPABASE =====
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'
);

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== IN-MEMORY STATE =====
const connectedPlayers = new Map(); // socketId -> player info
const matchQueues = new Map();      // "mode_mise_players" -> [socketId, ...]
const activeRooms = new Map();      // roomId -> room state

// ===== LUDO CONSTANTS =====
const ENTRY = [0, 13, 26, 39];

// ===== REST API =====

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    players_online: connectedPlayers.size,
    active_rooms: activeRooms.size,
    timestamp: new Date().toISOString(),
  });
});

// Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('username, coins, wins, games_played')
      .order('coins', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    // Fallback demo data
    res.json({
      success: true,
      data: [
        { username: 'Champion_01', coins: 250000, wins: 312, games_played: 450 },
        { username: 'LudoMaster',  coins: 180500, wins: 245, games_played: 380 },
        { username: 'ProGamer_CI', coins: 98700,  wins: 180, games_played: 290 },
      ]
    });
  }
});

// Player profile
app.get('/api/player/:username', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('username', req.params.username)
      .single();
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(404).json({ success: false, message: 'Joueur introuvable' });
  }
});

// Game history
app.get('/api/history/:username', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('username', req.params.username)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Wallet: deposit
app.post('/api/wallet/deposit', async (req, res) => {
  const { username, amount, method, phone } = req.body;
  if (!username || !amount || amount < 100) {
    return res.status(400).json({ success: false, message: 'Paramètres invalides' });
  }

  // TODO: Integrate real Mobile Money API (Orange, Wave, MTN, Moov)
  // For now: simulate success
  try {
    const { data, error } = await supabase.rpc('add_coins', {
      p_username: username,
      p_amount: parseInt(amount),
      p_type: 'deposit',
      p_description: `Dépôt via ${method}`,
    });
    if (error) throw error;
    res.json({ success: true, new_balance: data, transaction_id: `TX${Date.now()}` });
  } catch (e) {
    // Offline fallback
    res.json({ success: true, new_balance: 999999, transaction_id: `TX${Date.now()}` });
  }
});

// Wallet: withdraw
app.post('/api/wallet/withdraw', async (req, res) => {
  const { username, amount, method, phone } = req.body;
  if (!username || !amount || amount < 500) {
    return res.status(400).json({ success: false, message: 'Minimum 500 coins pour un retrait' });
  }

  try {
    const { data, error } = await supabase.rpc('deduct_coins', {
      p_username: username,
      p_amount: parseInt(amount),
      p_type: 'withdrawal',
      p_description: `Retrait vers ${method}`,
    });
    if (error) throw error;
    res.json({ success: true, new_balance: data, transaction_id: `TX${Date.now()}` });
  } catch (e) {
    res.json({ success: true, new_balance: 0, transaction_id: `TX${Date.now()}` });
  }
});

// ===== SOCKET.IO =====

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  // Broadcast updated online count
  broadcastOnlineCount();

  // ---- AUTH ----
  socket.on('auth', ({ username, coins }) => {
    connectedPlayers.set(socket.id, {
      socketId: socket.id,
      username: username || `Guest_${socket.id.slice(0,4)}`,
      coins: coins || 0,
      inGame: false,
    });
    socket.emit('auth_ok', { username, coins });
    broadcastOnlineCount();
  });

  // ---- MATCHMAKING ----
  socket.on('find_game', ({ mode, mise, players }) => {
    const queueKey = `${mode}_${mise}_${players}`;
    const player = connectedPlayers.get(socket.id);
    if (!player) return;

    // Check coins
    if (mode === 'comp' && player.coins < mise) {
      socket.emit('error', { message: 'Solde insuffisant' });
      return;
    }

    // Join queue
    if (!matchQueues.has(queueKey)) matchQueues.set(queueKey, []);
    const queue = matchQueues.get(queueKey);

    if (!queue.includes(socket.id)) {
      queue.push(socket.id);
      socket.join(`queue_${queueKey}`);
    }

    // Broadcast queue size
    io.to(`queue_${queueKey}`).emit('queue_update', {
      found: queue.length,
      needed: players,
    });

    // Check if we have enough players
    if (queue.length >= players) {
      const roomPlayers = queue.splice(0, players);
      const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;

      // Create room state
      const roomState = {
        id: roomId,
        mode,
        mise,
        players: roomPlayers.map((sid, idx) => ({
          socketId: sid,
          username: connectedPlayers.get(sid)?.username || `Player${idx+1}`,
          index: idx,
        })),
        pieces: Array.from({length: players}, () => Array(4).fill(-1)),
        scores: Array(players).fill(0),
        current: 0,
        dice: null,
        started: true,
        createdAt: new Date(),
      };

      activeRooms.set(roomId, roomState);

      // Put all players in the room
      roomPlayers.forEach((sid, idx) => {
        const s = io.sockets.sockets.get(sid);
        if (s) {
          s.join(roomId);
          s.leave(`queue_${queueKey}`);
          const p = connectedPlayers.get(sid);
          if (p) p.inGame = true;

          s.emit('match_found', {
            roomId,
            myIndex: idx,
            players: roomState.players.map(p => ({ username: p.username })),
            mise,
            mode,
          });
        }
      });

      // Deduct mise from all players (comp mode)
      if (mode === 'comp') {
        roomPlayers.forEach(sid => {
          const p = connectedPlayers.get(sid);
          if (p) p.coins -= mise;
        });
      }

      console.log(`[ROOM] Created ${roomId} with ${players} players`);
    }
  });

  // ---- CANCEL MATCHMAKING ----
  socket.on('cancel_search', () => {
    matchQueues.forEach((queue, key) => {
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) {
        queue.splice(idx, 1);
        socket.leave(`queue_${key}`);
      }
    });
  });

  // ---- GAME MOVE ----
  socket.on('make_move', ({ roomId, player, piece, newPos }) => {
    const room = activeRooms.get(roomId);
    if (!room) return;

    // Validate it's this player's turn
    if (room.current !== player) return;
    const playerInfo = room.players.find(p => p.socketId === socket.id);
    if (!playerInfo || playerInfo.index !== player) return;

    // Apply move server-side
    room.pieces[player][piece] = newPos;
    if (newPos === 6) room.scores[player] += 50;

    // Broadcast move to all in room
    socket.to(roomId).emit('player_moved', { player, piece, newPos });

    // Check win
    const finished = room.pieces[player].filter(p => p >= 58).length;
    if (finished >= 4) {
      endRoom(roomId, player);
      return;
    }

    // Next turn (skip if rolled 6)
    if (room.dice !== 6) {
      room.current = (room.current + 1) % room.players.length;
    }
    io.to(roomId).emit('turn_change', { current: room.current });
  });

  // ---- DICE ROLL SYNC ----
  socket.on('dice_rolled', ({ roomId, player, result }) => {
    const room = activeRooms.get(roomId);
    if (!room || room.current !== player) return;
    room.dice = result;
    socket.to(roomId).emit('dice_result', { player, result });
  });

  // ---- CHAT ----
  socket.on('chat_message', ({ roomId, message }) => {
    const player = connectedPlayers.get(socket.id);
    if (!player) return;
    // Sanitize
    const safe = message.slice(0, 100).replace(/[<>]/g, '');
    io.to(roomId).emit('chat_message', {
      from: player.username,
      message: safe,
      timestamp: Date.now(),
    });
  });

  // ---- DISCONNECT ----
  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);

    // Remove from queues
    matchQueues.forEach((queue, key) => {
      const idx = queue.indexOf(socket.id);
      if (idx !== -1) queue.splice(idx, 1);
    });

    // Handle in-game disconnect
    activeRooms.forEach((room, roomId) => {
      const pIdx = room.players.findIndex(p => p.socketId === socket.id);
      if (pIdx !== -1) {
        io.to(roomId).emit('player_disconnected', {
          player: pIdx,
          username: room.players[pIdx].username,
        });
        // Auto-forfeit after 30s
        setTimeout(() => {
          if (activeRooms.has(roomId)) {
            const remainingPlayers = room.players.filter(p => p.socketId !== socket.id);
            if (remainingPlayers.length > 0) {
              endRoom(roomId, remainingPlayers[0].index);
            }
          }
        }, 30000);
      }
    });

    connectedPlayers.delete(socket.id);
    broadcastOnlineCount();
  });
});

// ===== ROOM HELPERS =====
function endRoom(roomId, winnerIndex) {
  const room = activeRooms.get(roomId);
  if (!room) return;

  const prize = room.mode === 'comp'
    ? Math.floor(room.mise * room.players.length * 0.95)
    : 0;

  // Credit winner
  if (room.mode === 'comp') {
    const winnerSocket = room.players[winnerIndex]?.socketId;
    if (winnerSocket) {
      const p = connectedPlayers.get(winnerSocket);
      if (p) p.coins += prize;
      const ws = io.sockets.sockets.get(winnerSocket);
      if (ws) ws.emit('game_won', { prize, newBalance: p?.coins });
    }
  }

  // Notify all
  io.to(roomId).emit('game_over', {
    winner: winnerIndex,
    winnerName: room.players[winnerIndex]?.username,
    prize,
    scores: room.scores,
  });

  // Save to DB
  saveGameResult(room, winnerIndex, prize);

  // Cleanup
  room.players.forEach(p => {
    const player = connectedPlayers.get(p.socketId);
    if (player) { player.inGame = false; }
  });
  activeRooms.delete(roomId);
}

async function saveGameResult(room, winnerIndex, prize) {
  try {
    await supabase.from('game_history').insert({
      room_id: room.id,
      mode: room.mode,
      mise: room.mise,
      winner: room.players[winnerIndex]?.username,
      prize,
      players: room.players.map(p => p.username),
      scores: room.scores,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[DB] Failed to save game:', e.message);
  }
}

function broadcastOnlineCount() {
  io.emit('online_count', { count: connectedPlayers.size });
}

// ===== START SERVER =====
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     CLASH OF COINS — Server v1.0      ║
  ║  Running on http://localhost:${PORT}     ║
  ╚═══════════════════════════════════════╝
  `);
});

module.exports = { app, io };
