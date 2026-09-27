/**
 * Türkçe karakter duyarlı küçük harf dönüşümü yapar.
 * 'İ' -> 'i', 'I' -> 'ı' gibi Türkçe özel durumlarını doğru ele alır.
 * @param {string} str 
 * @returns {string}
 */
export function toTurkishLower(str) {
  if (!str) return '';
  return str.toLocaleLowerCase('tr-TR');
}

/**
 * İki karakterin Türkçe duyarlı olarak eşit olup olmadığını karşılaştırır.
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
export function isTurkishCharMatch(a, b) {
  if (!a || !b) return false;
  return toTurkishLower(a) === toTurkishLower(b);
}

/**
 * Tarayıcı kısıtlamalarına takılmadan (HTTP, localhost, iframe, izin sorunları vb.)
 * metni panoya kopyalayan güvenilir fonksiyon.
 */
export async function copyToClipboard(text) {
  if (!text) return false;

  // 1. Modern API
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Modern API başarısız olursa execCommand fallback'e geç
    }
  }

  // 2. Fallback: Gizli textarea ile execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Kopyalama hatası:', err);
    return false;
  }
}

/**
 * Rastgele Oyuncu Adı Üretici (Sayfa her yenilendiğinde başa döner)
 */
export function generateRandomPlayerName() {
  return `Oyuncu_${Math.floor(100 + Math.random() * 900)}`;
}

export function getCurrentPlayerName() {
  if (typeof window === 'undefined') return 'Oyuncu_100';
  let name = null;
  try {
    name = localStorage.getItem('antiwords_player_name') || sessionStorage.getItem('antiwords_session_player_name');
  } catch {}

  if (!name || name === 'Oyuncu') {
    name = generateRandomPlayerName();
  }

  try {
    localStorage.setItem('antiwords_player_name', name);
    sessionStorage.setItem('antiwords_session_player_name', name);
  } catch {}

  return name;
}

export function setCurrentPlayerName(name) {
  if (typeof window === 'undefined') return 'Oyuncu_100';
  let clean = String(name || '').trim();
  if (!clean || clean === 'Oyuncu') {
    clean = generateRandomPlayerName();
  }
  try {
    localStorage.setItem('antiwords_player_name', clean);
    sessionStorage.setItem('antiwords_session_player_name', clean);
  } catch {}
  return clean;
}

