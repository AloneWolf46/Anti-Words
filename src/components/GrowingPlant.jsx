import React, { useEffect, useState } from 'react';

/**
 * Bahçe & Bitki Büyütme Modu Hedef Bileşeni
 * - Ekranda rastgele alanlarda tohum olarak belirir.
 * - Su damladıkça (harfler doğru yazıldıkça) aşama aşama evrilir:
 *   1. Tohum -> 2. Filiz -> 3. Fidan -> 4. Tomurcuk -> 5. Çiçek
 * - Her doğru harfte su damlaları kütüğün/bitkinin üzerine düşer ve su sıçrama halkaları oluşur.
 * - Kelime tamamlandığında çiçek parıldayarak açar ve çiçek tozları saçar.
 */
export default function GrowingPlant({
  word,
  typedIndex,
  positionX,
  positionY,
  isActive,
  hasWateringCan = false,
  isBlooming = false,
  waterTrigger = 0,
}) {
  const [isWatering, setIsWatering] = useState(false);

  const chars = word ? word.split('') : [];

  // Evrim Aşaması Hesaplama (1 ile 5 arası)
  let stage = 1;
  if (isBlooming || typedIndex >= chars.length) {
    stage = 5;
  } else if (typedIndex > 0) {
    // Harf ilerlemesine göre orantılı evrim
    const progressRatio = typedIndex / chars.length;
    if (progressRatio >= 0.75) stage = 4;
    else if (progressRatio >= 0.5) stage = 3;
    else if (progressRatio >= 0.25) stage = 2;
    else stage = 2;
  }

  // Doğru harf basıldığında toprağa su sıçrama efekti
  useEffect(() => {
    if (!waterTrigger || !isActive) return;

    setIsWatering(true);
    const timer = setTimeout(() => {
      setIsWatering(false);
    }, 320);

    return () => clearTimeout(timer);
  }, [waterTrigger, isActive]);

  return (
    <div
      className={`growing-plant-container stage-${stage} ${isActive ? 'plant-focused' : ''} ${isBlooming ? 'plant-blooming' : ''}`}
      style={{
        left: `${positionX}%`,
        top: `${positionY}%`,
      }}
    >
      {/* Bitki Görseli (Aşamaya Göre Dinamik Değişir) */}
      <div className="plant-sprite-wrapper">
        <img
          src={`/assets/plant/plant-stage-${stage}.png`}
          alt={`Aşama ${stage}`}
          className={`plant-img stage-img-${stage}`}
          draggable={false}
        />

        {/* Sulama Anında Su Sıçraması (Halka) */}
        {isWatering && <div className="water-splash-ripple" />}

        {/* Çiçek Açma Kutlama Parıltıları */}
        {isBlooming && (
          <div className="bloom-sparkles-cluster">
            {Array.from({ length: 8 }).map((_, i) => (
              <span key={i} className={`pollen-sparkle sparkle-${i}`} />
            ))}
          </div>
        )}
      </div>

      {/* Bitki Üzerindeki Kelime Rozeti */}
      <div className="plant-word-badge">
        <div className="plant-letters-row">
          {chars.map((char, index) => {
            let charStatus = 'plant-char-pending';
            if (index < typedIndex) {
              charStatus = 'plant-char-watered';
            } else if (isActive && index === typedIndex) {
              charStatus = 'plant-char-active';
            }

            return (
              <span key={index} className={`plant-letter ${charStatus}`}>
                {char}
              </span>
            );
          })}
        </div>

        {/* Aşama İlerleme Çubuğu */}
        <div className="plant-growth-progress-bar">
          <div
            className="plant-growth-fill"
            style={{ width: `${(typedIndex / (chars.length || 1)) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
