import React, { useState, useEffect, useRef, useCallback } from 'react';
import GameHeader from './GameHeader';
import GameArea from './GameArea';
import Player from './Player';
import MainMenu from './MainMenu';
import GameOver from './GameOver';
import MultiplayerLobby from './MultiplayerLobby';
import RivalStatus from './RivalStatus';
import LeaderboardModal from './LeaderboardModal';
import VirtualKeyboard from './VirtualKeyboard';
import { getRandomWord } from '../data/words';
import { isTurkishCharMatch, getCurrentPlayerName } from '../utils/turkishUtils';
import { createSeededRandom, determineDuelOutcome, calculateRoomRankings } from '../services/multiplayerService';
import { recordChallengeScore } from '../services/communityChallengeService';
import {
  playTypeTick,
  playDestroySound,
  playDamageSound,
  playWrongKeySound,
  playWoodChopSound,
  playWoodBreakSound,
  playWaterDropSound,
  playFlowerBloomSound,
  playKnifeChopSound,
  playDishSizzleSound,
  playBallKickSound,
  playGoalSound,
  playNetRustleSound,
  playConstructionHammerSound,
  playCityUpgradeFanfare,
  toggleMute,
  getIsMuted,
} from '../utils/sounds';
import { CITY_BUILDING_STAGES, CITY_PARCEL_SLOTS } from './CityIslandArea';
import { useBotRival } from '../hooks/useBotRival';
import { useKitchenMode } from '../hooks/useKitchenMode';
import { useFootballMode } from '../hooks/useFootballMode';
import { useCityMode } from '../hooks/useCityMode';

const DANGER_LIMIT_DESKTOP = 82;
const DANGER_LIMIT_MOBILE = 62;
const SPAWN_COLUMNS = [28, 44, 60, 76, 90];
const THEMES = ['purple', 'blue', 'orange', 'red', 'emerald', 'gold'];

const BG_THEMES = [
  'theme-neon-pulse',
  'theme-cyber-violet',
  'theme-neon-emerald',
  'theme-solar-flare',
  'theme-midnight-aurora',
  'theme-synthwave-sunset',
  'theme-deep-abyss',
  'theme-toxic-hazard',
];

const DIFFICULTY_CONFIG = {
  easy:   { speed: 2.6, maxTargets: 3, spawnInterval: 2800 },
  medium: { speed: 3.4, maxTargets: 3, spawnInterval: 2300 },
  hard:   { speed: 4.2, maxTargets: 4, spawnInterval: 1900 },
  mixed:  { speed: 3.6, maxTargets: 3, spawnInterval: 2100 },
};

const SPEED_LEVELS = [
  { label: '×0.5', mult: 0.5 },
  { label: '×0.75', mult: 0.75 },
  { label: '×1', mult: 1 },
  { label: '×1.25', mult: 1.25 },
  { label: '×1.5', mult: 1.5 },
  { label: '×2', mult: 2 },
];

