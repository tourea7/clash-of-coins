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


// ===== POPUP CHOIX PSEUDO (pour nouveaux joueurs Google) =====
function showUsernamePopup(user, onComplete){
  // Create popup overlay
  const overlay = document.createElement('div');
  overlay.id = 'username-popup';
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:99999;
    display:flex;align-items:center;justify-content:center;
    font-family:'Rajdhani',sans-serif;
  `;

  const suggestedName = (user.user_metadata?.full_name || user.email?.split('@')[0] || '')
    .replace(/[^a-zA-Z0-9_]/g,'_').slice(0,20);

  overlay.innerHTML = `
    <div style="background:#111118;border:1px solid rgba(255,215,0,.2);border-radius:20px;padding:32px 24px;width:360px;max-width:92vw;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">👋</div>
      <div style="font-family:'Anton',sans-serif;font-size:22px;color:#FFD700;letter-spacing:2px;margin-bottom:8px">BIENVENUE!</div>
      <div style="font-size:13px;color:rgba(255,255,255,.5);margin-bottom:24px;line-height:1.6">
        Choisissez votre pseudo pour commencer à jouer
      </div>
      <div style="margin-bottom:8px">
        <input id="popup-username" type="text" value="${suggestedName}"
          style="width:100%;padding:13px 14px;background:rgba(255,255,255,.06);border:1.5px solid rgba(255,215,0,.3);border-radius:12px;color:#fff;font-family:'Rajdhani',sans-serif;font-size:16px;font-weight:600;outline:none;text-align:center;letter-spacing:1px"
          maxlength="20" oninput="validatePopupUsername(this.value)">
        <div id="popup-hint" style="font-size:10px;color:#44ff88;margin-top:6px">✓ Nom d'utilisateur valide</div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:10px;color:rgba(255,255,255,.3);margin-bottom:8px">Choisir un avatar</div>
        <div id="popup-avatars" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap"></div>
      </div>
      <button id="popup-confirm" onclick="confirmUsernamePopup()"
        style="width:100%;padding:14px;background:linear-gradient(135deg,#FFD700,#FF8C00);color:#000;font-family:'Anton',sans-serif;font-size:17px;letter-spacing:2px;border:none;border-radius:40px;cursor:pointer;box-shadow:0 6px 20px rgba(255,165,0,.3)">
        COMMENCER À JOUER ⚡
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Init avatars in popup
  const AVTS = ['👑','🦁','🐯','🦊','🐺','🦅','🐲','💎','⚡','🔥','🌙','⭐'];
  let popupAvatar = '👑';
  const grid = document.getElementById('popup-avatars');
  AVTS.forEach(av => {
    const el = document.createElement('div');
    el.textContent = av;
    el.style.cssText = `width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;border:2px solid ${av==='👑'?'#FFD700':'transparent'};background:rgba(255,255,255,.06);transition:all .2s`;
    el.onclick = () => {
      document.querySelectorAll('#popup-avatars div').forEach(a => {
        a.style.borderColor='transparent'; a.style.background='rgba(255,255,255,.06)';
      });
      el.style.borderColor='#FFD700'; el.style.background='rgba(255,215,0,.15)';
      popupAvatar = av;
    };
    grid.appendChild(el);
  });

  window._popupCallback = onComplete;
  window._popupAvatar = () => popupAvatar;
}

function validatePopupUsername(val){
  const hint = document.getElementById('popup-hint');
  const btn = document.getElementById('popup-confirm');
  const ok = /^[a-zA-Z0-9_]{3,20}$/.test(val);
  hint.style.color = ok ? '#44ff88' : '#ff6666';
  hint.textContent = ok ? '✓ Nom valide' : '✗ 3-20 caractères, lettres et chiffres uniquement';
  if(btn) btn.disabled = !ok;
}

