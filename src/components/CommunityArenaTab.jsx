import React, { useState, useEffect } from 'react';
import {
  getSavedChallenges,
  fetchCommunityChallenges,
  getSavedLeaderboard,
  fetchRoomLeaderboard,
  getRoomLeaderboard,
  createCommunityChallenge,
  updateCommunityChallenge,
  deleteCommunityChallenge,
  getRemainingTimeText,
  subscribeToCommunityEvents,
} from '../services/communityChallengeService';

export default function CommunityArenaTab({ playerName, onJoinChallenge, onStartCreatedChallenge }) {
  const [challenges, setChallenges] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [newMap, setNewMap] = useState('WOOD');
  const [newDuration, setNewDuration] = useState(60);
  const [newDifficulty, setNewDifficulty] = useState('medium');
  const [isCreating, setIsCreating] = useState(false);
  const [selectedFilterRoomId, setSelectedFilterRoomId] = useState('ALL');

  // Her odaya özel sıralama modalı durumları
  const [viewingRoomForLeaderboard, setViewingRoomForLeaderboard] = useState(null);
  const [roomScores, setRoomScores] = useState([]);
  const [isLoadingRoomScores, setIsLoadingRoomScores] = useState(false);

  // Düzenleme Durumları
  const [editingChallenge, setEditingChallenge] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMap, setEditMap] = useState('WOOD');
  const [editDuration, setEditDuration] = useState(60);
  const [editDifficulty, setEditDifficulty] = useState('medium');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [actionNotice, setActionNotice] = useState('');

  useEffect(() => {
    // 1. Yerel önbellekten hızlıca getir
    setChallenges(getSavedChallenges());
    setLeaderboard(getSavedLeaderboard());

    // 2. Supabase üzerinden en güncel online listeyi çek
    fetchCommunityChallenges().then((freshList) => {
      if (freshList && Array.isArray(freshList)) {
        setChallenges(freshList);
      }
    });

    // 3. Canlı yayınları dinle
    const unsubscribe = subscribeToCommunityEvents((event) => {
      if (event.type === 'community_challenge_created') {
        setChallenges((prev) => [event.challenge, ...prev.filter((c) => c.id !== event.challenge.id)]);
      } else if (event.type === 'community_challenge_updated') {
        setChallenges((prev) =>
          prev.map((c) => (c.id === event.challenge.id ? event.challenge : c))
        );
      } else if (event.type === 'community_challenge_deleted') {
        setChallenges((prev) => prev.filter((c) => c.id !== event.challengeId));
      } else if (event.type === 'community_challenges_refreshed') {
        if (event.challenges && Array.isArray(event.challenges)) {
          setChallenges(event.challenges);
        }
      } else if (event.type === 'community_score_submitted') {
        if (event.leaderboard) {
          setLeaderboard(event.leaderboard);
        } else if (event.entry) {
          setLeaderboard((prev) => {
            const merged = [event.entry, ...prev];
            return merged.sort((a, b) => b.wpm - a.wpm).slice(0, 50);
          });
        }
        if (event.challengeId && event.roomLeaderboard) {
          setRoomScores((prev) => (viewingRoomForLeaderboard?.id === event.challengeId ? event.roomLeaderboard : prev));
        }
      }
    });

    return unsubscribe;
  }, [viewingRoomForLeaderboard?.id]);

  const showToast = (msg) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(''), 3500);
  };

  const handleOpenRoomLeaderboard = async (ch) => {
    setViewingRoomForLeaderboard(ch);
    const initial = getRoomLeaderboard(ch.id);
    setRoomScores(initial);
    setIsLoadingRoomScores(true);
    try {
      const fresh = await fetchRoomLeaderboard(ch.id);
      if (fresh) {
        setRoomScores(fresh);
      }
    } finally {
      setIsLoadingRoomScores(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!playerName.trim()) return;

    setIsCreating(true);
    try {
      const title = newTitle.trim() || `${playerName}'in Challenge Odası`;
      const created = await createCommunityChallenge({
        title,
        hostName: playerName,
        map: newMap,
        difficulty: newDifficulty,
        duration: newDuration,
      });

      setChallenges((prev) => [created, ...prev.filter((c) => c.id !== created.id)]);
      setNewTitle('');
      showToast('🎉 Odan başarıyla kuruldu ve canlıya alındı!');

      // Doğrudan oda kurma/bekleme ekranına yönlendir!
      if (onStartCreatedChallenge) {
        onStartCreatedChallenge(created);
      }
    } catch (err) {
      console.error(err);
      showToast('⚠️ Oda kurulurken bir hata oluştu.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenEdit = (ch) => {
    setEditingChallenge(ch);
    setEditTitle(ch.title || '');
    setEditMap(ch.gameMap || 'WOOD');
    setEditDuration(Number(ch.duration) || 60);
    setEditDifficulty(ch.difficulty || 'medium');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingChallenge) return;

    setIsSavingEdit(true);
    try {
      const updated = await updateCommunityChallenge(editingChallenge.id, {
        title: editTitle,
        map: editMap,
        difficulty: editDifficulty,
        duration: editDuration,
      });

      if (updated) {
        setChallenges((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast('✅ Oda bilgileri ve modu başarıyla güncellendi!');
      }
      setEditingChallenge(null);
    } catch (err) {
      console.error(err);
      showToast('⚠️ Oda güncellenirken hata oluştu.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteRoom = async (ch) => {
    const ok = window.confirm(`"${ch.title}" odasını silmek ve kapatmak istediğinize emin misiniz?`);
    if (!ok) return;

    try {
      await deleteCommunityChallenge(ch.id);
      setChallenges((prev) => prev.filter((c) => c.id !== ch.id));
      if (selectedFilterRoomId === ch.id) {
        setSelectedFilterRoomId('ALL');
      }
      showToast('🗑️ Odanız başarıyla silindi ve kapatıldı.');
    } catch (err) {
      console.error(err);
      showToast('⚠️ Oda silinirken hata oluştu.');
    }
  };

  const getMapName = (m) => {
    if (m === 'WOOD') return 'Odun Kesme';
    if (m === 'GARDEN') return 'Bahçe';
    if (m === 'KITCHEN') return 'Mutfak';
    if (m === 'FOOTBALL') return 'Futbol';
    return 'Klasik';
  };

  const getMapIcon = (m) => {
    if (m === 'WOOD') return '🪓';
    if (m === 'GARDEN') return '🌱';
    if (m === 'KITCHEN') return '🍕';
    if (m === 'FOOTBALL') return '⚽';
    return '⌨️';
  };

  // Seçili odaya göre filtrelenmiş skorlar
  const filteredLeaderboard = selectedFilterRoomId === 'ALL'
    ? leaderboard
    : leaderboard.filter((item) => item.challengeId === selectedFilterRoomId);

  const selectedRoomObj = challenges.find((c) => c.id === selectedFilterRoomId);

  return (
    <div className="community-arena-container">
      {/* Bildirim Toast */}
      {actionNotice && (
        <div className="community-action-toast">
          <span>{actionNotice}</span>
        </div>
      )}

      {/* 1. Üst Kısım: Yeni Challenge Odası Kurma Çubuğu */}
      <div className="community-create-strip-card">
        <div className="strip-title-row">
          <div className="strip-title-left">
            <span className="strip-icon">🚀</span>
            <div>
              <h3 className="strip-title">Yeni Challenge Odası Kur</h3>
              <p className="strip-desc">
                Odanı aç, online olan tüm oyuncular anında görsün ve seninle yarışsın (Odalar max 24 saat açıktır)
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleCreateRoom} className="strip-form-row">
          <div className="strip-input-wrap">
            <input
              type="text"
              className="strip-text-input"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Oda İsmi Girin (Örn: Hızlı Parmaklar Kapışması)..."
              maxLength={36}
            />
          </div>

          <div className="strip-select-group">
            <select
              className="strip-select"
              value={newMap}
              onChange={(e) => setNewMap(e.target.value)}
              title="Harita Seç"
            >
              <option value="WOOD">🪓 Odun Kesme</option>
              <option value="GARDEN">🌱 Bahçe Modu</option>
              <option value="KITCHEN">🍕 Mutfak Modu</option>
              <option value="FOOTBALL">⚽ Futbol Modu</option>
              <option value="CLASSIC">⌨️ Siber Klasik</option>
            </select>

            <select
              className="strip-select"
              value={newDuration}
              onChange={(e) => setNewDuration(Number(e.target.value))}
              title="Süre Seç"
            >
              <option value={30}>⏱️ 30 Saniye</option>
              <option value={60}>⏱️ 60 Saniye</option>
              <option value={90}>⏱️ 90 Saniye</option>
            </select>

            <select
              className="strip-select"
              value={newDifficulty}
              onChange={(e) => setNewDifficulty(e.target.value)}
              title="Zorluk Seç"
            >
              <option value="easy">⚡ Kolay</option>
              <option value="medium">⚡ Orta</option>
              <option value="hard">⚡ Zor</option>
            </select>
          </div>

          <button
            type="submit"
            className="btn-strip-create-room"
            disabled={isCreating || !playerName.trim()}
          >
            {isCreating ? '⏳ Kuruluyor...' : '🚀 Odayı Kur & Başla'}
          </button>
        </form>
      </div>

      {/* 2. Orta Kısım: Kurulan Odaların Alt Alta Listesi & Sağda Katıl Butonu */}
      <div className="community-rooms-vertical-card">
        <div className="rooms-card-header">
          <div className="rooms-header-left">
            <span className="live-pulsing-dot green" />
            <h3 className="rooms-card-title">AÇIK CANLI ODALAR</h3>
            <span className="rooms-count-pill">{challenges.length} Oda Aktif</span>
          </div>
          <span className="rooms-header-hint">
            Odalar 24 saat boyunca canlı kalır. Kurduğunuz odayı silebilir veya modunu değiştirebilirsiniz.
          </span>
        </div>

        <div className="rooms-vertical-list">
          {challenges.length === 0 ? (
            <div className="no-rooms-message">
              <span>⏳ Şu an açık oda yok. Yukarıdaki formdan ilk odayı sen aç!</span>
            </div>
          ) : (
            challenges.map((c) => {
              const isSelected = selectedFilterRoomId === c.id;
              const isMyRoom = c.hostName?.trim().toLowerCase() === playerName?.trim().toLowerCase();
              const champion = leaderboard.find((item) => item.challengeId === c.id);
              const roomScoresCount = leaderboard.filter((item) => item.challengeId === c.id).length;
              const remainingText = getRemainingTimeText(c.createdAt);

              return (
                <div key={c.id} className={`room-row-card ${isSelected ? 'selected' : ''}`}>
                  <div className="room-row-left">
                    <div className="room-row-icon">{getMapIcon(c.gameMap)}</div>
                    <div className="room-row-details">
                      <div className="room-title-line">
                        <strong className="room-title-text">{c.title}</strong>
                        <span className={`room-host-badge ${isMyRoom ? 'my-room-badge' : ''}`}>
                          {isMyRoom ? '👑 Senin Odan' : `👑 ${c.hostName}`}
                        </span>
                        <span className="room-timer-badge" title="24 saat sonra otomatik sonlanır">
                          ⏳ {remainingText}
                        </span>
                      </div>
                      <div className="room-tags-line">
                        <span className="mini-tag map">🗺️ {getMapName(c.gameMap)}</span>
                        <span className="mini-tag dur">⏱️ {c.duration} sn</span>
                        <span className="mini-tag diff">
                          ⚡ {c.difficulty === 'easy' ? 'Kolay' : c.difficulty === 'medium' ? 'Orta' : 'Zor'}
                        </span>
                        <span className="mini-tag code">KOD: {c.roomCode || c.id.replace('CH_', '')}</span>
                        {champion && (
                          <span className="mini-tag champ" title={`Bu odanın lideri: ${champion.playerName === 'Oyuncu' ? (playerName || 'Yarışmacı') : champion.playerName} (${champion.wpm} WPM)`}>
                            👑 1. {champion.playerName === 'Oyuncu' ? (playerName || 'Yarışmacı') : champion.playerName} ({champion.wpm} WPM)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="room-row-actions">
                    {/* Oda Sahibine Özel Yönetim Butonları: Düzenle & Sil */}
                    {isMyRoom && (
                      <div className="room-owner-btn-group">
                        <button
                          type="button"
                          className="btn-room-owner-edit"
                          onClick={() => handleOpenEdit(c)}
                          title="Oda modunu veya ayarlarını düzenle"
                        >
                          ✏️ Düzenle
                        </button>
                        <button
                          type="button"
                          className="btn-room-owner-delete"
                          onClick={() => handleDeleteRoom(c)}
                          title="Odayı tamamen sil ve kapat"
                        >
                          🗑️ Sil
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      className="btn-room-scores"
                      onClick={() => handleOpenRoomLeaderboard(c)}
                      title="Bu odaya özel sıralama ekranını aç"
                    >
                      🏆 Sıralama {roomScoresCount > 0 ? `(${roomScoresCount})` : ''}
                    </button>

                    <button
                      type="button"
                      className="btn-room-join-hero"
                      onClick={() => onJoinChallenge && onJoinChallenge(c)}
                    >
                      ⚔️ Katıl
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* 3. Düzenleme Modalı */}
      {editingChallenge && (
        <div className="community-modal-backdrop">
          <div className="community-modal-card">
            <div className="modal-header">
              <h3>✏️ Odayı ve Modunu Düzenle</h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setEditingChallenge(null)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="modal-form">
              <label className="modal-label">
                <span>Oda Başlığı:</span>
                <input
                  type="text"
                  className="modal-input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={36}
                  required
                />
              </label>

              <label className="modal-label">
                <span>Harita / Oyun Modu:</span>
                <select
                  className="modal-select"
                  value={editMap}
                  onChange={(e) => setEditMap(e.target.value)}
                >
                  <option value="WOOD">🪓 Odun Kesme</option>
                  <option value="GARDEN">🌱 Bahçe Modu</option>
                  <option value="KITCHEN">🍕 Mutfak Modu</option>
                  <option value="FOOTBALL">⚽ Futbol Modu</option>
                  <option value="CLASSIC">⌨️ Siber Klasik</option>
                </select>
              </label>

              <div className="modal-row-two">
                <label className="modal-label">
                  <span>Süre (Saniye):</span>
                  <select
                    className="modal-select"
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                  >
                    <option value={30}>⏱️ 30 Saniye</option>
                    <option value={60}>⏱️ 60 Saniye</option>
                    <option value={90}>⏱️ 90 Saniye</option>
                  </select>
                </label>

                <label className="modal-label">
                  <span>Zorluk:</span>
                  <select
                    className="modal-select"
                    value={editDifficulty}
                    onChange={(e) => setEditDifficulty(e.target.value)}
                  >
                    <option value="easy">⚡ Kolay</option>
                    <option value="medium">⚡ Orta</option>
                    <option value="hard">⚡ Zor</option>
                  </select>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal-cancel"
                  onClick={() => setEditingChallenge(null)}
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="btn-modal-save"
                  disabled={isSavingEdit}
                >
                  {isSavingEdit ? 'Kaydediliyor...' : '💾 Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3.5. Odaya Özel Sıralama Modalı (Her Oda İçin Ayrı Sıralama Ekranı) */}
      {viewingRoomForLeaderboard && (
        <div className="community-modal-backdrop" onClick={() => setViewingRoomForLeaderboard(null)}>
          <div className="community-modal-card room-ranking-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-title-box">
                <span className="room-modal-icon">{getMapIcon(viewingRoomForLeaderboard.gameMap)}</span>
                <div>
                  <h3>{viewingRoomForLeaderboard.title} — Liderlik Sıralaması</h3>
                  <div className="modal-room-subtags">
                    <span className="modal-subtag">👑 Kurucu: {viewingRoomForLeaderboard.hostName}</span>
                    <span className="modal-subtag">🗺️ {getMapName(viewingRoomForLeaderboard.gameMap)}</span>
                    <span className="modal-subtag">⏱️ {viewingRoomForLeaderboard.duration} sn</span>
                    <span className="modal-subtag">
                      ⚡ {viewingRoomForLeaderboard.difficulty === 'easy' ? 'Kolay' : viewingRoomForLeaderboard.difficulty === 'medium' ? 'Orta' : 'Zor'}
                    </span>
                    <span className="modal-subtag code">KOD: {viewingRoomForLeaderboard.roomCode || viewingRoomForLeaderboard.id.replace('CH_', '')}</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setViewingRoomForLeaderboard(null)}
              >
                ✕
              </button>
            </div>

            <div className="room-ranking-modal-content">
              <div className="room-ranking-table-header">
                <span className="th-cell rank">SIRA</span>
                <span className="th-cell player">YARIŞMACI</span>
                <span className="th-cell wpm">HIZ (WPM)</span>
                <span className="th-cell acc">DOĞRULUK</span>
                <span className="th-cell score">SKOR</span>
              </div>

              <div className="room-ranking-table-body">
                {isLoadingRoomScores && roomScores.length === 0 ? (
                  <div className="ranking-loading-hint">⏳ Sıralama yükleniyor...</div>
                ) : roomScores.length === 0 ? (
                  <div className="no-scores-message">
                    <span>Bu oda için henüz tamamlanmış yarış bulunmuyor. Hemen katıl ve ilk rekoru sen yaz!</span>
                  </div>
                ) : (
                  roomScores.map((item, idx) => {
                    const rank = idx + 1;
                    const isGold = rank === 1;
                    const isSilver = rank === 2;
                    const isBronze = rank === 3;
                    const displayName = (!item.playerName || item.playerName === 'Oyuncu') ? (playerName || 'Yarışmacı') : item.playerName;
                    const isMe = displayName.trim().toLowerCase() === playerName?.trim().toLowerCase();

                    return (
                      <div
                        key={item.id || idx}
                        className={`scores-row ${isGold ? 'gold' : isSilver ? 'silver' : isBronze ? 'bronze' : ''} ${isMe ? 'is-me' : ''}`}
                      >
                        <div className="td-cell rank">
                          {isGold ? (
                            <span className="crown-badge gold" title="1. Şampiyon">👑 1</span>
                          ) : isSilver ? (
                            <span className="crown-badge silver" title="2. Sıra">🥈 2</span>
                          ) : isBronze ? (
                            <span className="crown-badge bronze" title="3. Sıra">🥉 3</span>
                          ) : (
                            <span className="normal-rank-num">#{rank}</span>
                          )}
                        </div>

                        <div className="td-cell player">
                          <span className="player-avatar-dot">👤</span>
                          <strong className="player-name">
                            {displayName} {isMe ? '(Sen)' : ''}
                          </strong>
                        </div>

                        <div className="td-cell wpm">
                          <span className="wpm-highlight-pill">{item.wpm} WPM</span>
                        </div>

                        <div className="td-cell acc">
                          <span className="acc-text">%{item.accuracy}</span>
                        </div>

                        <div className="td-cell score">
                          <span className="score-text">{item.score}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="modal-actions room-ranking-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setViewingRoomForLeaderboard(null)}
              >
                Kapat
              </button>
              <button
                type="button"
                className="btn-room-join-hero"
                onClick={() => {
                  const target = viewingRoomForLeaderboard;
                  setViewingRoomForLeaderboard(null);
                  if (onJoinChallenge) onJoinChallenge(target);
                }}
              >
                ⚔️ Bu Odaya Katıl & Yarış
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  );
}
