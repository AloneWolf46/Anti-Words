/**
 * Web Audio API ile ses efektleri.
 */

let audioCtx = null;
let masterGain = null;
let isMuted = false;
let masterVolume = 0.8;

try {
  const savedVol = localStorage.getItem('antiwords_master_volume');
  if (savedVol !== null) {
    masterVolume = Math.max(0, Math.min(1, parseFloat(savedVol)));
  }
} catch {}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

export function getAudioDestination() {
  const ctx = getAudioContext();
  if (!masterGain) {
    masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(isMuted ? 0 : masterVolume, ctx.currentTime);
    masterGain.connect(ctx.destination);
  }
  return masterGain;
}

export function setMasterVolume(vol) {
  masterVolume = Math.max(0, Math.min(1, Number(vol) || 0));
  try {
    localStorage.setItem('antiwords_master_volume', masterVolume.toString());
  } catch {}
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime);
  }
}

export function getMasterVolume() {
  return masterVolume;
}

export function setMuted(muted) {
  isMuted = muted;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime);
  }
}

export function getIsMuted() {
  return isMuted;
}

export function toggleMute() {
  isMuted = !isMuted;
  if (masterGain && audioCtx) {
    masterGain.gain.setValueAtTime(isMuted ? 0 : masterVolume, audioCtx.currentTime);
  }
  return isMuted;
}

/** Kısa tık sesi — doğru harf basıldığında */
export function playTypeTick() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getAudioDestination());

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.08);
  } catch (e) { /* sessiz devam */ }
}

/** Kelime tamamlama sesi */
export function playDestroySound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(getAudioDestination());
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(220, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
    gain1.gain.setValueAtTime(0.15, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.25);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(getAudioDestination());
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1400, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
    gain2.gain.setValueAtTime(0.1, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.15);
  } catch (e) { /* sessiz devam */ }
}

/** Can kaybı / hata sesi */
export function playDamageSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getAudioDestination());

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (e) { /* sessiz devam */ }
}

/** Yanlış tuş sesi */
export function playWrongKeySound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(getAudioDestination());

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, ctx.currentTime);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) { /* sessiz devam */ }
}

/** Odun Vurma / Balta Darbe Sesi (Wood Chop) */
export function playWoodChopSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Tok ahşap darbesi (Düşük frekanslı resonant thud)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.09);

    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + 0.09);

    // 2. Keskin balta ucu vuruş çıtırtısı (White noise burst)
    const bufferSize = ctx.sampleRate * 0.05;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200, t);
    noiseFilter.Q.setValueAtTime(3, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.18, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
  } catch (e) { /* sessiz devam */ }
}

/** Odun Kırılma / Parçalanma Sesi (Wood Shatter) */
export function playWoodBreakSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Derin kırılma darbesi
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.28);

    gain.gain.setValueAtTime(0.32, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + 0.28);

    // 2. Çatlama ve kıymık sesleri
    const bufferSize = ctx.sampleRate * 0.18;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(800, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.22, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
  } catch (e) { /* sessiz devam */ }
}

/** Su Damlası Sesi (Water Droplet Plink) */
export function playWaterDropSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    // Su damlasının tipik frekans yükselişi ve düşüşü
    osc.frequency.setValueAtTime(600 + Math.random() * 200, t);
    osc.frequency.exponentialRampToValueAtTime(1400 + Math.random() * 300, t + 0.05);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.1);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + 0.12);
  } catch (e) { /* sessiz devam */ }
}

/** Çiçek Açma & Büyüme Kutlama Melodisi (Flower Bloom Chime) */
export function playFlowerBloomSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Do majör arpej)

    notes.forEach((freq, i) => {
      const noteTime = t + i * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.12, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.35);

      osc.connect(gain);
      gain.connect(getAudioDestination());
      osc.start(noteTime);
      osc.stop(noteTime + 0.35);
    });
  } catch (e) { /* sessiz devam */ }
}

