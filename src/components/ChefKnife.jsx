import React, { useEffect, useState } from 'react';

export default function ChefKnife({ targetX, targetY, chopTrigger = 0 }) {
  const [isChopping, setIsChopping] = useState(false);

  useEffect(() => {
    if (!chopTrigger) return;
    setIsChopping(true);
    const timer = setTimeout(() => setIsChopping(false), 140);
    return () => clearTimeout(timer);
  }, [chopTrigger]);

  if (targetX === null || targetX === undefined) return null;

  return (
    <div
      className={`chef-knife-wrapper ${isChopping ? 'is-chopping-action' : ''}`}
      style={{
        left: `${targetX}%`,
        top: `${targetY}%`,
      }}
    >
      {/* Şef Bıçağı Görseli */}
      <div className="chef-knife-actor">
        <img
          src={`${import.meta.env.BASE_URL}assets/chef-knife.png`}
          alt="Şef Bıçağı"
          className="knife-custom-image"
          draggable={false}
        />

        {/* Doğrama anında çıkan parlak kesme kıvılcımı / rüzgar izi */}
        {isChopping && (
          <div className="knife-chop-slash-fx">
            <span className="slash-arc" />
          </div>
        )}
      </div>
    </div>
  );
}
