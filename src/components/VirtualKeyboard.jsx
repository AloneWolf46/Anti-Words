import React, { useState, useEffect, useRef } from 'react';
import { toTurkishLower } from '../utils/turkishUtils';

// Türkçe Q Klavye Tuş Düzeni
const KEYBOARD_ROWS_Q = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Ğ', 'Ü'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ş', 'İ'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Ö', 'Ç'],
];

// Türkçe F Klavye Tuş Düzeni
const KEYBOARD_ROWS_F = [
  ['F', 'G', 'Ğ', 'I', 'O', 'D', 'R', 'N', 'H', 'P', 'Q', 'W'],
  ['U', 'İ', 'E', 'A', 'Ü', 'T', 'K', 'M', 'L', 'Y', 'Ş', 'X'],
  ['J', 'Ö', 'V', 'C', 'Ç', 'Z', 'S', 'B'],
];

export default function VirtualKeyboard({ onKeyPress, isVisible = true, onToggleVisibility }) {
  const [activeKey, setActiveKey] = useState(null);
  const [layout, setLayout] = useState(() => {
    try {
      return localStorage.getItem('antiwords_kb_layout') || 'Q';
    } catch {
      return 'Q';
    }
  });

  const [useNativeKeyboard, setUseNativeKeyboard] = useState(false);
  const hiddenInputRef = useRef(null);

  const toggleLayout = () => {
    const next = layout === 'Q' ? 'F' : 'Q';
    setLayout(next);
    try {
      localStorage.setItem('antiwords_kb_layout', next);
    } catch {}
  };

  const handleKeyTouch = (e, char) => {
    e.preventDefault();
    setActiveKey(char);
    if (onKeyPress) {
      onKeyPress(toTurkishLower(char));
    }
    setTimeout(() => setActiveKey(null), 120);
  };

  // Telefonun kendi klavyesini açma
  useEffect(() => {
    if (useNativeKeyboard && hiddenInputRef.current) {
      hiddenInputRef.current.focus();
    }
  }, [useNativeKeyboard]);

  const handleNativeInputChange = (e) => {
    const val = e.target.value;
    if (val && val.length > 0) {
      const lastChar = val[val.length - 1];
      if (onKeyPress) {
        onKeyPress(toTurkishLower(lastChar));
      }
    }
    e.target.value = '';
  };

  const activeRows = layout === 'F' ? KEYBOARD_ROWS_F : KEYBOARD_ROWS_Q;

  if (!isVisible) {
    return (
      <button
        type="button"
        className="mobile-kb-show-toggle"
        onClick={onToggleVisibility}
        title="Klavyeyi Aç"
      >
        ⌨️ Klavyeyi Göster ({layout})
      </button>
    );
  }

  return (
    <div className="virtual-keyboard-overlay">
      {/* Gizli Input (Native Klavye İstendiğinde) */}
      <input
        ref={hiddenInputRef}
        type="text"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        onChange={handleNativeInputChange}
        style={{
          position: 'absolute',
          opacity: 0,
          pointerEvents: useNativeKeyboard ? 'auto' : 'none',
          width: '1px',
          height: '1px',
          bottom: 0,
          left: 0,
        }}
      />

      <div className="virtual-keyboard-header">
        <div className="kb-header-left">
          <span className="kb-hint-text">📱 TÜRKÇE {layout} KLAVYE</span>
          <button
            type="button"
            className="kb-layout-toggle-btn"
            onClick={toggleLayout}
            title="Q ve F Klavye Arasında Geçiş Yap"
          >
            🔄 {layout === 'Q' ? 'F Klavyeye Geç' : 'Q Klavyeye Geç'}
          </button>
        </div>

        <div className="kb-header-right">
          <button
            type="button"
            className={`kb-native-toggle-btn ${useNativeKeyboard ? 'active' : ''}`}
            onClick={() => {
              setUseNativeKeyboard((prev) => !prev);
              if (!useNativeKeyboard && hiddenInputRef.current) {
                hiddenInputRef.current.focus();
              }
            }}
            title="Telefonun Kendi Klavyeyi Aç / Kapat"
          >
            {useNativeKeyboard ? '📲 Dokunmatik Tuşlar' : '⌨️ Telefon Klavyesi'}
          </button>

          <button
            type="button"
            className="kb-collapse-btn"
            onClick={onToggleVisibility}
            title="Klavyeyi Gizle"
          >
            ▼
          </button>
        </div>
      </div>

      {!useNativeKeyboard ? (
        <div className="virtual-keyboard-body">
          {activeRows.map((row, rIdx) => (
            <div key={rIdx} className={`kb-row row-${rIdx} layout-${layout.toLowerCase()}`}>
              {row.map((char) => (
                <button
                  key={char}
                  type="button"
                  className={`kb-key ${activeKey === char ? 'active-pressed' : ''}`}
                  onPointerDown={(e) => handleKeyTouch(e, char)}
                >
                  {char}
                </button>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="kb-native-active-prompt"
          onClick={() => hiddenInputRef.current && hiddenInputRef.current.focus()}
        >
          <span>💬 Telefon klavyesi aktif! Buraya dokunarak yazmaya devam edin...</span>
        </div>
      )}
    </div>
  );
}
