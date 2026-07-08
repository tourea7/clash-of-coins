// ============================================================
// CLASH OF COINS — sounds.js
// Sons générés avec Web Audio API (pas de fichiers externes)
// ============================================================

const SFX = (() => {
  let ctx = null;

  function getCtx(){
    if(!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Volume global
  let vol = 0.5;
  function setVol(v){ vol = v; }

  // Utilitaire: jouer une note
  function tone(freq, type, start, dur, gainVal, dest){
    const ac = getCtx();
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(dest || ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0, ac.currentTime + start);
    g.gain.linearRampToValueAtTime(gainVal * vol, ac.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.05);
  }

  // Bruit blanc
  function noise(start, dur, gainVal, dest){
    const ac = getCtx();
    const bufSize = ac.sampleRate * dur;
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i] = Math.random()*2-1;
    const src = ac.createBufferSource();
    const g = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    src.buffer = buf;
    src.connect(filter); filter.connect(g); g.connect(dest || ac.destination);
    g.gain.setValueAtTime(gainVal * vol, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
    src.start(ac.currentTime + start);
    src.stop(ac.currentTime + start + dur + 0.05);
  }

  return {
    setVol,

    // 🎲 Lancer le dé — son de roulement
    dice(){
      const ac = getCtx();
      // Roulement rapide
      for(let i=0;i<8;i++){
        noise(i*0.06, 0.05, 0.15);
        tone(200 + Math.random()*400, 'square', i*0.06, 0.04, 0.08);
      }
      // Impact final
      noise(0.5, 0.12, 0.35);
      tone(120, 'sine', 0.5, 0.2, 0.2);
    },

    // ✨ Résultat du dé — son court
    diceResult(n){
      // Plus le chiffre est haut, plus le son est joyeux
      const freqs = [180, 220, 260, 320, 400, 500];
      tone(freqs[n-1] || 300, 'sine', 0, 0.15, 0.3);
      tone(freqs[n-1]*1.5 || 450, 'sine', 0.08, 0.12, 0.15);
      if(n === 6){
        // Son spécial pour le 6!
        tone(523, 'sine', 0, 0.1, 0.3);
        tone(659, 'sine', 0.1, 0.1, 0.3);
        tone(784, 'sine', 0.2, 0.2, 0.3);
      }
    },

    // ♟️ Déplacer un pion
    move(){
      tone(440, 'sine', 0, 0.08, 0.2);
      tone(550, 'sine', 0.05, 0.06, 0.15);
    },

    // 💥 Capturer un pion adverse
    capture(){
      // Impact + son d'élimination
      noise(0, 0.08, 0.4);
      tone(300, 'sawtooth', 0, 0.06, 0.25);
      tone(150, 'sawtooth', 0.06, 0.15, 0.3);
      tone(100, 'sine', 0.1, 0.2, 0.2);
    },

    // 🏠 Rentrer à la maison (fin de pièce)
    pieceDone(){
      tone(523, 'sine', 0, 0.1, 0.3);
      tone(659, 'sine', 0.08, 0.1, 0.3);
      tone(784, 'sine', 0.16, 0.1, 0.3);
      tone(1047,'sine', 0.24, 0.2, 0.35);
    },

    // 🏆 Victoire
    win(){
      const melody = [
        [523,0],[659,0.15],[784,0.3],[1047,0.45],
        [784,0.65],[1047,0.8],[1175,0.95],[1047,1.15],[1175,1.3]
      ];
      melody.forEach(([f,t]) => tone(f, 'sine', t, 0.18, 0.4));
      // Harmony
      const harmony = [
        [392,0],[523,0.15],[659,0.3],[784,0.45]
      ];
      harmony.forEach(([f,t]) => tone(f, 'triangle', t, 0.2, 0.2));
    },

    // 😤 Défaite
    lose(){
      tone(400, 'sawtooth', 0,    0.25, 0.3);
      tone(350, 'sawtooth', 0.2,  0.25, 0.3);
      tone(300, 'sawtooth', 0.4,  0.25, 0.3);
      tone(250, 'sawtooth', 0.6,  0.35, 0.3);
      tone(200, 'sine',     0.85, 0.4,  0.25);
    },

    // ⭐ Safe square (pion sur étoile)
    safe(){
      tone(880, 'sine', 0,    0.08, 0.2);
      tone(1109,'sine', 0.06, 0.08, 0.2);
      tone(1319,'sine', 0.12, 0.12, 0.25);
    },

    // 🎯 Mon tour
    myTurn(){
      tone(440, 'sine', 0,   0.06, 0.25);
      tone(554, 'sine', 0.07,0.06, 0.25);
      tone(659, 'sine', 0.14,0.1,  0.3);
    },

    // 🔔 Notification
    notif(){
      tone(880, 'sine', 0,   0.05, 0.2);
      tone(1109,'sine', 0.08,0.08, 0.2);
    },

    // 🎲 Rejouer (bouton)
    click(){
      tone(440, 'sine', 0, 0.06, 0.15);
      tone(550, 'sine', 0.04, 0.05, 0.1);
    },
  };
})();