/** Şef Bıçağı Doğrama Tıkırtısı (Crisp Kitchen Board Chop) */
export function playKnifeChopSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Kesme tahtası tok darbesi
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420 + Math.random() * 60, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.04);

    gain.gain.setValueAtTime(0.16, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + 0.05);

    // 2. Çelik bıçak temas çıtırtısı (Tık klik)
    const clickOsc = ctx.createOscillator();
    const clickGain = ctx.createGain();
    clickOsc.type = 'triangle';
    clickOsc.frequency.setValueAtTime(1800 + Math.random() * 400, t);
    clickOsc.frequency.exponentialRampToValueAtTime(600, t + 0.02);

    clickGain.gain.setValueAtTime(0.1, t);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.025);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start(t);
    clickOsc.stop(t + 0.025);
  } catch (e) { /* sessiz devam */ }
}

/** Tava Cızırtısı & Servis Zili (Dish Sizzle & Chef Ding) */
export function playDishSizzleSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Lezzetli tava cızırtısı (Sizzle)
    const bufferSize = ctx.sampleRate * 0.25;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.4;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2600, t);
    filter.Q.setValueAtTime(1.5, t);

    const sizzleGain = ctx.createGain();
    sizzleGain.gain.setValueAtTime(0.14, t);
    sizzleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    noise.connect(filter);
    filter.connect(sizzleGain);
    sizzleGain.connect(ctx.destination);
    noise.start(t);

    // 2. Şef Servis Zili ("Ting!")
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = 'sine';
    bell.frequency.setValueAtTime(1760, t + 0.05); // A6
    bellGain.gain.setValueAtTime(0.12, t + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);

    bell.connect(bellGain);
    bellGain.connect(ctx.destination);
    bell.start(t + 0.05);
    bell.stop(t + 0.45);
  } catch (e) { /* sessiz devam */ }
}

/** Futbol Topuna Vuruş / Şut Sesi (Punchy Leather Ball Kick) */
export function playBallKickSound(isSuperShot = false) {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Tok Deri & Krampon Darbesi (Low punch thud)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const startFreq = isSuperShot ? 220 : 160;
    const endFreq = isSuperShot ? 35 : 45;
    const dur = isSuperShot ? 0.16 : 0.09;

    osc.frequency.setValueAtTime(startFreq, t);
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);

    gain.gain.setValueAtTime(isSuperShot ? 0.38 : 0.22, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + dur);

    // 2. Krampon Temas Çıtırtısı & Hava Fırlama Hışırtısı
    const bufferSize = ctx.sampleRate * (isSuperShot ? 0.18 : 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSuperShot ? 800 : 550, t);
    filter.Q.setValueAtTime(1.8, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(isSuperShot ? 0.25 : 0.15, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + (isSuperShot ? 0.18 : 0.06));

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
  } catch (e) { /* sessiz devam */ }
}

/** Futbol Topunun Kalenin Ağlarına / Filesine Çarpma Sesi (File Sesi - Net Impact & Cord Rustle) */
export function playNetRustleSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Ağ Darbesi (Tok derin çarpma titreşimi)
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(85, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.08);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc.connect(gain);
    gain.connect(getAudioDestination());
    osc.start(t);
    osc.stop(t + 0.08);

    // 2. Naylon File İplerinin Titreşimi ve Hışırtısı (Realistic Net Cord Swish)
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const env = Math.exp(-i / (bufferSize * 0.28)) + 0.3 * Math.exp(-i / (bufferSize * 0.6));
      data[i] = (Math.random() * 2 - 1) * env;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, t);
    filter.Q.setValueAtTime(1.2, t);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.13, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(t);
  } catch (e) { /* sessiz devam */ }
}

