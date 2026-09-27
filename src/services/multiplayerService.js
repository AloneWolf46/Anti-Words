import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

// Rastgele 6 haneli oda kodu üretici
export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Tohum tabanlı rastgele sayı üretici (Mulberry32)
export function createSeededRandom(seed) {
  let s = (Number(seed) || 123456) >>> 0;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Düello Kapsamlı Performans Puanı (Rating)
 * Skor, Doğruluk (yüksek ağırlıklı), Hız (WPM) ve Canları tek bir adil puana dönüştürür.
 * Rastgele tuşlara basıp doğruluğu düşüren oyuncuları sert biçimde geriye düşürür.
 * @param {Object} stats - { score, accuracy, wpm, lives }
 * @returns {number}
 */
export function calculateDuelRating(stats) {
  const score = Math.max(0, Number(stats?.score) || 0);
  const accuracy = Math.max(0, Math.min(100, Number(stats?.accuracy ?? 100)));
  const wpm = Math.max(0, Number(stats?.wpm) || 0);
  const lives = Math.max(0, Number(stats?.lives ?? 3));

  // Doğruluk oranı üssü 1.25 ile ağırlıklandırılır:
  // %100 doğruluk -> 1.0 (Skor aynen korunur)
  // %80 doğruluk -> 0.75
  // %50 doğruluk -> 0.42
  // %21 doğruluk -> 0.14 (120 skor -> sadece 17 net puana düşer!)
  const accuracyRatio = accuracy / 100;
  const netScore = score * Math.pow(accuracyRatio, 1.25);
  const speedBonus = wpm * 1.5;
  const lifeBonus = lives * 10;

  return Math.round((netScore + speedBonus + lifeBonus) * 10) / 10;
}

/**
 * 1v1 Düello Nihai Sonuç Belirleyici (Matematiksel ve Kural Tabanlı Kesin Çözümleyici)
 * İki oyuncunun asla aynı anda 'victory' veya hatalı sonuç görmemesini garanti eder.
 * Doğruluk, Skor, Hız ve Hayatta Kalmayı birlikte değerlendirir.
 * @param {Object} myStats - { score, lives, wpm, accuracy, isEliminated }
 * @param {Object} rivalStats - { score, lives, wpm, accuracy, isEliminated }
 * @returns {'victory' | 'defeat' | 'draw'}
 */
export function determineDuelOutcome(myStats, rivalStats) {
  const myLives = myStats?.lives !== undefined ? Number(myStats.lives) : (myStats?.isEliminated ? 0 : 3);
  const rivalLives = rivalStats?.lives !== undefined ? Number(rivalStats.lives) : (rivalStats?.isEliminated ? 0 : 3);

  const myDead = Boolean(myStats?.isEliminated || myLives <= 0);
  const rivalDead = Boolean(rivalStats?.isEliminated || rivalLives <= 0);

  // 1. Kural: Biri elenmiş, diğeri hayattaysa hayatta kalan kazanır
  if (myDead && !rivalDead) {
    return 'defeat';
  }
  if (rivalDead && !myDead) {
    return 'victory';
  }

  // 2. Kural: Skorlar eşitse kesinlikle BERABERE
  const myScore = Number(myStats?.score) || 0;
  const rivalScore = Number(rivalStats?.score) || 0;

  if (myScore === rivalScore) {
    return 'draw';
  }

  // 3. Kural: Skoru yüksek olan kazanır
  if (myScore > rivalScore) {
    return 'victory';
  }
  return 'defeat';
}

/**
 * Çok Oyunculu Oda Yöneticisi Sınıfı
 */
/**
 * Çok Oyunculu Oda Yöneticisi Sınıfı
 * 1v1 Düello, Çok Kişilik Grup Odası ve Genel Canlı Arena (Fast Fingers) destekler.
 */
export class MultiplayerRoom {
  constructor({
    roomCode,
    isHost,
    playerName,
    difficulty = 'medium',
    seed,
    duration = 60,
    map = 'WOOD',
    roomType = 'group', // '1v1' | 'group' | 'arena'
  }) {
    this.roomCode = roomCode.trim().toUpperCase();
    this.isHost = isHost;
    this.playerName = playerName;
    this.clientId = `${this.playerName}_${Math.random().toString(36).substring(2, 9)}`;
    this.difficulty = difficulty;
    this.duration = Number(duration) || 60;
    this.gameMap = map || 'WOOD';
    this.roomType = roomType;
    this.seed = seed || Math.floor(Math.random() * 1000000);
    this.channel = null;
    this.localChannel = null;
    this.listeners = new Map();
    this.isOnline = isSupabaseConfigured();
    this.rivalInfo = null;
    this.participants = new Map(); // id -> { id, name, isHost, joinedAt, ready, stats }
    this.isSubscribed = false;

    // Kendimizi katılımcı olarak ekleyelim
    this.participants.set(this.clientId, {
      id: this.clientId,
      name: this.playerName,
      isHost: this.isHost,
      joinedAt: Date.now(),
      ready: true,
      stats: null,
    });

    this.matchStartedLocally = false;
    this.pollTimer = null;

    this._initChannel();
    this._initDatabaseSync();
  }

  _initChannel() {
    const channelName = `antiwords_room_${this.roomCode}`;

    // 1. Supabase Realtime Kanalı (Bulut WebSocket)
    if (this.isOnline && supabase) {
      try {
        this.channel = supabase.channel(channelName, {
          config: {
            broadcast: { self: false },
            presence: { key: this.clientId },
          },
        });

        this.channel
          .on('broadcast', { event: 'game_event' }, ({ payload }) => {
            this._handleIncomingEvent(payload);
          })
          .on('presence', { event: 'sync' }, () => {
            const state = this.channel.presenceState();
            const list = [];
            Object.keys(state).forEach((key) => {
              const p = state[key]?.[0] || {};
              list.push({
                id: key,
                name: p.playerName || key,
                isHost: Boolean(p.isHost),
                joinedAt: p.joinedAt || Date.now(),
                ready: true,
              });
            });
            this._syncParticipants(list);
          })
          .on('presence', { event: 'join' }, ({ key, newPresences }) => {
            const p = newPresences?.[0] || {};
            this._addParticipant({
              id: key,
              name: p.playerName || key,
              isHost: Boolean(p.isHost),
              joinedAt: p.joinedAt || Date.now(),
              ready: true,
            });

            if (this.isHost && key !== this.clientId) {
              this.sendEvent({
                type: 'room_synced',
                seed: this.seed,
                difficulty: this.difficulty,
                duration: this.duration,
                gameMap: this.gameMap,
                roomType: this.roomType,
                hostName: this.playerName,
              });
            }
          })
          .on('presence', { event: 'leave' }, ({ key }) => {
            this._removeParticipant(key);
          })
          .subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
              this.isSubscribed = true;
              try {
                await this.channel.track({
                  playerName: this.playerName,
                  isHost: this.isHost,
                  joinedAt: Date.now(),
                });
              } catch (trackErr) {
                console.warn('Presence track uyarısı:', trackErr);
              }

              const announcePacket = {
                type: 'player_announced',
                name: this.playerName,
                clientId: this.clientId,
                isHost: this.isHost,
              };
              this.sendEvent(announcePacket);
              setTimeout(() => this.sendEvent(announcePacket), 350);
              setTimeout(() => this.sendEvent(announcePacket), 900);
            }
          });
      } catch (e) {
        console.warn('Supabase Realtime kanalı kurulamadı, yerel kanala geçiliyor:', e);
      }
    }

    // 2. Yerel BroadcastChannel (Sekmeler arası anında iletişim)
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      this.localChannel = new window.BroadcastChannel(channelName);
      this.localChannel.onmessage = (event) => {
        if (event.data && event.data.payload) {
          this._handleIncomingEvent(event.data.payload);
        }
      };

      // Odaya katıldığımızı yerel kanaldakilere bildir (anında ve kısa aralıklarla)
      const localAnnounce = {
        type: 'player_announced',
        name: this.playerName,
        clientId: this.clientId,
        isHost: this.isHost,
      };
      setTimeout(() => this.sendEvent(localAnnounce), 50);
      setTimeout(() => this.sendEvent(localAnnounce), 300);
    }
  }

  _initDatabaseSync() {
    if (!this.isOnline || !supabase || this.roomCode === 'ARENA') return;

    // 1. Host odasını veritabanında kaydeder veya günceller (Harita difficulty alanında saklanır)
    if (this.isHost) {
      const encodedDiff = `${this.difficulty}|${this.gameMap || 'WOOD'}`;
      supabase
        .from('game_rooms')
        .upsert(
          {
            room_code: this.roomCode,
            status: 'waiting',
            host_name: this.playerName,
            difficulty: encodedDiff,
            seed: this.seed,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'room_code' }
        )
        .then(({ error }) => {
          if (error) console.warn('[MultiplayerRoom] DB upsert uyarısı:', error.message);
        })
        .catch(() => {});
    } else {
      // Misafir odaya katıldığını veritabanına yazar
      supabase
        .from('game_rooms')
        .update({
          guest_name: this.playerName,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(({ error }) => {
          if (error) console.warn('[MultiplayerRoom] DB guest update uyarısı:', error.message);
        })
        .catch(() => {});
    }

    // 2. Periyodik REST Polling (1000ms):
    // WebSocket / BroadcastChannel engellense dahi iki tarafın birbirini ve maç başlangıcını %100 bulmasını sağlar.
    this.pollTimer = setInterval(async () => {
      try {
        const { data, error } = await supabase
          .from('game_rooms')
          .select('*')
          .eq('room_code', this.roomCode)
          .maybeSingle();

        if (error || !data) return;

        // Host isek ve DB'de misafir belirdiyse katılımcılara ekle
        if (this.isHost && data.guest_name) {
          const guestId = `guest_${data.guest_name}`;
          const alreadyExists = Array.from(this.participants.values()).some(
            (p) => p.id !== this.clientId && (p.name === data.guest_name || p.id === guestId)
          );
          if (!alreadyExists) {
            this._addParticipant({
              id: guestId,
              name: data.guest_name,
              isHost: false,
              joinedAt: Date.now(),
              ready: true,
            });
          }
        }

        // Misafir isek ve DB'de host bilgisi varsa ekle
        if (!this.isHost && data.host_name) {
          const hostId = `host_${data.host_name}`;
          const alreadyExists = Array.from(this.participants.values()).some(
            (p) => p.id !== this.clientId && (p.name === data.host_name || p.id === hostId)
          );
          if (!alreadyExists) {
            this._addParticipant({
              id: hostId,
              name: data.host_name,
              isHost: true,
              joinedAt: Date.now(),
              ready: true,
            });
          }
          if (data.seed) this.seed = data.seed;
          if (data.difficulty) {
            if (data.difficulty.includes('|')) {
              const [diff, map] = data.difficulty.split('|');
              if (diff) this.difficulty = diff;
              if (map && this.gameMap !== map) {
                this.gameMap = map;
                this._emit('settings_updated', { gameMap: map, difficulty: diff });
                this._emit('room_synced', { gameMap: map, difficulty: diff, hostName: data.host_name });
              }
            } else {
              this.difficulty = data.difficulty;
            }
          }
        }

        // DB'de maç başlatıldıysa (status === 'countdown') ve henüz yerelde başlamadıysa:
        if (data.status === 'countdown' && !this.matchStartedLocally) {
          this.matchStartedLocally = true;
          let countdownMap = this.gameMap || 'WOOD';
          let countdownDiff = this.difficulty;
          if (data.difficulty && data.difficulty.includes('|')) {
            const [d, m] = data.difficulty.split('|');
            if (m) countdownMap = m;
            if (d) countdownDiff = d;
          }
          this.gameMap = countdownMap;
          this.difficulty = countdownDiff;

          const countdownPayload = {
            type: 'match_countdown',
            seed: data.seed || this.seed,
            difficulty: countdownDiff,
            duration: this.duration,
            gameMap: countdownMap,
            roomType: this.roomType,
            countdownSeconds: 3,
            matchStartTime: Date.now() + 3200,
            matchEndTime: Date.now() + 3200 + this.duration * 1000,
            timestamp: Date.now(),
          };
          this._emit('match_countdown', countdownPayload);
        }
      } catch (err) {
        // Sessiz hata yakalama
      }
    }, 1000);
  }

  _getParticipant(idOrName) {
    if (!idOrName) return null;
    if (this.participants.has(idOrName)) {
      return this.participants.get(idOrName);
    }
    for (const p of this.participants.values()) {
      if (p.id === idOrName) {
        return p;
      }
    }
    for (const p of this.participants.values()) {
      if (p.name === idOrName) {
        return p;
      }
    }
    return null;
  }

  _syncParticipants(list) {
    list.forEach((p) => {
      const id = p.id || p.clientId || p.name;
      const existing = this._getParticipant(id);
      this.participants.set(id, {
        ...p,
        id,
        stats: existing?.stats || p.stats || null,
      });
    });

    const others = Array.from(this.participants.values()).filter(
      (p) => p.id !== this.clientId
    );
    if (others.length > 0) {
      this.rivalInfo = { name: others[0].name, id: others[0].id };
      this._emit('rival_connected', { name: others[0].name, id: others[0].id });
    }

    this._emit('participants_updated', Array.from(this.participants.values()));
  }

  _addParticipant(participant) {
    const id = participant.id || participant.clientId || participant.name;
    const existing = this._getParticipant(id);
    const merged = {
      ...participant,
      id,
      stats: existing?.stats || participant.stats || null,
    };
    this.participants.set(id, merged);
    if (id !== this.clientId) {
      this.rivalInfo = { name: participant.name, id };
      this._emit('rival_connected', { name: participant.name, id });
    }
    this._emit('participant_joined', merged);
    this._emit('participants_updated', Array.from(this.participants.values()));
  }

  _removeParticipant(idOrName) {
    if (!idOrName) return;
    this.participants.delete(idOrName);
    for (const [k, v] of this.participants.entries()) {
      if (v.id === idOrName) {
        this.participants.delete(k);
      }
    }
    const others = Array.from(this.participants.values()).filter(
      (p) => p.id !== this.clientId
    );
    this.rivalInfo = others.length > 0 ? { name: others[0].name, id: others[0].id } : null;
    this._emit('participant_left', { name: idOrName, id: idOrName });
    this._emit('participants_updated', Array.from(this.participants.values()));
  }

  _handleIncomingEvent(payload) {
    if (!payload || !payload.type) return;

    // Kendimizden gelen paketleri yoksay (aynı isimli iki sekme/oyuncu olsa bile clientId ile kesin ayrım)
    const isFromSelf = payload.clientId
      ? payload.clientId === this.clientId
      : payload.senderId
      ? payload.senderId === this.clientId
      : false;

    if (isFromSelf) return;

    // Yeni oyuncu duyurusu (Handshake)
    if (payload.type === 'player_announced') {
      this._addParticipant({
        id: payload.clientId || payload.senderId || payload.name,
        name: payload.name,
        isHost: Boolean(payload.isHost),
        joinedAt: payload.timestamp || Date.now(),
        ready: true,
      });

      // İki yönlü tanışma onayı (Ben de buradayım)
      this.sendEvent({
        type: 'player_presence_ack',
        name: this.playerName,
        clientId: this.clientId,
        senderId: this.clientId,
        isHost: this.isHost,
      });

      // Host ise yeni gelen oyuncuya oda durumunu gönder
      if (this.isHost) {
        this.sendEvent({
          type: 'room_synced',
          seed: this.seed,
          difficulty: this.difficulty,
          duration: this.duration,
          gameMap: this.gameMap,
          roomType: this.roomType,
          hostName: this.playerName,
        });
      }
      return;
    }

    // Handshake yanıtı
    if (payload.type === 'player_presence_ack') {
      this._addParticipant({
        id: payload.clientId || payload.senderId || payload.name,
        name: payload.name,
        isHost: Boolean(payload.isHost),
        joinedAt: payload.timestamp || Date.now(),
        ready: true,
      });
      return;
    }

    // Senkronizasyon verileri (Host'tan geldiğinde)
    if (payload.type === 'room_synced' && !this.isHost) {
      this.seed = payload.seed;
      this.difficulty = payload.difficulty;
      this.duration = payload.duration || 60;
      if (payload.gameMap) this.gameMap = payload.gameMap;
      if (payload.roomType) this.roomType = payload.roomType;
      this.rivalInfo = { name: payload.hostName, id: payload.clientId || payload.senderId };
      this._emit('room_synced', payload);
      this._emit('rival_connected', { name: payload.hostName, id: payload.clientId || payload.senderId });
      return;
    }

    // Ayarlar güncellendiğinde
    if (payload.type === 'settings_updated' && !this.isHost) {
      if (payload.gameMap) this.gameMap = payload.gameMap;
      if (payload.difficulty) this.difficulty = payload.difficulty;
      if (payload.duration) this.duration = payload.duration;
      if (payload.roomType) this.roomType = payload.roomType;
      this._emit('settings_updated', payload);
      return;
    }

    // Canlı oyuncu ilerlemesi (Çoklu katılımcı ve 1v1 düello için kesin anlık senkronizasyon)
    if (payload.type === 'player_live_progress') {
      const pId = payload.clientId || payload.senderId || payload.sender;
      let p = this._getParticipant(pId);
      if (!p) {
        p = { id: pId, name: payload.sender, isHost: Boolean(payload.isHost) };
      }
      p.stats = {
        score: payload.score || 0,
        wpm: payload.wpm || 0,
        words: payload.words || 0,
        accuracy: payload.accuracy || 100,
        lives: payload.lives ?? 3,
        isEliminated: Boolean(payload.isEliminated),
      };
      this.participants.set(pId, p);
      this._emit('participants_progress', Array.from(this.participants.values()));
      this._emit('player_progress', { playerId: pId, progress: p.stats });

      // 1v1 rakip canlı ilerlemesi (Anlık skor, can, hız, doğruluk)
      this._emit('rival_progress', {
        score: payload.score || 0,
        lives: payload.lives !== undefined ? payload.lives : 3,
        wpm: payload.wpm || 0,
        words: payload.words || 0,
        accuracy: payload.accuracy || 100,
        name: payload.sender || 'Rakip',
      });
      return;
    }

    // Oyuncu elendi
    if (payload.type === 'rival_eliminated') {
      const pId = payload.clientId || payload.senderId || payload.sender;
      const p = this._getParticipant(pId) || { id: pId, name: payload.sender };
      p.stats = {
        ...(p.stats || {}),
        ...(payload.finalStats || {}),
        lives: 0,
        isEliminated: true,
      };
      this.participants.set(pId, p);
      this._emit('player_eliminated', { playerId: pId, finalStats: payload.finalStats });
      this._emit('rival_eliminated', payload);
      return;
    }

    // Oyuncu tamamladı veya elendi
    if (payload.type === 'player_live_finished') {
      const pId = payload.clientId || payload.senderId || payload.sender;
      const p = this._getParticipant(pId) || { id: pId, name: payload.sender };
      p.stats = {
        score: payload.score || 0,
        wpm: payload.wpm || 0,
        words: payload.words || 0,
        accuracy: payload.accuracy || 100,
        lives: payload.lives ?? 0,
        isEliminated: Boolean(payload.isEliminated),
        finished: true,
      };
      this.participants.set(pId, p);
      this._emit('participants_finished_update', Array.from(this.participants.values()));
      this._emit('player_live_finished', payload);
      return;
    }

    // Geri sayım başladığında
    if (payload.type === 'match_countdown') {
      if (payload.gameMap) this.gameMap = payload.gameMap;
      if (payload.difficulty) this.difficulty = payload.difficulty;
      if (payload.duration) this.duration = payload.duration;
      if (payload.seed) this.seed = payload.seed;
      if (payload.roomType) this.roomType = payload.roomType;
    }

    // Tekrar oyna / Lobiye dönüş olayı
    if (payload.type === 'rematch_lobby') {
      this.matchStartedLocally = false;
      if (payload.seed) this.seed = payload.seed;
      if (payload.gameMap) this.gameMap = payload.gameMap;
      if (payload.difficulty) this.difficulty = payload.difficulty;
      if (payload.duration) this.duration = payload.duration;
      for (const p of this.participants.values()) {
        p.stats = null;
        p.ready = true;
      }
      this._emit('participants_updated', Array.from(this.participants.values()));
    }

    this._emit(payload.type, payload);
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.listeners.get(event)?.delete(callback);
  }

  _emit(event, data) {
    const set = this.listeners.get(event);
    if (set) {
      set.forEach((cb) => {
        try {
          cb(data);
        } catch (e) {
          console.error(`Olay işleme hatası [${event}]:`, e);
        }
      });
    }
  }

  sendEvent(payload) {
    const packet = {
      ...payload,
      sender: this.playerName,
      clientId: this.clientId,
      senderId: this.clientId,
      isHost: this.isHost,
      timestamp: Date.now(),
    };

    try {
      if (this.channel && this.isOnline) {
        this.channel
          .send({
            type: 'broadcast',
            event: 'game_event',
            payload: packet,
          })
          .catch?.(() => {});
      }
    } catch (err) {
      console.warn('Realtime send uyarısı:', err);
    }

    try {
      if (this.localChannel) {
        this.localChannel.postMessage({ payload: packet });
      }
    } catch (err) {
      console.warn('BroadcastChannel send uyarısı:', err);
    }
  }

  // Canlı ilerleme durumu gönderme (Grup & 1v1 ortak)
  sendProgress({ score, lives, wpm, combo, currentWord, words, accuracy, isEliminated = false }) {
    // Kendi nesnemizi güncelle
    const self = this.participants.get(this.clientId) || this._getParticipant(this.clientId) || this._getParticipant(this.playerName);
    if (self) {
      self.stats = { score, lives, wpm, words, accuracy, isEliminated };
    }

    const payload = {
      type: 'player_live_progress',
      score,
      lives,
      wpm,
      words,
      accuracy,
      combo,
      currentWord,
      isEliminated,
    };
    this.sendEvent(payload);
  }

  // Oyun sonu nihai sonucunu odaya bildirme
  sendFinalStats({ score, lives, wpm, words, accuracy, isEliminated = false }) {
    const payload = {
      type: 'player_live_finished',
      score,
      lives,
      wpm,
      words,
      accuracy,
      isEliminated,
    };
    this.sendEvent(payload);
    setTimeout(() => this.sendEvent(payload), 100);
  }

  // Oyuncunun elendiğini bildirme
  sendEliminated(finalStats) {
    const packet = {
      type: 'rival_eliminated',
      finalStats,
      senderRole: this.isHost ? 'host' : 'guest',
    };
    this.sendEvent(packet);
  }

  // Çok oyunculu / Grup / Arena bitiş bildirimi
  sendFinished(participantStats) {
    const stats = participantStats?.stats || participantStats || {};
    this.sendFinalStats({
      score: stats.score,
      lives: stats.lives,
      wpm: stats.wpm,
      words: stats.words,
      accuracy: stats.accuracy,
      isEliminated: Boolean(stats.isEliminated || (stats.lives !== undefined && stats.lives <= 0)),
    });
  }

  // 1v1 veya Hakem Maç Bitiş Bildirimi (Kazanan / Kaybeden / Skorlar)
  sendMatchEnd(data) {
    const packet = {
      type: 'match_ended',
      ...(data || {}),
    };
    this.sendEvent(packet);
    setTimeout(() => this.sendEvent(packet), 80);

    // Supabase DB güncellemesi (Maç bittiğinde odayı 'finished' olarak işaretle)
    if (this.isOnline && supabase && this.roomCode !== 'ARENA') {
      supabase
        .from('game_rooms')
        .update({
          status: 'finished',
          winner: data?.winnerRole || null,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(() => {})
        .catch(() => {});
    }
  }

  // Lobi ayarlarını güncelleme
  updateSettings({ map, difficulty, duration, roomType }) {
    if (map) this.gameMap = map;
    if (difficulty) this.difficulty = difficulty;
    if (duration) this.duration = duration;
    if (roomType) this.roomType = roomType;

    // Supabase DB güncellemesi (Host haritayı değiştirdiğinde DB'yi anında güncelle)
    if (this.isHost && this.isOnline && supabase && this.roomCode !== 'ARENA') {
      const encodedDiff = `${this.difficulty}|${this.gameMap || 'WOOD'}`;
      supabase
        .from('game_rooms')
        .update({
          difficulty: encodedDiff,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(() => {})
        .catch(() => {});
    }

    this.sendEvent({
      type: 'settings_updated',
      gameMap: this.gameMap,
      difficulty: this.difficulty,
      duration: this.duration,
      roomType: this.roomType,
    });
  }

  // Maçı başlatma (Tüm odadaki katılımcılara geri sayım gönderir)
  startMatch(customDuration, customMap) {
    const finalDuration = customDuration !== undefined ? customDuration : this.duration;
    const finalMap = customMap || this.gameMap || 'WOOD';
    this.duration = finalDuration;
    this.gameMap = finalMap;
    this.matchStartedLocally = true;

    const now = Date.now();
    const matchStartTime = now + 3200;
    const matchEndTime = matchStartTime + finalDuration * 1000;

    const countdownPayload = {
      type: 'match_countdown',
      seed: this.seed,
      difficulty: this.difficulty,
      duration: finalDuration,
      gameMap: finalMap,
      roomType: this.roomType,
      countdownSeconds: 3,
      matchStartTime,
      matchEndTime,
      timestamp: now,
    };

    // 1. WebSocket & Yerel Broadcast gönderimi
    this.sendEvent(countdownPayload);
    setTimeout(() => this.sendEvent(countdownPayload), 100);
    setTimeout(() => this.sendEvent(countdownPayload), 250);

    // 2. Supabase DB güncellemesi (status: 'countdown' ve haritayı difficulty içinde sakla)
    if (this.isOnline && supabase && this.roomCode !== 'ARENA') {
      const encodedDiff = `${this.difficulty}|${finalMap}`;
      supabase
        .from('game_rooms')
        .update({
          status: 'countdown',
          difficulty: encodedDiff,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(() => {})
        .catch(() => {});
    }

    // 3. Yerel bildirim
    this._emit('match_countdown', countdownPayload);
  }

  // Tekrar Oyna / Lobiye Dönüş: Odayı yeni maç için hazırla (yeni link gerekmez)
  resetForRematch() {
    this.matchStartedLocally = false;
    this.seed = Math.floor(Math.random() * 10000000);
    for (const p of this.participants.values()) {
      p.stats = null;
      p.ready = true;
    }
    this._emit('participants_updated', Array.from(this.participants.values()));

    if (this.isHost && this.isOnline && supabase && this.roomCode !== 'ARENA') {
      const encodedDiff = `${this.difficulty}|${this.gameMap || 'WOOD'}`;
      supabase
        .from('game_rooms')
        .update({
          status: 'waiting',
          difficulty: encodedDiff,
          seed: this.seed,
          winner: null,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(() => {})
        .catch(() => {});
    }

    const rematchPayload = {
      type: 'rematch_lobby',
      roomCode: this.roomCode,
      difficulty: this.difficulty,
      gameMap: this.gameMap,
      duration: this.duration,
      seed: this.seed,
    };
    this.sendEvent(rematchPayload);
    setTimeout(() => this.sendEvent(rematchPayload), 120);
    this._emit('rematch_lobby', rematchPayload);
  }

  // Odadan ayrılma
  leave() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.sendEvent({ type: 'rival_left', name: this.playerName });

    if (this.isHost && this.isOnline && supabase && this.roomCode !== 'ARENA') {
      supabase
        .from('game_rooms')
        .update({
          status: 'finished',
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', this.roomCode)
        .then(() => {})
        .catch(() => {});
    }

    if (this.channel && this.isOnline && supabase) {
      try {
        supabase.removeChannel(this.channel);
      } catch (e) {}
    }
    if (this.localChannel) {
      try {
        this.localChannel.close();
      } catch (e) {}
    }
    this.listeners.clear();
  }
}

/**
 * Grup & Arena Maçları İçin Çoklu Oyuncu Sıralama Algoritması
 * Fast Fingers standartlarına göre WPM ve Doğruluk oranlarına göre adil sıralama üretir.
 */
export function calculateRoomRankings(participantsList = []) {
  return [...participantsList]
    .map((p) => {
      const stats = p.stats || {};
      const score = Number(stats.score) || 0;
      const wpm = Number(stats.wpm) || 0;
      const accuracy = Number(stats.accuracy !== undefined ? stats.accuracy : 100);
      const words = Number(stats.words) || 0;
      const lives = Number(stats.lives !== undefined ? stats.lives : 3);
      const isEliminated = Boolean(stats.isEliminated || lives <= 0);

      // Fast Fingers derecelendirme puanı
      const rating = calculateDuelRating({ score, accuracy, wpm, lives, isEliminated });

      return {
        name: p.name,
        isHost: Boolean(p.isHost),
        wpm,
        accuracy,
        score,
        words,
        lives,
        isEliminated,
        rating,
      };
    })
    .sort((a, b) => {
      // 1. Canı bitmeyen ve elenmeyen öne geçer
      if (a.isEliminated !== b.isEliminated) {
        return a.isEliminated ? 1 : -1;
      }
      // 2. Rating puanı yüksek olan
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      // 3. WPM Hızı yüksek olan
      if (b.wpm !== a.wpm) {
        return b.wpm - a.wpm;
      }
      // 4. Doğruluk oranı yüksek olan
      return b.accuracy - a.accuracy;
    })
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
}

// Sabit Açık Genel Canlı Arena Kodu
export const PUBLIC_ARENA_CODE = 'ARENA';

/**
 * Yeni bir özel grup veya 1v1 odası oluşturur
 */
export async function createRoom({
  hostName,
  difficulty = 'medium',
  duration = 60,
  map = 'WOOD',
  roomType = 'group',
  roomCode: customRoomCode,
}) {
  const roomCode = customRoomCode ? customRoomCode.trim().toUpperCase().slice(0, 6) : generateRoomCode();
  const seed = Math.floor(Math.random() * 10000000);

  return new MultiplayerRoom({
    roomCode,
    isHost: true,
    playerName: hostName,
    difficulty,
    duration,
    map,
    seed,
    roomType,
  });
}

/**
 * Açık Genel Canlı Arenaya Katılır (Fast Fingers Canlı Kanalı)
 */
export async function joinPublicArena({
  playerName,
  difficulty = 'medium',
  duration = 60,
  map = 'WOOD',
}) {
  return new MultiplayerRoom({
    roomCode: PUBLIC_ARENA_CODE,
    isHost: false,
    playerName,
    difficulty,
    duration,
    map,
    roomType: 'arena',
  });
}

/**
 * Bir oda kodunun geçerli, aktif ve karşı tarafta bekleyen bir oyuncusu olup olmadığını kontrol eder.
 */
export async function checkRoomStatus(roomCode) {
  if (!roomCode) {
    return { active: false, reason: 'INVALID_CODE', message: 'Geçersiz oda kodu.' };
  }
  const cleanCode = roomCode.trim().toUpperCase().slice(0, 6);

  // Arena her zaman aktiftir
  if (cleanCode === PUBLIC_ARENA_CODE) {
    return { active: true, hostName: 'Fast Fingers Arena', difficulty: 'medium', map: 'WOOD' };
  }

  // Supabase kontrolü
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('room_code', cleanCode)
        .maybeSingle();

      if (error) {
        console.warn('[checkRoomStatus] DB sorgu hatası:', error.message);
        return { active: true, roomCode: cleanCode };
      }

      if (!data) {
        return {
          active: false,
          reason: 'NOT_FOUND',
          message: 'Bu oda bulunamadı veya silinmiş. Karşıda bekleyen bir oyuncu yok.',
        };
      }

      if (data.status === 'finished') {
        return {
          active: false,
          reason: 'FINISHED',
          hostName: data.host_name,
          message: 'Bu maç tamamlanmış ve oda kapatılmış. Karşıda bekleyen oyuncu yok.',
        };
      }

      if (data.status === 'playing') {
        return {
          active: false,
          reason: 'IN_PROGRESS',
          hostName: data.host_name,
          message: 'Bu düello maçı şu anda devam ediyor, yeni katılımcı kabul edilmiyor.',
        };
      }

      // Zaman aşımı kontrolü (15 dakika)
      const lastUpdate = data.updated_at ? new Date(data.updated_at).getTime() : 0;
      const fifteenMinutes = 15 * 60 * 1000;
      if (lastUpdate > 0 && Date.now() - lastUpdate > fifteenMinutes) {
        return {
          active: false,
          reason: 'EXPIRED',
          hostName: data.host_name,
          message: 'Odanın bekleme süresi dolmuş veya kurucu oyuncu ayrılmış.',
        };
      }

      // Aktif oda
      let pureDiff = data.difficulty;
      let encodedMap = 'WOOD';
      if (data.difficulty && data.difficulty.includes('|')) {
        const [d, m] = data.difficulty.split('|');
        pureDiff = d || 'medium';
        encodedMap = m || 'WOOD';
      }

      return {
        active: true,
        hostName: data.host_name,
        difficulty: pureDiff,
        map: encodedMap,
        seed: data.seed,
      };
    } catch (err) {
      console.warn('[checkRoomStatus] İstisna:', err);
      return { active: true, roomCode: cleanCode };
    }
  }

  // Yerel ortam fallback
  return { active: true, roomCode: cleanCode };
}

/**
 * Kod ile odaya katılır
 */
export async function joinRoomByCode({ roomCode, playerName, map = 'WOOD' }) {
  const cleanCode = roomCode.trim().toUpperCase().slice(0, 6);

  // Odanın aktiflik durumunu doğrula
  const status = await checkRoomStatus(cleanCode);
  if (!status.active) {
    return {
      success: false,
      error: status.message || 'Bu oda aktif değil veya süresi dolmuş.',
      reason: status.reason,
    };
  }

  const effectiveMap = status.map || map || 'WOOD';

  const room = new MultiplayerRoom({
    roomCode: cleanCode,
    isHost: false,
    playerName,
    map: effectiveMap,
    difficulty: status.difficulty || 'medium',
    seed: status.seed,
    roomType: cleanCode === PUBLIC_ARENA_CODE ? 'arena' : 'group',
  });

  return { success: true, room, map: effectiveMap };
}

/**
 * Rastgele Eşleşme (Online Kuyruk / Random Matchmaking)
 */
export async function findQuickMatch({
  playerName,
  difficulty = 'medium',
  duration = 60,
  map = 'WOOD',
}) {
  const queueChannelName = 'antiwords_matchmaking_queue';
  let matchedRoom = null;

  // 1. Supabase üzerinden online bekleyen oda ara (Son 2 dakika içinde açılmış, status 'waiting')
  if (isSupabaseConfigured() && supabase) {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: waitingRooms, error: searchErr } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('status', 'waiting')
        .not('room_code', 'like', 'CH_%')
        .neq('room_code', PUBLIC_ARENA_CODE)
        .neq('host_name', playerName)
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!searchErr && waitingRooms && waitingRooms.length > 0) {
        matchedRoom = waitingRooms[0].room_code;
      }
    } catch (err) {
      console.warn('[findQuickMatch] Supabase matchmaking arama uyarısı:', err);
    }
  }

  // 2. Eğer Supabase'de bulunamadıysa yerel BroadcastChannel üzerinden havuz tarama
  if (!matchedRoom && typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      const queueChan = new window.BroadcastChannel(queueChannelName);

      // Diğer odası açık bekleyen oyuncu var mı sor
      queueChan.postMessage({ type: 'seeking_match', playerName });

      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 600);
        queueChan.onmessage = (e) => {
          if (e.data?.type === 'host_available' && e.data.roomCode) {
            matchedRoom = e.data.roomCode;
            clearTimeout(timer);
            resolve();
          }
        };
      });

      queueChan.close();
    } catch {
      // sessizce geç
    }
  }

  if (matchedRoom) {
    // Var olan odaya katıl
    return joinRoomByCode({ roomCode: matchedRoom, playerName, map });
  }

  // Yoksa kendisi yeni bir oda açıp beklesin
  const room = await createRoom({ hostName: playerName, difficulty, duration, map, roomType: '1v1' });

  // Havuza kendisini bildirsin
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      const hostChan = new window.BroadcastChannel(queueChannelName);
      hostChan.onmessage = (e) => {
        if (e.data?.type === 'seeking_match') {
          hostChan.postMessage({
            type: 'host_available',
            hostName: playerName,
            roomCode: room.roomCode,
          });
        }
      };
    } catch {
      // sessizce geç
    }
  }

  return { room, isNew: true };
}
