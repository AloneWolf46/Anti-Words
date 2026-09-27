import React from 'react';

/**
 * Ahşap masanın üzerinde konumlanan, minimalist titanyum odak savunma kulesi.
 */
export default function Player({ aimAngle = 0, isShooting = false }) {
  return (
    <footer className="modern-player-dock">
      <div
        className={`modern-turret-core ${isShooting ? 'firing' : ''}`}
        style={{
          transform: `rotate(${aimAngle}deg)`,
        }}
      >
        {/* Namlu ve Ateşleme Kıvılcımı */}
        <div className="modern-nozzle">
          {isShooting && <span className="modern-muzzle-flash" />}
        </div>
        {/* Titanyum Gövde */}
        <div className="modern-turret-housing">
          <div className="turret-lens-core" />
        </div>
      </div>

      <div className="modern-dock-status">
        <span className="dock-status-dot" />
        <span>{aimAngle !== 0 ? `HEDEF ODAĞI: ${Math.round(aimAngle)}°` : 'SAVUNMA SİSTEMİ AKTİF'}</span>
      </div>
    </footer>
  );
}
