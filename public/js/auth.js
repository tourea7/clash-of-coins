// ============================================================
// CLASH OF COINS — auth.js
// Gestion de session Supabase côté client
// Inclure AVANT game.js dans index.html
// ============================================================

// Supabase config (même valeurs que auth.html)
const SUPABASE_URL  = 'https://zkmlcqrsvzgngvtihakl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprbWxjcXJzdnpnbmd2dGloYWtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1ODIxMzMsImV4cCI6MjA5NDE1ODEzM30.m9oRQUdfzT_qTQ5TI14UpP0L2vE2CiATG_-GBzBh_l8';

// Init Supabase client (SDK chargé via CDN dans index.html)
let _supabase = null;
function getSupabase(){
  if(!_supabase) _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
  return _supabase;
}

// ===== SESSION COURANTE =====
let CURRENT_USER = null;  // données Supabase auth
let CURRENT_PROFILE = null;  // données table players

// Vérifie la session au chargement
async function initAuth(){
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();

  if(!session){
    // Pas connecté → redirige vers la page de connexion
    window.location.href = '/auth.html';
    return false;
  }

  CURRENT_USER = session.user;

  // Charge le profil joueur depuis la BDD
  await loadProfile();

  // Écoute les changements de session
  sb.auth.onAuthStateChange(async (event, session) => {
    if(event === 'SIGNED_OUT' || !session){
      window.location.href = '/auth.html';
    } else if(event === 'TOKEN_REFRESHED'){
      CURRENT_USER = session.user;
    }
  });

  return true;
}

async function loadProfile(){
  const sb = getSupabase();
  const { data, error } = await sb.from('players')
    .select('*')
    .eq('id', CURRENT_USER.id)
    .single();

  if(error || !data){
    // Crée le profil si inexistant (cas Google OAuth)
    const username = CURRENT_USER.user_metadata?.username ||
                     CURRENT_USER.email?.split('@')[0] ||
                     'Player_' + Math.random().toString(36).slice(2,6);
    const { data: newProfile } = await getSupabase().from('players').insert({
      id: CURRENT_USER.id,
      username,
      email: CURRENT_USER.email,
      avatar_url: CURRENT_USER.user_metadata?.avatar || '👑',
      coins: 1000,
      level: 1, xp: 0, wins: 0, losses: 0, games_played: 0,
    }).select().single();
    CURRENT_PROFILE = newProfile;
  } else {
    CURRENT_PROFILE = data;
  }

  // Injecte le profil dans STATE (défini dans game.js)
  if(typeof STATE !== 'undefined' && CURRENT_PROFILE){
    STATE.coins = CURRENT_PROFILE.coins || 1000;
    STATE.username = CURRENT_PROFILE.username || 'Joueur';
    STATE.initials = (CURRENT_PROFILE.username || 'JR').slice(0,2).toUpperCase();
    STATE.userId = CURRENT_PROFILE.id;
    STATE.avatar = CURRENT_PROFILE.avatar_url || '👑';
    STATE.level = CURRENT_PROFILE.level || 1;
    STATE.xp = CURRENT_PROFILE.xp || 0;
    STATE.wins = CURRENT_PROFILE.wins || 0;
    STATE.games_played = CURRENT_PROFILE.games_played || 0;
  }
}

// ===== SYNC COINS AVEC LA BDD =====
async function syncCoinsToDb(newAmount){
  if(!CURRENT_USER || !CURRENT_PROFILE) return;
  const sb = getSupabase();
  await sb.from('players')
    .update({ coins: Math.max(0, Math.round(newAmount)), updated_at: new Date().toISOString() })
    .eq('id', CURRENT_USER.id);
  if(CURRENT_PROFILE) CURRENT_PROFILE.coins = newAmount;
}

// ===== SAVE TRANSACTION =====
async function saveTransaction(type, desc, amount){
  if(!CURRENT_USER) return;
  const sb = getSupabase();
  await sb.from('transactions').insert({
    player_id: CURRENT_USER.id,
    username: CURRENT_PROFILE?.username || '',
    type,
    amount,
    description: desc,
    status: 'completed',
  });
}

// ===== SAVE GAME RESULT =====
async function saveGameResult(data){
  if(!CURRENT_USER) return;
  const sb = getSupabase();
  // Update player stats
  await sb.from('players').update({
    games_played: (CURRENT_PROFILE?.games_played || 0) + 1,
    wins: (CURRENT_PROFILE?.wins || 0) + (data.won ? 1 : 0),
    losses: (CURRENT_PROFILE?.losses || 0) + (data.won ? 0 : 1),
    xp: (CURRENT_PROFILE?.xp || 0) + (data.won ? 100 : 25),
    coins: Math.max(0, (CURRENT_PROFILE?.coins || 0) + data.coinsChange),
    updated_at: new Date().toISOString(),
  }).eq('id', CURRENT_USER.id);
}

// ===== LOAD LEADERBOARD =====
async function loadLeaderboard(){
  const sb = getSupabase();
  const { data } = await sb.from('players')
    .select('username, coins, wins, games_played, level, avatar_url')
    .order('coins', { ascending: false })
    .limit(10);
  return data || [];
}

