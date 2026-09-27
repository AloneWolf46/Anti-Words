import React from 'react';

export default function GameHeader({
  score,
  lives,
  maxLives = 3,
  isPaused,
  speedLabel,
  onPause,
  onSpeedDown,
  onSpeedUp,
  isMultiplayer = false,
  timeLeft = null,
  rivalData = null,
  myName = 'Sen',
}) {
  const renderHearts = (currentLives) => {
    const hearts = [];
    for (let i = 0; i < maxLives; i++) {
      hearts.push(
        <span
          key={i}
          className={`floating-heart ${i < currentLives ? 'alive' : 'lost'}`}
        >
          ♥
        </span>
      );
    }
    return hearts;
  };

  const formatTimer = (seconds) => {
    if (seconds === null || seconds === undefined) return 'SONSUZ ♾️';
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <aside
      className="duel-hud-sidebar"
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        width: '220px',
        maxWidth: '220px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 90,
        pointerEvents: 'auto',
      }}
    >
      {/* 1. ÜST DİKDÖRTGEN PENCERE: SEN (SKOR & CAN) */}
      <div className="hud-rect-card my-card">
        <div className="hud-rect-top-row">
          <div className="hud-rect-badge my-badge">
            <span className="hud-rect-dot my-dot" />
            <span className="hud-rect-name" title={myName}>
              {isMultiplayer ? 'SEN' : (myName ? myName.slice(0, 10).toUpperCase() : 'SKOR')}
            </span>
          </div>
          <div className="hud-rect-hearts">{renderHearts(lives)}</div>
        </div>

        <div className="hud-rect-main-row">
          <span className="hud-rect-big-score my-score">{score}</span>
          <span className="hud-rect-sublabel">PUAN</span>
        </div>
      </div>

      {/* 2. ALT DİKDÖRTGEN PENCERE: RAKİP (1v1) VEYA SÜRE & HIZ (TEK KİŞİLİK) */}
      {isMultiplayer ? (
        <div className={`hud-rect-card rival-card ${rivalData?.isEliminated ? 'eliminated' : ''}`}>
          <div className="hud-rect-top-row">
            <div className="hud-rect-badge rival-badge">
              <span className="hud-rect-dot rival-dot" />
              <span className="hud-rect-name" title={rivalData?.name || 'Rakip'}>
                RAKİP: {(rivalData?.name ? rivalData.name.slice(0, 8) : 'RAKİP').toUpperCase()}
              </span>
            </div>
            <div className="hud-rect-hearts">
              {renderHearts(rivalData?.lives !== undefined ? rivalData.lives : 3)}
            </div>
          </div>

          <div className="hud-rect-main-row">
            <span className="hud-rect-big-score rival-score">{rivalData?.score ?? 0}</span>
            <div className="hud-rect-meta-col">
              <span className="hud-rect-sublabel">PUAN</span>
              {rivalData?.wpm !== undefined && (
                <span className="hud-rect-wpm">{rivalData.wpm} WPM</span>
              )}
            </div>
          </div>

          {rivalData?.isEliminated && (
            <div className="hud-rect-eliminated-badge">ELENDİ!</div>
          )}
        </div>
      ) : (
        <div className="hud-rect-card info-card">
          <div className="hud-rect-top-row">
            <div className="hud-rect-badge info-badge">
              <span className="hud-rect-dot info-dot" />
              <span className="hud-rect-name">MAÇ DURUMU</span>
            </div>
            {timeLeft !== null && timeLeft !== undefined && (
              <span className="hud-timer-tag">⏳ SÜRE</span>
            )}
          </div>

          <div className="hud-rect-main-row">
            <span className={`hud-rect-big-timer ${timeLeft !== null && timeLeft <= 10 ? 'urgent' : ''}`}>
              {formatTimer(timeLeft)}
            </span>
          </div>

          <div className="hud-rect-controls-subrow">
            <span className="hud-controls-label">HIZ</span>
            <div className="hud-controls-buttons">
              <button
                type="button"
                className="hud-ctrl-btn"
                onClick={onSpeedDown}
                title="Hızı Düşür"
              >
                ◀
              </button>
              <span className="hud-ctrl-val">{speedLabel}</span>
              <button
                type="button"
                className="hud-ctrl-btn"
                onClick={onSpeedUp}
                title="Hızı Artır"
              >
                ▶
              </button>
              <button
                type="button"
                className={`hud-ctrl-btn pause-btn ${isPaused ? 'paused' : ''}`}
                onClick={onPause}
                title="Duraklat (ESC)"
              >
                {isPaused ? '▶' : '❚❚'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. ÇOK OYUNCULUYSA: İKİ PENCERENİN ALTINDA KOMPAKT SÜRE & HIZ BARININ YER ALMASI */}
      {isMultiplayer && (
        <div className="hud-rect-bottom-strip">
          {timeLeft !== null && timeLeft !== undefined && (
            <div className={`hud-strip-timer ${timeLeft <= 10 ? 'urgent' : ''}`}>
              <span className="timer-icon">⏳</span>
              <span className="timer-val">{formatTimer(timeLeft)}</span>
            </div>
          )}
          <div className="hud-strip-speed">
            <button
              type="button"
              className="hud-ctrl-btn mini"
              onClick={onSpeedDown}
              title="Hızı Düşür"
            >
              ◀
            </button>
            <span className="hud-strip-speed-val">{speedLabel}</span>
            <button
              type="button"
              className="hud-ctrl-btn mini"
              onClick={onSpeedUp}
              title="Hızı Artır"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
