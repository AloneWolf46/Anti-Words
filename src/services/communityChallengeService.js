import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { getCurrentPlayerName } from '../utils/turkishUtils';

const STORAGE_KEY_CHALLENGES = 'antiwords_public_challenges';
const STORAGE_KEY_LEADERBOARD = 'antiwords_challenge_leaderboard';
const CHANNEL_NAME = 'antiwords_community_challenges_hub';
const MIGRATION_KEY = 'antiwords_challenges_cleared_v2';

// Challenge odaları için maksimum geçerlilik süresi (24 saat)
export const MAX_ROOM_LIFETIME_MS = 24 * 60 * 60 * 1000;

// Eski, takılı kalmış yerel önbellek odalarını bir defaya mahsus tamamen temizle
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(MIGRATION_KEY)) {
      localStorage.removeItem(STORAGE_KEY_CHALLENGES);
      localStorage.setItem(MIGRATION_KEY, 'true');
    }
  } catch {
    // sessizce geç
  }
}

/**
 * 24 saatlik süre kontrolü: Odanın süresi dolmuş mu?
 */
export function isChallengeExpired(challenge) {
  if (!challenge) return true;
  if (challenge.status === 'closed') return true;
  const createdAt = Number(challenge.createdAt) || 0;
  if (createdAt <= 0) return false;
  return Date.now() - createdAt > MAX_ROOM_LIFETIME_MS;
}

/**
 * Kalan süreyi okunabilir formatta döndürür (Örn: "18 sa 35 dk kaldı")
 */