// ===== LOAD TRANSACTIONS =====
async function loadTransactions(){
  if(!CURRENT_USER) return [];
  const sb = getSupabase();
  const { data } = await sb.from('transactions')
    .select('*')
    .eq('player_id', CURRENT_USER.id)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

// ===== LOGOUT =====
async function doLogout(){
  await getSupabase().auth.signOut();
  window.location.href = '/auth.html';
}

// ===== UPDATE UI WITH REAL PROFILE =====
function updateProfileUI(){
  if(!CURRENT_PROFILE) return;

  // Top bar
  const tbAv = document.getElementById('tb-av');
  if(tbAv) tbAv.textContent = CURRENT_PROFILE.avatar_url || '👑';

  const tbName = document.querySelector('.tb-name');
  if(tbName) tbName.textContent = CURRENT_PROFILE.username;

  // XP bar
  const xpFill = document.querySelector('.xp-fill');
  if(xpFill){
    const xpPct = Math.min(100, ((CURRENT_PROFILE.xp % 1000) / 1000) * 100);
    xpFill.style.width = xpPct + '%';
  }
  const xpTxt = document.querySelector('.xp-txt');
  if(xpTxt) xpTxt.textContent = `${CURRENT_PROFILE.xp%1000}/1000`;

  // Level badge
  const lvBadge = document.querySelector('.tb-lv');
  if(lvBadge) lvBadge.textContent = 'Niv.' + (CURRENT_PROFILE.level||1);

  // Profile screen
  const profAv = document.querySelector('.prof-av');
  if(profAv) profAv.textContent = CURRENT_PROFILE.avatar_url || '👑';

  const profName = document.querySelector('.prof-name');
  if(profName) profName.textContent = CURRENT_PROFILE.username;

  const profLv = document.querySelector('.prof-lv-badge');
  if(profLv) profLv.textContent = 'Niveau ' + (CURRENT_PROFILE.level||1);

  // Stats
  const statEls = {
    'stat-parties': CURRENT_PROFILE.games_played || 0,
    'stat-victoires': CURRENT_PROFILE.wins || 0,
    'stat-taux': CURRENT_PROFILE.games_played > 0
      ? Math.round((CURRENT_PROFILE.wins/CURRENT_PROFILE.games_played)*100)+'%'
      : '0%',
    'profile-coins': (CURRENT_PROFILE.coins||0).toLocaleString('fr-FR'),
  };
  // Update stat cards by index
  const scVals = document.querySelectorAll('.sc-val');
  if(scVals[0]) scVals[0].textContent = CURRENT_PROFILE.games_played || 0;
  if(scVals[1]) scVals[1].textContent = CURRENT_PROFILE.wins || 0;
  if(scVals[2]) scVals[2].textContent = CURRENT_PROFILE.games_played > 0
    ? Math.round((CURRENT_PROFILE.wins/CURRENT_PROFILE.games_played)*100)+'%' : '0%';
  if(scVals[3]) scVals[3].textContent = (CURRENT_PROFILE.coins||0).toLocaleString('fr-FR');
}

// ===== LOAD REAL LEADERBOARD INTO UI =====
async function renderRealLeaderboard(){
  const lb = await loadLeaderboard();
  const lbCard = document.querySelector('.lb-card');
  if(!lbCard || !lb.length) return;

  const medals = ['🥇','🥈','🥉'];
  const rows = lb.slice(0,4).map((p,i) => {
    const isMe = p.username === CURRENT_PROFILE?.username;
    return `<div class="lb-row" ${isMe?'style="background:rgba(255,215,0,.04)"':''}>
      <div class="lb-rank">${i+1}</div>
      <div class="lb-av" style="background:rgba(255,255,255,.06);font-size:${medals[i]?'16':'12'}px">${medals[i]||p.avatar_url||'👤'}</div>
      <div class="lb-info">
        <div class="lb-name">${isMe?'<b style="color:var(--gold)">Vous</b>':p.username}</div>
        <div class="lb-stats">${p.games_played||0} parties · ${p.wins||0} victoires</div>
      </div>
      <div class="lb-coins-val">${(p.coins||0).toLocaleString('fr-FR')} 🪙</div>
    </div>`;
  }).join('');

  const hdr = lbCard.querySelector('.lb-hdr');
  lbCard.innerHTML = '';
  if(hdr) lbCard.appendChild(hdr);
  lbCard.innerHTML += rows;
}

// ===== REAL TRANSACTIONS =====
async function renderRealTransactions(){
  const txs = await loadTransactions();
  const list = document.getElementById('tx-list');
  if(!list) return;

  if(!txs.length){
    list.innerHTML = '<div style="text-align:center;padding:20px;color:rgba(255,255,255,.3);font-size:13px">Aucune transaction</div>';
    return;
  }

  list.innerHTML = txs.map(t => {
    const isGain = t.amount > 0;
    const date = new Date(t.created_at).toLocaleDateString('fr-FR', {day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    return `<div class="tx-row">
      <div class="tx-icon ${isGain?'tx-g':'tx-l'}">${isGain?'↑':'↓'}</div>
      <div class="tx-info"><div class="tx-desc">${t.description||t.type}</div><div class="tx-date">${date}</div></div>
      <div class="tx-amt ${isGain?'tx-pos':'tx-neg'}">${isGain?'+':''}${t.amount.toLocaleString('fr-FR')} 🪙</div>
    </div>`;
  }).join('');
}
