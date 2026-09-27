import React, { useState, useEffect, useRef } from 'react';
import {
  createRoom,
  joinRoomByCode,
  checkRoomStatus,
  findQuickMatch,
  PUBLIC_ARENA_CODE,
} from '../services/multiplayerService';
import { copyToClipboard, getCurrentPlayerName, setCurrentPlayerName } from '../utils/turkishUtils';

export default function MultiplayerLobby({
  onBackToMenu,
  onStartMultiplayerGame,
  initialMap = 'WOOD',
  initialRoomCode = null,
  autoCreateData = null,
  onChallengeRegistered = null,
  existingRoom = null,
}) {
  const [playerName, setPlayerName] = useState(() => getCurrentPlayerName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);

  // Çok Oyunculu Ana Mod Sekmesi: 'GROUP' (Arkadaş Odası) | 'ARENA' (Genel Canlı Arena) | 'RANDOM' (Rastgele Eşleş)
  const [lobbyTab, setLobbyTab] = useState('GROUP');

  const [selectedDifficulty, setSelectedDifficulty] = useState(
    () => existingRoom?.difficulty || 'medium'
  );
  const [selectedDuration, setSelectedDuration] = useState(
    () => existingRoom?.duration || 60
  ); // 30, 60, 90, 120
  const [selectedMap, setSelectedMap] = useState(
    () => existingRoom?.gameMap || initialMap || 'WOOD'
  );
  const [customRoomCode, setCustomRoomCode] = useState('');
  const [statusText, setStatusText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingRandom, setIsSearchingRandom] = useState(false);
  const [waitingElapsedSeconds, setWaitingElapsedSeconds] = useState(0);
  const [searchElapsedSeconds, setSearchElapsedSeconds] = useState(0);

  // Aktif Oda State'leri
  const [activeRoom, setActiveRoom] = useState(() => existingRoom || null);
  const [waitingCode, setWaitingCode] = useState(() => existingRoom?.roomCode || null);
  const [participants, setParticipants] = useState(() =>
    existingRoom ? Array.from(existingRoom.participants.values()) : []
  );
  const [countdown, setCountdown] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [invitedRoomCode, setInvitedRoomCode] = useState(null);
  const [invitedRoomInfo, setInvitedRoomInfo] = useState(null);
  const [isCheckingRoom, setIsCheckingRoom] = useState(false);
  const [showSoloPrompt, setShowSoloPrompt] = useState(false);

  const roomRef = useRef(null);
  const selectedMapRef = useRef(initialMap || 'WOOD');
  const isStartingGameRef = useRef(false);
  const autoHandledRef = useRef(false);
  const countdownIntervalRef = useRef(null);

  // Bekleme ve Arama Sayaçları
  useEffect(() => {
    let timer = null;
    if (activeRoom && participants.length < 2 && countdown === null) {
      timer = setInterval(() => {
        setWaitingElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setWaitingElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [activeRoom, participants.length, countdown]);

  useEffect(() => {
    let timer = null;
    if (isSearchingRandom) {
      timer = setInterval(() => {
        setSearchElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSearchElapsedSeconds(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSearchingRandom]);

  const normalizeRoomCodeInput = (value) => {
    const rawValue = String(value || '').trim();
    if (!rawValue) return '';

    try {
      const parsedUrl = new URL(rawValue, typeof window !== 'undefined' ? window.location.origin : undefined);
      const codeFromUrl =
        parsedUrl.searchParams.get('challenge') ||
        parsedUrl.searchParams.get('oda') ||
        parsedUrl.searchParams.get('room');

      if (codeFromUrl) {
        return codeFromUrl.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
      }
    } catch {
      // Düz oda kodu girişinde URL ayrıştırması gerekli değil.
    }

    return rawValue.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 6);
  };

  const buildInviteUrl = (roomCode) => {
    if (!roomCode || typeof window === 'undefined') return '';
    try {
      const inviteUrl = new URL(window.location.href);
      inviteUrl.search = '';
      inviteUrl.hash = '';
      inviteUrl.searchParams.set('challenge', roomCode);
      return inviteUrl.toString();
    } catch {
      const base = (window.location.href || '').split('?')[0].split('#')[0];
      return `${base}?challenge=${roomCode}`;
    }
  };

  useEffect(() => {
    if (initialMap) {
      setSelectedMap(initialMap);
      selectedMapRef.current = initialMap;
    }
  }, [initialMap]);

  useEffect(() => {
    selectedMapRef.current = selectedMap;
  }, [selectedMap]);

  // URL'deki ?oda= veya ?challenge= parametresi ile otomatik kontrol ve katılma
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('oda') || params.get('challenge') || params.get('room');
      if (roomParam) {
        const clean = normalizeRoomCodeInput(roomParam);
        if (clean) {
          setInvitedRoomCode(clean);
          setCustomRoomCode(clean);
          setLobbyTab('GROUP');

          // Odanın aktiflik durumunu kontrol et
          setIsCheckingRoom(true);
          checkRoomStatus(clean).then((info) => {
            setIsCheckingRoom(false);
            setInvitedRoomInfo(info);
            if (!info.active) {
              // URL'den parametreyi temizle ki sayfa yenilendiğinde aynı mesaj tekrar çıkmasın
              try {
                window.history.replaceState({}, '', window.location.pathname);
              } catch (e) {}
            } else {
              if (info.map) {
                setSelectedMap(info.map);
                selectedMapRef.current = info.map;
              }
              if (info.difficulty) {
                setSelectedDifficulty(info.difficulty);
              }
            }
          });
        }
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('antiwords_player_name', playerName);
  }, [playerName]);

  // Önceden var olan oda (Tekrar Oyna akışı) dinleyicilerini bağla
  useEffect(() => {
    if (existingRoom) {
      setupRoomListeners(existingRoom);
      setWaitingCode(existingRoom.roomCode);
      const curMap = existingRoom.gameMap || initialMap || 'WOOD';
      setSelectedMap(curMap);
      selectedMapRef.current = curMap;
      setSelectedDifficulty(existingRoom.difficulty || 'medium');
      setSelectedDuration(existingRoom.duration || 60);
      setParticipants(Array.from(existingRoom.participants.values()));
    }
  }, [existingRoom]);

  useEffect(() => {
    return () => {
      if (!isStartingGameRef.current && roomRef.current) {
        roomRef.current.leave();
      }
    };
  }, []);

  const setupRoomListeners = (room) => {
    isStartingGameRef.current = false;
    roomRef.current = room;
    setActiveRoom(room);

    // Odaya ilk giriş anında kendimizi katılımcılara ekleyelim
    setParticipants(Array.from(room.participants.values()));

    room.on('participants_updated', (list) => {
      setParticipants(list);
      if (list.length > 1) {
        setStatusText(`👥 Odada ${list.length} oyuncu var!`);
      }
    });

    room.on('participant_joined', (p) => {
      if (p.name !== playerName) {
        setStatusText(`🎉 ${p.name} odaya katıldı!`);
      }
    });

    room.on('participant_left', (data) => {
      setStatusText(`${data.name || 'Bir oyuncu'} ayrıldı.`);
    });

    room.on('room_synced', (data) => {
      if (data.gameMap) {
        setSelectedMap(data.gameMap);
        selectedMapRef.current = data.gameMap;
      }
      if (data.difficulty) setSelectedDifficulty(data.difficulty);
      if (data.duration) setSelectedDuration(data.duration);
    });

    room.on('settings_updated', (data) => {
      if (data.gameMap) {
        setSelectedMap(data.gameMap);
        selectedMapRef.current = data.gameMap;
      }
      if (data.difficulty) setSelectedDifficulty(data.difficulty);
      if (data.duration) setSelectedDuration(data.duration);
    });

    room.on('match_countdown', (data) => {
      // Eğer zaten geri sayım başlamışsa mükerrer tetiklemeleri engelle
      if (isStartingGameRef.current || countdownIntervalRef.current) {
        return;
      }

      setShowSoloPrompt(false);
      const targetMap = data.gameMap || room.gameMap || selectedMapRef.current || selectedMap || initialMap || 'WOOD';
      setSelectedMap(targetMap);
      selectedMapRef.current = targetMap;

      let currentSeconds = 3;
      setCountdown(3);

      countdownIntervalRef.current = setInterval(() => {
        currentSeconds -= 1;
        if (currentSeconds <= 0) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setCountdown(0);
          if (!isStartingGameRef.current) {
            isStartingGameRef.current = true;
            setTimeout(() => {
              const allParticipants = Array.from(room.participants.values());
              const rival = allParticipants.find((p) => (p.id ? p.id !== room.clientId : p.name !== playerName)) || allParticipants[0];
              const isBotMatch = Boolean(rival?.isBot || rival?.name?.includes('Bot'));
              const botDiff = rival?.botDiff || data.difficulty || room.difficulty || selectedDifficulty || 'medium';
              onStartMultiplayerGame({
                room,
                isHost: room.isHost,
                playerName,
                rivalName: rival?.name || room.rivalInfo?.name || 'Rakip',
                isBot: isBotMatch,
                botDifficulty: botDiff,
                difficulty: data.difficulty || room.difficulty,
                duration: data.duration !== undefined ? data.duration : (room.duration || 60),
                seed: data.seed || room.seed,
                gameMap: targetMap,
                roomType: room.roomType || 'group',
                participants: allParticipants,
                matchStartTime: Date.now(),
                matchEndTime: Date.now() + (data.duration || 60) * 1000,
                clockOffset: 0,
              });
            }, 200);
          }
        } else {
          setCountdown(currentSeconds);
        }
      }, 1000);
    });
  };

  // 1. Grup Arkadaş Odası Kurma (Çok Kişilik Link)
  const handleCreateGroupRoom = async () => {
    if (!playerName.trim()) return;
    setIsLoading(true);
    setStatusText('Grup challenge odası oluşturuluyor...');

    try {
      const room = await createRoom({
        hostName: playerName,
        difficulty: selectedDifficulty,
        duration: selectedDuration,
        map: selectedMap,
        roomType: 'group',
      });

      setupRoomListeners(room);
      setWaitingCode(room.roomCode);

      // Topluluk servisine kaydet (Ana menüdeki canlı listede de çıksın)
      if (onChallengeRegistered) {
        onChallengeRegistered({
          roomCode: room.roomCode,
          title: `${playerName}'in Odası`,
          map: selectedMap,
          difficulty: selectedDifficulty,
          duration: selectedDuration,
          hostName: playerName,
        });
      }

      // Davet linkini otomatik kopyala
      try {
        const inviteUrl = buildInviteUrl(room.roomCode);
        copyToClipboard(inviteUrl).then((ok) => {
          if (ok) {
            setLinkCopied(true);
            setTimeout(() => setLinkCopied(false), 3000);
          }
        });
      } catch (copyErr) {
        console.warn('Otomatik link kopyalama uyarısı:', copyErr);
      }

      setStatusText('Oda hazır! Arkadaşlarına linki göndererek birden fazla kişiyi çağırabilirsin.');
    } catch (err) {
      console.error('Oda kurma hatası:', err);
      setStatusText('Oda kurulamadı: ' + (err?.message || err));
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Rastgele Eşleşme (Hızlı Matchmaking)
  const handleStartRandomMatch = async () => {
    if (!playerName.trim()) return;
    setIsSearchingRandom(true);
    setStatusText('Online oyuncu aranıyor...');

    try {
      const res = await findQuickMatch({
        playerName,
        difficulty: selectedDifficulty,
        duration: selectedDuration,
        map: selectedMap,
      });

      setupRoomListeners(res.room);
      setWaitingCode(res.room.roomCode);

      if (res.isNew) {
        setStatusText('Oda kuruldu, rastgele bir rakip bekleniyor...');
      } else {
        setStatusText('Rakip bulundu! Maç hazırlanıyor...');
      }
    } catch (err) {
      console.error('Eşleşme hatası:', err);
      setStatusText('Eşleşme sağlanamadı: ' + err.message);
    } finally {
      setIsSearchingRandom(false);
    }
  };

  // Kod ile Odaya Katılma
  const handleJoinCustomRoom = async (overrideCode) => {
    const targetCode = normalizeRoomCodeInput(overrideCode || customRoomCode || invitedRoomCode);
    if (!targetCode) {
      setStatusText('Lütfen geçerli bir oda kodu girin!');
      return;
    }

    if (!playerName.trim()) {
      setStatusText('Lütfen bir oyuncu ismi belirleyin!');
      return;
    }

    setIsLoading(true);
    setStatusText('Oda kontrol ediliyor...');

    try {
      const res = await joinRoomByCode({
        roomCode: targetCode,
        playerName: playerName.trim(),
        map: selectedMapRef.current || selectedMap || initialMap || 'WOOD',
      });

      if (!res.success) {
        setIsLoading(false);
        setStatusText(res.error || 'Bu oda aktif değil.');
        setInvitedRoomInfo({ active: false, message: res.error, reason: res.reason });
        try {
          window.history.replaceState({}, '', window.location.pathname);
        } catch (e) {}
        return;
      }

      if (res.map) {
        setSelectedMap(res.map);
        selectedMapRef.current = res.map;
      }

      setupRoomListeners(res.room);
      setWaitingCode(res.room.roomCode);
      setStatusText('Odaya bağlandı! Diğer oyuncu bekleniyor...');
    } catch (err) {
      console.error(err);
      setStatusText('Bağlantı hatası: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Dışarıdan doğrudan oda kurma veya kod ile odaya katılma yönlendirmesi
  useEffect(() => {
    if (autoHandledRef.current) return;

    if (autoCreateData) {
      autoHandledRef.current = true;
      const { title, hostName, map, difficulty, duration } = autoCreateData;
      const chosenMap = map || initialMap || 'WOOD';
      const chosenDiff = difficulty || 'medium';
      const chosenDur = Number(duration) || 60;

      setSelectedMap(chosenMap);
      selectedMapRef.current = chosenMap;
      setSelectedDifficulty(chosenDiff);
      setSelectedDuration(chosenDur);

      setIsLoading(true);
      setStatusText('Topluluk Challenge odası oluşturuluyor...');

      createRoom({
        hostName: hostName || playerName,
        difficulty: chosenDiff,
        duration: chosenDur,
        map: chosenMap,
        roomType: 'group',
        roomCode: autoCreateData.roomCode,
      })
        .then((room) => {
          setupRoomListeners(room);
          setWaitingCode(room.roomCode);

          if (onChallengeRegistered) {
            onChallengeRegistered({
              roomCode: room.roomCode,
              title: title || `${hostName || playerName}'in Challenge Odası`,
              map: chosenMap,
              difficulty: chosenDiff,
              duration: chosenDur,
              hostName: hostName || playerName,
            });
          }

          const inviteUrl = buildInviteUrl(room.roomCode);
          copyToClipboard(inviteUrl).then((ok) => {
            if (ok) {
              setLinkCopied(true);
              setTimeout(() => setLinkCopied(false), 3000);
            }
          });
          setStatusText('Oda hazır! Arkadaşlarına linki göndererek veya kodla çağırabilirsin.');
        })
        .catch((err) => {
          console.error('Oda kurma hatası:', err);
          setStatusText('Oda kurulamadı: ' + err.message);
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else if (initialRoomCode) {
      autoHandledRef.current = true;
      const cleanCode = normalizeRoomCodeInput(initialRoomCode);
      setInvitedRoomCode(cleanCode);
      setCustomRoomCode(cleanCode);
    }
  }, [autoCreateData, initialRoomCode]);

  const getInviteUrl = () => {
    if (!waitingCode) return '';
    return buildInviteUrl(waitingCode);
  };

  const copyInviteLink = async () => {
    const url = getInviteUrl();
    if (url) {
      const success = await copyToClipboard(url);
      if (success) {
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2500);
      }
    }
  };

  const copyRoomCode = async () => {
    if (waitingCode) {
      const success = await copyToClipboard(waitingCode);
      if (success) {
        setCodeCopied(true);
        setTimeout(() => setCodeCopied(false), 2500);
      }
    }
  };

  const handleStartWithBot = () => {
    if (countdown !== null) return;
    setShowSoloPrompt(false);

    const diff = selectedDifficulty || 'medium';
    let botName = '🤖 Hızlı_Parmak [Bot]';
    let botWpm = 52;
    let botAcc = 96;

    if (diff === 'hard') {
      botName = '🤖 Siber_Klavye [Usta Bot]';
      botWpm = 78;
      botAcc = 98;
    } else if (diff === 'easy') {
      botName = '🤖 Çaylak_Parmak [Bot]';
      botWpm = 32;
      botAcc = 92;
    }

    setStatusText(`${botName} maça dahil edildi! Challenge başlıyor...`);

    const botId = `bot_${Math.random().toString(36).substring(2, 7)}`;
    const botParticipant = {
      id: botId,
      name: botName,
      isHost: false,
      joinedAt: Date.now(),
      ready: true,
      isBot: true,
      botDiff: diff,
      stats: { score: 0, wpm: botWpm, accuracy: botAcc, lives: 3, isEliminated: false },
    };

    if (roomRef.current) {
      roomRef.current._addParticipant(botParticipant);
    }
    setParticipants((prev) => {
      const filtered = prev.filter((p) => p && !p.name.includes('Bot'));
      return [...filtered, botParticipant];
    });

    setTimeout(() => {
      const finalMap = selectedMapRef.current || selectedMap || initialMap || 'WOOD';
      const finalDuration = Number(selectedDuration) || 60;
      if (roomRef.current && typeof roomRef.current.startMatch === 'function') {
        roomRef.current.startMatch(finalDuration, finalMap);
      } else {
        handleStartMatch();
      }
    }, 120);
  };

  const handleStartMatch = () => {
    if (countdown !== null) return;
    if (participants.length < 2) {
      setShowSoloPrompt(true);
      setStatusText('⚠️ Tek başınasınız! Aşağıdan Bot ile hemen başlayabilir veya arkadaşınızı bekleyebilirsiniz.');
      return;
    }

    setShowSoloPrompt(false);
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    isStartingGameRef.current = false;

    const finalMap = selectedMapRef.current || selectedMap || initialMap || 'WOOD';
    const finalDuration = Number(selectedDuration) || 60;
    const finalDiff = selectedDifficulty || 'medium';

    if (roomRef.current && typeof roomRef.current.startMatch === 'function') {
      roomRef.current.startMatch(finalDuration, finalMap);
    } else {
      const allParticipants = participants.length > 0 ? participants : [{ name: playerName, isHost: true }];
      const rival = allParticipants.find((p) => (p.id ? p.id !== roomRef.current?.clientId : p.name !== playerName)) || allParticipants[0];
      const isBotMatch = Boolean(rival?.isBot || rival?.name?.includes('Bot'));
      const botDiff = rival?.botDiff || finalDiff;
      onStartMultiplayerGame({
        room: activeRoom || { isHost: true, roomCode: waitingCode || 'CUSTOM', gameMap: finalMap, duration: finalDuration, difficulty: finalDiff },
        isHost: true,
        playerName,
        rivalName: rival?.name || 'Rakip',
        isBot: isBotMatch,
        botDifficulty: botDiff,
        difficulty: finalDiff,
        duration: finalDuration,
        seed: Math.floor(Math.random() * 1000000),
        gameMap: finalMap,
        roomType: activeRoom?.roomType || 'group',
        participants: allParticipants,
        matchStartTime: Date.now() + 500,
        matchEndTime: Date.now() + (finalDuration * 1000) + 500,
        clockOffset: 0,
      });
    }
  };
  const handleHostStartMatch = handleStartMatch;

  const handleSelectMap = (mapId) => {
    // Eğer bir odaya bağlıysak ve Host değilsek, harita kurucu tarafından belirlenir
    if (activeRoom && !activeRoom.isHost) {
      setStatusText('ℹ️ Harita seçimi oda kurucusu tarafından belirlenir.');
      return;
    }
    setSelectedMap(mapId);
    selectedMapRef.current = mapId;
    if (roomRef.current && roomRef.current.isHost) {
      roomRef.current.updateSettings({ map: mapId });
    }
  };

  const handleSelectDifficulty = (diff) => {
    if (activeRoom && !activeRoom.isHost) {
      setStatusText('ℹ️ Seviye seçimi oda kurucusu tarafından belirlenir.');
      return;
    }
    setSelectedDifficulty(diff);
    if (roomRef.current && roomRef.current.isHost) {
      roomRef.current.updateSettings({ difficulty: diff });
    }
  };

  const handleSelectDuration = (dur) => {
    if (activeRoom && !activeRoom.isHost) {
      setStatusText('ℹ️ Süre seçimi oda kurucusu tarafından belirlenir.');
      return;
    }
    setSelectedDuration(dur);
    if (roomRef.current && roomRef.current.isHost) {
      roomRef.current.updateSettings({ duration: dur });
    }
  };

  const cancelWaiting = () => {
    isStartingGameRef.current = false;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (roomRef.current) {
      roomRef.current.leave();
      roomRef.current = null;
    }
    setActiveRoom(null);
    setWaitingCode(null);
    setParticipants([]);
    setStatusText('');
    setCountdown(null);

    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  const handleSavePlayerName = () => {
    const clean = tempName.trim() || 'Oyuncu';
    setPlayerName(clean);
    localStorage.setItem('antiwords_player_name', clean);
    setIsEditingName(false);
  };

  const hostPlayer =
    (participants && participants.find((p) => p && p.isHost)) ||
    (activeRoom?.isHost
      ? { id: activeRoom?.clientId, name: playerName, isHost: true }
      : participants?.[0] || { name: 'Kurucu', isHost: true });

  const guestPlayers = (participants || []).filter((p) => {
    if (!p) return false;
    if (hostPlayer?.id && p.id) {
      return p.id !== hostPlayer.id;
    }
    if (activeRoom?.clientId && p.id) {
      return p.id !== activeRoom.clientId;
    }
    return p.name !== hostPlayer?.name;
  });
  const guestPlayer = guestPlayers[0] || null;
  const extraParticipants = guestPlayers.slice(1);

  return (
    <>
      <div className="modern-lobby-overlay">
        <div className="modern-lobby-card simplified">
        {/* Üst Başlık Barı */}
        <div className="modern-lobby-header">
          <button type="button" className="lobby-back-pill" onClick={onBackToMenu}>
            ← Ana Menü
          </button>

          <div className="lobby-title-wrap">
            <h2 className="lobby-title-text">ÇOK OYUNCULU YARIŞMA</h2>
            <p className="lobby-subtitle-text">Arkadaşlarınla veya online oyuncularla en hızlı sen yaz!</p>
          </div>

          {/* Sağda Oyuncu Çipi */}
          <div className="lobby-player-chip-wrapper">
            {isEditingName ? (
              <input
                type="text"
                className="lobby-name-quick-input"
                value={tempName}
                maxLength={18}
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSavePlayerName}
                onKeyDown={(e) => e.key === 'Enter' && handleSavePlayerName()}
                autoFocus
              />
            ) : (
              <div
                className="lobby-player-chip"
                onClick={() => {
                  setTempName(playerName);
                  setIsEditingName(true);
                }}
                title="İsmini değiştirmek için tıkla"
              >
                <span className="player-chip-avatar">👤</span>
                <span className="player-chip-name">{playerName}</span>
                <span className="player-chip-edit">✏️</span>
              </div>
            )}
          </div>
        </div>

        {/* Canlı Durum Bildirimi */}
        {statusText && (
          <div className="lobby-status-banner-pill">
            <span className="live-pulsing-dot green" />
            <span>{statusText}</span>
          </div>
        )}

        {/* 1. Link İle Davet Edilen Kullanıcı Ekranı (Doğrudan Sade Karşılama) */}
        {!activeRoom && invitedRoomCode ? (
          invitedRoomInfo && !invitedRoomInfo.active ? (
            <div className="invited-duel-direct-card room-inactive-warning-card">
              <div className="invited-card-badge badge-warning-red">⚠️ ODA AKTİF DEĞİL</div>
              <h2 className="invited-card-title">Bu Oda Artık Aktif Değil</h2>
              <p className="invited-card-subtitle">
                {invitedRoomInfo.message || 'Bu oda kapatılmış, maç tamamlanmış veya davet süresi dolmuş. Karşıda bekleyen bir oyuncu yok.'}
              </p>

              <div className="invited-room-code-badge expired-badge">
                <span className="code-label">ODA KODU:</span>
                <span className="code-val">{invitedRoomCode}</span>
                <span className="code-status-pill closed">KAPALI</span>
              </div>

              <div className="inactive-room-actions">
                <button
                  type="button"
                  className="btn-create-room-hero full-width"
                  onClick={() => {
                    setInvitedRoomCode(null);
                    setInvitedRoomInfo(null);
                    setCustomRoomCode('');
                    setLobbyTab('GROUP');
                    try {
                      window.history.replaceState({}, '', window.location.pathname);
                    } catch (e) {}
                  }}
                >
                  ➕ YENİ BİR ODA KUR
                </button>

                <button
                  type="button"
                  className="text-secondary-btn"
                  onClick={() => {
                    setInvitedRoomCode(null);
                    setInvitedRoomInfo(null);
                    setCustomRoomCode('');
                    try {
                      window.history.replaceState({}, '', window.location.pathname);
                    } catch (e) {}
                    onBackToMenu();
                  }}
                >
                  ← Ana Menüye Dön
                </button>
              </div>
            </div>
          ) : isCheckingRoom ? (
            <div className="invited-duel-direct-card">
              <div className="invited-card-badge">🔍 ODA KONTROLÜ</div>
              <h2 className="invited-card-title">Oda Durumu Kontrol Ediliyor...</h2>
              <p className="invited-card-subtitle">Lütfen bekleyin, davet edilen oda aranıyor.</p>
              <div className="searching-spinner-mini" style={{ width: 28, height: 28, margin: '1rem auto' }} />
            </div>
          ) : (
            <div className="invited-duel-direct-card">
              <div className="invited-card-badge">⚔️ ÖZEL ODA DAVETİ</div>
              <h2 className="invited-card-title">Düelloya Davet Edildiniz!</h2>
              <p className="invited-card-subtitle">
                {invitedRoomInfo?.hostName ? (
                  <span><strong>{invitedRoomInfo.hostName}</strong> sizi AntiWords kelime düellosuna davet etti! İsminizi yazıp odaya katılın.</span>
                ) : (
                  'Bir arkadaşınız sizi AntiWords kelime düellosuna davet etti. İsminizi yazıp hemen odaya katılın.'
                )}
              </p>

              <div className="invited-room-code-badge">
                <span className="code-label">ODA KODU:</span>
                <span className="code-val">{invitedRoomCode}</span>
              </div>

              <div className="invited-name-input-box">
                <label className="input-label">Yarışmacı İsminiz:</label>
                <div className="input-with-icon">
                  <span className="input-icon">👤</span>
                  <input
                    type="text"
                    className="invited-name-field"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="İsminizi yazın..."
                    maxLength={18}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-create-room-hero full-width"
                onClick={() => handleJoinCustomRoom(invitedRoomCode)}
                disabled={isLoading || !playerName.trim()}
              >
                {isLoading ? '⏳ Odaya Bağlanılıyor...' : '⚔️ ODAYA KATIL & HAZIR OL'}
              </button>

              <div className="invited-card-footer">
                <button
                  type="button"
                  className="text-secondary-btn"
                  onClick={() => {
                    setInvitedRoomCode(null);
                    setInvitedRoomInfo(null);
                    setCustomRoomCode('');
                    if (typeof window !== 'undefined' && window.history) {
                      window.history.replaceState({}, '', window.location.pathname);
                    }
                  }}
                >
                  ← Farklı bir oda kur veya ana lobiye dön
                </button>
              </div>
            </div>
          )
        ) : !activeRoom ? (
          <>
            {/* 3 Ana Mod Seçim Sekmesi (Grup, Arena, Rastgele) */}
            <div className="lobby-mode-tabs-bar">
              <button
                type="button"
                className={`lobby-mode-tab-btn ${lobbyTab === 'GROUP' ? 'active' : ''}`}
                onClick={() => setLobbyTab('GROUP')}
              >
                <span className="tab-icon">👥</span>
                <span className="tab-text">Arkadaş Odası (Çok Kişilik)</span>
              </button>

              <button
                type="button"
                className={`lobby-mode-tab-btn ${lobbyTab === 'RANDOM' ? 'active' : ''}`}
                onClick={() => setLobbyTab('RANDOM')}
              >
                <span className="tab-icon">⚡</span>
                <span className="tab-text">Rastgele Rakip</span>
              </button>
            </div>

            {/* Odaya Girilmemişse: 3 Farklı Mod Seçeneği */}
            <div className="lobby-clean-body">
            {/* Hızlı Ayarlar: Zorluk & Süre */}
            <div className="lobby-quick-settings-row">
              <div className="setting-pill-cluster">
                <span className="cluster-label">ZORLUK:</span>
                <div className="pills-segmented">
                  {['easy', 'medium', 'hard'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={`pill-item ${selectedDifficulty === d ? 'active' : ''}`}
                      onClick={() => setSelectedDifficulty(d)}
                    >
                      {d === 'easy' ? 'Kolay' : d === 'medium' ? 'Orta' : 'Zor'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="setting-pill-cluster">
                <span className="cluster-label">SÜRE:</span>
                <div className="pills-segmented">
                  {[
                    { val: 30, label: '30 sn' },
                    { val: 60, label: '60 sn' },
                    { val: 90, label: '90 sn' },
                    { val: 120, label: '120 sn' },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      className={`pill-item ${selectedDuration === item.val ? 'active' : ''}`}
                      onClick={() => setSelectedDuration(item.val)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* HARİTA SEÇİMİ (Referans Görselindeki Gibi Temiz ve Sade) */}
            <div className="lobby-map-selection-cluster">
              <div className="lobby-map-header-row">
                <span className="cluster-label">
                  Düello Modu & Haritası {activeRoom && !activeRoom.isHost ? '(👑 Kurucu Seçimi)' : ''}
                </span>
              </div>
              <div className="lobby-visual-cards-grid">
                {[
                  {
                    id: 'WOOD',
                    name: 'Kütük Kırma',
                    img: `${import.meta.env.BASE_URL}assets/cards/card-wood-wide.jpg`,
                  },
                  {
                    id: 'GARDEN',
                    name: 'Bitki Büyütme',
                    img: `${import.meta.env.BASE_URL}assets/cards/card-garden-wide.jpg`,
                  },
                  {
                    id: 'KITCHEN',
                    name: 'Mutfak Telaşı',
                    img: `${import.meta.env.BASE_URL}assets/cards/card-kitchen-wide.jpg`,
                  },
                  {
                    id: 'FOOTBALL',
                    name: 'Futbol Sahası',
                    img: `${import.meta.env.BASE_URL}assets/cards/card-football.png`,
                  },
                  {
                    id: 'CLASSIC',
                    name: 'Siber Masa',
                    img: `${import.meta.env.BASE_URL}assets/cards/card-classic-wide.png`,
                  },
                ].map((mapItem) => {
                  const isSelected = selectedMap === mapItem.id;
                  return (
                    <button
                      key={mapItem.id}
                      type="button"
                      className={`lobby-visual-card ${isSelected ? 'active' : ''}`}
                      onClick={() => handleSelectMap(mapItem.id)}
                    >
                      <div className="lobby-vcard-image-wrap">
                        <img
                          src={mapItem.img}
                          alt={mapItem.name}
                          className="lobby-vcard-img"
                        />
                        {isSelected && (
                          <div className="lobby-vcard-selected-tick">
                            <span>✓</span>
                          </div>
                        )}
                      </div>
                      <div className="lobby-vcard-content">
                        <span className="lobby-vcard-title">{mapItem.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* SEKME 1: ARKADAŞ ODASI (ÇOK KİŞİLİK) */}
            {lobbyTab === 'GROUP' && (
              <>
                <div className="lobby-hero-action-box">
                  <button
                    type="button"
                    className="btn-create-room-hero"
                    onClick={handleCreateGroupRoom}
                    disabled={isLoading || !playerName.trim()}
                  >
                    <div className="hero-btn-left">
                      <div className="hero-icon-circle">🔗</div>
                      <div className="hero-text-block">
                        <span className="hero-main-title">Grup Odası Kur & Davet Linki Al</span>
                        <span className="hero-sub-title">Tek linkle birden fazla arkadaşını davet et ve topluca yarış</span>
                      </div>
                    </div>
                    <div className="hero-btn-arrow">
                      <span>→</span>
                    </div>
                  </button>
                </div>

                <div className="lobby-clean-divider">
                  <span className="divider-line" />
                  <span className="divider-text">VEYA KOD İLE KATIL</span>
                  <span className="divider-line" />
                </div>

                <div className="lobby-code-join-single-row">
                  <div className="code-input-with-lock">
                    <span className="input-lock-symbol">🔒</span>
                    <input
                      type="text"
                      className="input-room-code-clean"
                      placeholder="6 Haneli Oda Kodu Gir..."
                      value={customRoomCode}
                      onChange={(e) => setCustomRoomCode(normalizeRoomCodeInput(e.target.value))}
                      maxLength={80}
                    />
                  </div>
                  <button
                    type="button"
                    className="btn-join-code-clean"
                    onClick={handleJoinCustomRoom}
                    disabled={isLoading || customRoomCode.length < 4}
                  >
                    Katıl
                  </button>
                </div>
              </>
            )}

            {/* SEKME 2: RASTGELE RAKİP BUL */}
            {lobbyTab === 'RANDOM' && (
              <div className="random-tab-container">
                <div className="lobby-hero-action-box">
                  <button
                    type="button"
                    className="btn-create-room-hero random-hero-variant"
                    onClick={handleStartRandomMatch}
                    disabled={isSearchingRandom || !playerName.trim()}
                  >
                    <div className="hero-btn-left">
                      <div className="hero-icon-circle random-circle">
                        {isSearchingRandom ? '⏳' : '⚡'}
                      </div>
                      <div className="hero-text-block">
                        <span className="hero-main-title">
                          {isSearchingRandom ? 'Online Rakip Aranıyor...' : 'Rastgele Rakiple Hızlı Düello'}
                        </span>
                        <span className="hero-sub-title">
                          {isSearchingRandom ? 'Sistemde uygun bir rakip aranıyor, lütfen bekle' : 'Şu an online olan başka bir oyuncuyla teke tek maça başla'}
                        </span>
                      </div>
                    </div>
                    <div className="hero-btn-arrow random-arrow">
                      <span>→</span>
                    </div>
                  </button>
                </div>

                {isSearchingRandom ? (
                  <div className="random-searching-live-box">
                    <div className="searching-spinner-mini" />
                    <span className="searching-status-text">
                      Eşleşme kuyruğunda online rakip aranıyor... ({searchElapsedSeconds} sn)
                    </span>
                    {searchElapsedSeconds >= 7 && (
                      <div className="searching-bot-fallback-card">
                        <span className="bot-fallback-hint">
                          Şu an boşta insan oyuncu bulunamadı. Kendi seviyene uygun bot ile hemen kapışmak ister misin?
                        </span>
                        <button
                          type="button"
                          className="btn-start-bot-now"
                          onClick={() => {
                            setIsSearchingRandom(false);
                            handleStartWithBot();
                          }}
                        >
                          🤖 {selectedDifficulty === 'hard' ? 'Usta Bot' : selectedDifficulty === 'medium' ? 'Orta Düzey Bot' : 'Başlangıç Botu'} ile Hemen Başla
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="btn-cancel-search-mini"
                      onClick={() => setIsSearchingRandom(false)}
                    >
                      Aramayı İptal Et
                    </button>
                  </div>
                ) : (
                  <div className="lobby-features-capsule-row">
                    <div className="lobby-feature-chip">
                      <span className="chip-live-dot amber" />
                      <span>Otomatik Eşleşme Kuyruğu</span>
                    </div>
                    <div className="lobby-feature-chip">
                      <span>⚔️</span>
                      <span>1v1 Teke Tek Mücadele</span>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>
          </>
        ) : null}

        {/* AKTİF ODA / BEKLEME EKRANI (Arkadaş Odası & Arena & Rastgele Ortak Ekranı) */}
        {/* AKTİF ODA / BEKLEME EKRANI (Sade ve Odaklanmış Düello Bekleme Ekranı) */}
        {activeRoom && (
          <div className="modern-active-room-box simplified-waiting">
            {/* Üst Başlık & Durum Rozeti */}
            <div className="waiting-room-header">
              <div className="waiting-header-status">
                {participants.length >= 2 ? (
                  <span className="waiting-status-badge ready">
                    <span className="live-pulsing-dot green" /> RAKİP KATILDI — DÜELLOYA HAZIR
                  </span>
                ) : (
                  <span className="waiting-status-badge waiting">
                    <span className="live-pulsing-dot orange" /> DİĞER OYUNCU BEKLENİYOR...
                  </span>
                )}
              </div>
              <h2 className="waiting-room-title">
                {participants.length >= 2 ? 'Herkes Hazır! Düello Başlayabilir' : 'Oda Hazır, Rakip Bekleniyor'}
              </h2>
              <p className="waiting-room-desc">
                {activeRoom.isHost
                  ? (participants.length >= 2
                      ? 'Rakibiniz odaya bağlandı! Aşağıdaki butona basarak yarışmayı hemen başlatabilirsiniz.'
                      : 'Arkadaşınıza aşağıdaki linki veya oda kodunu gönderin. Odaya katıldığında başlatma butonu aktifleşecek.')
                  : `Odaya başarıyla bağlandınız! Kurucunun (${hostPlayer?.name || 'Kurucu'}) yarışmayı başlatması bekleniyor...`}
              </p>
            </div>

            {/* Arkadaş Davet ve Paylaşım Kartı (Özel Odalar İçin) */}
            {waitingCode && waitingCode !== PUBLIC_ARENA_CODE && (
              <div className="room-invite-card compact">
                <div className="invite-url-bar-container">
                  <div className="invite-url-icon">🔗</div>
                  <input
                    type="text"
                    readOnly
                    className="invite-url-input"
                    value={getInviteUrl()}
                    onClick={(e) => {
                      e.target.select();
                      copyInviteLink();
                    }}
                  />
                  <button
                    type="button"
                    className={`invite-url-copy-btn ${linkCopied ? 'copied' : ''}`}
                    onClick={copyInviteLink}
                    title="Linki kopyala"
                  >
                    {linkCopied ? '✓ Kopyalandı!' : 'Linki Kopyala'}
                  </button>
                </div>

                <div className="invite-btn-row">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Anti Words kelime düellosuna davet edildin! Birlikte yarışmak için tıkla: ${getInviteUrl()} veya oda kodu: ${waitingCode}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="whatsapp-share-btn"
                  >
                    <span>💬</span>
                    <span>WhatsApp ile Davet Et</span>
                  </a>

                  <div className="modern-code-display-box" onClick={copyRoomCode} title="Kodu kopyala">
                    <span className="code-display-label">ODA KODU:</span>
                    <span className="code-display-num">{waitingCode}</span>
                    <button
                      type="button"
                      className={`code-copy-mini-btn ${codeCopied ? 'copied' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyRoomCode();
                      }}
                    >
                      {codeCopied ? '✓' : '📋 Kopyala'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2'Lİ DÜELLO EŞLEŞME GÖRÜNÜMÜ (Kurucu vs Misafir) */}
            <div className="duel-matchup-container">
              {/* 1. Oyuncu: Kurucu (Host) */}
              <div className="duel-player-card is-host">
                <div className="duel-avatar-wrap">
                  <span className="duel-avatar-emoji">👑</span>
                </div>
                <div className="duel-player-meta">
                  <span className="duel-role-pill">ODA KURUCUSU</span>
                  <h4 className="duel-player-name">
                    {hostPlayer?.name || (activeRoom.isHost ? playerName : 'Kurucu')}
                    {activeRoom.isHost ? ' (Sen)' : ''}
                  </h4>
                </div>
                <div className="duel-status-tag ready">
                  <span className="dot" /> HAZIR ✓
                </div>
              </div>

              {/* Ortadaki VS Rozeti */}
              <div className="duel-vs-badge">
                <span>VS</span>
              </div>

              {/* 2. Oyuncu: Misafir / Rakip */}
              {guestPlayer ? (
                <div className="duel-player-card is-guest connected">
                  <div className="duel-avatar-wrap">
                    <span className="duel-avatar-emoji">🎯</span>
                  </div>
                  <div className="duel-player-meta">
                    <span className="duel-role-pill">MEYDAN OKUYAN</span>
                    <h4 className="duel-player-name">
                      {guestPlayer.name}
                      {!activeRoom.isHost && guestPlayer.name === playerName ? ' (Sen)' : ''}
                    </h4>
                  </div>
                  <div className="duel-status-tag ready">
                    <span className="dot" /> KATILDI ✓
                  </div>
                </div>
              ) : (
                <div className="duel-player-card is-guest waiting">
                  <div className="duel-avatar-wrap pulsing">
                    <span className="duel-avatar-emoji">⏳</span>
                  </div>
                  <div className="duel-player-meta">
                    <span className="duel-role-pill waiting">BEKLENİYOR</span>
                    <h4 className="duel-player-name empty">İkinci Oyuncu Bekleniyor...</h4>
                  </div>
                  <div className="duel-status-tag waiting">
                    <span className="dot pulse" /> Katılmadı
                  </div>
                </div>
              )}
            </div>

            {/* Grup Odasında 2'den Fazla Katılımcı Varsa */}
            {extraParticipants.length > 0 && (
              <div className="extra-participants-row">
                <span className="extra-label">Diğer Katılımcılar ({extraParticipants.length}):</span>
                <div className="extra-chips-wrap">
                  {extraParticipants.map((p) => (
                    <span key={p.id || p.name} className="extra-chip">
                      👤 {p.name} {p.name === playerName ? '(Sen)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Seçilen Oda ve Ayar Özeti (Mükerrer Seçim Yerine Temiz Bilgi Rozeti) */}
            <div className="room-active-match-summary-card">
              <div className="summary-card-badge">
                <span>🔒 ODA AYARLARI KİLİTLENDİ</span>
              </div>
              <div className="summary-card-items-row">
                <div className="summary-item-chip">
                  <span className="summary-item-label">HARİTA / ODA:</span>
                  <span className="summary-item-value">
                    {selectedMap === 'WOOD' && '🪵 Kütük Kırma'}
                    {selectedMap === 'GARDEN' && '🌱 Bitki Büyütme'}
                    {selectedMap === 'KITCHEN' && '🍕 Mutfak Telaşı'}
                    {selectedMap === 'FOOTBALL' && '⚽ Futbol Sahası'}
                    {selectedMap === 'CLASSIC' && '🎯 Siber Masa'}
                    {!['WOOD', 'GARDEN', 'KITCHEN', 'FOOTBALL', 'CLASSIC'].includes(selectedMap) && '🪵 Kütük Kırma'}
                  </span>
                </div>
                <div className="summary-item-chip">
                  <span className="summary-item-label">ZORLUK:</span>
                  <span className="summary-item-value">
                    ⚡ {selectedDifficulty === 'hard' ? 'Zor' : selectedDifficulty === 'easy' ? 'Kolay' : 'Orta'}
                  </span>
                </div>
                <div className="summary-item-chip">
                  <span className="summary-item-label">MAÇ SÜRESİ:</span>
                  <span className="summary-item-value">⏱️ {selectedDuration} sn</span>
                </div>
              </div>
            </div>

            {/* Aksiyon Butonları (Yarışmayı Başlat Butonu & Ayrıl) */}
            <div className="waiting-room-actions">
              <div className="host-actions-wrap">
                {/* Tek Kişiyken Tıklanınca Açılan İnteraktif Uyarı Kartı */}
                {showSoloPrompt && participants.length < 2 && (
                  <div className="solo-prompt-modal">
                    <div className="solo-prompt-content">
                      <div className="solo-prompt-header">
                        <span className="solo-prompt-icon">⚠️</span>
                        <h4>İkinci Oyuncu Bekleniyor</h4>
                      </div>
                      <p>
                        Odada şu an tek kişisiniz. Arkadaşınızın katılmasını bekleyebilir veya mekanikleri hemen test etmek için <strong>Antrenman Botu</strong> ile başlayabilirsiniz!
                      </p>
                      <div className="solo-prompt-actions">
                        <button
                          type="button"
                          className="btn-solo-bot-launch"
                          onClick={handleStartWithBot}
                        >
                          🤖 Bot ile Hemen Başlat (Test Et)
                        </button>
                        <button
                          type="button"
                          className="btn-solo-copy-link"
                          onClick={copyInviteLink}
                        >
                          {linkCopied ? '✓ Link Kopyalandı!' : '📋 Davet Linkini Kopyala'}
                        </button>
                        <button
                          type="button"
                          className="btn-solo-dismiss"
                          onClick={() => setShowSoloPrompt(false)}
                        >
                          Beklemeye Devam Et
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  disabled={countdown !== null || participants.length < 2 || !activeRoom.isHost}
                  className={`host-launch-btn ${
                    countdown !== null
                      ? 'starting'
                      : participants.length >= 2 && activeRoom.isHost
                      ? 'ready pulse-glow'
                      : 'waiting-players'
                  }`}
                  onClick={handleStartMatch}
                >
                  {countdown !== null
                    ? `⏳ YARIŞMA BAŞLIYOR... (${countdown > 0 ? countdown : 'YAZ!'})`
                    : participants.length < 2
                    ? '⏳ RAKİP BEKLENİYOR... (Katılınca Aktif Olur)'
                    : activeRoom.isHost
                    ? '🚀 YARIŞMAYI BAŞLAT! (Herkes Hazır)'
                    : `⏳ KURUCUNUN (${hostPlayer?.name || 'Kurucu'}) BAŞLATMASI BEKLENİYOR...`}
                </button>

                {/* Katılımcı 1 Kişiyken Doğrudan Bot ile Başlatma Seçeneği */}
                {participants.length < 2 && countdown === null && (
                  <div className="solo-quick-bot-strip">
                    {waitingElapsedSeconds >= 7 && (
                      <div className="waiting-bot-timeout-box">
                        <span className="waiting-timeout-text">
                          ⏳ Bekleme süresi uzadı ({waitingElapsedSeconds} sn). Arkadaşını beklemeden seviyene uygun botla hemen yarışabilirsin:
                        </span>
                      </div>
                    )}
                    <button
                      type="button"
                      className={`btn-bot-quick-launch ${waitingElapsedSeconds >= 7 ? 'highlight-bot-active' : ''}`}
                      onClick={handleStartWithBot}
                      title="Seviyene uygun yapay zeka bot ile hemen başlat"
                    >
                      <span>🤖</span>
                      <span>
                        {selectedDifficulty === 'hard'
                          ? 'Usta Seviye Bot ile Başla (Yüksek Hız)'
                          : selectedDifficulty === 'medium'
                          ? 'Orta Düzey Bot ile Başla'
                          : 'Başlangıç Seviyesi Bot ile Başla'}
                      </span>
                    </button>
                    <span className="host-launch-subtext">
                      👥 Veya arkadaşına davet linkini gönder, odaya bağlandığında otomatik algılanacaktır.
                    </span>
                  </div>
                )}

                {!activeRoom.isHost && participants.length >= 2 && countdown === null && (
                  <span className="guest-ready-subtext">
                    ✨ Odaya katıldınız! Kurucu veya siz yukarıdaki butona basarak yarışmayı başlatabilirsiniz.
                  </span>
                )}
              </div>

              <button
                type="button"
                className="room-leave-btn"
                onClick={cancelWaiting}
                disabled={countdown !== null}
              >
                Odayı Kapat & Ayrıl
              </button>
            </div>
          </div>
        )}
        </div>
      </div>

      {/* 3-2-1 Geri Sayım Ekranı (Tamamen Bağımsız ve Merkeze Kilitli Viewport Katmanı) */}
      {countdown !== null && (
        <div className="modern-countdown-backdrop">
          <div className="modern-countdown-box">
            <span className="countdown-sub">CHALLENGE BAŞLIYOR!</span>
            <span className="countdown-digits">
              {countdown > 0 ? countdown : 'YAZ!'}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
