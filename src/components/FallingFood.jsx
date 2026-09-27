import React, { useState } from 'react';

// Pizza malzemeleri listesi (Mantar, Sucuk, Domates, Biber, Peynir, Zeytin, Mısır)
export const FOOD_TYPES = [
  { id: 'mushroom', name: 'Mantar', emoji: '🍄', color: '#e0a96d' },
  { id: 'sausage', name: 'Sucuk', emoji: '🥩', color: '#e11d48' },
  { id: 'tomato', name: 'Domates', emoji: '🍅', color: '#ef4444' },
  { id: 'pepper', name: 'Biber', emoji: '🫑', color: '#22c55e' },
  { id: 'cheese', name: 'Peynir', emoji: '🧀', color: '#fbbf24' },
  { id: 'olive', name: 'Zeytin', emoji: '🫒', color: '#475569' },
  { id: 'corn', name: 'Mısır', emoji: '🌽', color: '#eab308' },
];

export function getFoodTypeForWord(word, id) {
  const index = Math.abs((Number(id) || 0) + (word ? word.charCodeAt(0) : 0)) % FOOD_TYPES.length;
  return FOOD_TYPES[index];
}

export default function FallingFood({
  word,
  typedIndex,
  positionY,
  positionX,
  isActive,
  foodId,
  isSliced = false,
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const food = FOOD_TYPES.find((f) => f.id === foodId) || FOOD_TYPES[0];

  const typedPart = word.slice(0, typedIndex);
  const nextChar = word[typedIndex] || '';
  const remainingPart = word.slice(typedIndex + 1);

  return (
    <div
      className={`falling-food-container ${isActive ? 'active-food-target' : ''} ${
        isSliced ? 'food-sliced-burst' : ''
      }`}
      style={{
        left: `${positionX}%`,
        top: `${positionY}%`,
      }}
    >
      {/* 1. Malzeme Görseli (Varsa özel resim örn: mushroom.png, yoksa tatlı fallback emoji) */}
      <div
        className="food-avatar-bubble"
        style={{
          boxShadow: isActive
            ? `0 0 20px ${food.color}cc, 0 4px 12px rgba(0,0,0,0.5)`
            : '0 4px 12px rgba(0,0,0,0.35)',
          borderColor: isActive ? food.color : 'rgba(255, 255, 255, 0.22)',
        }}
      >
        {!imgFailed ? (
          <img
            src={`/assets/food/${food.id}.png`}
            alt={food.name}
            className="food-custom-img"
            onError={() => setImgFailed(true)}
            draggable={false}
          />
        ) : (
          <span className="food-fallback-emoji" title={food.name}>
            {food.emoji}
          </span>
        )}

        {/* Aktif Hedef Halka Parıltısı */}
        {isActive && !isSliced && (
          <div className="food-active-pulse-ring" style={{ borderColor: food.color }} />
        )}
      </div>

      {/* 2. Dilimlenirken Kelime Rozeti Kaybolur, Normal Düşerken Gösterilir */}
      {!isSliced && (
        <div className={`food-word-badge ${isActive ? 'active-badge' : ''}`}>
          <span className="char-typed">{typedPart}</span>
          <span className="char-next">{nextChar}</span>
          <span className="char-remaining">{remainingPart}</span>
        </div>
      )}
    </div>
  );
}
