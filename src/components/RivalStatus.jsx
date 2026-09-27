import React from 'react';

export default function RivalStatus({ rivalData, participantsList = [], myName = 'Sen' }) {
  // Çok oyunculu (Grup veya Arena) canlı sıralama çubuğu
  if (participantsList && participantsList.length > 2) {
    // WPM ve Skora göre sırala
    const sorted = [...participantsList].sort((a, b) => {
      const aWpm = a.stats?.wpm || 0;
      const bWpm = b.stats?.wpm || 0;
      if (bWpm !== aWpm) return bWpm - aWpm;
      return (b.stats?.score || 0) - (a.stats?.score || 0);
    });

    return (
      <div className="group-live-leaderboard-hud">
        <div className="group-hud-header">
          <span className="live-pulsing-dot small" />
          <span className="group-hud-title">CANLI YARIŞMA SIRALAMASI</span>
        </div>
        <div className="group-hud-list">
          {sorted.slice(0, 5).map((p, idx) => {
            const isMe = p.name === myName;
            const wpm = p.stats?.wpm || 0;
            const score = p.stats?.score || 0;
            const isEliminated = Boolean(p.stats?.isEliminated);
            const rankEmoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

            return (
              <div key={p.name} className={`group-hud-row ${isMe ? 'is-me' : ''} ${isEliminated ? 'eliminated' : ''}`}>
                <span className="group-hud-rank">{rankEmoji}</span>
                <span className="group-hud-name">{p.name} {isMe ? '(Sen)' : ''}</span>
                <span className="group-hud-wpm">{wpm} WPM</span>
                <span className="group-hud-score">{score}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Klasik 1v1 Rakip HUD'ı
  if (!rivalData) return null;

  const {
    name = 'Rakip',
    score = 0,
    lives = 3,
    wpm = 0,
    isEliminated = false,
  } = rivalData;

  return (
    <div className={`rival-status-hud ${isEliminated ? 'eliminated' : ''}`}>
      <div className="rival-hud-header">
        <span className="rival-pulse-dot" />
        <span className="rival-title">RAKİP: {name.toUpperCase()}</span>
      </div>

      <div className="rival-hud-body">
        {/* Can Göstergesi */}
        <div className="rival-stat-group">
          <span className="stat-label">CAN</span>
          <div className="rival-lives-row">
            {[1, 2, 3].map((heart) => (
              <span
                key={heart}
                className={`rival-heart ${heart <= lives ? 'active' : 'lost'}`}
              >
                ♥
              </span>
            ))}
          </div>
        </div>

        {/* Skor */}
        <div className="rival-stat-group">
          <span className="stat-label">SKOR</span>
          <span className="stat-val rival-score-num">{score}</span>
        </div>

        {/* Hız */}
        <div className="rival-stat-group">
          <span className="stat-label">HIZ</span>
          <span className="stat-val rival-wpm-num">{wpm} WPM</span>
        </div>
      </div>

      {isEliminated && (
        <div className="rival-eliminated-badge">
          ELENDİ!
        </div>
      )}
    </div>
  );
}
