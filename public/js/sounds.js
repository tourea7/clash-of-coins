// ============================================================
// CLASH OF COINS — sounds.js v2
// Sons + Musiques générés avec Web Audio API
// ============================================================

const SFX = (() => {
  let ctx = null;
  let _vol = 0.5;
  let _musicVol = 0.3;

  // Musiques en cours
  let homeMusic = null;
  let gameMusic = null;

  function getCtx(){
    if(!ctx){
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ console.warn('AudioContext:', e); return null; }
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Unlock audio au premier geste
  function unlock(){
    const ac = getCtx();
    if(!ac) return;
    const buf = ac.createBuffer(1,1,22050);
    const src = ac.createBufferSource();
    src.buffer=buf; src.connect(ac.destination);
    src.start(0); src.stop(0.001);
  }
  document.addEventListener('touchstart', unlock, {once:true});
  document.addEventListener('click', unlock, {once:true});

  function setVol(v){ _vol = v; }
  function setMusicVol(v){ _musicVol = v; }

  // ===== UTILITAIRES =====
  function tone(freq, type, start, dur, gainVal, dest){
    const ac = getCtx(); if(!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(dest || ac.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime + start);
    g.gain.setValueAtTime(0, ac.currentTime + start);
    g.gain.linearRampToValueAtTime(gainVal * _vol, ac.currentTime + start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.05);
  }

  function noise(start, dur, gainVal, dest){
    const ac = getCtx(); if(!ac) return;
    const bufSize = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for(let i=0;i<bufSize;i++) data[i] = Math.random()*2-1;
    const src = ac.createBufferSource();
    const g = ac.createGain();
    const filter = ac.createBiquadFilter();
    filter.type='bandpass'; filter.frequency.value=800;
    src.buffer=buf;
    src.connect(filter); filter.connect(g); g.connect(dest || ac.destination);
    g.gain.setValueAtTime(gainVal * _vol, ac.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + start + dur);
    src.start(ac.currentTime + start);
    src.stop(ac.currentTime + start + dur + 0.05);
  }

  // Crée un gain master pour la musique
  function createMusicGain(){
    const ac = getCtx(); if(!ac) return null;
    const g = ac.createGain();
    g.gain.setValueAtTime(_musicVol, ac.currentTime);
    g.connect(ac.destination);
    return g;
  }

  // Joue une note musicale
  function musicNote(freq, type, start, dur, gain, dest){
    const ac = getCtx(); if(!ac) return;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(dest || ac.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime + start);
    g.gain.linearRampToValueAtTime(gain, ac.currentTime + start + 0.05);
    g.gain.setValueAtTime(gain, ac.currentTime + start + dur - 0.05);
    g.gain.linearRampToValueAtTime(0, ac.currentTime + start + dur);
    osc.start(ac.currentTime + start);
    osc.stop(ac.currentTime + start + dur + 0.1);
  }

  // ===== 🏠 MUSIQUE ACCUEIL =====
  // Mélodie épique de château style jeu mobile
  function startHomeMusic(){
    const ac = getCtx(); if(!ac) return;
    if(homeMusic) stopHomeMusic();

    const masterGain = createMusicGain();
    if(!masterGain) return;
    masterGain.gain.value = 0.18;

    // Temps de boucle
    const BPM = 88;
    const beat = 60 / BPM;
    const bar = beat * 4;

    // Mélodie principale (flute/triangle)
    const melody = [
      // Bar 1 - montée héroïque
      [523.25, 0],    // Do
      [587.33, 0.5],  // Ré
      [659.25, 1.0],  // Mi
      [783.99, 1.5],  // Sol
      [880.00, 2.0],  // La
      [783.99, 2.5],  // Sol
      [659.25, 3.0],  // Mi
      [587.33, 3.5],  // Ré
      // Bar 2 - descente royale
      [523.25, 4.0],  // Do
      [440.00, 4.5],  // La
      [392.00, 5.0],  // Sol
      [349.23, 5.5],  // Fa
      [392.00, 6.0],  // Sol
      [440.00, 6.5],  // La
      [523.25, 7.0],  // Do
      [659.25, 7.5],  // Mi
      // Bar 3 - variation
      [783.99, 8.0],  // Sol
      [880.00, 8.5],  // La
      [1046.5, 9.0],  // Do haut
      [880.00, 9.5],  // La
      [783.99, 10.0], // Sol
      [659.25, 10.5], // Mi
      [587.33, 11.0], // Ré
      [523.25, 11.5], // Do
      // Bar 4 - résolution
      [440.00, 12.0], // La
      [523.25, 12.5], // Do
      [392.00, 13.0], // Sol
      [440.00, 13.5], // La
      [349.23, 14.0], // Fa
      [392.00, 14.5], // Sol
      [523.25, 15.0], // Do
      [523.25, 15.5], // Do (tenu)
    ];

    // Basse (drone royal)
    const bass = [
      [130.81, 0, 2],   // Do basse
      [130.81, 2, 2],
      [98.00,  4, 2],   // Sol basse
      [98.00,  6, 2],
      [130.81, 8, 2],
      [146.83, 10, 2],  // Ré basse
      [130.81, 12, 2],
      [98.00,  14, 2],
    ];

    // Accords (pad)
    const chords = [
      // Do majeur
      [[261.63, 329.63, 392.00], 0,  1.8],
      [[261.63, 329.63, 392.00], 2,  1.8],
      // Sol majeur
      [[196.00, 246.94, 293.66], 4,  1.8],
      [[196.00, 246.94, 293.66], 6,  1.8],
      // Do majeur
      [[261.63, 329.63, 392.00], 8,  1.8],
      // Ré mineur
      [[146.83, 174.61, 220.00], 10, 1.8],
      // Fa majeur
      [[174.61, 220.00, 261.63], 12, 1.8],
      // Sol majeur
      [[196.00, 246.94, 293.66], 14, 1.8],
    ];

    let stopped = false;
    let loopTimeout = null;

    function playLoop(offset){
      if(stopped) return;

      const melodyGain = ac.createGain();
      melodyGain.gain.value = 0.4;
      melodyGain.connect(masterGain);

      const bassGain = ac.createGain();
      bassGain.gain.value = 0.35;
      bassGain.connect(masterGain);

      const chordGain = ac.createGain();
      chordGain.gain.value = 0.15;
      chordGain.connect(masterGain);

      // Mélodie
      melody.forEach(([freq, t]) => {
        if(stopped) return;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(melodyGain);
        osc.type = 'triangle';
        osc.frequency.value = freq;
        const st = ac.currentTime + offset + t * beat;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.6, st + 0.02);
        g.gain.setValueAtTime(0.6, st + beat * 0.4);
        g.gain.linearRampToValueAtTime(0, st + beat * 0.48);
        osc.start(st);
        osc.stop(st + beat * 0.5);
      });

      // Basse
      bass.forEach(([freq, t, dur]) => {
        if(stopped) return;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(bassGain);
        osc.type = 'sine';
        osc.frequency.value = freq;
        const st = ac.currentTime + offset + t * beat;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.8, st + 0.1);
        g.gain.setValueAtTime(0.8, st + dur * beat - 0.1);
        g.gain.linearRampToValueAtTime(0, st + dur * beat);
        osc.start(st);
        osc.stop(st + dur * beat + 0.1);
      });

      // Accords pad
      chords.forEach(([freqs, t, dur]) => {
        if(stopped) return;
        freqs.forEach(freq => {
          const osc = ac.createOscillator();
          const g = ac.createGain();
          osc.connect(g); g.connect(chordGain);
          osc.type = 'sine';
          osc.frequency.value = freq;
          const st = ac.currentTime + offset + t * beat;
          g.gain.setValueAtTime(0, st);
          g.gain.linearRampToValueAtTime(0.3, st + 0.15);
          g.gain.setValueAtTime(0.3, st + dur * beat - 0.15);
          g.gain.linearRampToValueAtTime(0, st + dur * beat);
          osc.start(st);
          osc.stop(st + dur * beat + 0.1);
        });
      });

      // Percussion légère (caisse claire)
      for(let i=0;i<16;i++){
        if(stopped) break;
        if(i%2===0) continue; // Beats 2 et 4
        const st = ac.currentTime + offset + i * beat * 0.5;
        const bufSize = Math.floor(ac.sampleRate * 0.08);
        const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
        const data = buf.getChannelData(0);
        for(let j=0;j<bufSize;j++) data[j] = (Math.random()*2-1) * Math.exp(-j/bufSize*20);
        const src = ac.createBufferSource();
        const g = ac.createGain();
        const filter = ac.createBiquadFilter();
        filter.type='highpass'; filter.frequency.value=3000;
        src.buffer=buf; src.connect(filter); filter.connect(g); g.connect(masterGain);
        g.gain.value = 0.06;
        src.start(st);
      }

      const loopDuration = 16 * beat;
      loopTimeout = setTimeout(() => playLoop(0), loopDuration * 1000 - 100);
    }

    playLoop(0.3);

    homeMusic = {
      stop: () => {
        stopped = true;
        if(loopTimeout) clearTimeout(loopTimeout);
        // Fade out
        masterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1.5);
        setTimeout(() => { try{ masterGain.disconnect(); }catch(e){} }, 2000);
      },
      gain: masterGain
    };
  }

  function stopHomeMusic(){
    if(homeMusic){ homeMusic.stop(); homeMusic = null; }
  }

  // ===== 🎵 MUSIQUE DE JEU =====
  // Rythme tendu, suspense
  function startGameMusic(){
    const ac = getCtx(); if(!ac) return;
    if(gameMusic) stopGameMusic();

    const masterGain = createMusicGain();
    if(!masterGain) return;
    masterGain.gain.value = 0.10;

    const BPM = 110;
    const beat = 60 / BPM;
    let stopped = false;
    let loopTimeout = null;

    // Mélodie mystérieuse/tendue
    const gameMelody = [
      [392.00, 0],    // Sol
      [370.00, 0.5],  // Fa#
      [392.00, 1.0],
      [440.00, 1.5],  // La
      [392.00, 2.0],
      [349.23, 2.5],  // Fa
      [329.63, 3.0],  // Mi
      [293.66, 3.5],  // Ré
      [329.63, 4.0],
      [349.23, 4.5],
      [392.00, 5.0],
      [440.00, 5.5],
      [523.25, 6.0],  // Do haut
      [493.88, 6.5],  // Si
      [440.00, 7.0],
      [392.00, 7.5],
    ];

    function playGameLoop(offset){
      if(stopped) return;

      const melGain = ac.createGain();
      melGain.gain.value = 0.25;
      melGain.connect(masterGain);

      gameMelody.forEach(([freq, t]) => {
        if(stopped) return;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(melGain);
        osc.type = 'square';
        osc.frequency.value = freq;
        const st = ac.currentTime + offset + t * beat;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.15, st + 0.01);
        g.gain.linearRampToValueAtTime(0, st + beat * 0.45);
        osc.start(st);
        osc.stop(st + beat * 0.5);
      });

      // Basse pulsée
      for(let i=0;i<8;i++){
        if(stopped) break;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.connect(g); g.connect(masterGain);
        osc.type = 'sine';
        osc.frequency.value = i%2===0 ? 98 : 110;
        const st = ac.currentTime + offset + i * beat;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.2, st + 0.02);
        g.gain.linearRampToValueAtTime(0, st + beat * 0.4);
        osc.start(st);
        osc.stop(st + beat * 0.5);
      }

      const loopDur = 8 * beat;
      loopTimeout = setTimeout(() => playGameLoop(0), loopDur * 1000 - 80);
    }

    playGameLoop(0.2);

    gameMusic = {
      stop: () => {
        stopped = true;
        if(loopTimeout) clearTimeout(loopTimeout);
        masterGain.gain.linearRampToValueAtTime(0, ac.currentTime + 1);
        setTimeout(() => { try{ masterGain.disconnect(); }catch(e){} }, 1500);
      }
    };
  }

  function stopGameMusic(){
    if(gameMusic){ gameMusic.stop(); gameMusic = null; }
  }

  // ===== 🏆 SON VICTOIRE =====
  function playWin(){
    const ac = getCtx(); if(!ac) return;
    stopGameMusic();

    // Fanfare épique
    const fanfare = [
      [523.25, 0,    0.15, 'square'],
      [659.25, 0.15, 0.15, 'square'],
      [783.99, 0.3,  0.15, 'square'],
      [1046.5, 0.45, 0.4,  'square'],
      [880.00, 0.85, 0.15, 'square'],
      [1046.5, 1.0,  0.15, 'square'],
      [1174.7, 1.15, 0.15, 'square'],
      [1318.5, 1.3,  0.6,  'square'],
    ];

    // Harmonie
    const harmony = [
      [392.00, 0,    0.4,  'sine'],
      [523.25, 0.45, 0.4,  'sine'],
      [659.25, 0.85, 0.4,  'sine'],
      [783.99, 1.3,  0.6,  'sine'],
    ];

    // Percussions de victoire
    const perc = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.65];

    const vol = _vol;

    fanfare.forEach(([freq, t, dur, type]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const st = ac.currentTime + t;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.3 * vol, st + 0.02);
      g.gain.setValueAtTime(0.3 * vol, st + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, st + dur);
      osc.start(st); osc.stop(st + dur + 0.1);
    });

    harmony.forEach(([freq, t, dur, type]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const st = ac.currentTime + t;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.15 * vol, st + 0.05);
      g.gain.setValueAtTime(0.15 * vol, st + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, st + dur);
      osc.start(st); osc.stop(st + dur + 0.1);
    });

    perc.forEach(t => {
      const bufSize = Math.floor(ac.sampleRate * 0.05);
      const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
      const data = buf.getChannelData(0);
      for(let i=0;i<bufSize;i++) data[i] = (Math.random()*2-1) * Math.exp(-i/(bufSize*0.3));
      const src = ac.createBufferSource();
      const g = ac.createGain();
      src.buffer=buf; src.connect(g); g.connect(ac.destination);
      g.gain.value = 0.15 * vol;
      src.start(ac.currentTime + t);
    });

    // Clochettes finales
    [1318.5, 1567.98, 2093.0].forEach((freq, i) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = 'sine'; osc.frequency.value = freq;
      const st = ac.currentTime + 2.0 + i * 0.12;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.25 * vol, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.5);
      osc.start(st); osc.stop(st + 0.6);
    });
  }

  // ===== 😤 SON DÉFAITE =====
  function playLose(){
    const ac = getCtx(); if(!ac) return;
    stopGameMusic();

    const vol = _vol;

    // Descente dramatique
    const descent = [
      [523.25, 0,   0.3, 'sawtooth'],
      [466.16, 0.3, 0.3, 'sawtooth'],
      [415.30, 0.6, 0.3, 'sawtooth'],
      [369.99, 0.9, 0.3, 'sawtooth'],
      [329.63, 1.2, 0.3, 'sawtooth'],
      [293.66, 1.5, 0.3, 'sawtooth'],
      [261.63, 1.8, 0.6, 'sawtooth'],
    ];

    // Accord mineur sombre
    const dark = [
      [130.81, 0, 2.4, 'sine'],
      [155.56, 0.1, 2.3, 'sine'],
      [196.00, 0.2, 2.2, 'sine'],
    ];

    descent.forEach(([freq, t, dur, type]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const st = ac.currentTime + t;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.2 * vol, st + 0.02);
      g.gain.setValueAtTime(0.2 * vol, st + dur - 0.05);
      g.gain.linearRampToValueAtTime(0, st + dur);
      osc.start(st); osc.stop(st + dur + 0.1);
    });

    dark.forEach(([freq, t, dur, type]) => {
      const osc = ac.createOscillator();
      const g = ac.createGain();
      osc.connect(g); g.connect(ac.destination);
      osc.type = type; osc.frequency.value = freq;
      const st = ac.currentTime + t;
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.12 * vol, st + 0.1);
      g.gain.setValueAtTime(0.12 * vol, st + dur - 0.2);
      g.gain.linearRampToValueAtTime(0, st + dur);
      osc.start(st); osc.stop(st + dur + 0.1);
    });

    // Impact grave final
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.connect(g); g.connect(ac.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ac.currentTime + 2.0);
    osc.frequency.exponentialRampToValueAtTime(40, ac.currentTime + 2.8);
    g.gain.setValueAtTime(0, ac.currentTime + 2.0);
    g.gain.linearRampToValueAtTime(0.3 * vol, ac.currentTime + 2.05);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 2.8);
    osc.start(ac.currentTime + 2.0);
    osc.stop(ac.currentTime + 3.0);
  }

  // ===== SONS DE JEU =====
  return {
    setVol,
    setMusicVol,

    // Musiques
    startHomeMusic,
    stopHomeMusic,
    startGameMusic,
    stopGameMusic,

    // Victoire / Défaite
    win(){ playWin(); },
    lose(){ playLose(); },

    // 🎲 Dé
    dice(){
      for(let i=0;i<8;i++){
        noise(i*0.06, 0.05, 0.15);
        tone(200+Math.random()*400,'square',i*0.06,0.04,0.08);
      }
      noise(0.5, 0.12, 0.35);
      tone(120,'sine',0.5,0.2,0.2);
    },

    diceResult(n){
      const freqs=[180,220,260,320,400,500];
      tone(freqs[n-1]||300,'sine',0,0.15,0.3);
      tone((freqs[n-1]||300)*1.5,'sine',0.08,0.12,0.15);
      if(n===6){
        tone(523,'sine',0,0.1,0.3);
        tone(659,'sine',0.1,0.1,0.3);
        tone(784,'sine',0.2,0.2,0.3);
      }
    },

    // ♟️ Pion
    move(){
      tone(440,'sine',0,0.08,0.2);
      tone(550,'sine',0.05,0.06,0.15);
    },

    // 💥 Capture
    capture(){
      noise(0,0.08,0.4);
      tone(300,'sawtooth',0,0.06,0.25);
      tone(150,'sawtooth',0.06,0.15,0.3);
      tone(100,'sine',0.1,0.2,0.2);
    },

    // 🏠 Pion arrivé
    pieceDone(){
      tone(523,'sine',0,0.1,0.3);
      tone(659,'sine',0.08,0.1,0.3);
      tone(784,'sine',0.16,0.1,0.3);
      tone(1047,'sine',0.24,0.2,0.35);
    },

    // ⭐ Case safe
    safe(){
      tone(880,'sine',0,0.08,0.2);
      tone(1109,'sine',0.06,0.08,0.2);
      tone(1319,'sine',0.12,0.12,0.25);
    },

    // 🎲 Mon tour
    myTurn(){
      tone(440,'sine',0,0.06,0.25);
      tone(554,'sine',0.07,0.06,0.25);
      tone(659,'sine',0.14,0.1,0.3);
    },

    // 🔔 Click
    click(){
      tone(440,'sine',0,0.06,0.15);
      tone(550,'sine',0.04,0.05,0.1);
    },

    // 🔧 Test
    test(){
      const ac = getCtx();
      if(!ac){ console.error('❌ AudioContext non disponible'); return false; }
      tone(440,'sine',0,0.3,0.5);
      console.log('✅ Son test - state:', ac.state);
      return true;
    },

    getState(){
      const ac = getCtx();
      return ac ? ac.state : 'not initialized';
    }
  };
})();

window.addEventListener('load',()=>{
  console.log('🔊 SFX v2 loaded. SFX.test() pour tester.');
});