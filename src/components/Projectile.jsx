import React, { useEffect, useState } from 'react';

/**
 * Oyuncunun namlusundan hedefe doğru uçan mermi parçacığı.
 */
export default function Projectile({ id, startX, startY, targetX, targetY, onComplete }) {
  const [currentPos, setCurrentPos] = useState({ x: startX, y: startY });

  // Açı hesaplama (namludan hedefe yönelme)
  const angle = Math.atan2(targetY - startY, targetX - startX) * (180 / Math.PI) + 90;

  useEffect(() => {
    // Bir sonraki render frame'inde hedef koordinata uçur
    const frame = requestAnimationFrame(() => {
      setCurrentPos({ x: targetX, y: targetY });
    });

    // 160ms sonra mermi hedefe ulaşır ve kaldırılır
    const timer = setTimeout(() => {
      onComplete(id);
    }, 160);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
    };
  }, [id, startX, startY, targetX, targetY, onComplete]);

  return (
    <div
      className="projectile"
      style={{
        left: `${currentPos.x}%`,
        top: `${currentPos.y}%`,
        transform: `translate(-50%, -50%) rotate(${angle}deg)`,
        transition: 'left 0.15s cubic-bezier(0.2, 0.8, 0.2, 1), top 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }}
    />
  );
}
