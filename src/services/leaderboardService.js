import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

const LOCAL_STORAGE_KEY = 'antiwords_local_leaderboard';

// Varsayılan liderlik tablosu (Sahte veri barındırmaz)
const DEFAULT_LEADERBOARD = [];
const FAKE_USERS = new Set(['KlavyeFırtınası', 'SiberNinja', 'NeonHacker', 'TürkçeBükücü', 'HızlıParmaklar']);

/**
 * Liderlik tablosunu getirir (Supabase aktifse buluttan, değilse yerel depodan)
 */
export async function getLeaderboard(limit = 20) {
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);

      if (error) throw error;
      const realData = (data || []).filter((item) => item && !FAKE_USERS.has(item.username));
      return { data: realData, isOnline: true };
    } catch (err) {
      console.warn('Supabase liderlik tablosu okunamadı, yerel veri kullanılıyor:', err.message);
    }
  }

  // Çevrimdışı / Yerel Mod
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!local) {
      return { data: [], isOnline: false };
    }
    const parsed = JSON.parse(local);
    if (Array.isArray(parsed)) {
      // Eski sahte kullanıcıları temizle
      const cleaned = parsed.filter((item) => item && !FAKE_USERS.has(item.username) && !['1', '2', '3', '4', '5'].includes(item.id));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cleaned));
      }
      const sorted = cleaned.sort((a, b) => b.score - a.score).slice(0, limit);
      return { data: sorted, isOnline: false };
    }
    return { data: [], isOnline: false };
  } catch {
    return { data: [], isOnline: false };
  }
}

/**
 * İsimden zararlı HTML karakterlerini temizler
 */
function sanitizeUsername(name) {
  if (!name) return 'Anonim Oyuncu';
  return String(name)
    .replace(/[<>'"&]/g, '')
    .trim()
    .slice(0, 24) || 'Anonim Oyuncu';
}

/**
 * Yeni bir skor kaydeder (Anti-Cheat & Doğrulama Filtreli)
 */
export async function submitScore({ username, score, wpm, accuracy = 100, difficulty = 'medium', mode = 'single' }) {
  const cleanScore = Math.max(0, Math.min(250000, Math.round(Number(score) || 0)));
  const cleanWpm = Math.max(0, Math.min(240, Math.round(Number(wpm) || 0)));
  const cleanAcc = Math.max(0, Math.min(100, Math.round(Number(accuracy) || 100)));
  const cleanUsername = sanitizeUsername(username);

  // Anormal / Hileli Skor Filtresi (Örn: 240 üzeri WPM insan limitinin ötesindedir)
  if (Number(wpm) > 240 || Number(score) > 250000) {
    console.warn('[AntiCheat] Geçersiz veya şüpheli skor reddedildi:', { score, wpm });
    return { success: false, error: 'Şüpheli skor parametresi' };
  }

  const newEntry = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    username: cleanUsername,
    score: cleanScore,
    wpm: cleanWpm,
    accuracy: cleanAcc,
    difficulty: String(difficulty || 'medium').slice(0, 32),
    mode: String(mode || 'single').slice(0, 32),
    created_at: new Date().toISOString()
  };

  // 1. Supabase'e göndermeyi dene
  if (isSupabaseConfigured() && supabase) {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .insert([newEntry])
        .select();

      if (!error && data) {
        return { success: true, isOnline: true, entry: data[0] };
      }
    } catch (err) {
      console.warn('Supabase skor kaydı başarısız, yerel depoya yazılıyor:', err.message);
    }
  }

  // 2. Çevrimdışı / Yerel Depolama
  try {
    const local = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list = local ? JSON.parse(local) : [...DEFAULT_LEADERBOARD];
    list.push(newEntry);
    list.sort((a, b) => b.score - a.score);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list.slice(0, 50)));
    return { success: true, isOnline: false, entry: newEntry };
  } catch (err) {
    console.error('Yerel skor kaydetme hatası:', err);
    return { success: false, isOnline: false, error: err.message };
  }
}
