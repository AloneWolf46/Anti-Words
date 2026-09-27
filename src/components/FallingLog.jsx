import React, { useEffect, useState } from 'react';
import AxeWeapon from './AxeWeapon';

/**
 * Odun Kesme Modu İçin Düşen Kütük Bileşeni
 * - wood-log.png görselini kütük gövdesi olarak kullanır.
 * - Kelime harflerini kütüğün gövdesi üzerine rustik/ahşap oyma stiliyle yazar.
 * - Yazılan harflere göre kütükte kesik/darbe izleri oluşturur.
 * - Balta bu kütüğe atanmışsa (hasAxe) doğrudan kütüğün üzerinde yer alır, asla havada kalmaz.
 */
export default function FallingLog({
  word,
  typedIndex,
  positionY,
  positionX,
  isActive,
  isBreaking = false,
  hasAxe = false,
  chopTrigger = 0,
}) {
  const [isShaking, setIsShaking] = useState(false);

  // Doğru harfe vurulduğunda kütük darbe ile anlık titrer
  useEffect(() => {
    if (!chopTrigger || !hasAxe) return;
    setIsShaking(true);
    const timer = setTimeout(() => setIsShaking(false), 120);
    return () => clearTimeout(timer);
  }, [chopTrigger, hasAxe]);

  if (!word) return null;

  const chars = word.split('');
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  // Kelime uzunluğuna göre kütük genişliği (mobilde ekran sınırlarına tam oturan kompakt boyut)
  const calculatedWidth = isMobile
    ? Math.max(120, Math.min(185, chars.length * 15 + 38))
    : Math.max(160, Math.min(270, chars.length * 22 + 70));

  return (
    <div
      className={`falling-log-container ${isActive ? 'log-focused' : ''} ${isBreaking ? 'log-breaking' : ''}`}
      style={{
        top: `${positionY}%`,
        left: `${positionX}%`,
        width: `${calculatedWidth}px`,
      }}
    >
      {/* Aktif Odak Göstergesi (Kütük Nişangahı) */}
      {isActive && !isBreaking && (
        <div className="log-focus-halo">
          <div className="halo-spin-ring" />
          <div className="halo-axe-pointer">HEDEF</div>
        </div>
      )}

      {/* Normal Kütük Görünümü */}
      {!isBreaking ? (
        <div className={`log-body-wrapper ${isShaking ? 'log-hit-shake' : ''}`}>
          {/* Kütük Görseli */}
          <img
            src={`${import.meta.env.BASE_URL}assets/wood-log.png`}
            alt="Kütük"
            className="log-wood-image"
            draggable={false}
          />

          {/* Kütük Üzerindeki Harfler */}
          <div className="log-letters-overlay">
            {chars.map((char, index) => {
              let statusClass = 'log-char-pending';
              if (index < typedIndex) {
                statusClass = 'log-char-chopped';
              } else if (isActive && index === typedIndex) {
                statusClass = 'log-char-next';
              }

              return (
                <span
                  key={index}
                  className={`log-char ${statusClass}`}
                >
                  {char}
                </span>
              );
            })}
          </div>

          {/* İlerleme Kesik İzi (Doğru yazılan harf oranı) */}
          {typedIndex > 0 && (
            <div
              className="log-crack-overlay"
              style={{
                width: `${(typedIndex / chars.length) * 100}%`,
              }}
            />
          )}
        </div>
      ) : (
        /* Kütük Parçalanma Efekti (İki Parçaya Bölünerek Uçuşur) */
        <div className="log-split-wrapper">
          <img
            src={`${import.meta.env.BASE_URL}assets/wood-log-left.png`}
            alt="Kütük Sol Parça"
            className="log-split-piece piece-left"
            draggable={false}
          />
          <img
            src={`${import.meta.env.BASE_URL}assets/wood-log-right.png`}
            alt="Kütük Sağ Parça"
            className="log-split-piece piece-right"
            draggable={false}
          />
        </div>
      )}

      {/* Doğrudan Kütüğün Üzerine Konumlanan Balta (Asla Gecikmez veya Havada Vurmaz) */}
      {hasAxe && !isBreaking && (
        <AxeWeapon
          chopTrigger={chopTrigger}
          isFocused={isActive}
        />
      )}
    </div>
  );
}
