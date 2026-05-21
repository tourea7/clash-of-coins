// ============================================================
// CLASH OF COINS — auth.js v2
// Chargement sécurisé des clés depuis le serveur
// ============================================================

let _supabase = null;
let CURRENT_USER = null;
let CURRENT_PROFILE = null;

// Charge la config depuis le serveur (les clés ne sont jamais dans le code)
async function getSupabase(){
  if(_supabase) return _supabase;
  try {
    const res = await fetch('/api/config');
    const config = await res.json();
    _supabase = window.supabase.createClient(config.supabase_url, config.supabase_anon);
  } catch(e) {
    console.error('Config load failed:', e);
    // Fallback pour développement local
    _supabase = window.supabase.createClient(
      'https://zkmlcqrsvzgngvtihakl.supabase.co',
      window.__SUPABASE_ANON__ || ''
    );
  }
  return _supabase;
}

// Vérifie la session au chargement
async function initAuth(){
  const sb = await getSupabase();
  const { data: { session } } = await sb.auth.getSession();

  if(!session){
    window.location.href = '/auth.html';
    return false;
  }

  CURRENT_USER = session.user;
  await loadProfile();

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
  const sb = await getSupabase();
  const { data, error } = await sb.from('players')
    .select('*')
    .eq('id', CURRENT_USER.id)
    .single();

  if(error || !data){
    // Build username from Google name or email
    const googleName = CURRENT_USER.user_metadata?.full_name ||
                       CURRENT_USER.user_metadata?.name || '';
    const username = CURRENT_USER.user_metadata?.username ||
                     googleName.replace(/\s+/g, '_').slice(0, 20) ||
                     CURRENT_USER.email?.split('@')[0] ||
                     'Player_' + Math.random().toString(36).slice(2,6);

    const avatar = CURRENT_USER.user_metadata?.avatar_url ? '🌐' : '👑';

    const { data: newProfile } = await sb.from('players').upsert({
      id: CURRENT_USER.id,
      username,
      email: CURRENT_USER.email,
      avatar_url: avatar,
      coins: 1000,
      level: 1, xp: 0, wins: 0, losses: 0, games_played: 0,
    }, { onConflict: 'id' }).select().single();
    CURRENT_PROFILE = newProfile;
  } else {
    CURRENT_PROFILE = data;
  }

  if(typeof STATE !== 'undefined' && CURRENT_PROFILE){
    STATE.coins        = CURRENT_PROFILE.coins || 1000;
    STATE.username     = CURRENT_PROFILE.username || 'Joueur';
    STATE.initials     = (CURRENT_PROFILE.username || 'JR').slice(0,2).toUpperCase();
    STATE.userId       = CURRENT_PROFILE.id;
    STATE.avatar       = CURRENT_PROFILE.avatar_url || '👑';
    STATE.level        = CURRENT_PROFILE.level || 1;
    STATE.xp           = CURRENT_PROFILE.xp || 0;
    STATE.wins         = CURRENT_PROFILE.wins || 0;
    STATE.games_played = CURRENT_PROFILE.games_played || 0;
    // Update topbar avatar initials
    const tbAv = document.getElementById('tb-av');
    if(tbAv) tbAv.textContent = STATE.initials;
    const tbName = document.querySelector('.tb-name');
    if(tbName) tbName.textContent = STATE.username;
  }
}

async function syncCoinsToDb(newAmount){
  if(!CURRENT_USER || !CURRENT_PROFILE) return;
  const sb = await getSupabase();
  await sb.from('players')
    .update({ coins: Math.max(0, Math.round(newAmount)), updated_at: new Date().toISOString() })
    .eq('id', CURRENT_USER.id);
  if(CURRENT_PROFILE) CURRENT_PROFILE.coins = newAmount;
}

async function saveTransaction(type, desc, amount){
  if(!CURRENT_USER) return;
  const sb = await getSupabase();
  await sb.from('transactions').insert({
    player_id: CURRENT_USER.id,
    username: CURRENT_PROFILE?.username || '',
    type, amount,
    description: desc,
    status: 'completed',
  });
}

