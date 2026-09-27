import React, { useState, useEffect, useRef } from 'react';
import CommunityArenaTab from './CommunityArenaTab';
import { getLeaderboard } from '../services/leaderboardService';
import { getCurrentPlayerName, setCurrentPlayerName } from '../utils/turkishUtils';

export default function MainMenu({
  onStartWithDifficulty,
  onOpenMultiplayer,
  onOpenLeaderboard,
  onStartCommunityChallenge,
  onJoinCommunityChallenge,
  onCreateCommunityChallenge,
  highScore = 0,
  isMuted = false,
  onToggleMute,
}) {
  // Kullanıcı adı state'i (Sayfa her yenilendiğinde başa döner)
  const [playerName, setPlayerName] = useState(() => getCurrentPlayerName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);
  const nameInputRef = useRef(null);

  // Modallar ve bildirimler
  const [showSettings, setShowSettings] = useState(false);
  const [showDiffPicker, setShowDiffPicker] = useState(false);
  const [modeForDiff, setModeForDiff] = useState('SINGLE'); // 'SINGLE' | 'WOOD'
  const [selectedSingleDuration, setSelectedSingleDuration] = useState(60); // 30, 60, 90, 120, 0 (Sonsuz)
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'multiplayer' | 'leaderboard' | 'settings'
  const [toastMessage, setToastMessage] = useState(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [topLeaderboard, setTopLeaderboard] = useState([]);

  // Günlük seri (localStorage'dan dinamik)
  const [dailyStreak] = useState(() => {
    return parseInt(localStorage.getItem('antiwords_daily_streak') || '1', 10);
  });

  const [bestWpm] = useState(() => {
    return parseInt(localStorage.getItem('antiwords_best_wpm') || '0', 10);
  });

  // Sayfa her yenilendiğinde rastgele değişen On Parmak & Hızlı Yazma Taktikleri
  const typingTips = [
    {
      icon: '⚡',
      title: 'Son Harfe Odaklan',
      desc: 'Klavyeye bakmak yerine kelimenin son harfine odaklanırsan refleks hızın katlanır.',
    },
    {
      icon: '🎯',
      title: 'F ve J Kılavuzları',
      desc: 'İşaret parmaklarını F ve J çıkıntılarında tutarak tüm klavyeyi parmak uçlarınla haritalandır.',
    },
    {
      icon: '🧘',
      title: 'Akıcı ve Sabit Ritim',
      desc: 'Ani hızlanıp duraksamak yerine sabit bir ritim tutturmak hata yapmanı tamamen önler.',
    },
    {
      icon: '🚀',
      title: 'Önceden Yakala',
      desc: 'Yazdığın kelimeyi bitirirken göz ucuyla sonraki kelimeyi okumak yazma hızını 15+ WPM artırır.',
    },
    {
      icon: '🖐️',
      title: 'Hafif Bilekler',
      desc: 'Bileklerini masaya bastırmak yerine hafif havada tutmak parmaklarına ekstra esneklik sağlar.',
    },
    {
      icon: '⌨️',
      title: 'Serçe Parmakları Kullan',
      desc: 'Shift, Enter ve kenar harfler için serçe parmaklarını aktif kullanmak el hareketini azaltır.',
    },
    {
      icon: '👀',
      title: 'Ekrana Kilitlen',
      desc: 'Yanlış yazsan bile asla parmaklarına bakma; kas hafızan ancak bu şekilde gelişir.',
    },
    {
      icon: '💨',
      title: 'Çabuk Backspace',
      desc: 'Hata yaptığında beklemeden hemen düzelt ve hızını kesmeden sıradaki kelimeye odaklan.',
    },
    {
      icon: '📐',
      title: 'Doğru Duruş Açısı',
      desc: 'Klavyeye 90 derecelik dirsek açısıyla oturmak uzun oyunlarda parmak yorgunluğunu önler.',
    },
    {
      icon: '🧩',
      title: 'Hece Hece Yaz',
      desc: 'Uzun kelimeleri harf harf değil, zihninde 2-3 harfli hece blokları halinde canlandırarak yaz.',
    },
  ];

  // Sayfa her açıldığında veya yenilendiğinde rastgele bir tüyo seçilir
  const [todayTip] = useState(() => {
    const randomIndex = Math.floor(Math.random() * typingTips.length);
    return typingTips[randomIndex];
  });

  // Streak ve Seviye hesaplaması
  const level = Math.max(1, Math.floor(highScore / 200) + 1);
  const currentLevelXp = highScore % 200;
  const levelProgressPct = Math.min(100, Math.round((currentLevelXp / 200) * 100));

  useEffect(() => {
    let isMounted = true;
    getLeaderboard(5).then((res) => {
      if (isMounted && res && res.data) {
        setTopLeaderboard(res.data);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleSaveName = () => {
    const trimmed = setCurrentPlayerName(tempName);
    setPlayerName(trimmed);
    setIsEditingName(false);
  };

  const handleKeyDownName = (e) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setTempName(playerName);
      setIsEditingName(false);
    }
  };

  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  };

  // Tam ekran toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  const difficulties = [
    { id: 'easy', label: 'Kolay', desc: 'Yeni başlayanlar için sakin hız' },
    { id: 'medium', label: 'Orta', desc: 'Dengeli refleks ve odak' },
    { id: 'hard', label: 'Zor', desc: 'Usta klavye savaşçıları için' },
    { id: 'mixed', label: 'Karışık', desc: 'Tüm kelime uzunlukları karma' },
  ];

  return (
    <div className="anti-main-menu">
      {/* Toast Bildirimi */}
      {toastMessage && (
        <div className="menu-toast-pill">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ÜST BAR (Header) */}
      <header className="menu-top-header">
        {/* Sol: Sadece Kullanıcı Profili (Avatar + İsim + Seviye) */}
        <div className="top-profile-container">
          <div className="profile-avatar-circle" title="Profil Avatarı">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="#82807a">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
            </svg>
          </div>

          <div className="profile-info-block">
            {isEditingName ? (
              <input
                ref={nameInputRef}
                type="text"
                className="profile-name-input"
                value={tempName}
                maxLength={18}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSaveName}
                onKeyDown={handleKeyDownName}
                autoFocus
              />
            ) : (
              <div
                className="profile-name-row"
                onClick={() => {
                  setTempName(playerName);
                  setIsEditingName(true);
                }}
                title="İsmini düzenlemek için tıkla"
              >
                <span className="profile-name-text">{playerName}</span>
                <svg className="edit-pencil-icon" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </div>
            )}

            <div className="profile-level-row">
              <span className="profile-level-text">Seviye {level}</span>
              <div className="profile-xp-bar-bg" title={`XP: ${currentLevelXp}/200`}>
                <div
                  className="profile-xp-bar-fill"
                  style={{ width: `${Math.max(18, levelProgressPct)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sağ: Seri, Puan/Yıldız, Bildirim, Ses ve En Sağda MENÜ (Hamburger) Butonu */}
        <div className="top-stats-container">
          <div className="stat-pill-item" title="Günlük Seri">
            <span className="stat-icon-fire">🔥</span>
            <span className="stat-value-num">{dailyStreak}</span>
          </div>

          <div className="stat-pill-item" title="Skor Puanı">
            <span className="stat-icon-star">⭐</span>
            <span className="stat-value-num">{highScore || 0}</span>
          </div>

          <button
            type="button"
            className="top-bell-btn hide-on-mobile"
            onClick={() => triggerToast('📢 Klasik, Odun Kesme, Bahçe ve Mutfak modları aktif! En hızlı sen ol!')}
            title="Bildirimler"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="bell-badge-dot" />
          </button>

          <button
            type="button"
            className="top-ghost-icon-btn"
            onClick={onToggleMute}
            title={isMuted ? 'Sesi Aç' : 'Sesi Kapat'}
          >
            {isMuted ? (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor">
                <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6m0-6l6 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor">
                <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
            )}
          </button>

          <button
            type="button"
            className="top-ghost-icon-btn hide-on-mobile"
            onClick={toggleFullScreen}
            title="Tam Ekran"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
              <path strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>

          {/* Sağ Üst Hamburger Butonu (Mobilde ve Dar Ekranda Çekmeceyi Açar) */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileDrawerOpen(true)}
            title="Menüyü Aç"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </header>

      {/* MERKEZ BAŞLIK: Anti W🎯rds */}
      <div className="menu-center-brand">
        <h1 className="brand-logo-heading">
          <span className="logo-text-anti">Anti </span>
          <span className="logo-text-w">W</span>
          <span className="logo-reticle-o" title="Target">
            <svg viewBox="0 0 46 46" className="reticle-svg" fill="none">
              <circle cx="23" cy="23" r="15" stroke="currentColor" strokeWidth="4.2" />
              <circle cx="23" cy="23" r="4.2" fill="currentColor" />
              <line x1="23" y1="2" x2="23" y2="10" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
              <line x1="23" y1="36" x2="23" y2="44" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
              <line x1="2" y1="23" x2="10" y2="23" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
              <line x1="36" y1="23" x2="44" y2="23" stroke="currentColor" strokeWidth="4.2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="logo-text-rds">rds</span>
        </h1>
        <p className="brand-subtext">KELİMELERİ YAKALA, SINIRLARINI AŞ</p>
      </div>

      {/* ANA İÇERİK: SOL NAV + ORTA KARTLAR + SAĞ LİDERLİK */}
      <div className={`menu-main-stage ${activeTab === 'community' ? 'community-layout' : ''}`}>
        {/* SOL MENÜ */}
        <aside className="menu-left-sidebar">
          <nav className="nav-pill-group">
            <button
              type="button"
              className={`nav-pill-btn ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => setActiveTab('home')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
              </svg>
              <span>Ana Sayfa</span>
            </button>

            <button
              type="button"
              className={`nav-pill-btn ${activeTab === 'community' ? 'active' : ''}`}
              onClick={() => setActiveTab('community')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth="2" />
                <path strokeWidth="2" strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
              </svg>
              <span>Canlı Challenge</span>
            </button>

            <button
              type="button"
              className={`nav-pill-btn ${activeTab === 'multiplayer' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('multiplayer');
                onOpenMultiplayer();
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14.5 17.5L3 6V3h3l11.5 11.5M14.5 6.5L17.5 3.5 21 7l-3 3M9.5 14.5L3.5 20.5 7 24l6-6" />
              </svg>
              <span>Online Kapışma</span>
            </button>


            <button
              type="button"
              className={`nav-pill-btn ${activeTab === 'settings' ? 'active' : ''}`}
              onClick={() => setShowSettings(true)}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor">
                <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" strokeWidth="2" />
              </svg>
              <span>Ayarlar</span>
            </button>
          </nav>

          {/* Sol Alttaki Eğik El Yazısı */}
          <div className="left-cursive-quote">
            <span>Daha hızlı</span>
            <span>daha güçlü</span>
            <span>bir sen!</span>
          </div>
        </aside>

        {/* ORTA SAHNE: COMMUNITY ARENA VEYA MOD KARTLARI */}
        {activeTab === 'community' ? (
          <CommunityArenaTab
            playerName={playerName}
            onJoinChallenge={(ch) => {
              if (onJoinCommunityChallenge) {
                onJoinCommunityChallenge(ch);
              } else if (onStartCommunityChallenge) {
                onStartCommunityChallenge(ch);
              }
            }}
            onStartCreatedChallenge={(ch) => {
              if (onCreateCommunityChallenge) {
                onCreateCommunityChallenge(ch);
              } else if (onStartCommunityChallenge) {
                onStartCommunityChallenge(ch);
              }
            }}
          />
        ) : (
          <>
            {/* ORTA MOD KARTLARI */}
            <section className="menu-cards-carousel">
              {/* Kart 1: Klasik Mod */}
              <div
                className="game-mode-card card-classic-mod card-full-visual-card"
                onClick={() => {
                  setModeForDiff('SINGLE');
                  setShowDiffPicker(true);
                }}
                title="Klasik Mod - Süper hızda kelimeleri yakala!"
              >
                <img
                  src="/assets/cards/card-classic-full.png"
                  alt="Klasik Mod"
                  className="card-full-img card-desktop-img"
                />
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/cards/card-classic-wide.png"
                      alt="Klasik Mod"
                      className="card-mobile-wide-img"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag">🎯 KLASİK</div>
                    <h3 className="card-mobile-title">Klasik Mod</h3>
                    <p className="card-mobile-desc">Süper hızda kelimeleri yakala, sınırlarını aş!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen Oyna</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 2: Odun Kesme Modu */}
              <div
                className="game-mode-card card-wood-mod card-full-visual-card"
                onClick={() => {
                  setModeForDiff('WOOD');
                  setShowDiffPicker(true);
                }}
                title="Odun Kesme Modu - Yukarıdan gelen odunları baltayla parçala!"
              >
                <img
                  src="/assets/cards/card-wood-full.png"
                  alt="Odun Kesme Modu"
                  className="card-full-img card-desktop-img"
                />
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/cards/card-wood-wide.jpg"
                      alt="Odun Kesme Modu"
                      className="card-mobile-wide-img"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag wood">🪓 REFLEKS</div>
                    <h3 className="card-mobile-title">Odun Kesme Modu</h3>
                    <p className="card-mobile-desc">Yukarıdan gelen odunları baltayla parçala!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen Oyna</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 3: Bitki Büyütme / Bahçe Modu */}
              <div
                className="game-mode-card card-garden-mod card-full-visual-card"
                onClick={() => {
                  setModeForDiff('GARDEN');
                  setShowDiffPicker(true);
                }}
                title="Bitki Büyütme Modu - Kelime bahçene adım at!"
              >
                <img
                  src="/assets/cards/card-garden-full.png"
                  alt="Bitki Büyütme Modu"
                  className="card-full-img card-desktop-img"
                />
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/cards/card-garden-wide.jpg"
                      alt="Bitki Büyütme Modu"
                      className="card-mobile-wide-img"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag garden">🌿 BAHÇE</div>
                    <h3 className="card-mobile-title">Bitki Büyütme Modu</h3>
                    <p className="card-mobile-desc">Kelimeleri topla, fidanları sulayıp büyüt!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen Oyna</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 4: Mutfak Modu */}
              <div
                className="game-mode-card card-kitchen-mod card-full-visual-card"
                onClick={() => {
                  setModeForDiff('KITCHEN');
                  setShowDiffPicker(true);
                }}
                title="Mutfak Modu - Kelimeleri doğra, pizzanı hazırla!"
              >
                <img
                  src="/assets/cards/card-kitchen-full.png"
                  alt="Mutfak Modu"
                  className="card-full-img card-desktop-img"
                />
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/cards/card-kitchen-wide.jpg"
                      alt="Mutfak Modu"
                      className="card-mobile-wide-img"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag kitchen">🍕 MUTFAK</div>
                    <h3 className="card-mobile-title">Mutfak Modu</h3>
                    <p className="card-mobile-desc">Kelimeleri doğra, fırına at, pizzanı hazırla!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen Oyna</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 5: Futbol / Şut & Gol Modu */}
              <div
                className="game-mode-card card-football-mod"
                onClick={() => {
                  setModeForDiff('FOOTBALL');
                  setShowDiffPicker(true);
                }}
                title="Futbol Modu - Ceza sahasından kaleye şut çek, golleri at!"
              >
                <div className="card-visual-header card-desktop-img">
                  <img
                    src="/assets/cards/card-football.png"
                    alt="Futbol Modu"
                    className="card-banner-img"
                  />
                </div>
                <div className="card-info-footer card-desktop-img">
                  <div className="card-title-row">
                    <span className="card-mini-icon-emoji">⚽</span>
                    <h3 className="card-title-text">Futbol Modu</h3>
                  </div>
                  <p className="card-desc-text">Ceza sahasından kaleye şut çek, golleri at!</p>
                  <div className="card-action-circle" title="Futbol Modunu Oyna">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/cards/card-football.png"
                      alt="Futbol Modu"
                      className="card-mobile-wide-img football"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag football">⚽ ŞUT & GOL</div>
                    <h3 className="card-mobile-title">Futbol Modu</h3>
                    <p className="card-mobile-desc">Ceza sahasından kaleye şut çek, golleri at!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen Oyna</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Kart 6: Şehir Mimarı Modu */}
              <div
                className="game-mode-card card-city-mod"
                onClick={() => {
                  setModeForDiff('CITY');
                  setShowDiffPicker(true);
                }}
                title="Şehir Mimarı - Kelimeleri yaz, adanda köyden dev metropole şehrini kur!"
              >
                <div className="card-visual-header card-desktop-img">
                  <img
                    src="/assets/city/city_building_ground_island_4k.png"
                    alt="Şehir Mimarı Modu"
                    className="card-banner-img city-card-banner"
                  />
                  <div className="card-overlay-badge city-badge">🏙️ YENİ MOD</div>
                </div>
                <div className="card-info-footer card-desktop-img">
                  <div className="card-title-row">
                    <span className="card-mini-icon-emoji">🏗️</span>
                    <h3 className="card-title-text">Şehir Mimarı</h3>
                  </div>
                  <p className="card-desc-text">Kelimeleri yaz, ada üzerinde köyden metropole şehrini kur!</p>
                  <div className="card-action-circle" title="Şehir Mimarı Modunu Oyna">
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
                <div className="card-mobile-horizontal-view">
                  <div className="card-mobile-media-box">
                    <img
                      src="/assets/city/city_building_ground_island_4k.png"
                      alt="Şehir Mimarı Modu"
                      className="card-mobile-wide-img city"
                    />
                  </div>
                  <div className="card-mobile-body">
                    <div className="card-mobile-tag city">🏙️ ŞEHİR MİMARI</div>
                    <h3 className="card-mobile-title">Şehir Mimarı</h3>
                    <p className="card-mobile-desc">Kelimeleri yaz, adada köyden metropole şehrini yükselt!</p>
                    <div className="card-mobile-action">
                      <span className="card-mobile-btn-text">Hemen İnşa Et</span>
                      <span className="card-mobile-arrow">→</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

        {/* SAĞ PANEL: KİŞİSEL İSTATİSTİKLER & GÜNÜN KLAVYE TAKTİKLERİ */}
        <aside className="menu-right-sidebar">
          <div className="sidebar-header-badge">
            <span className="live-pulsing-dot emerald" />
            <span className="sidebar-header-title">GELİŞİM & TAKTİKLER</span>
          </div>

          {/* Kişisel İstatistikler ve Günün Tüyosu Kartı */}
          <div className="personal-stats-glass-card">
            {/* Üst Kısım: Kişisel Metrikler Satır Listesi */}
            <div className="p-stats-list">
              <div className="p-stat-row">
                <div className="p-stat-row-left">
                  <span className="p-stat-mini-icon wpm">⚡</span>
                  <span className="p-stat-row-label">En İyi Hız</span>
                </div>
                <span className="p-stat-row-value">{bestWpm > 0 ? `${bestWpm} WPM` : 'Ölçülmedi'}</span>
              </div>

              <div className="p-stat-row">
                <div className="p-stat-row-left">
                  <span className="p-stat-mini-icon level">🏆</span>
                  <span className="p-stat-row-label">Kademe</span>
                </div>
                <span className="p-stat-row-value">Seviye {level}</span>
              </div>

              <div className="p-stat-row">
                <div className="p-stat-row-left">
                  <span className="p-stat-mini-icon streak">🔥</span>
                  <span className="p-stat-row-label">Günlük Seri</span>
                </div>
                <span className="p-stat-row-value">{dailyStreak} Gün</span>
              </div>

              <div className="p-stat-row">
                <div className="p-stat-row-left">
                  <span className="p-stat-mini-icon score">⭐</span>
                  <span className="p-stat-row-label">Toplam Puan</span>
                </div>
                <span className="p-stat-row-value">{(highScore || 0).toLocaleString('tr-TR')}</span>
              </div>
            </div>

            {/* Alt Kısım: Günün Klavye Taktigi & Önerisi */}
            <div className="daily-tip-container">
              <div className="daily-tip-top-row">
                <span className="daily-tip-badge">💡 GÜNÜN İPUCU</span>
                <span className="daily-tip-icon">{todayTip.icon}</span>
              </div>
              <h4 className="daily-tip-title">{todayTip.title}</h4>
              <p className="daily-tip-desc">{todayTip.desc}</p>
            </div>
          </div>

          {/* Sağ Alttaki Zarif El Yazısı */}
          <div className="right-cursive-quote">
            <span>Kelimeler seninle</span>
            <span>daha hızlı...</span>
          </div>
        </aside>
      </>
    )}
  </div>

      {/* ZORLUK SEÇİM MODALI */}
      {showDiffPicker && (
        <div className="menu-modal-backdrop" onClick={() => setShowDiffPicker(false)}>
          <div className="menu-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <div className="modal-title-group">
                <h3>
                  {modeForDiff === 'GARDEN'
                    ? '🌸 BAHÇE MODU // ZORLUK SEÇİMİ'
                    : modeForDiff === 'WOOD'
                    ? '🪓 ODUN KESME // ZORLUK SEÇİMİ'
                    : modeForDiff === 'KITCHEN'
                    ? '🍳 MUTFAK TELAŞI // ZORLUK SEÇİMİ'
                    : modeForDiff === 'FOOTBALL'
                    ? '⚽ FUTBOL MODU // ZORLUK SEÇİMİ'
                    : modeForDiff === 'CITY'
                    ? '🏙️ ŞEHİR MİMARI // ZORLUK SEÇİMİ'
                    : 'KLASİK MOD // ZORLUK SEÇİMİ'}
                </h3>
                <p>
                  {modeForDiff === 'GARDEN'
                    ? 'Tohumların sulanma temposunu ve kelime uzunluklarını belirle'
                    : modeForDiff === 'WOOD'
                    ? 'Kütüklerin hızını ve baltanın temposunu belirle'
                    : modeForDiff === 'KITCHEN'
                    ? 'Gelen malzemelerin hızını ve şef bıçağının temposunu belirle'
                    : modeForDiff === 'FOOTBALL'
                    ? 'Topların çıkış temposunu ve şut sıklığını belirle'
                    : modeForDiff === 'CITY'
                    ? 'Kelimeleri yazarak adanı köyden metropole dönüştür!'
                    : 'Oynamak istediğiniz zorluk seviyesini seçin'}
                </p>
              </div>
              <button className="menu-modal-close" onClick={() => setShowDiffPicker(false)}>✕</button>
            </div>

            {/* Süre Seçimi Kümesi */}
            <div className="single-duration-picker-cluster">
              <div className="single-duration-header">
                <span className="single-duration-title">⏱️ OYUN SÜRESİ:</span>
                <span className="single-duration-hint">
                  {selectedSingleDuration === 0 ? 'Süre sınırı yok, 3 can bitene kadar yaz!' : `${selectedSingleDuration} saniyede en yüksek skora ulaş!`}
                </span>
              </div>
              <div className="single-duration-pills">
                {[
                  { value: 30, label: '30 Saniye' },
                  { value: 60, label: '60 Saniye' },
                  { value: 90, label: '90 Saniye' },
                  { value: 120, label: '120 Saniye' },
                  { value: 0, label: 'Sonsuz ♾️' },
                ].map((dur) => (
                  <button
                    key={dur.value}
                    type="button"
                    className={`single-duration-pill ${selectedSingleDuration === dur.value ? 'active' : ''}`}
                    onClick={() => setSelectedSingleDuration(dur.value)}
                  >
                    {dur.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="diff-options-grid">
              {difficulties.map((diff) => (
                <button
                  key={diff.id}
                  type="button"
                  className="diff-choice-btn"
                  onClick={() => {
                    setShowDiffPicker(false);
                    onStartWithDifficulty(diff.id, modeForDiff, selectedSingleDuration);
                  }}
                >
                  <div className="diff-badge-header">
                    <span className="diff-name">{diff.label}</span>
                    <span className="diff-arrow">→</span>
                  </div>
                  <span className="diff-desc">{diff.desc}</span>
                </button>
              ))}
            </div>

            {modeForDiff === 'GARDEN' && (
              <div className="modal-footer-extra-action">
                <button
                  type="button"
                  className="diff-online-garden-btn"
                  onClick={() => {
                    setShowDiffPicker(false);
                    onOpenMultiplayer('GARDEN');
                  }}
                >
                  <span>🌸 1'e 1 Çiçek Düellosu Yap (Online Bahçe Modu) →</span>
                </button>
              </div>
            )}

            {modeForDiff === 'KITCHEN' && (
              <div className="modal-footer-extra-action">
                <button
                  type="button"
                  className="diff-online-garden-btn diff-online-kitchen-btn"
                  onClick={() => {
                    setShowDiffPicker(false);
                    onOpenMultiplayer('KITCHEN');
                  }}
                >
                  <span>🍳 1'e 1 Şef Düellosu Yap (Online Mutfak Modu) →</span>
                </button>
              </div>
            )}

            {modeForDiff === 'FOOTBALL' && (
              <div className="modal-footer-extra-action">
                <button
                  type="button"
                  className="diff-online-garden-btn diff-online-football-btn"
                  onClick={() => {
                    setShowDiffPicker(false);
                    onOpenMultiplayer('FOOTBALL');
                  }}
                >
                  <span>⚽ 1'e 1 Futbol Düellosu Yap (Online Futbol Modu) →</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AYARLAR MODALI */}
      {showSettings && (
        <div className="menu-modal-backdrop" onClick={() => setShowSettings(false)}>
          <div className="menu-modal-card settings-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="menu-modal-header">
              <h3>AYARLAR</h3>
              <button className="menu-modal-close" onClick={() => setShowSettings(false)}>✕</button>
            </div>
            <div className="settings-options-list">
              <div className="setting-item-row">
                <div className="setting-info">
                  <strong>Ses Efektleri</strong>
                  <span>Klavye daktilo ve patlama sesleri</span>
                </div>
                <button
                  type="button"
                  className={`setting-toggle-pill ${!isMuted ? 'on' : 'off'}`}
                  onClick={onToggleMute}
                >
                  {!isMuted ? 'Açık' : 'Kapalı'}
                </button>
              </div>

              <div className="setting-item-row">
                <div className="setting-info">
                  <strong>Tam Ekran Modu</strong>
                  <span>Geniş açılı oyun deneyimi</span>
                </div>
                <button
                  type="button"
                  className="setting-toggle-pill on"
                  onClick={toggleFullScreen}
                >
                  Değiştir
                </button>
              </div>

              <div className="setting-item-row">
                <div className="setting-info">
                  <strong>Oyuncu İsmi</strong>
                  <span>Çok oyunculu ve liderlikte görünen ad</span>
                </div>
                <button
                  type="button"
                  className="setting-toggle-pill"
                  onClick={() => {
                    setShowSettings(false);
                    setTempName(playerName);
                    setIsEditingName(true);
                  }}
                >
                  {playerName} ✏️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MOBİL YAN ÇEKMECE MENÜSÜ (Drawer) */}
      {mobileDrawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={() => setMobileDrawerOpen(false)}>
          <div className="mobile-drawer-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-drawer-header">
              <div className="drawer-brand-title">
                <span>Anti W🎯rds</span>
              </div>
              <button
                type="button"
                className="mobile-drawer-close"
                onClick={() => setMobileDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <nav className="mobile-drawer-nav">
              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'home' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('home');
                  setMobileDrawerOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
                </svg>
                <span>Ana Sayfa</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'community' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('community');
                  setMobileDrawerOpen(false);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <path strokeWidth="2" strokeLinecap="round" d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                </svg>
                <span>Canlı Challenge</span>
              </button>

              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'multiplayer' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('multiplayer');
                  setMobileDrawerOpen(false);
                  onOpenMultiplayer();
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M14.5 17.5L3 6V3h3l11.5 11.5M14.5 6.5L17.5 3.5 21 7l-3 3M9.5 14.5L3.5 20.5 7 24l6-6" />
                </svg>
                <span>Online Kapışma</span>
              </button>


              <button
                type="button"
                className={`drawer-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                onClick={() => {
                  setMobileDrawerOpen(false);
                  setShowSettings(true);
                }}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor">
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <circle cx="12" cy="12" r="3" strokeWidth="2" />
                </svg>
                <span>Ayarlar</span>
              </button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