async function confirmUsernamePopup(){
  const username = document.getElementById('popup-username').value.trim();
  if(!/^[a-zA-Z0-9_]{3,20}$/.test(username)) return;
  const avatar = window._popupAvatar ? window._popupAvatar() : '👑';

  // Update profile in DB
  const sb = await getSupabase();
  await sb.from('players').update({ username, avatar_url: avatar }).eq('id', CURRENT_USER.id);

  // Update local profile
  if(CURRENT_PROFILE){ CURRENT_PROFILE.username = username; CURRENT_PROFILE.avatar_url = avatar; }
  if(typeof STATE !== 'undefined'){ STATE.username = username; STATE.initials = username.slice(0,2).toUpperCase(); }

  // Remove popup
  const popup = document.getElementById('username-popup');
  if(popup) popup.remove();

  // Execute callback
  if(window._popupCallback) window._popupCallback();
}


// Update ALL profile displays across the page
function updateAllProfileDisplays(){
  if(!CURRENT_PROFILE) return;
  const p = CURRENT_PROFILE;
  const u = CURRENT_USER;

  // Topbar
  const tbAv = document.getElementById('tb-av');
  if(tbAv) tbAv.textContent = p.avatar_url || p.username?.slice(0,2).toUpperCase() || '👑';
  const tbName = document.querySelector('.tb-name');
  if(tbName) tbName.textContent = p.username || '...';
  const tbLv = document.querySelector('.tb-lv');
  if(tbLv) tbLv.textContent = 'Niv.' + (p.level||1);

  // Profile screen elements (with IDs)
  const els = {
    'prof-av-display': p.avatar_url || '👑',
    'prof-lv-display': 'Niveau ' + (p.level||1),
    'prof-name-display': p.username || '...',
  };
  Object.entries(els).forEach(([id,val]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = val;
  });

  // Profile screen elements (with classes)
  const profAv = document.querySelector('.prof-av');
  if(profAv) profAv.textContent = p.avatar_url || '👑';
  const profName = document.querySelector('.prof-name');
  if(profName) profName.textContent = p.username || '...';
  const profLv = document.querySelector('.prof-lv-badge');
  if(profLv) profLv.textContent = 'Niveau ' + (p.level||1);

  // Member since
  const profSince = document.querySelector('.prof-since');
  const sinceEl = document.getElementById('prof-since-display');
  const sinceDate = u?.created_at
    ? new Date(u.created_at).toLocaleDateString('fr-FR',{month:'long',year:'numeric'})
    : 'récemment';
  const sinceText = 'Membre depuis ' + sinceDate;
  if(profSince) profSince.textContent = sinceText;
  if(sinceEl) sinceEl.textContent = sinceText;

  // Stats
  const scVals = document.querySelectorAll('.sc-val');
  if(scVals[0]) scVals[0].textContent = p.games_played || 0;
  if(scVals[1]) scVals[1].textContent = p.wins || 0;
  if(scVals[2]) scVals[2].textContent = p.games_played > 0
    ? Math.round((p.wins/p.games_played)*100)+'%' : '0%';
  if(scVals[3]) scVals[3].textContent = (p.coins||0).toLocaleString('fr-FR');

  // Also call every second for 3 seconds to catch late renders
  if(!window._profileUpdateDone){
    window._profileUpdateDone = true;
    [500,1000,2000].forEach(delay => {
      setTimeout(updateAllProfileDisplays, delay);
    });
  }
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
    // Update topbar
    const tbAv = document.getElementById('tb-av');
    if(tbAv) tbAv.textContent = STATE.initials;
    const tbName = document.querySelector('.tb-name');
    if(tbName) tbName.textContent = STATE.username;
  }

  // Update profile screen immediately
  updateAllProfileDisplays();

  // Show username popup for new Google users (username contains @ or looks auto-generated)
  const needsUsername = CURRENT_PROFILE && (
    !CURRENT_PROFILE.username ||
    CURRENT_PROFILE.username.includes('@') ||
    CURRENT_PROFILE.username.startsWith('Player_')
  );

  if(needsUsername && CURRENT_USER){
    // Wait for DOM then show popup
    setTimeout(() => {
      showUsernamePopup(CURRENT_USER, () => {
        // After choosing username, update UI
        if(typeof updateProfileUI === 'function') updateProfileUI();
        if(typeof updateCoinsUI === 'function') updateCoinsUI();
      });
    }, 500);
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