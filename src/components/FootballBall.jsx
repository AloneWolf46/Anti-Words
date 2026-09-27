import React, { useEffect, useState } from 'react';

/**
 * Futbol / Şut & Gol Modu Hedef Bileşeni
 * - Saha üzerinde ceza sahası çevresinde duran futbol topu.
 * - Topun hemen altında kelime rozeti bulunur.
 * - Doğru harfler yazıldıkça top vuruş tepkisiyle zıplar (kickTrigger).
 * - Aktif hedefte odak halkası ve harf vurguları parlar.
 */
export default function FootballBall({
  word,
  typedIndex = 0,
  positionX,
  positionY,
  isActive = false,
  kickTrigger = 0,
  lifeSpent = 0,
  maxLife = 18,
}) {
  const [isKicking, setIsKicking] = useState(false);

  const chars = word ? word.split('') : [];

  // Vuruş / Tekme Mikro Zıplama Tepkisi
  useEffect(() => {
    if (!kickTrigger || !isActive) return;
    setIsKicking(true);
    const timer = setTimeout(() => {
      setIsKicking(false);
    }, 140);
    return () => clearTimeout(timer);
  }, [kickTrigger, isActive]);

  // Kalan süre oranı (%0 - %100)
  const remainingLifeRatio = Math.max(0, Math.min(1, 1 - (lifeSpent || 0) / (maxLife || 18)));
  const isUrgent = remainingLifeRatio < 0.3 && !isActive;

  return (
    <div
      className={`football-target-container ${isActive ? 'is-active-ball' : ''} ${
        isUrgent ? 'is-urgent-ball' : ''
      }`}
      style={{
        left: `${positionX}%`,
        top: `${positionY}%`,
      }}
    >
      {/* Top ve Çim Gölgesi Sarıcısı */}
      <div className={`football-ball-wrap ${isKicking ? 'ball-kicking-recoil' : ''}`}>
        {/* Çim Üzerindeki Eliptik Gölge */}
        <div className="football-grass-shadow" />

        {/* Aktif Odak Işıltısı */}
        {isActive && <div className="football-focus-glow" />}

        {/* Futbol Topu Görseli */}
        <img
          src="/assets/football-ball.png"
          alt="Futbol Topu"
          className="football-ball-img"
          draggable={false}
        />

        {/* Vuruş Sırasında Çim Sıçraması Parçacıkları */}
        {isKicking && (
          <div className="turf-particles-cluster">
            <span className="turf-particle t1" />
            <span className="turf-particle t2" />
            <span className="turf-particle t3" />
          </div>
        )}
      </div>

      {/* Topun Altında Yer Alan Kelime Rozeti */}
      <div className="football-word-badge">
        <div className="football-letters-row">
          {chars.map((char, index) => {
            let charStatus = 'football-char-pending';
            if (index < typedIndex) {
              charStatus = 'football-char-typed';
            } else if (isActive && index === typedIndex) {
              charStatus = 'football-char-active';
            }

            return (
              <span key={index} className={`football-letter ${charStatus}`}>
                {char}
              </span>
            );
          })}
        </div>

        {/* Süre / İlerleme Çizgisi */}
        <div className="football-badge-timer-track">
          {isActive ? (
            <div
              className="football-typed-fill"
              style={{ width: `${(typedIndex / (chars.length || 1)) * 100}%` }}
            />
          ) : (
            <div
              className={`football-timer-fill ${remainingLifeRatio < 0.35 ? 'danger' : ''}`}
              style={{ width: `${remainingLifeRatio * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
