import React, { useEffect, useState } from 'react';

/**
 * Kütüğe Monteli Akıllı Balta Bileşeni (AxeWeapon)
 * - Kütüğün hemen üstünde, bıçağı doğrudan kütüğün gövdesine bakacak şekilde konumlanır.
 * - Her doğru harfte (chopTrigger) güçlü bir darbe indirir ve talaş saçar.
 * - Hedef odaklıyken altın rengi darbe şoku üretir.
 */
export default function AxeWeapon({ chopTrigger = 0, isFocused = false }) {
  const [isChopping, setIsChopping] = useState(false);
  const [chips, setChips] = useState([]);

  useEffect(() => {
    if (!chopTrigger) return;

    setIsChopping(true);

    // Darbe anında kütükten fırlayan tahta kıymıkları
    const newChips = Array.from({ length: 7 }).map((_, i) => ({
      id: `chip-${Date.now()}-${i}`,
      vx: (Math.random() - 0.5) * 70,
      vy: -Math.random() * 50 - 25,
      rot: (Math.random() - 0.5) * 360,
      size: Math.random() * 6 + 4,
      color: ['#c29462', '#e4b678', '#8b5a2b', '#d29b55', '#fff1d6'][Math.floor(Math.random() * 5)],
    }));
    setChips((prev) => [...prev.slice(-14), ...newChips]);

    const timer = setTimeout(() => {
      setIsChopping(false);
    }, 130);

    return () => clearTimeout(timer);
  }, [chopTrigger]);

  // Kıymıkları temizle
  useEffect(() => {
    if (chips.length === 0) return;
    const timer = setTimeout(() => {
      setChips((prev) => prev.slice(7));
    }, 400);
    return () => clearTimeout(timer);
  }, [chips]);

  return (
    <div className={`log-axe-anchor ${isFocused ? 'axe-target-focused' : 'axe-target-idle'}`}>
      {/* Vuruş Talaş/Kıymık Parçacıkları */}
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="wood-chip-particle"
          style={{
            '--vx': `${chip.vx}px`,
            '--vy': `${chip.vy}px`,
            '--rot': `${chip.rot}deg`,
            width: `${chip.size}px`,
            height: `${chip.size * 0.55}px`,
            backgroundColor: chip.color,
          }}
        />
      ))}

      {/* Balta Görseli ve Vurma Animasyonu */}
      <div className={`axe-sprite-wrap ${isChopping ? 'axe-chopping-hit' : 'axe-idle-hover'}`}>
        <img
          src={`${import.meta.env.BASE_URL}assets/axe.png`}
          alt="Balta"
          className="axe-sprite-img"
          draggable={false}
        />
        {/* Vuruş Darbe Şoku */}
        {isChopping && <div className="axe-impact-shockwave" />}
      </div>
    </div>
  );
}
