import React, { useState, useEffect, useRef } from 'react';

export const TARGET_PALETTES = {
  purple:  { base: '#281a38', border: '#a855f7', activeBorder: '#c084fc', glow: 'rgba(168, 85, 247, 0.6)', eye: '#d8b4fe' },
  blue:    { base: '#152538', border: '#38bdf8', activeBorder: '#7dd3fc', glow: 'rgba(56, 189, 248, 0.6)', eye: '#7dd3fc' },
  orange:  { base: '#301d12', border: '#fb923c', activeBorder: '#fdba74', glow: 'rgba(251, 146, 60, 0.6)', eye: '#fdba74' },
  red:     { base: '#301419', border: '#f87171', activeBorder: '#fca5a5', glow: 'rgba(248, 113, 113, 0.6)', eye: '#fca5a5' },
  emerald: { base: '#132820', border: '#34d399', activeBorder: '#6ee7b7', glow: 'rgba(52, 211, 153, 0.6)', eye: '#6ee7b7' },
  gold:    { base: '#2d2712', border: '#fbbf24', activeBorder: '#fde047', glow: 'rgba(251, 191, 36, 0.6)', eye: '#fde047' },
};

export default function FallingWord({
  word,
  typedIndex,
  positionY,
  positionX,
  isActive,
  theme = 'blue',
  targetId = 1,
}) {
  if (!word) return null;

  const palette = TARGET_PALETTES[theme] || TARGET_PALETTES.blue;
  const chars = word.split('');

  // Hasar tepkisi (flinch) animasyonu
  const [isHit, setIsHit] = useState(false);
  const prevTypedRef = useRef(typedIndex);

  useEffect(() => {
    if (typedIndex > prevTypedRef.current) {
      setIsHit(true);
      const timer = setTimeout(() => setIsHit(false), 140);
      prevTypedRef.current = typedIndex;
      return () => clearTimeout(timer);
    }
    prevTypedRef.current = typedIndex;
  }, [typedIndex]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
  const calculatedWidth = isMobile
    ? Math.max(92, chars.length * 12 + 28)
    : Math.max(118, chars.length * 15 + 46);

  return (
    <div
      className={`modern-target-node virus-target-organism ${isActive ? 'target-locked' : ''} ${isHit ? 'virus-damaged' : ''}`}
      style={{
        top: `${positionY}%`,
        left: `${positionX}%`,
        width: `${calculatedWidth}px`,
      }}
    >
      {/* Aktif Hedef Nişangahı (Reticle) */}
      {isActive && (
        <div className="target-reticle-wrap virus-reticle">
          <div className="reticle-line top" style={{ background: palette.activeBorder, boxShadow: `0 0 8px ${palette.activeBorder}` }} />
          <div className="reticle-line bottom" style={{ background: palette.activeBorder, boxShadow: `0 0 8px ${palette.activeBorder}` }} />
          <div className="reticle-line left" style={{ background: palette.activeBorder, boxShadow: `0 0 8px ${palette.activeBorder}` }} />
          <div className="reticle-line right" style={{ background: palette.activeBorder, boxShadow: `0 0 8px ${palette.activeBorder}` }} />
          <div className="reticle-tag" style={{ color: palette.activeBorder, borderColor: palette.border }}>VİRÜS KİLİTLENDİ</div>
        </div>
      )}

      {/* Corona Dikenleri / Reseptör Dokunaçları (3D Spikes with Glow Knobs) */}
      <div className="virus-spikes-cluster">
        {/* Üst Dikenler */}
        <div className="virus-spike spike-top-1">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-top-2">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-top-3">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>

        {/* Alt Dikenler */}
        <div className="virus-spike spike-bot-1">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-bot-2">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-bot-3">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>

        {/* Sol Dikenler */}
        <div className="virus-spike spike-left-1">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-left-2">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>

        {/* Sağ Dikenler */}
        <div className="virus-spike spike-right-1">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
        <div className="virus-spike spike-right-2">
          <div className="spike-stalk" />
          <div className="spike-knob" style={{ background: palette.border, boxShadow: `0 0 8px ${palette.glow}` }} />
        </div>
      </div>

      {/* 3D Virüs Kapsid Gövdesi */}
      <div
        className="virus-capsid-shell"
        style={{
          background: `radial-gradient(ellipse at 35% 25%, ${palette.base} 0%, #131720 65%, #090b0f 100%)`,
          borderColor: isActive ? palette.activeBorder : palette.border,
          boxShadow: isActive
            ? `0 0 24px ${palette.glow}, inset 0 2px 6px rgba(255,255,255,0.22), inset 0 -4px 10px rgba(0,0,0,0.8)`
            : `0 6px 18px rgba(0, 0, 0, 0.65), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -3px 8px rgba(0,0,0,0.7)`,
        }}
      >
        {/* Organik Yüzey Gözenekleri / Pores */}
        <div className="virus-pore pore-1" />
        <div className="virus-pore pore-2" />
        <div className="virus-pore pore-3" />

        {/* Tehditkar Virüs Yüzü (Öfkeli Gözler & Kaşlar) */}
        <div className="virus-menacing-face">
          {/* Sol Göz */}
          <div className="virus-eye-socket eye-left">
            <div className="virus-brow-ridge brow-left" />
            <div className="virus-eyeball">
              <div
                className="virus-pupil-iris"
                style={{
                  background: palette.eye,
                  boxShadow: `0 0 8px ${palette.eye}`,
                }}
              >
                <div className="iris-glint" />
              </div>
            </div>
          </div>

          {/* Sağ Göz */}
          <div className="virus-eye-socket eye-right">
            <div className="virus-brow-ridge brow-right" />
            <div className="virus-eyeball">
              <div
                className="virus-pupil-iris"
                style={{
                  background: palette.eye,
                  boxShadow: `0 0 8px ${palette.eye}`,
                }}
              >
                <div className="iris-glint" />
              </div>
            </div>
          </div>
        </div>

        {/* Kelime Yuvası (Word Dock) */}
        <div className="virus-word-dock">
          <div className="target-letters-row">
            {chars.map((char, index) => {
              let charClass = 'char-pending';
              if (index < typedIndex) {
                charClass = 'char-typed';
              } else if (isActive && index === typedIndex) {
                charClass = 'char-next';
              }

              return (
                <span
                  key={index}
                  className={`target-letter ${charClass}`}
                  style={index < typedIndex ? { width: 0, opacity: 0, overflow: 'hidden' } : {}}
                >
                  {char}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