/** Özel Gol Kutlama & Hakem Düdüğü Sesi (Yalnızca 10. Gol vb. Kilometre Taşlarında Çalar) */
export function playGoalSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Hakem Düdüğü (Çift tonlu keskin düdük: "Füü-Füüüt!")
    const whistleTimes = [
      { start: t, dur: 0.11, freq: 2750 },
      { start: t + 0.15, dur: 0.26, freq: 2950 },
    ];

    whistleTimes.forEach((w) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      // Vibrato modülasyonu
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.setValueAtTime(32, w.start);
      lfoGain.gain.setValueAtTime(45, w.start);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(w.freq, w.start);

      gain.gain.setValueAtTime(0.18, w.start);
      gain.gain.exponentialRampToValueAtTime(0.001, w.start + w.dur);

      osc.connect(gain);
      gain.connect(getAudioDestination());
      lfo.start(w.start);
      osc.start(w.start);
      lfo.stop(w.start + w.dur);
      osc.stop(w.start + w.dur);
    });

    // 2. Zafer / Gol Coşkusu Melodisi (Majör Fanfar)
    const fanfare = [
      { f: 523.25, time: t + 0.18, dur: 0.18 }, // C5
      { f: 659.25, time: t + 0.28, dur: 0.18 }, // E5
      { f: 783.99, time: t + 0.38, dur: 0.22 }, // G5
      { f: 1046.5, time: t + 0.50, dur: 0.45 }, // C6
    ];

    fanfare.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.f, note.time);

      gain.gain.setValueAtTime(0.14, note.time);
      gain.gain.exponentialRampToValueAtTime(0.001, note.time + note.dur);

      osc.connect(gain);
      gain.connect(getAudioDestination());
      osc.start(note.time);
      osc.stop(note.time + note.dur);
    });
  } catch (e) { /* sessiz devam */ }
}

/** Şantiye / İnşaat Çekiç Vurma Sesi (Bina dikildiğinde çalar) */
export function playConstructionHammerSound() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // 1. Metalik çekiç darbesi (Tık/Şangırtı)
    const metalOsc = ctx.createOscillator();
    const metalGain = ctx.createGain();
    metalOsc.type = 'triangle';
    metalOsc.frequency.setValueAtTime(1480, t);
    metalOsc.frequency.exponentialRampToValueAtTime(620, t + 0.08);

    metalGain.gain.setValueAtTime(0.2, t);
    metalGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    metalOsc.connect(metalGain);
    metalGain.connect(ctx.destination);
    metalOsc.start(t);
    metalOsc.stop(t + 0.09);

    // 2. Tahta / Taş oturma yankısı (Tok çekiç tınısı)
    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();
    woodOsc.type = 'sine';
    woodOsc.frequency.setValueAtTime(280, t);
    woodOsc.frequency.exponentialRampToValueAtTime(120, t + 0.14);

    woodGain.gain.setValueAtTime(0.24, t);
    woodGain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    woodOsc.connect(woodGain);
    woodGain.connect(ctx.destination);
    woodOsc.start(t);
    woodOsc.stop(t + 0.15);
  } catch (e) { /* sessiz devam */ }
}

/** Şehir Seviye Atlama & Evrim Coşkusu (Köy -> Kasaba -> Metropol) */
export function playCityUpgradeFanfare() {
  if (isMuted) return;
  try {
    const ctx = getAudioContext();
    const t = ctx.currentTime;

    // Yükselen ışıltılı çan notaları
    const notes = [
      { f: 523.25, time: t + 0.02, dur: 0.15 }, // C5
      { f: 659.25, time: t + 0.10, dur: 0.15 }, // E5
      { f: 783.99, time: t + 0.18, dur: 0.18 }, // G5
      { f: 1046.5, time: t + 0.26, dur: 0.24 }, // C6
      { f: 1318.5, time: t + 0.36, dur: 0.38 }, // E6
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.f, n.time);

      gain.gain.setValueAtTime(0.18, n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, n.time + n.dur);

      osc.connect(gain);
      gain.connect(getAudioDestination());
      osc.start(n.time);
      osc.stop(n.time + n.dur);
    });
  } catch (e) { /* sessiz devam */ }
}