export function getRemainingTimeText(createdAt) {
  const ts = Number(createdAt) || 0;
  if (ts <= 0) return '24 sa kaldı';
  const elapsed = Date.now() - ts;
  const remainingMs = Math.max(0, MAX_ROOM_LIFETIME_MS - elapsed);
  if (remainingMs <= 0) return 'Süresi Doldu';

  const totalMinutes = Math.floor(remainingMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours} sa ${minutes} dk kaldı`;
  }
  return `${minutes} dk kaldı`;
}

/**
 * Yerel depodan aktif ve 24 saati geçmemiş challenge'ları getirir
 */
export function getSavedChallenges() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHALLENGES);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const valid = parsed.filter((c) => c && c.id && !isChallengeExpired(c));
      if (valid.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(valid));
      }
      return valid;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Supabase `game_rooms` üzerinden online challenge odalarını çeker, önbelleğe kaydeder ve döndürür
 */
export async function fetchCommunityChallenges() {
  const localList = getSavedChallenges();

  if (!isSupabaseConfigured() || !supabase) {
    return localList;
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - MAX_ROOM_LIFETIME_MS).toISOString();
    const { data, error } = await supabase
      .from('game_rooms')
      .select('*')
      .like('room_code', 'CH_%')
      .neq('status', 'closed')
      .gte('created_at', twentyFourHoursAgo)
      .order('created_at', { ascending: false })
      .limit(30);

    if (error) {
      console.warn('[communityChallengeService] fetchCommunityChallenges DB hatası:', error.message);
      return localList;
    }

    if (!data || data.length === 0) {
      // Supabase'de hiç oda yoksa yerel liste ile devam et
      return localList;
    }

    const fetchedChallenges = data
      .map((row) => {
        const roomCodeOnly = (row.room_code || '').replace(/^CH_/, '');
        let title = `${row.host_name || 'Oyuncu'}'in Challenge'ı`;
        let map = 'WOOD';
        let difficulty = 'medium';
        let duration = 60;
        let createdAt = row.created_at ? new Date(row.created_at).getTime() : Date.now();

        // Metadata diff alanında JSON veya pipe ayrılmış formatta tutulabilir
        if (row.difficulty) {
          try {
            if (row.difficulty.startsWith('{')) {
              const parsedMeta = JSON.parse(row.difficulty);
              title = parsedMeta.t || title;
              map = parsedMeta.m || map;
              difficulty = parsedMeta.d || difficulty;
              duration = Number(parsedMeta.dur) || duration;
              if (parsedMeta.ca) createdAt = Number(parsedMeta.ca);
            } else if (row.difficulty.includes('|')) {
              const [d, m] = row.difficulty.split('|');
              difficulty = d || difficulty;
              map = m || map;
            } else {
              difficulty = row.difficulty;
            }
          } catch {
            // sessizce geç
          }
        }

        const challengeObj = {
          id: row.room_code,
          roomCode: roomCodeOnly,
          title,
          hostName: row.host_name || 'Kurucu',
          gameMap: map,
          difficulty,
          duration,
          createdAt,
          status: row.status || 'waiting',
          participantCount: row.guest_name ? 2 : 1,
        };

        return challengeObj;
      })
      .filter((c) => !isChallengeExpired(c));

    // Yerelde henüz Supabase'e düşmemiş taze odalar varsa onları da koru
    const mergedMap = new Map();
    for (const c of fetchedChallenges) {
      mergedMap.set(c.id, c);
    }
    for (const local of localList) {
      if (!mergedMap.has(local.id) && !isChallengeExpired(local)) {
        mergedMap.set(local.id, local);
      }
    }

    const finalList = Array.from(mergedMap.values()).sort(
      (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
    );

    localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(finalList));
    return finalList;
  } catch (err) {
    console.warn('[communityChallengeService] fetchCommunityChallenges istisna:', err);
    return localList;
  }
}

/**
 * Yerel depodan liderlik tablosunu getirir (WPM ve Doğruluk ile sıralı)
 */
export function getSavedLeaderboard() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEADERBOARD);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const currentName = getCurrentPlayerName();
      let hasChanges = false;
      const cleaned = parsed.map((item) => {
        if (!item.playerName || item.playerName === 'Oyuncu') {
          hasChanges = true;
          return { ...item, playerName: currentName };
        }
        return item;
      });
      if (hasChanges) {
        try {
          localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(cleaned));
        } catch {}
      }
      return sortLeaderboardEntries(cleaned);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * En iyi yazanları WPM ve Doğruluk önceliğine göre sıralar
 */
export function sortLeaderboardEntries(list) {
  if (!Array.isArray(list)) return [];
  return [...list].sort((a, b) => {
    if (b.wpm !== a.wpm) return b.wpm - a.wpm;
    if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
    return (b.score || 0) - (a.score || 0);
  });
}

/**
 * Bir odaya ait sıralamada her oyuncunun yalnızca en yüksek derecesini tutar ve sıralar
 */
export function sortAndDeduplicateRoomLeaderboard(list) {
  if (!Array.isArray(list)) return [];
  const bestByPlayer = new Map();

  for (const entry of list) {
    if (!entry || !entry.playerName) continue;
    const key = entry.playerName.trim().toLowerCase();
    const existing = bestByPlayer.get(key);

    if (!existing) {
      bestByPlayer.set(key, entry);
    } else {
      const isBetter =
        (entry.wpm || 0) > (existing.wpm || 0) ||
        ((entry.wpm || 0) === (existing.wpm || 0) && (entry.accuracy || 0) > (existing.accuracy || 0)) ||
        ((entry.wpm || 0) === (existing.wpm || 0) && (entry.accuracy || 0) === (existing.accuracy || 0) && (entry.score || 0) > (existing.score || 0));

      if (isBetter) {
        bestByPlayer.set(key, entry);
      }
    }
  }

  return sortLeaderboardEntries(Array.from(bestByPlayer.values()));
}

/**
 * Yeni bir Topluluk Challenge Odası oluşturur, Supabase'e yazar ve canlı yayınlar
 */
export async function createCommunityChallenge({
  title,
  hostName,
  map = 'WOOD',
  difficulty = 'medium',
  duration = 60,
  roomCode,
}) {
  const generatedCode = (roomCode || Math.random().toString(36).substring(2, 8))
    .toUpperCase()
    .slice(0, 6);
  const challengeId = `CH_${generatedCode}`;
  const now = Date.now();

  const newChallenge = {
    id: challengeId,
    roomCode: generatedCode,
    title: title?.trim() || `${hostName}'in Canlı Challenge'ı`,
    hostName: hostName?.trim() || 'Kurucu',
    gameMap: map,
    difficulty,
    duration: Number(duration) || 60,
    participantCount: 1,
    createdAt: now,
    status: 'active',
  };

  // 1. Yerel Depoya Kaydet
  const current = getSavedChallenges();
  const updated = [newChallenge, ...current.filter((c) => c.id !== challengeId)].slice(0, 30);
  localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(updated));

  // 2. Supabase `game_rooms` tablosuna kaydet (Böylece tüm dünya anlık görebilir)
  if (isSupabaseConfigured() && supabase) {
    try {
      const metaPayload = JSON.stringify({
        t: newChallenge.title,
        m: newChallenge.gameMap,
        d: newChallenge.difficulty,
        dur: newChallenge.duration,
        ca: newChallenge.createdAt,
      });

      await supabase.from('game_rooms').upsert(
        {
          room_code: challengeId,
          status: 'waiting',
          host_name: newChallenge.hostName,
          difficulty: metaPayload,
          seed: Math.floor(Math.random() * 1000000),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'room_code' }
      );
    } catch (err) {
      console.warn('[communityChallengeService] Supabase kayıt uyarısı:', err);
    }
  }

  // 3. Canlı Kanala Yayınla
  broadcastCommunityEvent({
    type: 'community_challenge_created',
    challenge: newChallenge,
  });

  return newChallenge;
}

/**
 * Challenge Odasını Günceller (Harita, Süre, Zorluk, Başlık)
 */
export async function updateCommunityChallenge(challengeId, updates) {
  if (!challengeId) return null;

  const current = getSavedChallenges();
  const target = current.find((c) => c.id === challengeId);
  if (!target) return null;

  const updatedChallenge = {
    ...target,
    title: updates.title !== undefined ? updates.title.trim() : target.title,
    gameMap: updates.map !== undefined ? updates.map : target.gameMap,
    difficulty: updates.difficulty !== undefined ? updates.difficulty : target.difficulty,
    duration: updates.duration !== undefined ? Number(updates.duration) : target.duration,
    updatedAt: Date.now(),
  };

  const nextList = current.map((c) => (c.id === challengeId ? updatedChallenge : c));
  localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(nextList));

  // Supabase Güncellemesi
  if (isSupabaseConfigured() && supabase) {
    try {
      const metaPayload = JSON.stringify({
        t: updatedChallenge.title,
        m: updatedChallenge.gameMap,
        d: updatedChallenge.difficulty,
        dur: updatedChallenge.duration,
        ca: updatedChallenge.createdAt,
      });

      await supabase
        .from('game_rooms')
        .update({
          difficulty: metaPayload,
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', challengeId);
    } catch (err) {
      console.warn('[communityChallengeService] Supabase güncelleme uyarısı:', err);
    }
  }

  // Canlı Kanala Bildir
  broadcastCommunityEvent({
    type: 'community_challenge_updated',
    challenge: updatedChallenge,
  });

  return updatedChallenge;
}

/**
 * Challenge Odasını Siler / Kapatır
 */
export async function deleteCommunityChallenge(challengeId) {
  if (!challengeId) return;

  // 1. Yerel Depodan Kaldır
  try {
    const current = getSavedChallenges().filter((c) => c.id !== challengeId);
    localStorage.setItem(STORAGE_KEY_CHALLENGES, JSON.stringify(current));
  } catch {}

  // 2. Supabase Üzerinde Statüsü 'closed' Yap
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase
        .from('game_rooms')
        .update({
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('room_code', challengeId);
    } catch (err) {
      console.warn('[communityChallengeService] Supabase silme uyarısı:', err);
    }
  }

  // 3. Canlı Kanala Silindiğini Duyur
  broadcastCommunityEvent({
    type: 'community_challenge_deleted',
    challengeId,
  });
}

/**
 * Belirli bir odaya ait skorları Supabase ve yerel depodan çeker
 */
export async function fetchRoomLeaderboard(challengeId) {
  if (!challengeId) return [];

  const localAll = getSavedLeaderboard();
  let roomScores = localAll.filter((item) => item.challengeId === challengeId);

  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .eq('mode', challengeId)
        .order('score', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        const currentName = getCurrentPlayerName();
        const fetchedEntries = data.map((d) => ({
          id: d.id,
          challengeId: d.mode,
          challengeTitle: 'Canlı Challenge',
          playerName: (!d.username || d.username === 'Oyuncu') ? currentName : d.username,
          wpm: d.wpm,
          accuracy: d.accuracy,
          score: d.score,
          gameMap: d.difficulty || 'WOOD',
          completedAt: d.created_at ? new Date(d.created_at).getTime() : Date.now(),
        }));

        const mergedMap = new Map();
        for (const item of fetchedEntries) mergedMap.set(item.id, item);
        for (const item of roomScores) {
          if (!mergedMap.has(item.id)) mergedMap.set(item.id, item);
        }
        roomScores = sortAndDeduplicateRoomLeaderboard(Array.from(mergedMap.values()));

        // Yerel depoda da sakla
        const otherScores = localAll.filter((item) => item.challengeId !== challengeId);
        const combined = [...roomScores, ...otherScores].slice(0, 100);
        localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(combined));
      }
    } catch (err) {
      console.warn('[communityChallengeService] fetchRoomLeaderboard hatası:', err);
    }
  }

  return sortAndDeduplicateRoomLeaderboard(roomScores);
}

/**
 * Belirli bir odaya ait kayıtlı yerel skorları döndürür
 */
export function getRoomLeaderboard(challengeId) {
  if (!challengeId) return [];
  const localAll = getSavedLeaderboard();
  return sortAndDeduplicateRoomLeaderboard(localAll.filter((item) => item.challengeId === challengeId));
}

/**
 * Bir challenge tamamlandığında skoru kaydeder ve liderlik tablosunu günceller
 */
export async function recordChallengeScore({
  challengeId,
  challengeTitle,
  playerName,
  wpm,
  accuracy,
  score,
  gameMap = 'WOOD',
}) {
  const rawName = playerName?.trim() && playerName.trim() !== 'Oyuncu'
    ? playerName.trim()
    : getCurrentPlayerName();
  const validPlayerName = String(rawName).replace(/[<>'"&]/g, '').slice(0, 24) || 'Oyuncu';

  const cleanScore = Math.max(0, Math.min(250000, Math.round(Number(score) || 0)));
  const cleanWpm = Math.max(0, Math.min(240, Math.round(Number(wpm) || 0)));
  const cleanAcc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 100)));

  // Aşırı / imkansız değerleri reddet
  if (Number(wpm) > 240 || Number(score) > 250000) {
    console.warn('[AntiCheat] Challenge skoru reddedildi:', { score, wpm });
    return getSavedLeaderboard();
  }

  const newEntry = {
    id: `score_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    challengeId: challengeId || 'GENERAL',
    challengeTitle: challengeTitle || 'Canlı Challenge',
    playerName: validPlayerName,
    wpm: cleanWpm,
    accuracy: cleanAcc,
    score: cleanScore,
    gameMap,
    completedAt: Date.now(),
  };

  const current = getSavedLeaderboard();
  const merged = [
    newEntry,
    ...current.filter(
      (e) =>
        !(
          e.challengeId === newEntry.challengeId &&
          e.playerName?.trim().toLowerCase() === validPlayerName.toLowerCase() &&
          (e.wpm || 0) <= newEntry.wpm
        )
    ),
  ];
  const sorted = sortLeaderboardEntries(merged).slice(0, 100);
  localStorage.setItem(STORAGE_KEY_LEADERBOARD, JSON.stringify(sorted));

  // Supabase'e kaydet
  if (isSupabaseConfigured() && supabase) {
    try {
      await supabase.from('leaderboard').insert([
        {
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
          username: newEntry.playerName,
          score: newEntry.score,
          wpm: newEntry.wpm,
          accuracy: newEntry.accuracy,
          difficulty: gameMap,
          mode: newEntry.challengeId,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      console.warn('[communityChallengeService] Supabase leaderboard insert:', err);
    }
  }

  // Canlı Kanala Yayınla
  const roomScores = sortAndDeduplicateRoomLeaderboard(sorted.filter((s) => s.challengeId === newEntry.challengeId));
  broadcastCommunityEvent({
    type: 'community_score_submitted',
    entry: newEntry,
    challengeId: newEntry.challengeId,
    roomLeaderboard: roomScores,
    leaderboard: sorted,
  });

  return sorted;
}

/**
 * Broadcast & Supabase üzerinden topluluk etkinliği yayınlama
 */
function broadcastCommunityEvent(payload) {
  // 1. BroadcastChannel (Aynı tarayıcı pencereleri / sekmeler arası anında bildirim)
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      const channel = new window.BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(payload);
    } catch {}
  }

  // 2. Supabase Realtime (Farklı cihazlar ve tarayıcılar arası bildirim)
  if (isSupabaseConfigured() && supabase) {
    try {
      const liveChan = supabase.channel(CHANNEL_NAME);
      liveChan.send({
        type: 'broadcast',
        event: 'community_event',
        payload,
      });
    } catch {}
  }
}