export default function Game() {
  const [gameStatus, setGameStatus] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('oda') || params.get('room') || params.get('challenge')) {
        return 'LOBBY';
      }
    }
    return 'MENU';
  });
  const [gameMode, setGameMode] = useState('SINGLE'); // 'SINGLE' | '1V1'
  const [gameMap, setGameMap] = useState('CLASSIC'); // 'CLASSIC' | 'WOOD' | 'GARDEN'
  const [preferredLobbyMap, setPreferredLobbyMap] = useState('WOOD');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [targets, setTargets] = useState([]);
  const [activeTargetId, setActiveTargetId] = useState(null);
  const [projectiles, setProjectiles] = useState([]);
  const [chopTrigger, setChopTrigger] = useState(0);
  const [waterTrigger, setWaterTrigger] = useState(0);
  const [breakingTargets, setBreakingTargets] = useState([]);
  const [bloomingTargets, setBloomingTargets] = useState([]);
  // [Refactored] Şehir, Mutfak ve Futbol modları custom hook'lara devredildi

  const [isPaused, setIsPaused] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [bgTheme, setBgTheme] = useState('theme-neon-pulse');
  const [isMuted, setIsMutedState] = useState(getIsMuted());
  const [aimAngle, setAimAngle] = useState(0);
  const [isShooting, setIsShooting] = useState(false);

  // Çok Oyunculu Durumları
  const [multiplayerRoom, setMultiplayerRoom] = useState(null);
  const [multiplayerRoomType, setMultiplayerRoomType] = useState('1v1'); // '1v1' | 'group' | 'arena'
  const [participantsList, setParticipantsList] = useState([]);
  const [finalRankings, setFinalRankings] = useState([]);
  const [rivalData, setRivalData] = useState(null);
  const [matchResult, setMatchResult] = useState(null); // 'victory' | 'defeat' | 'draw'
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null); // Saniye cinsinden kalan süre
  const [activeCommunityChallenge, setActiveCommunityChallenge] = useState(null);
  const activeCommunityChallengeRef = useRef(null);
  const [lobbyAutoJoinCode, setLobbyAutoJoinCode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('oda') || params.get('room') || params.get('challenge');
      return code ? code.trim().toUpperCase().slice(0, 6) : null;
    }
    return null;
  });
  const [lobbyAutoCreateData, setLobbyAutoCreateData] = useState(null);
  const participantsRef = useRef([]);
  const multiplayerRoomTypeRef = useRef('1v1');

  // Mobil Cihaz & Sanal Klavye Durumları
  const [isMobileDevice, setIsMobileDevice] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
    }
    return false;
  });
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(true);

  // İstatistikler
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [totalKeystrokes, setTotalKeystrokes] = useState(0);
  const [correctKeystrokes, setCorrectKeystrokes] = useState(0);
  const [startTime, setStartTime] = useState(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [highScore, setHighScore] = useState(() => {
    return parseInt(localStorage.getItem('antivirus_highscore') || '0', 10);
  });
  const [isNewHighScore, setIsNewHighScore] = useState(false);

  // Referanslar
  const gameStatusRef = useRef('MENU');
  const gameModeRef = useRef('SINGLE');
  const gameMapRef = useRef('CLASSIC');
  const selectedDiffRef = useRef('medium');
  const targetsRef = useRef([]);
  const activeTargetIdRef = useRef(null);
  const livesRef = useRef(3);
  const scoreRef = useRef(0);
  const destroyedCountRef = useRef(0);
  const totalKeystrokesRef = useRef(0);
  const correctKeystrokesRef = useRef(0);
  const startTimeRef = useRef(null);
  const isPausedRef = useRef(false);
  const speedMultRef = useRef(1);
  const lastTimeRef = useRef(null);
  const reqIdRef = useRef(null);
  const nextTargetIdRef = useRef(1);
  const lastSpawnTimeRef = useRef(0);
  const currentBgThemeRef = useRef('theme-neon-pulse');
  const prngRef = useRef(Math.random);
  const roomRef = useRef(null);
  const rivalDataRef = useRef(null);
  const timeLeftRef = useRef(null);
  const matchDurationRef = useRef(60);
  const matchEndTimeRef = useRef(null);
  const clockOffsetRef = useRef(0);
  const lastActiveTimestampRef = useRef(Date.now());
  const botInfoRef = useRef(null);

  gameStatusRef.current = gameStatus;
  gameModeRef.current = gameMode;
  gameMapRef.current = gameMap;
  selectedDiffRef.current = selectedDifficulty;
  targetsRef.current = targets;
  activeTargetIdRef.current = activeTargetId;
  livesRef.current = lives;
  scoreRef.current = score;
  isPausedRef.current = isPaused;
  speedMultRef.current = SPEED_LEVELS[speedIndex].mult;
  roomRef.current = multiplayerRoom;
  rivalDataRef.current = rivalData;
  timeLeftRef.current = timeLeft;

  // Rakibe Canlı Veri İletme Fonksiyonu
  const broadcastMyProgress = useCallback((updatedScore, updatedLives) => {
    if (roomRef.current && gameStatusRef.current === 'PLAYING') {
      const finalStartTime = startTimeRef.current || Date.now();
      const elapsedMinutes = Math.max(0.1, (Date.now() - finalStartTime) / 60000);
      const currentWpm = Math.round(correctKeystrokesRef.current / 5 / elapsedMinutes);
      const currentAcc =
        totalKeystrokesRef.current > 0
          ? Math.round((correctKeystrokesRef.current / totalKeystrokesRef.current) * 100)
          : 100;

      roomRef.current.sendProgress({
        score: updatedScore !== undefined ? updatedScore : scoreRef.current,
        lives: updatedLives !== undefined ? updatedLives : livesRef.current,
        wpm: currentWpm,
        words: destroyedCountRef.current,
        accuracy: currentAcc,
      });
    }
  }, []);

  // Mod Hook'ları
  const {
    ballKickTrigger,
    setBallKickTrigger,
    shootingBalls,
    goalCelebrations,
    goalsScored,
    goalsScoredRef,
    triggerFootballShot,
    resetFootballMode,
  } = useFootballMode();

  const {
    kitchenChopTrigger,
    setKitchenChopTrigger,
    slicingTargets,
    kitchenPizzaCount,
    kitchenIngredientCount,
    pizzaBounceTrigger,
    pizzaCompleteBurst,
    isPizzaLaunching,
    isOvenGlowing,
    isNewPizzaArriving,
    triggerKitchenSlice,
    resetKitchenMode,
  } = useKitchenMode({ scoreRef, setScore, livesRef, broadcastMyProgress });

  const {
    citySlots,
    setCitySlots,
    cityPopulation,
    setCityPopulation,
    cityStage,
    setCityStage,
    completedBuildingCount,
    setCompletedBuildingCount,
    recentBuildEffect,
    setRecentBuildEffect,
    stageUpgradeNotice,
    setStageUpgradeNotice,
    citySlotsRef,
    cityStageRef,
    completedBuildingCountRef,
    cityPopulationRef,
    citySlotWordsRef,
    isCityDemolishingRef,
    triggerCityBuild,
    resetCityMode,
  } = useCityMode({
    scoreRef,
    setScore,
    livesRef,
    broadcastMyProgress,
    setTargets,
    targetsRef,
    setActiveTargetId,
    activeTargetIdRef,
    createTarget: (...args) => createTarget(...args),
  });

  // Bot Rakip Hook'u
  useBotRival({
    gameStatus,
    gameMode,
    botInfoRef,
    gameStatusRef,
    isPausedRef,
    setRivalData,
    rivalDataRef,
    setParticipantsList,
    triggerGameOver: (...args) => triggerGameOver(...args),
  });

  // Hedef açısını hesapla (silahın hedefe dönmesi)
  useEffect(() => {
    if (activeTargetId !== null) {
      const activeTarget = targets.find((t) => t.id === activeTargetId);
      if (activeTarget) {
        const dx = activeTarget.x - 50;
        const dy = Math.max(8, 92 - activeTarget.y);
        const calculatedAngle = Math.atan2(dx, dy) * (180 / Math.PI);
        setAimAngle(Math.max(-65, Math.min(65, calculatedAngle)));
        return;
      }
    }
    setAimAngle(0);
  }, [activeTargetId, targets]);

  const handleToggleMute = () => {
    const newState = toggleMute();
    setIsMutedState(newState);
  };

  // Rastgele/Tohumlu hedef oluşturucu
  const createTarget = useCallback((currentList, diffParam) => {
    const isCityMode = gameMapRef.current === 'CITY';
    const isGardenMode = gameMapRef.current === 'GARDEN';
    const isFootballMode = gameMapRef.current === 'FOOTBALL';

    if (isCityMode) {
      const currentStage = cityStageRef.current;
      const stageBuildings = CITY_BUILDING_STAGES[currentStage] || CITY_BUILDING_STAGES.VILLAGE;

      // Mevcut aşamadaki binalardan henüz 2 kelimesi tamamlanmamış olanlar
      const incompleteStageBuildings = stageBuildings.filter(
        (b) => (citySlotWordsRef.current[b.slotId] || 0) < 2
      );

      // Zaten şu an ekranda hedef olarak bulunan slotlar
      const targetedSlotIds = currentList.map((t) => t.slotId);

      // Hem henüz 2 kelimesi dolmamış hem de şu an ekranda hedef olmayan slotlar
      let availableSlots = incompleteStageBuildings.filter(
        (b) => !targetedSlotIds.includes(b.slotId)
      );

      if (availableSlots.length === 0) {
        availableSlots = incompleteStageBuildings;
      }
      if (availableSlots.length === 0) {
        availableSlots = stageBuildings;
      }

      const chosenBuilding = availableSlots[0] || stageBuildings[0];
      const parcelSlot = CITY_PARCEL_SLOTS.find((p) => p.id === chosenBuilding.slotId) || CITY_PARCEL_SLOTS[0];
      const diff = diffParam || selectedDiffRef.current;
      const lastWord = currentList.length > 0 ? currentList[currentList.length - 1].word : '';

      const rawWord = getRandomWord(diff, lastWord, prngRef.current);
      const upperWord = rawWord.toLocaleUpperCase('tr-TR');
      const currentSlotWords = citySlotWordsRef.current[chosenBuilding.slotId] || 0;
      const currentStep = Math.min(2, currentSlotWords + 1);

      return {
        id: `city-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        word: upperWord,
        typedIndex: 0,
        x: parcelSlot.x,
        y: parcelSlot.y,
        slotId: chosenBuilding.slotId,
        buildingName: chosenBuilding.name,
        buildingPop: chosenBuilding.pop,
        stage: currentStage,
        currentStep: currentStep,
        maxSteps: 2,
        lifeSpent: 0,
        maxLife: 28,
        theme: THEMES[Math.floor(prngRef.current() * THEMES.length)],
      };
    }

    let chosenX, chosenY;

    if (isFootballMode) {
      // Futbol Modu: Toplar sahanın ceza sahası ve yayının çevresinde belirir (Y: %65 - %78, X: %20 - %80)
      const isMobileNow = typeof window !== 'undefined' && window.innerWidth <= 768;
      const minX = isMobileNow ? 22 : 18;
      const spanX = isMobileNow ? 56 : 64;
      let bestX = Math.floor(minX + prngRef.current() * spanX);
      let bestY = Math.floor(65 + prngRef.current() * 13);
      let maxDist = 0;

      for (let attempt = 0; attempt < 25; attempt++) {
        const candX = Math.floor(minX + prngRef.current() * spanX);
        const candY = Math.floor(65 + prngRef.current() * 13);

        if (currentList.length === 0) {
          bestX = candX;
          bestY = candY;
          break;
        }

        let minDistToOthers = Infinity;
        for (const other of currentList) {
          const dist = Math.hypot(other.x - candX, (other.y - candY) * 1.8);
          if (dist < minDistToOthers) {
            minDistToOthers = dist;
          }
        }

        if (minDistToOthers > 22) {
          bestX = candX;
          bestY = candY;
          break;
        }

        if (minDistToOthers > maxDist) {
          maxDist = minDistToOthers;
          bestX = candX;
          bestY = candY;
        }
      }

      chosenX = bestX;
      chosenY = bestY;
    } else if (isGardenMode) {
      // Tohumlar birbirine ve rozetlere çok yakın doğmasın (minimum %26 mesafe kontrolü)
      // Sol skor panelinin (0-%26) altına gelmemesi için 27-%79 aralığına yerleştir
      const maxYSpan = isMobileDevice ? 34 : 48;
      let bestX = Math.floor(27 + prngRef.current() * 52);
      let bestY = Math.floor(16 + prngRef.current() * maxYSpan);
      let maxDist = 0;

      // 25 deneme yaparak mevcut tohumlardan en uzak ve dengeli konumu bul
      for (let attempt = 0; attempt < 25; attempt++) {
        const candX = Math.floor(27 + prngRef.current() * 52);
        const candY = Math.floor(16 + prngRef.current() * maxYSpan);

        if (currentList.length === 0) {
          bestX = candX;
          bestY = candY;
          break;
        }

        // Mevcut tohumlara olan mesafeyi ölç (kelime rozetleri dikey olduğu için dikey ekseni daha yüksek ağırlıklandır)
        let minDistToOthers = Infinity;
        for (const other of currentList) {
          const dist = Math.hypot(other.x - candX, (other.y - candY) * 1.6);
          if (dist < minDistToOthers) {
            minDistToOthers = dist;
          }
        }

        // Eğer %26 mesafeden daha uzaktaysa doğrudan kabul et
        if (minDistToOthers > 26) {
          bestX = candX;
          bestY = candY;
          break;
        }

        if (minDistToOthers > maxDist) {
          maxDist = minDistToOthers;
          bestX = candX;
          bestY = candY;
        }
      }

      chosenX = bestX;
      chosenY = bestY;
    } else {
      const isMobileNow = typeof window !== 'undefined' && window.innerWidth <= 768;
      const activeColumns = isMobileNow ? [35, 62, 86] : SPAWN_COLUMNS;
      // Mobilde kelimelerin üst üste binmesini önlemek için üst yarıdaki hedeflerin sütunlarını dolu say
      const occupiedColumns = currentList.filter((t) => t.y < 42).map((t) => t.x);
      const availableColumns = activeColumns.filter((c) => !occupiedColumns.includes(c));
      const randomVal = prngRef.current();
      chosenX =
        availableColumns.length > 0
          ? availableColumns[Math.floor(randomVal * availableColumns.length)]
          : activeColumns[Math.floor(randomVal * activeColumns.length)];
      chosenY = -8;
    }

    const lastWord = currentList.length > 0 ? currentList[currentList.length - 1].word : '';
    const diff = diffParam || selectedDiffRef.current;
    const newWord = getRandomWord(diff, lastWord, prngRef.current);
    const config = DIFFICULTY_CONFIG[diff] || DIFFICULTY_CONFIG.medium;
    const chosenTheme = THEMES[Math.floor(prngRef.current() * THEMES.length)];
    const foodTypes = ['mushroom', 'meat', 'pepper', 'corn', 'cheese', 'tomato'];
    const chosenFood = foodTypes[Math.floor(prngRef.current() * foodTypes.length)];

    return {
      id: nextTargetIdRef.current++,
      word: newWord,
      typedIndex: 0,
      x: chosenX,
      y: chosenY,
      speed: config.speed + (prngRef.current() * 0.5 - 0.25),
      theme: chosenTheme,
      foodId: chosenFood,
    };
  }, []);

  // Oyunu Başlatma
  const startGameWithDiff = (diffId, modeOverride, mapOverride, durationOverride) => {
    const targetDiff = diffId || selectedDifficulty;
    setSelectedDifficulty(targetDiff);
    selectedDiffRef.current = targetDiff;

    const targetMode = modeOverride || gameModeRef.current || 'SINGLE';
    setGameMode(targetMode);
    gameModeRef.current = targetMode;

    const targetMap = mapOverride || gameMapRef.current || 'CLASSIC';
    setGameMap(targetMap);
    gameMapRef.current = targetMap;

    if (!prngRef.current) {
      prngRef.current = Math.random;
    }

    // Süre Zamanlayıcısını Sıfırla ve Yeniden Kur
    if (durationOverride !== undefined) {
      const parsedDuration = Number(durationOverride) || 0;
      matchDurationRef.current = parsedDuration;
      if (parsedDuration > 0) {
        setTimeLeft(parsedDuration);
        timeLeftRef.current = parsedDuration;
        matchEndTimeRef.current = Date.now() + parsedDuration * 1000;
      } else {
        setTimeLeft(null);
        timeLeftRef.current = null;
        matchEndTimeRef.current = null;
      }
    } else if (targetMode === 'SINGLE') {
      const parsedDuration = Number(matchDurationRef.current) || 0;
      if (parsedDuration > 0) {
        setTimeLeft(parsedDuration);
        timeLeftRef.current = parsedDuration;
        matchEndTimeRef.current = Date.now() + parsedDuration * 1000;
      } else {
        setTimeLeft(null);
        timeLeftRef.current = null;
        matchEndTimeRef.current = null;
      }
    }

    setShowLeaderboard(false);

    const availableThemes = BG_THEMES.filter((t) => t !== currentBgThemeRef.current);
    const nextBgTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)] || BG_THEMES[0];
    currentBgThemeRef.current = nextBgTheme;
    setBgTheme(nextBgTheme);

    setScore(0);
    setLives(3);
    setDestroyedCount(0);
    setTotalKeystrokes(0);
    setCorrectKeystrokes(0);
    setWpm(0);
    setAccuracy(100);
    setIsNewHighScore(false);
    setActiveTargetId(null);
    setProjectiles([]);
    setChopTrigger(0);
    setWaterTrigger(0);
    setBreakingTargets([]);
    setBloomingTargets([]);
    resetCityMode();
    resetKitchenMode();
    resetFootballMode();
    setIsPaused(false);
    setSpeedIndex(2);
    setAimAngle(0);
    setIsShooting(false);
    setMatchResult(null);

    scoreRef.current = 0;
    livesRef.current = 3;
    destroyedCountRef.current = 0;
    totalKeystrokesRef.current = 0;
    correctKeystrokesRef.current = 0;
    activeTargetIdRef.current = null;
    isPausedRef.current = false;
    speedMultRef.current = 1;

    const now = Date.now();
    setStartTime(now);
    startTimeRef.current = now;

    const isGarden = targetMap === 'GARDEN';
    const isFootball = targetMap === 'FOOTBALL';
    const isCity = targetMap === 'CITY';
    const initialTargets = [];
    const count = isGarden ? 3 : (isFootball || isCity) ? 2 : 2;
    for (let i = 0; i < count; i++) {
      const t = createTarget(initialTargets, targetDiff);
      if (!isGarden && !isFootball && !isCity) {
        t.y = 4 + i * 20;
      }
      initialTargets.push(t);
    }
    setTargets(initialTargets);
    targetsRef.current = initialTargets;

    setGameStatus('PLAYING');
    gameStatusRef.current = 'PLAYING';
    lastTimeRef.current = performance.now();
    lastSpawnTimeRef.current = performance.now();
    lastActiveTimestampRef.current = Date.now();
  };

  // Topluluk Challenge Odası Kurma -> Doğrudan Oyuna Başla (Rakip Bekleme Yok)
  const handleCreateCommunityChallengeRoom = (challengeData) => {
    handleStartCommunityChallenge(challengeData);
  };

  // Topluluk Açık Odaya Katılma -> Doğrudan Oyuna Başla (Rakip Bekleme Yok)
  const handleJoinCommunityChallengeRoom = (challenge) => {
    handleStartCommunityChallenge(challenge);
  };

  // Topluluk Canlı Challenge'ını Başlat (Açık Oda - Doğrudan Oyun)
  const handleStartCommunityChallenge = (challenge) => {
    setActiveCommunityChallenge(challenge);
    activeCommunityChallengeRef.current = challenge;

    const targetMap = challenge.gameMap || challenge.map || 'WOOD';
    const targetDiff = challenge.difficulty || 'medium';
    const targetDuration = Number(challenge.duration) || 60;

    setGameMode('CHALLENGE');
    gameModeRef.current = 'CHALLENGE';
    setGameMap(targetMap);
    gameMapRef.current = targetMap;

    matchDurationRef.current = targetDuration;
    setTimeLeft(targetDuration);
    timeLeftRef.current = targetDuration;

    // Herkes bu odaya girdiğinde birebir aynı kelimeleri aynı sırayla alsın:
    const seedStr = String(challenge.roomCode || challenge.id || 'CHALLENGE');
    const numericSeed = Math.abs(seedStr.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)) || 123456;
    prngRef.current = createSeededRandom(numericSeed);

    startGameWithDiff(targetDiff, 'CHALLENGE', targetMap, targetDuration);
  };

  // Çok Oyunculu Maçı Başlat
  const handleStartMultiplayer = ({
    room,
    difficulty,
    duration,
    seed,
    rivalName,
    gameMap: incomingMap,
    roomType = '1v1',
    participants = [],
    isBot = false,
    botDifficulty = null,
    matchStartTime,
    matchEndTime,
    clockOffset = 0,
  }) => {
    const targetMap = incomingMap || room?.gameMap || 'WOOD';
    setGameMode('1V1');
    gameModeRef.current = '1V1';
    setMultiplayerRoomType(roomType);
    multiplayerRoomTypeRef.current = roomType;
    setGameMap(targetMap);
    gameMapRef.current = targetMap;
    setMultiplayerRoom(room);
    roomRef.current = room;

    const initialParticipants = participants && participants.length > 0 ? participants : [];
    setParticipantsList(initialParticipants);
    participantsRef.current = initialParticipants;

    const parsedDuration = Number(duration) || 0;
    matchDurationRef.current = parsedDuration;
    clockOffsetRef.current = clockOffset || 0;

    const nowWithOffset = Date.now() + (clockOffset || 0);
    const finalEndTime =
      matchEndTime ||
      (matchStartTime ? matchStartTime + parsedDuration * 1000 : nowWithOffset + parsedDuration * 1000);
    matchEndTimeRef.current = finalEndTime;

    if (parsedDuration > 0) {
      const initialRemaining = Math.max(0, Math.ceil((finalEndTime - nowWithOffset) / 1000));
      setTimeLeft(initialRemaining);
      timeLeftRef.current = initialRemaining;
    } else {
      setTimeLeft(null);
      timeLeftRef.current = null;
    }

    const initialRival = {
      name: rivalName || 'Rakip',
      score: 0,
      lives: 3,
      wpm: 0,
      words: 0,
      accuracy: 100,
      isEliminated: false,
    };
    setRivalData(initialRival);
    rivalDataRef.current = initialRival;

    // Bot Rakip Tespiti ve Konfigürasyonu
    const isBotMatch = Boolean(
      isBot ||
      rivalName?.includes('Bot') ||
      (participants && participants.some((p) => p.isBot || p.name?.includes('Bot')))
    );

    if (isBotMatch) {
      const effBotDiff = botDifficulty || difficulty || selectedDifficulty || 'medium';
      let baseBotWpm = 52;
      let botAcc = 96;
      if (effBotDiff === 'hard') {
        baseBotWpm = 78;
        botAcc = 98;
      } else if (effBotDiff === 'easy') {
        baseBotWpm = 32;
        botAcc = 92;
      }

      botInfoRef.current = {
        active: true,
        name: rivalName || (effBotDiff === 'hard' ? '🤖 Siber_Klavye [Usta Bot]' : effBotDiff === 'easy' ? '🤖 Çaylak_Parmak [Bot]' : '🤖 Hızlı_Parmak [Bot]'),
        difficulty: effBotDiff,
        baseWpm: baseBotWpm,
        currentWpm: baseBotWpm,
        score: 0,
        words: 0,
        lives: 3,
        accuracy: botAcc,
        accumulatedWordFraction: 0,
        lastTick: Date.now(),
      };
    } else {
      botInfoRef.current = null;
    }

    // Tohumlu rastgele sayı üretici (her iki oyuncu aynı kelimeleri alır)
    prngRef.current = createSeededRandom(seed);

    // ÇOK OYUNCULU GRUP & ARENA DINLEYICILERI
    room.on('participants_progress', (updatedList) => {
      setParticipantsList(updatedList);
      participantsRef.current = updatedList;
    });

    room.on('player_progress', ({ playerId, progress }) => {
      setParticipantsList((prev) => {
        const idx = prev.findIndex((p) => p.id === playerId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = { ...next[idx], stats: { ...(next[idx].stats || {}), ...progress } };
          return next;
        }
        return prev;
      });
    });

    room.on('player_eliminated', ({ playerId, finalStats }) => {
      setParticipantsList((prev) => {
        const idx = prev.findIndex((p) => p.id === playerId);
        if (idx !== -1) {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            stats: { ...(next[idx].stats || {}), ...finalStats, isEliminated: true, lives: 0 },
          };
          return next;
        }
        return prev;
      });
    });

    room.on('player_announced', (playerData) => {
      setParticipantsList((prev) => {
        if (!prev.some((p) => p.id === playerData.id)) {
          return [...prev, playerData];
        }
        return prev;
      });
    });

    room.on('participants_finished_update', (finishedList) => {
      setParticipantsList(finishedList);
      participantsRef.current = finishedList;
    });

    // Tekrar Oyna ile lobiye dönüş dinleyicisi
    room.on('rematch_lobby', (data) => {
      if (data?.gameMap) {
        setGameMap(data.gameMap);
        gameMapRef.current = data.gameMap;
      }
      if (data?.difficulty) {
        setSelectedDifficulty(data.difficulty);
        selectedDiffRef.current = data.difficulty;
      }
      if (gameStatusRef.current === 'GAMEOVER') {
        setGameStatus('LOBBY');
      }
    });

    // Rakip olaylarını dinle (1v1)
    room.on('rival_progress', (data) => {
      setRivalData((prev) => ({
        ...prev,
        name: data.name || prev?.name || 'Rakip',
        score: data.score !== undefined ? data.score : (prev?.score ?? 0),
        lives: data.lives !== undefined ? data.lives : (prev?.lives ?? 3),
        wpm: data.wpm !== undefined ? data.wpm : (prev?.wpm ?? 0),
        words: data.words !== undefined ? data.words : (prev?.words ?? 0),
        accuracy: data.accuracy !== undefined ? data.accuracy : (prev?.accuracy ?? 100),
      }));
      rivalDataRef.current = {
        ...rivalDataRef.current,
        name: data.name || rivalDataRef.current?.name || 'Rakip',
        score: data.score !== undefined ? data.score : (rivalDataRef.current?.score ?? 0),
        lives: data.lives !== undefined ? data.lives : (rivalDataRef.current?.lives ?? 3),
        wpm: data.wpm !== undefined ? data.wpm : (rivalDataRef.current?.wpm ?? 0),
        words: data.words !== undefined ? data.words : (rivalDataRef.current?.words ?? 0),
        accuracy: data.accuracy !== undefined ? data.accuracy : (rivalDataRef.current?.accuracy ?? 100),
      };

      // RAKİBİN CANI 0 OLDUĞUNDA ANINDA ZAFER İLE OYUNU SONLANDIR (BİZ HAYATTAYSAK)
      if (data.lives !== undefined && data.lives <= 0 && gameStatusRef.current === 'PLAYING') {
        setRivalData((prev) => ({ ...prev, lives: 0, isEliminated: true }));
        rivalDataRef.current = { ...rivalDataRef.current, lives: 0, isEliminated: true };
        if (livesRef.current > 0) {
          triggerGameOver('victory');
        }
      }
    });

    room.on('rival_eliminated', (data) => {
      if (gameStatusRef.current === 'PLAYING') {
        const stats = data?.finalStats || {};
        setRivalData((prev) => ({
          ...prev,
          ...stats,
          lives: 0,
          isEliminated: true,
        }));
        rivalDataRef.current = {
          ...rivalDataRef.current,
          ...stats,
          lives: 0,
          isEliminated: true,
        };
        if (livesRef.current > 0) {
          triggerGameOver('victory');
        } else {
          triggerGameOver('defeat');
        }
      }
    });

    room.on('match_ended', (data) => {
      if (gameStatusRef.current === 'PLAYING') {
        const isHost = Boolean(room.isHost);
        const myRole = isHost ? 'host' : 'guest';

        // Gelen verilerle rakibin kesin istatistiklerini güncelle
        const incomingRivalStats = isHost ? data.guestStats : data.hostStats;
        const incomingRivalScore = isHost ? data.guestScore : data.hostScore;
        const incomingRivalLives = isHost ? data.guestLives : data.hostLives;

        if (incomingRivalStats || incomingRivalScore !== undefined) {
          setRivalData((prev) => ({
            ...prev,
            ...(incomingRivalStats || {}),
            score: incomingRivalScore ?? prev.score,
            lives: incomingRivalLives ?? prev.lives,
            isEliminated: incomingRivalLives !== undefined ? incomingRivalLives <= 0 : prev.isEliminated,
          }));
          rivalDataRef.current = {
            ...rivalDataRef.current,
            ...(incomingRivalStats || {}),
            score: incomingRivalScore ?? rivalDataRef.current?.score ?? 0,
            lives: incomingRivalLives ?? rivalDataRef.current?.lives ?? 3,
            isEliminated: incomingRivalLives !== undefined ? incomingRivalLives <= 0 : rivalDataRef.current?.isEliminated,
          };
        }

        // 1. Rol tabanlı kesin kazanan kontrolü
        if (data.winnerRole) {
          if (data.winnerRole === 'draw') {
            triggerGameOver('draw');
          } else if (data.winnerRole === myRole) {
            triggerGameOver('victory');
          } else {
            triggerGameOver('defeat');
          }
          return;
        }

        // 2. Fallback: Matematiksel kural kontrolü (Asla iki tarafa zafer vermez)
        const myFinalStartTime = startTimeRef.current || Date.now();
        const elapsedMinutes = Math.max(0.1, (Date.now() - myFinalStartTime) / 60000);
        const calculatedWpm = Math.round(correctKeystrokesRef.current / 5 / elapsedMinutes);
        const calculatedAcc =
          totalKeystrokesRef.current > 0
            ? Math.round((correctKeystrokesRef.current / totalKeystrokesRef.current) * 100)
            : 100;

        const myStats = {
          score: scoreRef.current,
          lives: livesRef.current,
          wpm: calculatedWpm,
          accuracy: calculatedAcc,
          isEliminated: livesRef.current <= 0,
        };
        const rivalStats = {
          score: incomingRivalScore ?? rivalDataRef.current?.score ?? 0,
          lives: incomingRivalLives ?? rivalDataRef.current?.lives ?? 3,
          wpm: rivalDataRef.current?.wpm || 0,
          accuracy: incomingRivalStats?.accuracy ?? rivalDataRef.current?.accuracy ?? 100,
          isEliminated: Boolean(rivalDataRef.current?.isEliminated || (incomingRivalLives ?? rivalDataRef.current?.lives ?? 3) <= 0),
        };

        triggerGameOver(determineDuelOutcome(myStats, rivalStats));
      }
    });

    room.on('rival_left', () => {
      if (gameStatusRef.current === 'PLAYING') {
        triggerGameOver('victory');
      }
    });

    startGameWithDiff(difficulty, '1V1', targetMap);
  };

  // 1v1 Bot Rakip Simülasyonu (Eğer rakip 'Bot' veya 'Yapay Zeka' ise gerçek zamanlı yazma ve skor simülasyonu)
  useEffect(() => {
    if (gameStatus !== 'PLAYING' || gameMode !== '1V1') return;
    const rivalNameStr = String(rivalData?.name || rivalDataRef.current?.name || '');
    const isBot = rivalNameStr.includes('Bot') || rivalNameStr.includes('Yapay Zeka') || Boolean(rivalData?.isBot);

    if (!isBot) return;

    const botInterval = setInterval(() => {
      if (gameStatusRef.current !== 'PLAYING') return;

      setRivalData((prev) => {
        const nextScore = (prev?.score || 0) + Math.floor(18 + Math.random() * 12);
        const nextWords = (prev?.words || 0) + 1;
        const nextWpm = Math.floor(45 + Math.random() * 15);
        const updated = {
          ...prev,
          score: nextScore,
          words: nextWords,
          wpm: nextWpm,
          accuracy: Math.floor(95 + Math.random() * 5),
          lives: prev?.lives ?? 3,
          isEliminated: false,
        };
        rivalDataRef.current = updated;
        return updated;
      });
    }, 2200);

    return () => clearInterval(botInterval);
  }, [gameStatus, gameMode, rivalData?.name]);

  // Oyun Sonu (Zafer / Yenilgi / Berabere)
  const triggerGameOver = (result = 'defeat') => {
    if (gameStatusRef.current === 'GAMEOVER') return;
    setGameStatus('GAMEOVER');
    gameStatusRef.current = 'GAMEOVER';

    const finalScore = scoreRef.current;
    const finalTotalKeys = totalKeystrokesRef.current;
    const finalCorrectKeys = correctKeystrokesRef.current;
    const finalStartTime = startTimeRef.current || Date.now();
    const elapsedMinutes = Math.max(0.1, (Date.now() - finalStartTime) / 60000);

    const calculatedWpm = Math.round(finalCorrectKeys / 5 / elapsedMinutes);
    const calculatedAcc =
      finalTotalKeys > 0 ? Math.round((finalCorrectKeys / finalTotalKeys) * 100) : 100;

    setWpm(calculatedWpm);
    setAccuracy(calculatedAcc);

    if (gameModeRef.current === '1V1') {
      const isHost = Boolean(roomRef.current?.isHost);
      const myRole = isHost ? 'host' : 'guest';
      const rivalRole = isHost ? 'guest' : 'host';

      const myStats = {
        score: finalScore,
        lives: livesRef.current,
        wpm: calculatedWpm,
        words: destroyedCountRef.current,
        accuracy: calculatedAcc,
        isEliminated: livesRef.current <= 0,
      };
      const rivalStats = {
        score: rivalDataRef.current?.score || 0,
        lives: rivalDataRef.current?.lives !== undefined ? rivalDataRef.current.lives : 3,
        wpm: rivalDataRef.current?.wpm || 0,
        words: rivalDataRef.current?.words || 0,
        accuracy: rivalDataRef.current?.accuracy || 100,
        isEliminated: Boolean(rivalDataRef.current?.isEliminated || (rivalDataRef.current?.lives !== undefined && rivalDataRef.current.lives <= 0)),
      };

      // Matematiksel ve mantıksal doğrulama: Canımız 0 iken zafer verilemez!
      const verifiedOutcome = determineDuelOutcome(myStats, rivalStats);
      const finalResult = (result === 'victory' && verifiedOutcome === 'defeat') ? 'defeat' : (result || verifiedOutcome);

      setMatchResult(finalResult);

      // Sadece 3 veya daha fazla oyuncu varsa grup sıralaması oluşturulur (2 kişilik maçlar her zaman 1v1 düello modundadır)
      const myPlayerName = getCurrentPlayerName();
      if ((multiplayerRoomTypeRef.current === 'group' || multiplayerRoomTypeRef.current === 'arena') && participantsRef.current.length > 2) {
        const otherParticipants = (participantsRef.current || [])
          .filter((p) => p.name !== myPlayerName)
          .map((p) => ({
            name: p.name,
            score: p.stats?.score || 0,
            lives: p.stats?.lives ?? 3,
            wpm: p.stats?.wpm || 0,
            words: p.stats?.words || 0,
            accuracy: p.stats?.accuracy || 100,
            isEliminated: Boolean(p.stats?.isEliminated),
          }));

        const myParticipantObj = {
          name: myPlayerName,
          score: finalScore,
          lives: livesRef.current,
          wpm: calculatedWpm,
          words: destroyedCountRef.current,
          accuracy: calculatedAcc,
          isEliminated: livesRef.current <= 0,
          isMe: true,
        };

        const allForRanking = [myParticipantObj, ...otherParticipants];
        const calculatedRankings = calculateRoomRankings(allForRanking);
        setFinalRankings(calculatedRankings);

        if (roomRef.current?.sendFinished) {
          roomRef.current.sendFinished(myParticipantObj);
        }
      } else {
        setFinalRankings([]);
      }

      if (finalResult === 'defeat' && roomRef.current) {
        // Canım bitti veya kaybettim: Rakibe anında kesin elenme ve maç sonu bildirimini ilet
        roomRef.current.sendEliminated({
          score: finalScore,
          lives: 0,
          wpm: calculatedWpm,
          words: destroyedCountRef.current,
          accuracy: calculatedAcc,
        });

        roomRef.current.sendMatchEnd({
          winnerRole: rivalRole,
          loserRole: myRole,
          reason: 'elimination',
          hostScore: isHost ? finalScore : rivalStats.score,
          guestScore: isHost ? rivalStats.score : finalScore,
          hostLives: isHost ? 0 : rivalStats.lives,
          guestLives: isHost ? rivalStats.lives : 0,
          hostStats: isHost ? myStats : rivalStats,
          guestStats: isHost ? rivalStats : myStats,
        });

        roomRef.current.sendProgress({
          score: finalScore,
          lives: 0,
          wpm: calculatedWpm,
          words: destroyedCountRef.current,
          accuracy: calculatedAcc,
        });
      }
    } else {
      const currentHigh = parseInt(localStorage.getItem('antivirus_highscore') || '0', 10);
      if (finalScore > currentHigh) {
        localStorage.setItem('antivirus_highscore', finalScore.toString());
        setHighScore(finalScore);
        setIsNewHighScore(true);
      }
    }

    // Topluluk Challenge Odası Skoru Kaydı (Fast Fingers Liderlik Sıralaması)
    const ch =
      activeCommunityChallengeRef.current ||
      (roomRef.current?.roomCode
        ? {
            id: `CH_${roomRef.current.roomCode}`,
            title: `Oda #${roomRef.current.roomCode}`,
            gameMap: gameMapRef.current || 'WOOD',
          }
        : null);

    if (ch) {
      const currentPName = getCurrentPlayerName();
      recordChallengeScore({
        challengeId: ch.id || `CH_${ch.roomCode || 'ARENA'}`,
        challengeTitle: ch.title || 'Canlı Challenge',
        playerName: currentPName,
        wpm: calculatedWpm,
        accuracy: calculatedAcc,
        score: finalScore,
        gameMap: gameMapRef.current || ch.gameMap || 'WOOD',
      });
    }
  };

  const togglePause = useCallback(() => {
    if (gameStatusRef.current !== 'PLAYING' || gameModeRef.current === '1V1') return;
    setIsPaused((prev) => {
      const next = !prev;
      isPausedRef.current = next;
      if (!next) {
        lastTimeRef.current = performance.now();
      }
      return next;
    });
  }, []);

  // Hız Ayarları (Hem Tek Kişilikte Hem 1v1'de Serbestçe Değiştirilebilir)
  const speedDown = () => setSpeedIndex((i) => Math.max(0, i - 1));
  const speedUp = () => setSpeedIndex((i) => Math.min(SPEED_LEVELS.length - 1, i + 1));

  const handleProjectileComplete = useCallback((projId) => {
    setProjectiles((prev) => prev.filter((p) => p.id !== projId));
  }, []);

  // Düzenli Senkronizasyon Kalp Atışı (Her 200ms'de bir rakibe canlı veri yollar)
  useEffect(() => {
    if (gameMode !== '1V1' || gameStatus !== 'PLAYING') return;

    broadcastMyProgress();
    const interval = setInterval(() => {
      broadcastMyProgress();
    }, 200);

    return () => clearInterval(interval);
  }, [gameMode, gameStatus]);

  // Süre Sayacı (Geri Sayım - Hem 1v1 Hem Tek Kişilik İçin)
  useEffect(() => {
    if (gameStatus !== 'PLAYING' || !matchDurationRef.current) return;

    const tickTimer = () => {
      if (!matchEndTimeRef.current) return;
      const now = Date.now() + (clockOffsetRef.current || 0);
      const remainingMs = matchEndTimeRef.current - now;
      const secondsLeft = Math.max(0, Math.ceil(remainingMs / 1000));

      timeLeftRef.current = secondsLeft;
      setTimeLeft(secondsLeft);

      if (remainingMs <= 0) {
        clearInterval(timer);
        const isHost = Boolean(roomRef.current?.isHost);
        const myFinalScore = scoreRef.current;
        const rivalFinalScore = rivalDataRef.current?.score || 0;

        const finalStartTime = startTimeRef.current || Date.now();
        const elapsedMinutes = Math.max(0.1, (Date.now() - finalStartTime) / 60000);
        const calculatedWpm = Math.round(correctKeystrokesRef.current / 5 / elapsedMinutes);
        const calculatedAcc =
          totalKeystrokesRef.current > 0
            ? Math.round((correctKeystrokesRef.current / totalKeystrokesRef.current) * 100)
            : 100;

        const myFinalStats = {
          score: myFinalScore,
          lives: livesRef.current,
          wpm: calculatedWpm,
          words: destroyedCountRef.current,
          accuracy: calculatedAcc,
          isEliminated: livesRef.current <= 0,
        };

        // Son anlık durumumuzu rakibe son kez yayınla
        if (roomRef.current) {
          roomRef.current.sendProgress(myFinalStats);
        }

        const rivalFinalStats = {
          score: rivalFinalScore,
          lives: rivalDataRef.current?.lives !== undefined ? rivalDataRef.current.lives : 3,
          wpm: rivalDataRef.current?.wpm || 0,
          words: rivalDataRef.current?.words || 0,
          accuracy: rivalDataRef.current?.accuracy || 100,
          isEliminated: Boolean(
            rivalDataRef.current?.isEliminated ||
              (rivalDataRef.current?.lives !== undefined && rivalDataRef.current.lives <= 0)
          ),
        };

        if (gameModeRef.current === '1V1') {
          if (isHost) {
            // Ev sahibi hakem olarak sonucu belirler ve yayınlar
            const hostOutcome = determineDuelOutcome(myFinalStats, rivalFinalStats);
            const winnerRole = hostOutcome === 'victory' ? 'host' : hostOutcome === 'defeat' ? 'guest' : 'draw';
            const loserRole = hostOutcome === 'victory' ? 'guest' : hostOutcome === 'defeat' ? 'host' : null;

            if (roomRef.current) {
              roomRef.current.sendMatchEnd({
                winnerRole,
                loserRole,
                reason: 'timeout',
                hostScore: myFinalStats.score,
                guestScore: rivalFinalStats.score,
                hostLives: myFinalStats.lives,
                guestLives: rivalFinalStats.lives,
                hostStats: myFinalStats,
                guestStats: rivalFinalStats,
              });
            }

            triggerGameOver(hostOutcome);
          } else {
            // Misafir tarafı: Host'un match_ended yayınlamasını bekler, 650ms içinde gelmezse kendisi sonlandırır
            const guestOutcome = determineDuelOutcome(myFinalStats, rivalFinalStats);
            const fallbackTimeout = setTimeout(() => {
              if (gameStatusRef.current === 'PLAYING') {
                triggerGameOver(guestOutcome);
              }
            }, 650);

            return () => clearTimeout(fallbackTimeout);
          }
        } else {
          // Tek kişilik oyun süresi doldu: Görev başarıyla tamamlandı!
          triggerGameOver('victory');
        }
      }
    };

    tickTimer();
    const timer = setInterval(tickTimer, 250);

    return () => clearInterval(timer);
  }, [gameMode, gameStatus]);

  // Ortak Harf İşleme Mantığı (Hem Fiziksel Klavye Hem Sanal Klavye Kullanır)
  const processKeyPress = useCallback((pressedKey) => {
    if (
      gameStatusRef.current !== 'PLAYING' ||
      isPausedRef.current ||
      !pressedKey ||
      pressedKey.length !== 1
    ) {
      return;
    }

    totalKeystrokesRef.current += 1;
    setTotalKeystrokes(totalKeystrokesRef.current);

    const currentTargets = [...targetsRef.current];
    let currentActiveId = activeTargetIdRef.current;

    // DURUM 1: HALİHAZIRDA BİR KELİMEYE KİLİTLİYSEK
    if (currentActiveId !== null) {
      const targetIndex = currentTargets.findIndex((t) => t.id === currentActiveId);
      if (targetIndex !== -1) {
        const target = currentTargets[targetIndex];
        const expectedChar = target.word[target.typedIndex];
        const isCityMode = gameMapRef.current === 'CITY';
        const isWoodMode = gameMapRef.current === 'WOOD';
        const isGardenMode = gameMapRef.current === 'GARDEN';
        const isKitchenMode = gameMapRef.current === 'KITCHEN';
        const isFootballMode = gameMapRef.current === 'FOOTBALL';

        if (isTurkishCharMatch(pressedKey, expectedChar)) {
          correctKeystrokesRef.current += 1;
          setCorrectKeystrokes(correctKeystrokesRef.current);

          if (isCityMode) {
            playTypeTick();
          } else if (isFootballMode) {
            playBallKickSound(false);
            setBallKickTrigger((k) => k + 1);
          } else if (isKitchenMode) {
            playKnifeChopSound();
            setKitchenChopTrigger((k) => k + 1);
          } else if (isGardenMode) {
            playWaterDropSound();
            setWaterTrigger((w) => w + 1);
          } else if (isWoodMode) {
            playWoodChopSound();
            setChopTrigger((c) => c + 1);
          } else {
            playTypeTick();
            setIsShooting(true);
            setTimeout(() => setIsShooting(false), 90);

            const newProjectile = {
              id: `proj-${Date.now()}-${Math.random()}`,
              startX: 50,
              startY: 92,
              targetX: target.x,
              targetY: Math.max(8, target.y + 3),
            };
            setProjectiles((prev) => [...prev, newProjectile]);
          }

          const nextTypedIndex = target.typedIndex + 1;
          const newScore = scoreRef.current + 10;
          scoreRef.current = newScore;
          setScore(newScore);

          // Kelime TAMAMLANDI MI?
          if (nextTypedIndex >= target.word.length) {
            const bonusScore = newScore + 50;
            scoreRef.current = bonusScore;
            setScore(bonusScore);

            destroyedCountRef.current += 1;
            setDestroyedCount(destroyedCountRef.current);

            if (isCityMode) {
              triggerCityBuild(target);
            } else if (isFootballMode) {
              triggerFootballShot(target, prngRef.current);
            } else if (isKitchenMode) {
              triggerKitchenSlice(target);
            } else if (isGardenMode) {
              playFlowerBloomSound();
              const bloomingTarget = { ...target };
              setBloomingTargets((prev) => [...prev, bloomingTarget]);
              setTimeout(() => {
                setBloomingTargets((prev) => prev.filter((b) => b.id !== bloomingTarget.id));
              }, 750);
            } else if (isWoodMode) {
              playWoodBreakSound();
              const breakingTarget = { ...target };
              setBreakingTargets((prev) => [...prev, breakingTarget]);
              setTimeout(() => {
                setBreakingTargets((prev) => prev.filter((b) => b.id !== breakingTarget.id));
              }, 520);
            } else {
              playDestroySound();
            }

            const updatedTargets = currentTargets.filter((t) => t.id !== currentActiveId);
            setActiveTargetId(null);
            activeTargetIdRef.current = null;
            setTargets(updatedTargets);
            targetsRef.current = updatedTargets;

            broadcastMyProgress(bonusScore, livesRef.current);
          } else {
            const updatedTarget = {
              ...target,
              typedIndex: nextTypedIndex,
              lifeSpent: (isGardenMode || isFootballMode || isCityMode) ? 0 : target.lifeSpent,
            };
            currentTargets[targetIndex] = updatedTarget;
            setTargets(currentTargets);
            targetsRef.current = currentTargets;
            broadcastMyProgress(newScore, livesRef.current);
          }
        } else {
          playWrongKeySound();
          const penalizedScore = Math.max(0, scoreRef.current - 2);
          scoreRef.current = penalizedScore;
          setScore(penalizedScore);
          broadcastMyProgress(penalizedScore, livesRef.current);
        }
        return;
      }
    }

    // DURUM 2: KİLİTLİ HEDEF YOKSA
    // 1. Önce ekranda daha önce harfi yazılmış (typedIndex > 0) ama odak kaybedilmiş bir hedef var mı?
    const resumedTarget = currentTargets.find(
      (t) => t.typedIndex > 0 && isTurkishCharMatch(pressedKey, t.word[t.typedIndex])
    );

    let chosenTarget = null;
    if (resumedTarget) {
      chosenTarget = resumedTarget;
    } else {
      const matchingTargets = currentTargets.filter(
        (t) => t.typedIndex === 0 && isTurkishCharMatch(pressedKey, t.word[0])
      );

      if (matchingTargets.length > 0) {
        if (gameMapRef.current === 'GARDEN') {
          // Bahçe modunda: Sürahinin odaklandığı en yaşlı hedef eşleşiyorsa KESİNLİKLE onu seç!
          const oldestTarget = [...currentTargets].sort((a, b) => (b.lifeSpent || 0) - (a.lifeSpent || 0))[0];
          const canTargetMatch = matchingTargets.find((t) => oldestTarget && t.id === oldestTarget.id);
          if (canTargetMatch) {
            chosenTarget = canTargetMatch;
          } else {
            // Değilse en çok sulanmaya ihtiyacı olan çiçeği seç
            matchingTargets.sort((a, b) => (b.lifeSpent || 0) - (a.lifeSpent || 0));
            chosenTarget = matchingTargets[0];
          }
        } else if (gameMapRef.current === 'FOOTBALL') {
          // Futbol modunda: süresi en çok tükenmiş topu seç
          matchingTargets.sort((a, b) => (b.lifeSpent || 0) - (a.lifeSpent || 0));
          chosenTarget = matchingTargets[0];
        } else {
          // Düşen hedeflerde en aşağıdaki tehlikeli olanı seç
          matchingTargets.sort((a, b) => Number(b.y) - Number(a.y));
          chosenTarget = matchingTargets[0];
        }
      }
    }

    if (chosenTarget) {
      const chosenId = chosenTarget.id;
      const isCityMode = gameMapRef.current === 'CITY';
      const isWoodMode = gameMapRef.current === 'WOOD';
      const isGardenMode = gameMapRef.current === 'GARDEN';
      const isKitchenMode = gameMapRef.current === 'KITCHEN';
      const isFootballMode = gameMapRef.current === 'FOOTBALL';

      setActiveTargetId(chosenId);
      activeTargetIdRef.current = chosenId;

      const dx = chosenTarget.x - 50;
      const dy = Math.max(8, 92 - chosenTarget.y);
      const calcAngle = Math.atan2(dx, dy) * (180 / Math.PI);
      setAimAngle(Math.max(-65, Math.min(65, calcAngle)));

      correctKeystrokesRef.current += 1;
      setCorrectKeystrokes(correctKeystrokesRef.current);

      if (isCityMode) {
        playTypeTick();
      } else if (isFootballMode) {
        playBallKickSound(false);
        setBallKickTrigger((k) => k + 1);
      } else if (isKitchenMode) {
        playKnifeChopSound();
        setKitchenChopTrigger((k) => k + 1);
      } else if (isGardenMode) {
        playWaterDropSound();
        setWaterTrigger((w) => w + 1);
      } else if (isWoodMode) {
        playWoodChopSound();
        setChopTrigger((c) => c + 1);
      } else {
        setIsShooting(true);
        setTimeout(() => setIsShooting(false), 90);
        playTypeTick();

        const newProjectile = {
          id: `proj-${Date.now()}-${Math.random()}`,
          startX: 50,
          startY: 92,
          targetX: chosenTarget.x,
          targetY: Math.max(8, chosenTarget.y + 3),
        };
        setProjectiles((prev) => [...prev, newProjectile]);
      }

      const currentIdx = chosenTarget.typedIndex || 0;
      const nextTypedIndex = currentIdx + 1;
      const newScore = scoreRef.current + 10;
      scoreRef.current = newScore;
      setScore(newScore);

      if (nextTypedIndex >= chosenTarget.word.length) {
        const bonusScore = newScore + 50;
        scoreRef.current = bonusScore;
        setScore(bonusScore);
        destroyedCountRef.current += 1;
        setDestroyedCount(destroyedCountRef.current);

        if (isCityMode) {
          triggerCityBuild(chosenTarget);
        } else if (isFootballMode) {
          triggerFootballShot(chosenTarget, prngRef.current);
        } else if (isKitchenMode) {
          triggerKitchenSlice(chosenTarget);
        } else if (isGardenMode) {
          playFlowerBloomSound();
          const bloomingTarget = { ...chosenTarget };
          setBloomingTargets((prev) => [...prev, bloomingTarget]);
          setTimeout(() => {
            setBloomingTargets((prev) => prev.filter((b) => b.id !== bloomingTarget.id));
          }, 750);
        } else if (isWoodMode) {
          playWoodBreakSound();
          const breakingTarget = { ...chosenTarget };
          setBreakingTargets((prev) => [...prev, breakingTarget]);
          setTimeout(() => {
            setBreakingTargets((prev) => prev.filter((b) => b.id !== breakingTarget.id));
          }, 520);
        } else {
          playDestroySound();
        }

        const updatedTargets = currentTargets.filter((t) => t.id !== chosenId);
        setActiveTargetId(null);
        activeTargetIdRef.current = null;
        setTargets(updatedTargets);
        targetsRef.current = updatedTargets;

        broadcastMyProgress(bonusScore, livesRef.current);
      } else {
        const targetIndex = currentTargets.findIndex((t) => t.id === chosenId);
        if (targetIndex !== -1) {
          currentTargets[targetIndex] = {
            ...chosenTarget,
            typedIndex: nextTypedIndex,
            lifeSpent: (isGardenMode || isFootballMode || isCityMode) ? 0 : chosenTarget.lifeSpent,
          };
          setTargets(currentTargets);
          targetsRef.current = currentTargets;
          broadcastMyProgress(newScore, livesRef.current);
        }
      }
    } else {
      playWrongKeySound();
      const penalizedScore = Math.max(0, scoreRef.current - 2);
      scoreRef.current = penalizedScore;
      setScore(penalizedScore);
      broadcastMyProgress(penalizedScore, livesRef.current);
    }
  }, []);

  // Klavye olayları
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && gameStatusRef.current === 'PLAYING') {
        togglePause();
        return;
      }

      if (e.key === 'Enter' && gameStatusRef.current === 'MENU') {
        startGameWithDiff('medium');
        return;
      }

      if (e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }

      processKeyPress(e.key);
    };

    const handleResize = () => {
      setIsMobileDevice(
        window.innerWidth <= 768 ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [togglePause, processKeyPress]);

  // Ortak Fizik Adımı (Hem Aktif rAF Hem Arka Plan İnterval Kullanır)
  const runPhysicsTick = useCallback((deltaTime, timeNow) => {
    if (gameStatusRef.current !== 'PLAYING' || isPausedRef.current) return;

    const speedMult = speedMultRef.current;
    const isCityMode = gameMapRef.current === 'CITY';
    const isGardenMode = gameMapRef.current === 'GARDEN';
    const isFootballMode = gameMapRef.current === 'FOOTBALL';

    let currentList;
    if (isGardenMode || isFootballMode || isCityMode) {
      currentList = targetsRef.current.map((target) => ({
        ...target,
        // Aktif yazılmakta olan hedef üzerinde çalışıldığı için ömrü donar / taze kalır
        lifeSpent: target.id === activeTargetIdRef.current ? 0 : (target.lifeSpent || 0) + deltaTime * speedMult,
      }));

      const MAX_LIFESPAN = isCityMode ? 28 : isFootballMode ? 16 : 18;
      // Aktif olarak yazılmakta olan hedef ASLA kaybolmaz!
      const expiredTargets = currentList.filter(
        (t) => t.id !== activeTargetIdRef.current && t.lifeSpent >= MAX_LIFESPAN
      );
      if (expiredTargets.length > 0) {
        const nextLives = Math.max(0, livesRef.current - expiredTargets.length);
        setLives(nextLives);
        livesRef.current = nextLives;

        playDamageSound();
        broadcastMyProgress(scoreRef.current, nextLives);

        if (nextLives <= 0) {
          triggerGameOver('defeat');
        }

        currentList = currentList.filter((t) => t.lifeSpent < MAX_LIFESPAN);
      }
    } else {
      currentList = targetsRef.current.map((target) => ({
        ...target,
        y: target.y + target.speed * deltaTime * speedMult,
      }));

      const activeDangerLimit = isMobileDevice ? DANGER_LIMIT_MOBILE : DANGER_LIMIT_DESKTOP;
      const escapedTargets = currentList.filter((t) => t.y >= activeDangerLimit);
      if (escapedTargets.length > 0) {
        const nextLives = Math.max(0, livesRef.current - escapedTargets.length);
        setLives(nextLives);
        livesRef.current = nextLives;

        playDamageSound();
        broadcastMyProgress(scoreRef.current, nextLives);

        if (escapedTargets.some((t) => t.id === activeTargetIdRef.current)) {
          setActiveTargetId(null);
          activeTargetIdRef.current = null;
        }

        if (nextLives <= 0) {
          triggerGameOver('defeat');
        }

        currentList = currentList.filter((t) => t.y < activeDangerLimit);
      }
    }

    const config = DIFFICULTY_CONFIG[selectedDiffRef.current] || DIFFICULTY_CONFIG.medium;
    const isMobileNow = typeof window !== 'undefined' && window.innerWidth <= 768;
    const effectiveMaxTargets = isCityMode
      ? (isMobileNow ? 1 : 2)
      : isFootballMode
      ? (isMobileNow ? 2 : 3)
      : isMobileNow
      ? Math.min(2, config.maxTargets)
      : config.maxTargets;
    const adjustedInterval = (config.spawnInterval / speedMult) * (isMobileNow ? 1.15 : 1);
    const minTargetsNeeded = (isGardenMode || isFootballMode || isCityMode) ? (isMobileNow ? 1 : 2) : 1;
    const needsImmediateSpawn = currentList.length < minTargetsNeeded;
    const nowPerf = timeNow || performance.now();

    if (isCityMode && isCityDemolishingRef.current) {
      setTargets(currentList);
      targetsRef.current = currentList;
      return;
    }

    if (
      needsImmediateSpawn ||
      (currentList.length < effectiveMaxTargets && nowPerf - lastSpawnTimeRef.current > adjustedInterval)
    ) {
      const newTarget = createTarget(currentList);
      currentList.push(newTarget);
      lastSpawnTimeRef.current = nowPerf;
    }

    setTargets(currentList);
    targetsRef.current = currentList;
  }, [createTarget, isMobileDevice]);

  // Ana Oyun Döngüsü (rAF - Sekme Aktifken 60fps)
  useEffect(() => {
    const loop = (time) => {
      if (lastTimeRef.current === null) lastTimeRef.current = time;

      const deltaTime = Math.min(0.2, (time - lastTimeRef.current) / 1000);
      lastTimeRef.current = time;
      lastActiveTimestampRef.current = Date.now();

      runPhysicsTick(deltaTime, time);
      reqIdRef.current = requestAnimationFrame(loop);
    };

    reqIdRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqIdRef.current) cancelAnimationFrame(reqIdRef.current);
    };
  }, [runPhysicsTick]);

  // Arka Plan / İnaktif Sekme Zamanlayıcısı ve 1V1 Gerçek Zamanlı Denetçi (Watchdog)
  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;

    lastActiveTimestampRef.current = Date.now();

    const bgInterval = setInterval(() => {
      if (gameStatusRef.current !== 'PLAYING') return;

      const now = Date.now();
      const elapsedSinceLastActive = (now - lastActiveTimestampRef.current) / 1000;

      // 1. Eğer sekme arka plandaysa (rAF durduğu için 350ms'den uzun süredir çağrılmadıysa):
      if (elapsedSinceLastActive > 0.35) {
        lastActiveTimestampRef.current = now;
        runPhysicsTick(elapsedSinceLastActive, performance.now());
      }

      // 2. 1V1 MAÇ DENETÇİSİ (Gerçek Zamanlı Can & Elenme Takibi):
      if (gameModeRef.current === '1V1') {
        // Eğer rakibin canı 0'a indiyse veya elendiyse ve biz hayattaysak zafer
        if (
          rivalDataRef.current &&
          (rivalDataRef.current.lives <= 0 || rivalDataRef.current.isEliminated) &&
          livesRef.current > 0
        ) {
          triggerGameOver('victory');
        } else if (livesRef.current <= 0) {
          triggerGameOver('defeat');
        }
      }
    }, 200);

    // Sekme görünür olduğunda anında aradaki farkı işle
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameStatusRef.current === 'PLAYING') {
        const now = Date.now();
        const elapsed = (now - lastActiveTimestampRef.current) / 1000;
        if (elapsed > 0.3) {
          lastActiveTimestampRef.current = now;
          runPhysicsTick(elapsed, performance.now());
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(bgInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameStatus, runPhysicsTick]);

  // Ana Menüye Dönüş
  const handleBackToMainMenu = () => {
    botInfoRef.current = null;
    if (multiplayerRoom) {
      multiplayerRoom.leave();
      setMultiplayerRoom(null);
      roomRef.current = null;
    }
    setGameMode('SINGLE');
    gameModeRef.current = 'SINGLE';
    setActiveCommunityChallenge(null);
    activeCommunityChallengeRef.current = null;
    setGameMap('CLASSIC');
    gameMapRef.current = 'CLASSIC';
    prngRef.current = Math.random;
    setGameStatus('MENU');
    setTimeLeft(null);

    // URL parametresini temizle
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <div
      className={`game-container ${
        gameStatus === 'PLAYING' && gameMap === 'GARDEN'
          ? 'garden-mode'
          : gameStatus === 'PLAYING' && gameMap === 'KITCHEN'
          ? 'kitchen-mode'
          : gameStatus === 'PLAYING' && gameMap === 'FOOTBALL'
          ? 'football-mode'
          : gameStatus === 'PLAYING' && gameMap === 'CITY'
          ? 'city-mode'
          : ''
      }`}
    >
      {/* Oyun Alanı, Başlık ve Taret (Yalnızca PLAYING durumunda) */}
      {gameStatus === 'PLAYING' && (
        <>
          <GameHeader
            score={score}
            lives={lives}
            isPaused={isPaused}
            speedLabel={SPEED_LEVELS[speedIndex].label}
            onPause={togglePause}
            onSpeedDown={speedDown}
            onSpeedUp={speedUp}
            isMultiplayer={gameMode === '1V1'}
            timeLeft={timeLeft}
            rivalData={rivalData}
            myName={getCurrentPlayerName()}
          />

          <GameArea
            targets={targets}
            activeTargetId={activeTargetId}
            projectiles={projectiles}
            onProjectileComplete={handleProjectileComplete}
            bgTheme={bgTheme}
            gameMode={gameMode}
            gameMap={gameMap}
            chopTrigger={chopTrigger}
            waterTrigger={waterTrigger}
            kitchenChopTrigger={kitchenChopTrigger}
            ballKickTrigger={ballKickTrigger}
            shootingBalls={shootingBalls}
            goalCelebrations={goalCelebrations}
            goalsScored={goalsScored}
            breakingTargets={breakingTargets}
            bloomingTargets={bloomingTargets}
            slicingTargets={slicingTargets}
            kitchenPizzaCount={kitchenPizzaCount}
            kitchenIngredientCount={kitchenIngredientCount}
            pizzaBounceTrigger={pizzaBounceTrigger}
            pizzaCompleteBurst={pizzaCompleteBurst}
            isPizzaLaunching={isPizzaLaunching}
            isOvenGlowing={isOvenGlowing}
            isNewPizzaArriving={isNewPizzaArriving}
            citySlots={citySlots}
            cityPopulation={cityPopulation}
            cityStage={cityStage}
            completedBuildingCount={completedBuildingCount}
            recentBuildEffect={recentBuildEffect}
            stageUpgradeNotice={stageUpgradeNotice}
          />

          {gameMap !== 'WOOD' && gameMap !== 'GARDEN' && gameMap !== 'KITCHEN' && gameMap !== 'FOOTBALL' && gameMap !== 'CITY' && (
            <Player aimAngle={aimAngle} isShooting={isShooting} />
          )}

          {/* Mobil Cihazlar İçin Dokunmatik Türkçe Q Sanal Klavye */}
          {isMobileDevice && (
            <VirtualKeyboard
              isVisible={showVirtualKeyboard}
              onToggleVisibility={() => setShowVirtualKeyboard((v) => !v)}
              onKeyPress={processKeyPress}
            />
          )}
        </>
      )}

      {/* Pause Ekranı */}
      {isPaused && gameStatus === 'PLAYING' && (
        <div className="pause-overlay">
          <h2 className="pause-title">DURAKLATILDI</h2>
          <div className="pause-actions">
            <button className="btn-primary" onClick={togglePause}>Devam Et</button>
            <button className="btn-secondary" onClick={() => { setIsPaused(false); handleBackToMainMenu(); }}>Ana Menü</button>
          </div>
        </div>
      )}

      {/* Ana Menü */}
      {gameStatus === 'MENU' && (
        <MainMenu
          onStartWithDifficulty={(diff, mode, duration) => {
            const targetMap =
              mode === 'WOOD'
                ? 'WOOD'
                : mode === 'GARDEN'
                ? 'GARDEN'
                : mode === 'KITCHEN'
                ? 'KITCHEN'
                : mode === 'FOOTBALL'
                ? 'FOOTBALL'
                : mode === 'CITY'
                ? 'CITY'
                : 'CLASSIC';
            startGameWithDiff(diff, 'SINGLE', targetMap, duration);
          }}
          onOpenMultiplayer={(prefMap) => {
            setPreferredLobbyMap(prefMap || 'WOOD');
            setLobbyAutoCreateData(null);
            setLobbyAutoJoinCode(null);
            setGameStatus('LOBBY');
          }}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
          onStartCommunityChallenge={handleStartCommunityChallenge}
          onJoinCommunityChallenge={handleJoinCommunityChallengeRoom}
          onCreateCommunityChallenge={handleCreateCommunityChallengeRoom}
          highScore={highScore}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Multiplayer Lobisi */}
      {gameStatus === 'LOBBY' && (
        <MultiplayerLobby
          initialMap={preferredLobbyMap}
          initialRoomCode={lobbyAutoJoinCode}
          autoCreateData={lobbyAutoCreateData}
          existingRoom={multiplayerRoom}
          onBackToMenu={() => {
            setLobbyAutoCreateData(null);
            setLobbyAutoJoinCode(null);
            if (multiplayerRoom) {
              multiplayerRoom.leave();
              setMultiplayerRoom(null);
              roomRef.current = null;
            }
            handleBackToMainMenu();
          }}
          onStartMultiplayerGame={handleStartMultiplayer}
          onChallengeRegistered={(ch) => {
            setActiveCommunityChallenge(ch);
            activeCommunityChallengeRef.current = ch;
          }}
        />
      )}

      {/* Game Over Ekranı */}
      {gameStatus === 'GAMEOVER' && (
        <GameOver
          score={score}
          lives={livesRef.current}
          destroyedCount={destroyedCount}
          wpm={wpm}
          accuracy={accuracy}
          difficulty={selectedDifficulty}
          isNewHighScore={isNewHighScore}
          isMultiplayer={gameMode === '1V1'}
          communityChallenge={activeCommunityChallenge}
          roomType={multiplayerRoomType}
          rankings={finalRankings}
          participantsList={participantsList}
          matchResult={matchResult}
          rivalName={rivalData?.name || 'Rakip'}
          rivalStats={rivalData}
          onRestart={() => {
            if (activeCommunityChallenge) {
              handleStartCommunityChallenge(activeCommunityChallenge);
            } else if (gameMode === '1V1') {
              if (multiplayerRoom) {
                multiplayerRoom.resetForRematch();
              }
              setGameStatus('LOBBY');
            } else {
              startGameWithDiff(selectedDifficulty, 'SINGLE', gameMap);
            }
          }}
          onMainMenu={handleBackToMainMenu}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {/* Liderlik Tablosu Modalı */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />
    </div>
  );
}