async function saveGameResult(data){
  if(!CURRENT_USER) return;
  const sb = await getSupabase();
  await sb.from('players').update({
    games_played: (CURRENT_PROFILE?.games_played || 0) + 1,
    wins: (CURRENT_PROFILE?.wins || 0) + (data.won ? 1 : 0),
    losses: (CURRENT_PROFILE?.losses || 0) + (data.won ? 0 : 1),
    xp: (CURRENT_PROFILE?.xp || 0) + (data.won ? 100 : 25),
    coins: Math.max(0, (CURRENT_PROFILE?.coins || 0) + data.coinsChange),
    updated_at: new Date().toISOString(),
  }).eq('id', CURRENT_USER.id);
}

async function loadLeaderboard(){
  const sb = await getSupabase();
  const { data } = await sb.from('players')
    .select('username, coins, wins, games_played, level, avatar_url')
    .order('coins', { ascending: false })
    .limit(10);
  return data || [];
}

async function loadTransactions(){
  if(!CURRENT_USER) return [];
  const sb = await getSupabase();
  const { data } = await sb.from('transactions')
    .select('*')
    .eq('player_id', CURRENT_USER.id)
    .order('created_at', { ascending: false })
    .limit(20);
  return data || [];
}

async function doLogout(){
  const sb = await getSupabase();
  await sb.auth.signOut();
  window.location.href = '/auth.html';
}

function updateProfileUI(){
  if(!CURRENT_PROFILE) return;
  const username = CURRENT_PROFILE.username || 'Joueur';
  const initials = username.slice(0,2).toUpperCase();
  const avatar = CURRENT_PROFILE.avatar_url || '👑';

  // Topbar avatar - show initials if no emoji avatar
  const tbAv = document.getElementById('tb-av');
  if(tbAv) tbAv.textContent = ['👑','🦁','🐯','🦊','🐺','🦅','🐲','💎','⚡','🔥','🌙','⭐','🌐'].includes(avatar) ? avatar : initials;

  const tbName = document.querySelector('.tb-name');
  if(tbName) tbName.textContent = username;
  const xpFill = document.querySelector('.xp-fill');
  if(xpFill) xpFill.style.width = Math.min(100,((CURRENT_PROFILE.xp%1000)/1000)*100)+'%';
  const xpTxt = document.querySelector('.xp-txt');
  if(xpTxt) xpTxt.textContent = `${CURRENT_PROFILE.xp%1000}/1000`;
  const lvBadge = document.querySelector('.tb-lv');
  if(lvBadge) lvBadge.textContent = 'Niv.'+(CURRENT_PROFILE.level||1);
  const profAv = document.querySelector('.prof-av');
  if(profAv) profAv.textContent = CURRENT_PROFILE.avatar_url || '👑';
  const profName = document.querySelector('.prof-name');
  if(profName) profName.textContent = CURRENT_PROFILE.username;
  const profLv = document.querySelector('.prof-lv-badge');
  if(profLv) profLv.textContent = 'Niveau '+(CURRENT_PROFILE.level||1);
  const scVals = document.querySelectorAll('.sc-val');
  if(scVals[0]) scVals[0].textContent = CURRENT_PROFILE.games_played || 0;
  if(scVals[1]) scVals[1].textContent = CURRENT_PROFILE.wins || 0;
  if(scVals[2]) scVals[2].textContent = CURRENT_PROFILE.games_played > 0
    ? Math.round((CURRENT_PROFILE.wins/CURRENT_PROFILE.games_played)*100)+'%' : '0%';
  if(scVals[3]) scVals[3].textContent = (CURRENT_PROFILE.coins||0).toLocaleString('fr-FR');
}

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
  lbCard.insertAdjacentHTML('beforeend', rows);
}

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
    const date = new Date(t.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
    return `<div class="tx-row">
      <div class="tx-icon ${isGain?'tx-g':'tx-l'}">${isGain?'↑':'↓'}</div>
      <div class="tx-info"><div class="tx-desc">${t.description||t.type}</div><div class="tx-date">${date}</div></div>
      <div class="tx-amt ${isGain?'tx-pos':'tx-neg'}">${isGain?'+':''}${t.amount.toLocaleString('fr-FR')} 🪙</div>
    </div>`;
  }).join('');
}