// ============================================================
// CLASH OF COINS — sounds.js v4 — Modern Premium
// Style: Electro / Future Pop / Arcade Premium
// Inspiré: Clash Royale, Coin Master, Monopoly GO, Ludo Club
// ============================================================

const SFX = (() => {
  let ctx = null;
  let _sfxVol   = 0.65;
  let _musicVol = 0.28;
  let _gameVol  = 0.14;
  let _muted    = false;

  let homeMusic = null;
  let gameMusic = null;
  let tensionLayer = null;

  // ===== AUDIO CONTEXT =====
  function getCtx(){
    if(!ctx){
      try{ ctx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ return null; }
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function unlock(){
    const ac = getCtx(); if(!ac) return;
    const b = ac.createBuffer(1,1,22050);
    const s = ac.createBufferSource();
    s.buffer=b; s.connect(ac.destination); s.start(0); s.stop(0.001);
  }
  document.addEventListener('touchstart', unlock, {once:true});
  document.addEventListener('click', unlock, {once:true});

  // ===== HELPERS =====
  const v = (vol) => _muted ? 0 : vol * _sfxVol;

  function synth(freq, type, t0, dur, peak, dest, ac2, detune=0){
    const ac = ac2||getCtx(); if(!ac) return null;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type=type; o.frequency.value=freq;
    if(detune) o.detune.value=detune;
    o.connect(g); g.connect(dest||ac.destination);
    const t = ac.currentTime+t0;
    g.gain.setValueAtTime(0,t);
    g.gain.linearRampToValueAtTime(peak,t+0.008);
    g.gain.setValueAtTime(peak,t+dur*0.6);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.start(t); o.stop(t+dur+0.05);
    return {osc:o,gain:g};
  }

  function noiseBuffer(ac, dur){
    const n = Math.floor(ac.sampleRate*dur);
    const b = ac.createBuffer(1,n,ac.sampleRate);
    const d = b.getChannelData(0);
    for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    return b;
  }

  function noiseNode(t0, dur, vol, freq, type='bandpass', dest, ac2){
    const ac = ac2||getCtx(); if(!ac) return;
    const src = ac.createBufferSource();
    const flt = ac.createBiquadFilter();
    const g = ac.createGain();
    flt.type=type; flt.frequency.value=freq;
    src.buffer=noiseBuffer(ac,dur);
    src.connect(flt); flt.connect(g); g.connect(dest||ac.destination);
    const t = ac.currentTime+t0;
    g.gain.setValueAtTime(vol,t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    src.start(t); src.stop(t+dur+0.05);
  }

  // Coin-style metallic ping
  function metalPing(freq, t0, dur=0.4, vol=0.5, dest, ac2){
    const ac = ac2||getCtx(); if(!ac) return;
    const harmonics = [[1,1],[2.76,0.5],[5.4,0.25],[8.93,0.1]];
    harmonics.forEach(([h,hv])=>{
      const o=ac.createOscillator(), g=ac.createGain();
      o.type='sine'; o.frequency.value=freq*h;
      o.connect(g); g.connect(dest||ac.destination);
      const t=ac.currentTime+t0;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(vol*hv*(v(1)),t+0.003);
      g.gain.exponentialRampToValueAtTime(0.0001,t+dur*(1-h*0.06));
      o.start(t); o.stop(t+dur+0.1);
    });
  }

  // Synth pad (electro)
  function pad(freq, t0, dur, vol=0.3, dest, ac2){
    const ac = ac2||getCtx(); if(!ac) return;
    [-7,0,7].forEach(det=>{
      const o=ac.createOscillator(), g=ac.createGain(), f=ac.createBiquadFilter();
      o.type='sawtooth'; o.frequency.value=freq; o.detune.value=det;
      f.type='lowpass'; f.frequency.value=freq*3; f.Q.value=1.5;
      o.connect(f); f.connect(g); g.connect(dest||ac.destination);
      const t=ac.currentTime+t0;
      g.gain.setValueAtTime(0,t);
      g.gain.linearRampToValueAtTime(vol*v(1)/3,t+0.06);
      g.gain.setValueAtTime(vol*v(1)/3,t+dur-0.08);
      g.gain.linearRampToValueAtTime(0,t+dur);
      o.start(t); o.stop(t+dur+0.1);
    });
  }

  // Sub bass kick
  function kick(t0, vol=0.7, dest, ac2){
    const ac=ac2||getCtx(); if(!ac||_muted) return;
    const o=ac.createOscillator(), g=ac.createGain();
    o.type='sine'; o.connect(g); g.connect(dest||ac.destination);
    const t=ac.currentTime+t0;
    o.frequency.setValueAtTime(200,t);
    o.frequency.exponentialRampToValueAtTime(35,t+0.15);
    g.gain.setValueAtTime(vol*(v(1)),t);
    g.gain.exponentialRampToValueAtTime(0.0001,t+0.25);
    o.start(t); o.stop(t+0.3);
  }

  function snare(t0, vol=0.4, dest, ac2){
    const ac=ac2||getCtx(); if(!ac||_muted) return;
    noiseNode(t0,0.12,vol*v(1),3000,'highpass',dest,ac2);
    synth(200,'sine',t0,0.08,vol*0.5*v(1),dest,ac2);
  }

  function hihat(t0, vol=0.2, open=false, dest, ac2){
    const ac=ac2||getCtx(); if(!ac||_muted) return;
    noiseNode(t0,open?0.25:0.06,vol*v(1),10000,'highpass',dest,ac2);
  }

  // ===== 🏠 MUSIQUE ACCUEIL — Electro / Future Pop =====
  function startHomeMusic(){
    const ac=getCtx(); if(!ac) return;
    if(homeMusic) stopHomeMusic();

    const master=ac.createGain();
    master.gain.value=_muted?0:_musicVol;
    master.connect(ac.destination);

    // Compresseur pour un son plus "radio"
    const comp=ac.createDynamicsCompressor();
    comp.threshold.value=-18; comp.knee.value=12;
    comp.ratio.value=4; comp.attack.value=0.003; comp.release.value=0.1;
    comp.connect(master);

    const BPM=112; const B=60/BPM;
    let stopped=false, loopId=null;

    // Mélodie principale (synth lead)
    const mel=[
      [523.25,0],[659.25,0.5],[783.99,1],[1046.5,1.5],
      [880,2],[783.99,2.5],[659.25,3],[587.33,3.5],
      [659.25,4],[783.99,4.5],[1046.5,5],[1174.7,5.5],
      [1046.5,6],[880,6.5],[783.99,7],[659.25,7.5],
      [523.25,8],[587.33,8.5],[659.25,9],[783.99,9.5],
      [880,10],[1046.5,10.5],[1174.7,11],[1318.5,11.5],
      [1174.7,12],[1046.5,12.5],[880,13],[783.99,13.5],
      [659.25,14],[587.33,14.5],[523.25,15],[523.25,15.5],
    ];

    // Basse électro
    const bass=[
      [65.41,0,1.8],[65.41,2,1.8],[49,4,1.8],[55,6,1.8],
      [65.41,8,1.8],[55,10,1.8],[65.41,12,1.8],[49,14,1.8],
    ];

    // Accords pad
    const chords=[
      [[261.63,329.63,392],0,1.9],[[261.63,329.63,392],2,1.9],
      [[196,246.94,293.66],4,1.9],[[220,277.18,329.63],6,1.9],
      [[261.63,329.63,392],8,1.9],[[246.94,311.13,369.99],10,1.9],
      [[261.63,329.63,392],12,1.9],[[196,246.94,293.66],14,1.9],
    ];

    function loop(offset){
      if(stopped) return;

      const mG=ac.createGain(); mG.gain.value=0.4; mG.connect(comp);
      const bG=ac.createGain(); bG.gain.value=0.5; bG.connect(comp);
      const pG=ac.createGain(); pG.gain.value=0.2; pG.connect(comp);
      const dG=ac.createGain(); dG.gain.value=0.6; dG.connect(comp);

      // Lead synth (saw + filter)
      mel.forEach(([f,t])=>{
        if(stopped) return;
        const o=ac.createOscillator(),o2=ac.createOscillator();
        const flt=ac.createBiquadFilter(),g=ac.createGain();
        o.type='sawtooth'; o.frequency.value=f; o.detune.value=-5;
        o2.type='sawtooth'; o2.frequency.value=f; o2.detune.value=5;
        flt.type='lowpass'; flt.frequency.value=f*2.5; flt.Q.value=2;
        o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(mG);
        const st=ac.currentTime+offset+t*B;
        g.gain.setValueAtTime(0,st);
        g.gain.linearRampToValueAtTime(0.35,st+0.015);
        g.gain.setValueAtTime(0.35,st+B*0.55);
        g.gain.linearRampToValueAtTime(0,st+B*0.7);
        o.start(st); o2.start(st); o.stop(st+B); o2.stop(st+B);
      });

      // Sub bass
      bass.forEach(([f,t,d])=>{
        if(stopped) return;
        const o=ac.createOscillator(),g=ac.createGain();
        o.type='sine'; o.frequency.value=f;
        o.connect(g); g.connect(bG);
        const st=ac.currentTime+offset+t*B;
        g.gain.setValueAtTime(0,st);
        g.gain.linearRampToValueAtTime(0.8,st+0.02);
        g.gain.setValueAtTime(0.8,st+d*B-0.05);
        g.gain.linearRampToValueAtTime(0,st+d*B);
        o.start(st); o.stop(st+d*B+0.1);
        // Avec distorsion légère
        const o2=ac.createOscillator(),g2=ac.createGain();
        o2.type='square'; o2.frequency.value=f*2;
        o2.connect(g2); g2.connect(bG);
        g2.gain.setValueAtTime(0,st); g2.gain.linearRampToValueAtTime(0.08,st+0.02);
        g2.gain.setValueAtTime(0.08,st+d*B*0.4); g2.gain.linearRampToValueAtTime(0,st+d*B*0.6);
        o2.start(st); o2.stop(st+d*B+0.1);
      });

      // Pad chords
      chords.forEach(([freqs,t,d])=>{
        if(stopped) return;
        freqs.forEach(f=>{
          pad(f,offset+t*B,d*B,0.25,pG,ac);
        });
      });

      // Drums — Future Bass style
      for(let i=0;i<16;i++){
        if(stopped) break;
        if(i%4===0) kick(offset+i*B,0.8,dG,ac);
        if(i%4===2) snare(offset+i*B,0.5,dG,ac);
        if(i%2===0) hihat(offset+i*B,0.15,false,dG,ac);
        else hihat(offset+i*B,0.08,false,dG,ac);
        // Off-beat hihat
        if(i%4===1||i%4===3) hihat(offset+(i+0.5)*B,0.06,false,dG,ac);
      }

      const dur=16*B;
      loopId=setTimeout(()=>loop(0),(dur-0.08)*1000);
    }

    loop(0.3);
    homeMusic={
      stop:()=>{ stopped=true; if(loopId) clearTimeout(loopId);
        master.gain.linearRampToValueAtTime(0,ac.currentTime+1.5);
        setTimeout(()=>{ try{master.disconnect();}catch(e){} },2000); },
      setVol:v2=>master.gain.setValueAtTime(_muted?0:v2,ac.currentTime),
    };
  }

  function stopHomeMusic(){
    if(homeMusic){ homeMusic.stop(); homeMusic=null; }
  }

  // ===== 🎮 MUSIQUE PARTIE — Future Bass léger =====
  function startGameMusic(){
    const ac=getCtx(); if(!ac) return;
    if(gameMusic) stopGameMusic();

    const master=ac.createGain();
    master.gain.value=_muted?0:_gameVol;
    master.connect(ac.destination);

    const BPM=108; const B=60/BPM;
    let stopped=false, loopId=null;

    const gmMel=[
      [392,0],[440,0.5],[493.88,1],[440,1.5],
      [392,2],[369.99,2.5],[329.63,3],[369.99,3.5],
      [392,4],[440,4.5],[523.25,5],[493.88,5.5],
      [440,6],[392,6.5],[369.99,7],[392,7.5],
    ];

    function gmLoop(offset){
      if(stopped) return;
      const mG=ac.createGain(); mG.gain.value=0.3; mG.connect(master);
      const bG=ac.createGain(); bG.gain.value=0.5; bG.connect(master);
      const dG=ac.createGain(); dG.gain.value=0.4; dG.connect(master);

      gmMel.forEach(([f,t])=>{
        if(stopped) return;
        const o=ac.createOscillator(),g=ac.createGain();
        const flt=ac.createBiquadFilter();
        o.type='triangle'; o.frequency.value=f;
        flt.type='lowpass'; flt.frequency.value=f*2;
        o.connect(flt); flt.connect(g); g.connect(mG);
        const st=ac.currentTime+offset+t*B;
        g.gain.setValueAtTime(0,st);
        g.gain.linearRampToValueAtTime(0.25,st+0.01);
        g.gain.linearRampToValueAtTime(0,st+B*0.65);
        o.start(st); o.stop(st+B);
      });

      [0,1,2,3,4,5,6,7].forEach(i=>{
        if(stopped) return;
        const o=ac.createOscillator(),g=ac.createGain();
        o.type='sine'; o.frequency.value=i%2===0?98.00:87.31;
        o.connect(g); g.connect(bG);
        const st=ac.currentTime+offset+i*B;
        g.gain.setValueAtTime(0,st);
        g.gain.linearRampToValueAtTime(0.5,st+0.01);
        g.gain.linearRampToValueAtTime(0,st+B*0.45);
        o.start(st); o.stop(st+B);
      });

      for(let i=0;i<8;i++){
        if(stopped) break;
        if(i%4===0) kick(offset+i*B,0.6,dG,ac);
        if(i%4===2) snare(offset+i*B,0.35,dG,ac);
        hihat(offset+i*B,0.1,false,dG,ac);
      }

      const dur=8*B;
      loopId=setTimeout(()=>gmLoop(0),(dur-0.06)*1000);
    }

    gmLoop(0.2);
    gameMusic={
      stop:()=>{ stopped=true; if(loopId) clearTimeout(loopId);
        master.gain.linearRampToValueAtTime(0,ac.currentTime+1);
        setTimeout(()=>{ try{master.disconnect();}catch(e){} },1500); },
      fadeOut:(d=2)=>master.gain.linearRampToValueAtTime(0,ac.currentTime+d),
      rampUp:()=>master.gain.linearRampToValueAtTime(_muted?0:_gameVol*2,ac.currentTime+1),
    };
  }

  function stopGameMusic(){ if(gameMusic){ gameMusic.stop(); gameMusic=null; } }

  // ===== 💰 SONS DE PIÈCES =====

  // 🪙 Pièce gagnée — "cling" métallique
  function coinCling(){
    if(_muted) return;
    metalPing(1567.98,0,0.35,0.45);
    metalPing(2093,0.04,0.25,0.2);
  }

  // 💰 Pluie de pièces
  function coinRain(){
    if(_muted) return;
    const freqs=[1046.5,1318.5,1567.98,2093,1760,1396.9,1174.7];
    for(let i=0;i<12;i++){
      const f=freqs[Math.floor(Math.random()*freqs.length)];
      const t=i*0.08+Math.random()*0.04;
      metalPing(f,t,0.2+Math.random()*0.2,0.3+Math.random()*0.2);
    }
  }

  // 💵 Mise validée — caisse enregistreuse moderne
  function betPlaced(){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    // Claquement + cling
    noiseNode(0,0.04,0.3,4000,'highpass');
    metalPing(1046.5,0.03,0.3,0.4);
    metalPing(1318.5,0.1,0.25,0.3);
    synth(2093,'sine',0.15,0.15,v(0.2));
  }

  // 🎁 Récompense — jingle brillant
  function reward(){
    if(_muted) return;
    [523.25,659.25,783.99,1046.5,1318.5].forEach((f,i)=>{
      synth(f,'sine',i*0.07,0.2,v(0.25));
      metalPing(f*2,i*0.07+0.03,0.3,0.15);
    });
  }

  // 💎 Gros gain — explosion de pièces + montée
  function bigWin(){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    // Montée orchestrale
    [[523.25,0],[659.25,0.1],[783.99,0.2],[1046.5,0.3],[1318.5,0.4],[1567.98,0.5],[2093,0.6]]
      .forEach(([f,t])=>{ synth(f,'sine',t,0.4,v(0.3)); pad(f/2,t,0.5,0.2); });
    // Pluie de pièces
    for(let i=0;i<20;i++){
      const f=[1046.5,1318.5,1567.98,2093][Math.floor(Math.random()*4)];
      metalPing(f,0.3+i*0.06+Math.random()*0.04,0.25,0.35);
    }
    // Impact
    kick(0,0.8); kick(0.3,0.6); kick(0.6,0.8);
    noiseNode(0.3,0.4,0.3,200,'lowpass');
  }

  // 💸 Déduction mise — son de retrait
  function betDeducted(){
    if(_muted) return;
    metalPing(523.25,0,0.2,0.3);
    metalPing(392,0.08,0.2,0.2);
    metalPing(293.66,0.16,0.25,0.15);
  }

  // ===== 🎲 SONS DE JEU =====

  // Dé qui roule + rebond
  function dice(){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    // Rolling
    for(let i=0;i<7;i++){
      noiseNode(i*0.055,0.04,0.15,1200+(i*200),'bandpass');
      synth(300+i*40,'square',i*0.055,0.03,v(0.06));
    }
    // Rebond final
    kick(0.4,0.5);
    noiseNode(0.4,0.05,0.25,800,'bandpass');
    metalPing(880,0.42,0.15,0.2);
  }

  // Résultat 1-5 — clic numérique
  function diceResult(n){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    noiseNode(0,0.03,0.2,3000,'highpass');
    const freqs=[220,261.63,293.66,329.63,369.99,440];
    synth(freqs[n-1]||329.63,'sine',0,0.12,v(0.3));
    synth((freqs[n-1]||329.63)*2,'sine',0.02,0.08,v(0.12));
    if(n===6){
      // Jingle chance + clochette
      [523.25,659.25,783.99,1046.5].forEach((f,i)=>synth(f,'sine',0.05+i*0.08,0.12,v(0.25)));
      metalPing(2093,0.35,0.5,0.45);
      metalPing(2637,0.43,0.4,0.25);
    }
  }

  // Déplacement — pop léger électro
  function move(){
    if(_muted) return;
    noiseNode(0,0.025,0.15,2000,'highpass');
    synth(523.25,'sine',0,0.06,v(0.2));
    synth(659.25,'sine',0.03,0.05,v(0.12));
  }

  // Capture — impact + whoosh
  function capture(){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    // Impact
    kick(0,0.7); noiseNode(0,0.05,0.4,400,'lowpass');
    // Whoosh
    const o=ac.createOscillator(),g=ac.createGain(),flt=ac.createBiquadFilter();
    o.type='sawtooth'; flt.type='highpass';
    o.frequency.setValueAtTime(800,ac.currentTime);
    o.frequency.exponentialRampToValueAtTime(200,ac.currentTime+0.3);
    flt.frequency.setValueAtTime(800,ac.currentTime);
    flt.frequency.exponentialRampToValueAtTime(200,ac.currentTime+0.3);
    o.connect(flt); flt.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(v(0.25),ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.3);
    o.start(); o.stop(ac.currentTime+0.35);
  }

  // Case safe — tintement cristallin
  function safe(){
    if(_muted) return;
    metalPing(2637,0,0.5,0.35);
    metalPing(3136,0.07,0.4,0.2);
    metalPing(3951,0.14,0.3,0.12);
    synth(659.25,'sine',0,0.2,v(0.1));
  }

  // Pion arrivé — jingle de réussite
  function pieceDone(){
    if(_muted) return;
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>synth(f,'sine',i*0.07,0.18,v(0.28)));
    metalPing(2093,0.28,0.6,0.4);
    metalPing(2637,0.36,0.5,0.25);
    coinCling();
  }

  // Mon tour — notification courte
  function myTurn(){
    if(_muted) return;
    synth(880,'sine',0,0.06,v(0.3));
    synth(1108,'sine',0.07,0.06,v(0.3));
    synth(1318.5,'sine',0.14,0.1,v(0.35));
    metalPing(1760,0.18,0.25,0.2);
  }

  // Changement de tour
  function turnChange(){
    if(_muted) return;
    noiseNode(0,0.04,0.12,2000,'bandpass');
    synth(440,'sine',0,0.08,v(0.15));
  }

  // Coup impossible
  function invalid(){
    if(_muted) return;
    synth(220,'sine',0,0.1,v(0.25));
    synth(196,'sine',0.08,0.12,v(0.2));
    noiseNode(0,0.08,0.1,300,'lowpass');
  }

  // Coup valide
  function valid(){
    if(_muted) return;
    noiseNode(0,0.02,0.15,3000,'highpass');
    synth(659.25,'sine',0,0.06,v(0.2));
  }

  // Début de partie — jingle départ
  function gameStart(){
    if(_muted) return;
    const ac=getCtx(); if(!ac) return;
    // Compte à rebours style
    [0,0.3,0.6].forEach(t=>{ kick(t,0.6); snare(t+0.15,0.3); });
    // GO!
    [523.25,659.25,783.99,1046.5].forEach((f,i)=>synth(f,'sine',0.9+i*0.06,0.2,v(0.3)));
    metalPing(2093,1.15,0.5,0.4);
    coinCling();
  }

  // Tous pions sortis
  function allDone(){
    if(_muted) return;
    reward();
    setTimeout(()=>coinRain(),200);
  }

  // Joueur rejoint
  function playerJoin(){
    if(_muted) return;
    synth(783.99,'sine',0,0.08,v(0.25));
    synth(1046.5,'sine',0.09,0.1,v(0.3));
    metalPing(1318.5,0.15,0.3,0.2);
  }

  // Joueur quitte
  function playerLeave(){
    if(_muted) return;
    synth(523.25,'sine',0,0.08,v(0.2));
    synth(392,'sine',0.09,0.1,v(0.15));
    noiseNode(0.1,0.08,0.08,500,'bandpass');
  }

  // Nouveau message
  function chatMsg(){
    if(_muted) return;
    metalPing(1318.5,0,0.15,0.25);
    metalPing(1567.98,0.06,0.12,0.15);
  }

  // 5 secondes — bip discret
  function countdown(){
    if(_muted) return;
    synth(880,'square',0,0.05,v(0.15));
    synth(880,'square',0.08,0.05,v(0.15));
  }

  // Temps écoulé
  function timeOut(){
    if(_muted) return;
    synth(440,'sawtooth',0,0.1,v(0.2));
    synth(330,'sawtooth',0.1,0.1,v(0.2));
    synth(220,'sawtooth',0.2,0.2,v(0.25));
    noiseNode(0.15,0.2,0.15,300,'lowpass');
  }

  // Interface
  function btnHover(){
    if(_muted) return;
    noiseNode(0,0.02,0.06,4000,'highpass');
  }

  function btnClick(){
    if(_muted) return;
    noiseNode(0,0.025,0.12,3000,'highpass');
    synth(880,'sine',0,0.04,v(0.15));
  }

  function modalOpen(){
    if(_muted) return;
    [400,600,800,1000].forEach((f,i)=>synth(f,'sine',i*0.03,0.08,v(0.1)));
    noiseNode(0,0.1,0.08,2000,'bandpass');
  }

  function modalClose(){
    if(_muted) return;
    [1000,800,600,400].forEach((f,i)=>synth(f,'sine',i*0.025,0.06,v(0.08)));
  }

  function menuBack(){
    if(_muted) return;
    synth(659.25,'sine',0,0.08,v(0.2));
    synth(523.25,'sine',0.08,0.08,v(0.18));
    synth(392,'sine',0.16,0.1,v(0.15));
  }

  // ===== 🏆 VICTOIRE — Fanfare moderne + pièces =====
  function win(){
    if(_muted) return;
    if(gameMusic) gameMusic.fadeOut(1);

    const ac=getCtx(); if(!ac) return;

    // Jingle 5 secondes — accord majeur montant
    const fanfare=[
      [523.25,0,0.15],[659.25,0.15,0.15],[783.99,0.3,0.15],
      [1046.5,0.45,0.4],[880,0.85,0.15],[1046.5,1.0,0.15],
      [1318.5,1.15,0.6],
    ];
    fanfare.forEach(([f,t,d])=>{
      synth(f,'sine',t,d,v(0.3));
      synth(f*1.5,'sine',t,d*0.7,v(0.12));
      if(t>0.4) pad(f/2,t,d,0.2);
    });

    // Pluie de pièces
    for(let i=0;i<18;i++){
      const f=[1046.5,1318.5,1567.98,2093,2637][Math.floor(Math.random()*5)];
      metalPing(f,0.5+i*0.07+Math.random()*0.04,0.2+Math.random()*0.15,0.35);
    }

    // Drums de célébration
    [0,0.15,0.3,0.45,0.85,1.0,1.15,1.4,1.55,1.7]
      .forEach((t,i)=>i%3===1?snare(t,0.45):kick(t,0.7));

    // Effet foule — bruit rose filtré
    noiseNode(1.5,1.5,0.08,800,'bandpass');
  }

  // ===== 😔 DÉFAITE — Descente légère =====
  function lose(){
    if(_muted) return;
    if(gameMusic) gameMusic.fadeOut(0.8);

    // Descente musicale 2-3 secondes
    [440,392,349.23,293.66,261.63].forEach((f,i)=>{
      synth(f,'sine',i*0.25,0.3,v(0.2));
      pad(f/2,i*0.25,0.4,0.1);
    });

    // Fin grave
    synth(130.81,'sine',1.2,0.6,v(0.25));
    noiseNode(1.2,0.3,0.1,200,'lowpass');
  }

  // ===== MUTE =====
  function toggleMute(){
    _muted=!_muted;
    if(homeMusic) homeMusic.setVol(_muted?0:_musicVol);
    const btn=document.getElementById('sound-btn');
    if(btn) btn.textContent=_muted?'🔇':'🔊';
    if(!_muted) btnClick();
    return _muted;
  }

  function setVol(v2){ _sfxVol=v2; }

  return {
    // Musiques
    startHomeMusic, stopHomeMusic, startGameMusic, stopGameMusic,
    // Pièces
    coinCling, coinRain, betPlaced, reward, bigWin, betDeducted,
    // Jeu
    gameStart, dice, diceResult, move, capture, safe,
    pieceDone, myTurn, turnChange, invalid, valid,
    allDone, playerJoin, playerLeave, chatMsg,
    countdown, timeOut,
    // Interface
    btnHover, btnClick, modalOpen, modalClose, menuBack,
    // Fin
    win, lose,
    // Utils
    toggleMute, setVol, isMuted:()=>_muted,
    // Legacy
    click:btnClick, notif:myTurn, pieceBack:()=>{},
    test(){
      const ac=getCtx();
      if(!ac){ console.error('❌ AudioContext non dispo'); return false; }
      coinCling(); setTimeout(()=>reward(),400);
      console.log('✅ SFX v4 Modern Premium - state:',ac.state);
      return true;
    },
    getState(){ const ac=getCtx(); return ac?ac.state:'not initialized'; }
  };
})();

window.addEventListener('load',()=>{
  console.log('🎵 SFX v4 Modern Premium loaded. SFX.test() pour tester.');
});