/**
 * Canlı Topluluk etkinliklerini dinler (Yeni odalar, güncellemeler, silinmeler ve skorlar)
 */
export function subscribeToCommunityEvents(onEvent) {
  let localChannel = null;
  let supabaseChannel = null;
  let pollInterval = null;

  // 1. Sekmeler arası dinleyici
  if (typeof window !== 'undefined' && window.BroadcastChannel) {
    try {
      localChannel = new window.BroadcastChannel(CHANNEL_NAME);
      localChannel.onmessage = (e) => {
        if (e.data) {
          onEvent(e.data);
        }
      };
    } catch {}
  }

  // 2. Supabase Realtime Broadcast & Postgres Değişiklikleri Dinleyicisi
  if (isSupabaseConfigured() && supabase) {
    try {
      supabaseChannel = supabase
        .channel(CHANNEL_NAME)
        .on('broadcast', { event: 'community_event' }, ({ payload }) => {
          if (payload) onEvent(payload);
        })
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'game_rooms' },
          (payload) => {
            const row = payload.new || payload.old;
            if (row && row.room_code && row.room_code.startsWith('CH_')) {
              // Değişiklik oldu, odaları arka planda yeniden çekip bildirelim
              fetchCommunityChallenges().then((freshList) => {
                onEvent({
                  type: 'community_challenges_refreshed',
                  challenges: freshList,
                });
              });
            }
          }
        )
        .subscribe();
    } catch {}
  }

  // 3. Akıllı Periyodik Senkronizasyon (Sadece sekme aktifken ve 30 saniyede bir güvenlik tazeleyicisi)
  const syncIfVisible = () => {
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return;
    }
    fetchCommunityChallenges().then((freshList) => {
      onEvent({
        type: 'community_challenges_refreshed',
        challenges: freshList,
      });
    });
  };

  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      syncIfVisible();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  }

  // 30 saniyede bir pasif güvenlik senkronizasyonu
  pollInterval = setInterval(syncIfVisible, 30000);

  return () => {
    if (localChannel) {
      localChannel.close();
    }
    if (supabaseChannel && supabase) {
      supabase.removeChannel(supabaseChannel);
    }
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  };
}
