import React, { useEffect, useState } from 'react';
import { submitScore } from '../services/leaderboardService';
import { determineDuelOutcome, calculateDuelRating } from '../services/multiplayerService';
import { fetchRoomLeaderboard, getRoomLeaderboard } from '../services/communityChallengeService';
import { getCurrentPlayerName } from '../utils/turkishUtils';

export default function GameOver({
  score,
  lives,
  destroyedCount,
  wpm,
  accuracy,
  difficulty,
  isNewHighScore,
  isMultiplayer = false,
  communityChallenge = null,
  roomType = '1v1',
  rankings = [],
  participantsList = [],
  matchResult = null, // 'victory' | 'defeat' | 'draw'
  rivalName = 'Rakip',
  rivalStats = null,
  onRestart,
  onMainMenu,
  onOpenLeaderboard,
}) {
  const [savedStatus, setSavedStatus] = useState(null);
  const rawPlayerName = getCurrentPlayerName();

  const [roomScores, setRoomScores] = useState(() => {
    if (!communityChallenge?.id) return [];
    return getRoomLeaderboard(communityChallenge.id);
  });

  useEffect(() => {
    if (!communityChallenge?.id) return;
    fetchRoomLeaderboard(communityChallenge.id).then((list) => {
      if (list && list.length > 0) {
        setRoomScores(list);
      }
    });
  }, [communityChallenge?.id]);

  // İki oyuncunun adı aynıysa (ör. tek tarayıcıda iki sekme testi) karışıklığı önle
  const isSameName =
    isMultiplayer &&
    rivalName &&
    rawPlayerName.trim().toLowerCase() === rivalName.trim().toLowerCase();
  const displayName = isSameName ? `${rawPlayerName} (Sen)` : rawPlayerName;
  const displayRivalName = isSameName ? `${rivalName} (Rakip)` : rivalName;

  const diffLabels = {
    easy: 'KOLAY',
    medium: 'ORTA',
    hard: 'ZOR',
    mixed: 'KARIŞIK',
  };

  // KESİN VE DOĞRULANMIŞ MAÇ SONUCU HESABI
  // Doğruluk, skor, hız ve can metriklerini birlikte hesaplar
  const myScore = Number(score) || 0;
  const rivalScore = Number(rivalStats?.score) || 0;
  const myLives = lives !== undefined ? Number(lives) : (matchResult === 'defeat' ? 0 : 3);
  const rivalLives = rivalStats?.lives !== undefined ? Number(rivalStats.lives) : (rivalStats?.isEliminated ? 0 : 3);
  const myAcc = Number(accuracy) || 0;
  const rivalAcc = rivalStats?.accuracy !== undefined ? Number(rivalStats.accuracy) : (rivalStats?.lives === 0 ? 85 : 100);

  const myDuelRating = calculateDuelRating({
    score: myScore,
    lives: myLives,
    wpm,
    accuracy: myAcc,
    isEliminated: myLives <= 0,
  });

  const rivalDuelRating = calculateDuelRating({
    score: rivalScore,
    lives: rivalLives,
    wpm: rivalStats?.wpm || 0,
    accuracy: rivalAcc,
    isEliminated: Boolean(rivalStats?.isEliminated || rivalLives <= 0),
  });

  const effectiveMatchResult = isMultiplayer
    ? determineDuelOutcome(
        { score: myScore, lives: myLives, wpm, accuracy: myAcc, isEliminated: myLives <= 0 },
        {
          score: rivalScore,
          lives: rivalLives,
          wpm: rivalStats?.wpm || 0,
          accuracy: rivalAcc,
          isEliminated: Boolean(rivalStats?.isEliminated || rivalLives <= 0),
        }
      )
    : matchResult;

  useEffect(() => {
    if (communityChallenge) {
      setSavedStatus('Oda Sıralamasına Kaydedildi ✓');
      return;
    }
    // Skoru otomatik olarak liderlik tablosuna kaydet
    submitScore({
      username: rawPlayerName,
      score,
      wpm,
      accuracy,
      difficulty,
      mode: isMultiplayer ? '1v1' : 'single',
    }).then((res) => {
      if (res && res.success) {
        setSavedStatus(res.isOnline ? 'Buluta Kaydedildi ✓' : 'Yerel Kaydedildi ✓');
      }
    });
  }, [score, wpm, accuracy, difficulty, isMultiplayer, rawPlayerName, communityChallenge]);

  const isCommunityChallenge = Boolean(communityChallenge);

  // Sıralama listesi derleme (Fast Fingers kriterleri: WPM > Doğruluk > Skor)
  let displayRankings = [];
  if (isCommunityChallenge) {
    const list = [...roomScores];
    const existingIdx = list.findIndex(
      (item) => item.playerName?.trim().toLowerCase() === rawPlayerName?.trim().toLowerCase()
    );
    const myCurrentEntry = {
      playerName: rawPlayerName,
      wpm,
      accuracy: myAcc,
      score: myScore,
      lives: myLives,
      isEliminated: myLives <= 0,
      isMe: true,
    };
    if (existingIdx === -1) {
      list.push(myCurrentEntry);
    } else {
      if (myScore >= (list[existingIdx].score || 0)) {
        list[existingIdx] = { ...list[existingIdx], ...myCurrentEntry };
      }
    }
    list.sort((a, b) => {
      if (b.wpm !== a.wpm) return b.wpm - a.wpm;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return (b.score || 0) - (a.score || 0);
    });
    displayRankings = list.map((item, idx) => ({
      ...item,
      name: item.playerName || item.name,
      rank: idx + 1,
      isMe: (item.playerName || item.name)?.trim().toLowerCase() === rawPlayerName?.trim().toLowerCase(),
    }));
  } else if (rankings && rankings.length > 0) {
    displayRankings = [...rankings];
  }

  // 2 Kişilik (Birebir) maçlarda her zaman 1v1 Çift Oyuncu Karşılaştırma Paneli (duel-versus-board) gösterilir!
  // Grup sıralama tablosu sadece 3 veya daha fazla gerçek oyuncu varsa gösterilir.
  const isDuel1v1 =
    isMultiplayer &&
    (!participantsList || participantsList.length <= 2) &&
    (!displayRankings || displayRankings.length <= 2);

  const isGroupOrArena =
    !isDuel1v1 &&
    ((isCommunityChallenge && displayRankings.length > 2) ||
      (roomType === 'arena' && (displayRankings?.length > 2 || participantsList?.length > 2)) ||
      (rankings && rankings.length > 2) ||
      (participantsList && participantsList.length > 2));

  if (!isCommunityChallenge && isGroupOrArena && displayRankings.length === 0) {
    const myItem = {
      name: rawPlayerName,
      score: myScore,
      wpm,
      accuracy: myAcc,
      lives: myLives,
      isEliminated: myLives <= 0,
      isMe: true,
    };
    const otherItems = (participantsList || [])
      .filter((p) => p && p.name !== rawPlayerName)
      .map((p) => ({
        name: p.name,
        score: p.stats?.score || 0,
        wpm: p.stats?.wpm || 0,
        accuracy: p.stats?.accuracy !== undefined ? p.stats.accuracy : 100,
        lives: p.stats?.lives ?? 3,
        isEliminated: Boolean(p.stats?.isEliminated),
        isMe: false,
      }));

    if (otherItems.length === 0 && rivalStats && rivalName && rivalName !== rawPlayerName) {
      otherItems.push({
        name: rivalName,
        score: rivalStats.score || 0,
        wpm: rivalStats.wpm || 0,
        accuracy: rivalStats.accuracy !== undefined ? rivalStats.accuracy : 100,
        lives: rivalStats.lives ?? 3,
        isEliminated: Boolean(rivalStats.isEliminated || (rivalStats.lives !== undefined && rivalStats.lives <= 0)),
        isMe: false,
      });
    }

    const combined = [myItem, ...otherItems];
    displayRankings = combined
      .sort((a, b) => {
        if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
        if (b.score !== a.score) return b.score - a.score;
        if (b.wpm !== a.wpm) return b.wpm - a.wpm;
        return b.accuracy - a.accuracy;
      })
      .map((item, idx) => ({ ...item, rank: idx + 1 }));
  }

  const myRankObj = displayRankings.find((r) => r.isMe || r.name === rawPlayerName);
  const myRank = myRankObj ? myRankObj.rank : 1;

  const top1 = displayRankings[0];
  const top2 = displayRankings[1];
  const top3 = displayRankings[2];

  return (
    <div className="modern-overlay-backdrop">
      <div className={`modern-gameover-card ${isGroupOrArena ? 'arena-gameover-card' : isMultiplayer ? ('duel-gameover-card ' + (effectiveMatchResult === 'victory' ? 'victory-card' : effectiveMatchResult === 'draw' ? 'draw-card' : 'defeat-card')) : ''}`}>
        {/* Üst Rozet & Başlık */}
        <div className="modern-result-header">
          {isGroupOrArena ? (
            <>
              <div className="result-pill-badge badge-arena-finish">
                {isCommunityChallenge ? `🏆 ${communityChallenge.title || 'CANLI CHALLENGE ODASI'}` : (roomType === 'arena' ? '🌐 CANLI GENEL ARENA YARIŞMASI' : '👥 ÇOK KİŞİLİK ODA SIRALAMASI')}
              </div>
              <h2 className="result-main-title victory-text">
                {myRank === 1 ? '🏆 TEBRİKLER, 1. SIRADASIN!' : myRank <= 3 ? `🏅 HARİKA PERFORMANS! #${myRank}. SIRA` : `CHALLENGE TAMAMLANDI (#${myRank})`}
              </h2>
              <p className="result-subtitle-mode">Fast Fingers Tarzı Canlı Sıralama</p>
            </>
          ) : isMultiplayer ? (
            <>
              <div className={`result-pill-badge ${effectiveMatchResult === 'victory' ? 'badge-victory' : effectiveMatchResult === 'draw' ? 'badge-draw' : 'badge-defeat'}`}>
                {effectiveMatchResult === 'victory' ? '⚔️ 1V1 DÜELLO ZAFERİ' : effectiveMatchResult === 'draw' ? '🤝 1V1 BERABERE' : '☠️ 1V1 DÜELLO KAYBEDİLDİ'}
              </div>
              <h2 className={`result-main-title ${effectiveMatchResult === 'victory' ? 'victory-text' : effectiveMatchResult === 'draw' ? 'draw-text' : 'defeat-text'}`}>
                {effectiveMatchResult === 'victory' ? 'TEBRİKLER, KAZANDIN!' : effectiveMatchResult === 'draw' ? 'MAÇ BERABERE BİTTİ!' : 'RAKİP DAHA HIZLIYDI!'}
              </h2>
              {effectiveMatchResult === 'draw' && (
                <p className="result-subtitle-mode" style={{ color: '#fbbf24', marginTop: '4px' }}>
                  Her iki taraf da eşit skor elde etti.
                </p>
              )}
            </>
          ) : (
            <>
              <div className="result-pill-badge">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>SAVUNMA SONLANDI</span>
              </div>
              <h2 className="result-main-title">GÖREV TAMAMLANDI</h2>
              <p className="result-subtitle-mode">{diffLabels[difficulty] || 'ORTA'} MOD</p>
            </>
          )}

          {isNewHighScore && (
            <div className="modern-record-banner">
              ★ YENİ REKOR! TEBRİKLER ★
            </div>
          )}
        </div>

        {/* Çok Oyunculu Grup / Arena Podyumu ve Sıralama Tablosu */}
        {isGroupOrArena ? (
          <div className="arena-results-container">
            {/* 3'lü Podyum Alanı */}
            {displayRankings.length >= 2 && (
              <div className="challenge-podium-board">
                {/* 2. Sıra (Gümüş) */}
                {top2 && (
                  <div className={`podium-slot rank-2 ${top2.isMe || top2.name === rawPlayerName ? 'is-me-podium' : ''}`}>
                    <div className="podium-avatar">🥈</div>
                    <div className="podium-user-name">{top2.name} {top2.isMe || top2.name === rawPlayerName ? '(Sen)' : ''}</div>
                    <div className="podium-wpm">{top2.wpm} WPM</div>
                    <div className="podium-pedestal step-2">
                      <span className="step-num">2</span>
                    </div>
                  </div>
                )}

                {/* 1. Sıra (Altın) */}
                {top1 && (
                  <div className={`podium-slot rank-1 ${top1.isMe || top1.name === rawPlayerName ? 'is-me-podium' : ''}`}>
                    <div className="podium-crown">👑</div>
                    <div className="podium-avatar">🥇</div>
                    <div className="podium-user-name champion">{top1.name} {top1.isMe || top1.name === rawPlayerName ? '(Sen)' : ''}</div>
                    <div className="podium-wpm champion-wpm">{top1.wpm} WPM</div>
                    <div className="podium-pedestal step-1">
                      <span className="step-num">1</span>
                    </div>
                  </div>
                )}

                {/* 3. Sıra (Bronz) */}
                {top3 && (
                  <div className={`podium-slot rank-3 ${top3.isMe || top3.name === rawPlayerName ? 'is-me-podium' : ''}`}>
                    <div className="podium-avatar">🥉</div>
                    <div className="podium-user-name">{top3.name} {top3.isMe || top3.name === rawPlayerName ? '(Sen)' : ''}</div>
                    <div className="podium-wpm">{top3.wpm} WPM</div>
                    <div className="podium-pedestal step-3">
                      <span className="step-num">3</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ayrıntılı Sıralama Tablosu */}
            <div className="challenge-rankings-table-wrapper">
              <table className="challenge-rankings-table">
                <thead>
                  <tr>
                    <th>SIRA</th>
                    <th>YARIŞMACI</th>
                    <th>HIZ (WPM)</th>
                    <th>DOĞRULUK</th>
                    <th>SKOR</th>
                    <th>DURUM</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRankings.map((r, idx) => {
                    const isMe = r.isMe || r.name === rawPlayerName;
                    const rankNum = r.rank || (idx + 1);
                    return (
                      <tr key={r.name || idx} className={`ranking-row ${isMe ? 'ranking-row-me' : ''}`}>
                        <td className="rank-cell">
                          <span className={`rank-tag rank-tag-${rankNum <= 3 ? rankNum : 'normal'}`}>
                            {rankNum === 1 ? '🥇 #1' : rankNum === 2 ? '🥈 #2' : rankNum === 3 ? '🥉 #3' : `#${rankNum}`}
                          </span>
                        </td>
                        <td className="player-cell">
                          <div className="player-cell-content">
                            <span className="player-cell-name">{r.name}</span>
                            {isMe && <span className="cell-me-tag">SEN</span>}
                          </div>
                        </td>
                        <td className="wpm-cell">{r.wpm} WPM</td>
                        <td className="accuracy-cell">%{r.accuracy}</td>
                        <td className="score-cell">{r.score}</td>
                        <td className="status-cell">
                          {r.isEliminated ? (
                            <span className="status-pill eliminated">☠️ Elendi</span>
                          ) : rankNum === 1 ? (
                            <span className="status-pill winner">🏆 1. Sırada</span>
                          ) : (
                            <span className="status-pill completed">✓ Tamamladı</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : isMultiplayer ? (
          /* 1v1 Çift Oyuncu Detaylı Karşılaştırma Paneli */
          <div className="duel-versus-board">
            {/* SENİN KARTIN */}
            <div className={`duel-player-card ${effectiveMatchResult === 'victory' ? 'winner-card' : effectiveMatchResult === 'defeat' ? 'loser-card' : 'draw-card'}`}>
              <div className="player-card-header">
                <div className="player-avatar-ring">👤</div>
                <div className="player-title-box">
                  <span className="player-role-badge">SEN</span>
                  <span className="player-name-text">{displayName}</span>
                </div>
                {effectiveMatchResult === 'victory' && <span className="winner-crown-tag">👑 KAZANAN</span>}
                {effectiveMatchResult === 'draw' && <span className="winner-crown-tag draw-tag" style={{ background: '#f59e0b', color: '#000', borderColor: '#fbbf24' }}>🤝 BERABERE</span>}
              </div>

              <div className="player-metric-hero">
                <span className="metric-hero-label">SKOR</span>
                <span className="metric-hero-value">{score}</span>
                <span className="metric-hero-sub" title="Doğruluk ve Hız Ağırlıklı Düello Gücü">
                  DÜELLO GÜCÜ: <strong>{Math.round(myDuelRating)}</strong>
                </span>
              </div>

              <div className="player-stats-mini-grid">
                <div className="mini-stat-item">
                  <span className="mini-stat-label">HIZ</span>
                  <span className="mini-stat-val highlight-wpm">{wpm} WPM</span>
                </div>
                <div className="mini-stat-item">
                  <span className="mini-stat-label">KELİME</span>
                  <span className="mini-stat-val">{destroyedCount}</span>
                </div>
                <div className="mini-stat-item">
                  <span className="mini-stat-label">DOĞRULUK</span>
                  <span className="mini-stat-val">%{accuracy}</span>
                </div>
              </div>
            </div>

            {/* ORTA VS AYIRICI */}
            <div className="duel-mid-vs">
              <div className="vs-line-top" />
              <span className="vs-center-tag">VS</span>
              <div className="vs-line-bottom" />
            </div>

            {/* RAKİBİN KARTI */}
            <div className={`duel-player-card ${effectiveMatchResult === 'defeat' ? 'winner-card' : effectiveMatchResult === 'victory' ? 'loser-card' : 'draw-card'}`}>
              <div className="player-card-header">
                <div className="player-avatar-ring rival">🎯</div>
                <div className="player-title-box">
                  <span className="player-role-badge rival">RAKİP</span>
                  <span className="player-name-text">{displayRivalName}</span>
                </div>
                {effectiveMatchResult === 'defeat' && <span className="winner-crown-tag">👑 KAZANAN</span>}
                {effectiveMatchResult === 'draw' && <span className="winner-crown-tag draw-tag" style={{ background: '#f59e0b', color: '#000', borderColor: '#fbbf24' }}>🤝 BERABERE</span>}
              </div>

              <div className="player-metric-hero">
                <span className="metric-hero-label">SKOR</span>
                <span className="metric-hero-value rival-score">{rivalStats?.score ?? 0}</span>
                <span className="metric-hero-sub rival" title="Doğruluk ve Hız Ağırlıklı Düello Gücü">
                  DÜELLO GÜCÜ: <strong>{Math.round(rivalDuelRating)}</strong>
                </span>
              </div>

              <div className="player-stats-mini-grid">
                <div className="mini-stat-item">
                  <span className="mini-stat-label">HIZ</span>
                  <span className="mini-stat-val highlight-wpm">{rivalStats?.wpm ?? 0} WPM</span>
                </div>
                <div className="mini-stat-item">
                  <span className="mini-stat-label">KELİME</span>
                  <span className="mini-stat-val">{rivalStats?.words ?? Math.floor((rivalStats?.score || 0) / 60)}</span>
                </div>
                <div className="mini-stat-item">
                  <span className="mini-stat-label">DOĞRULUK</span>
                  <span className="mini-stat-val">%{rivalStats?.accuracy ?? (rivalStats?.lives === 0 ? 85 : 95)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Tek Kişilik Mod İstatistik Kutuları */
          <div className="modern-stats-row">
            <div className="modern-stat-box highlight">
              <span className="stat-label">TOPLAM SKOR</span>
              <span className="stat-number score-accent">{score}</span>
            </div>
            <div className="modern-stat-box">
              <span className="stat-label">YAZILAN KELİME</span>
              <span className="stat-number">{destroyedCount}</span>
            </div>
            <div className="modern-stat-box">
              <span className="stat-label">HIZ (WPM)</span>
              <span className="stat-number">{wpm}</span>
            </div>
            <div className="modern-stat-box">
              <span className="stat-label">DOĞRULUK</span>
              <span className="stat-number">%{accuracy}</span>
            </div>
          </div>
        )}

        {/* Kayıt Durumu */}
        <div className="modern-save-status">
          <span className="status-dot" />
          <span>{savedStatus || 'Skor kaydediliyor...'}</span>
        </div>

        {/* Aksiyon Butonları */}
        <div className="modern-result-actions">
          <button className="result-action-btn primary" onClick={onRestart}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isCommunityChallenge ? 'Bu Odayı Tekrar Oyna' : 'Tekrar Oyna'}</span>
          </button>

          {!isCommunityChallenge && onOpenLeaderboard && (
            <button className="result-action-btn secondary" onClick={onOpenLeaderboard}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4M5 4h14v4a7 7 0 01-7 7 7 7 0 01-7-7V4zM5 6H3a2 2 0 00-2 2v1a4 4 0 004 4h0M19 6h2a2 2 0 012 2v1a4 4 0 01-4 4h0" />
              </svg>
              <span>Liderlik Tablosu</span>
            </button>
          )}

          <button className="result-action-btn tertiary" onClick={onMainMenu}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
              <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>{isCommunityChallenge ? 'Canlı Odalara Dön' : 'Ana Menü'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
