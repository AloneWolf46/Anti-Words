import { useState, useRef, useCallback } from 'react';
import { CITY_BUILDING_STAGES } from '../components/CityIslandArea';
import { playConstructionHammerSound, playCityUpgradeFanfare } from '../utils/sounds';

/**
 * Şehir Mimarı Modu State ve İnşaat Mekanik Hook'u
 */
export function useCityMode({
  scoreRef,
  setScore,
  livesRef,
  broadcastMyProgress,
  setTargets,
  targetsRef,
  setActiveTargetId,
  activeTargetIdRef,
  createTarget,
}) {
  const [citySlots, setCitySlots] = useState([]);
  const [cityPopulation, setCityPopulation] = useState(0);
  const [cityStage, setCityStage] = useState('VILLAGE'); // 'VILLAGE' | 'TOWN' | 'METRO' | 'COMPLETED'
  const [completedBuildingCount, setCompletedBuildingCount] = useState(0);
  const [recentBuildEffect, setRecentBuildEffect] = useState(null);
  const [stageUpgradeNotice, setStageUpgradeNotice] = useState(null);

  const citySlotsRef = useRef([]);
  const cityStageRef = useRef('VILLAGE');
  const completedBuildingCountRef = useRef(0);
  const cityPopulationRef = useRef(0);
  const citySlotWordsRef = useRef({});
  const isCityDemolishingRef = useRef(false);

  const resetCityMode = useCallback(() => {
    setCitySlots([]);
    citySlotsRef.current = [];
    setCityPopulation(0);
    cityPopulationRef.current = 0;
    setCityStage('VILLAGE');
    cityStageRef.current = 'VILLAGE';
    setCompletedBuildingCount(0);
    completedBuildingCountRef.current = 0;
    citySlotWordsRef.current = {};
    isCityDemolishingRef.current = false;
    setRecentBuildEffect(null);
    setStageUpgradeNotice(null);
  }, []);

  const triggerCityBuild = useCallback((targetObj) => {
    playConstructionHammerSound();
    const currentStage = cityStageRef.current;
    const stageBuildings = CITY_BUILDING_STAGES[currentStage] || CITY_BUILDING_STAGES.VILLAGE;
    const buildingInfo = stageBuildings.find((b) => b.slotId === targetObj.slotId);

    if (!buildingInfo) return;

    const slotId = targetObj.slotId;
    const currentSlotWords = (citySlotWordsRef.current[slotId] || 0) + 1;
    citySlotWordsRef.current[slotId] = currentSlotWords;

    const isBuildingCompleted = currentSlotWords >= 2;

    // 1. kelime: Temel inşaatı (Bina henüz bitmedi)
    if (!isBuildingCompleted) {
      const stepBonus = 50;
      scoreRef.current += stepBonus;
      setScore(scoreRef.current);
      if (broadcastMyProgress) {
        broadcastMyProgress(scoreRef.current, livesRef.current);
      }

      setRecentBuildEffect({
        slotId: slotId,
        name: buildingInfo.name,
        stage: currentStage,
        time: Date.now(),
      });
      return;
    }

    // 2. KELİME TAMAMLANDI: BİNA ADAYA İNŞA EDİLİR!
    const nextSlots = [
      ...citySlotsRef.current.filter((s) => s.slotId !== slotId),
      {
        slotId: slotId,
        stage: currentStage,
        name: buildingInfo.name,
        img: buildingInfo.img,
        tall: buildingInfo.tall,
        monument: buildingInfo.monument,
      },
    ];

    citySlotsRef.current = nextSlots;
    setCitySlots(nextSlots);

    // Nüfusu artır (SADECE ŞEHİR NÜFUSUNA EKLENİR, OYUN SKORUNA DEĞİL!)
    const addedPop = buildingInfo.pop || 100;
    cityPopulationRef.current += addedPop;
    setCityPopulation(cityPopulationRef.current);

    // Tamamlanan bina sayısı
    const nextCount = completedBuildingCountRef.current + 1;
    completedBuildingCountRef.current = nextCount;
    setCompletedBuildingCount(nextCount);

    // Tamamlanan bina bonusu (+100 puan, dengeli ve adil skor birimi)
    const completionBonus = 100;
    scoreRef.current += completionBonus;
    setScore(scoreRef.current);
    if (broadcastMyProgress) {
      broadcastMyProgress(scoreRef.current, livesRef.current);
    }

    setRecentBuildEffect({
      slotId: slotId,
      name: buildingInfo.name,
      stage: currentStage,
      time: Date.now(),
    });

    // Aşama kontrolü: Mevcut aşamadaki tüm binaların 2 kelimesi de bitti mi?
    const currentStageSlotsDone = stageBuildings.every((b) =>
      (citySlotWordsRef.current[b.slotId] || 0) >= 2
    );

    if (currentStageSlotsDone) {
      citySlotWordsRef.current = {}; // Yeni çağ için slot sayaçlarını sıfırla

      if (currentStage === 'VILLAGE') {
        cityStageRef.current = 'TOWN';
        setCityStage('TOWN');
        setStageUpgradeNotice('🎉 TEBRİKLER! KASABA ÇAĞINA GEÇİLDİ!');
        playCityUpgradeFanfare();
        setTimeout(() => setStageUpgradeNotice(null), 3000);
      } else if (currentStage === 'TOWN') {
        cityStageRef.current = 'METRO';
        setCityStage('METRO');
        setStageUpgradeNotice('🚀 İNANILMAZ! MODERN METROPOL ÇAĞI BAŞLADI!');
        playCityUpgradeFanfare();
        setTimeout(() => setStageUpgradeNotice(null), 3000);
      } else if (currentStage === 'METRO') {
        // EN SON SEVİYEYE ULAŞILDI:
        // Gökdelenler ekranda bir bir geri yok olur ve yerine gelen kelimeler tekrardan şehri baştan oluşturur!
        isCityDemolishingRef.current = true;
        setStageUpgradeNotice('🌟 EFSANEVİ METROPOL TAMAMLANDI! YENİDEN İNŞA BAŞLIYOR...');
        playCityUpgradeFanfare();

        // Haritada asılı kalan hedefleri geçici olarak temizle
        setTargets([]);
        targetsRef.current = [];
        setActiveTargetId(null);
        activeTargetIdRef.current = null;

        // Binaların ekrandan birer birer geri yok olma sekansı
        const currentBuildings = [...citySlotsRef.current];
        currentBuildings.forEach((bld, idx) => {
          setTimeout(() => {
            citySlotsRef.current = citySlotsRef.current.map((s) =>
              s.slotId === bld.slotId ? { ...s, demolishing: true } : s
            );
            setCitySlots([...citySlotsRef.current]);

            setTimeout(() => {
              citySlotsRef.current = citySlotsRef.current.filter((s) => s.slotId !== bld.slotId);
              setCitySlots([...citySlotsRef.current]);
            }, 380);
          }, idx * 260);
        });

        // Tüm binalar yok olduktan sonra sıfırdan köy aşamasından yeniden inşa başlar
        const totalVanishTime = currentBuildings.length * 260 + 500;
        setTimeout(() => {
          citySlotsRef.current = [];
          setCitySlots([]);
          citySlotWordsRef.current = {};
          cityStageRef.current = 'VILLAGE';
          setCityStage('VILLAGE');
          isCityDemolishingRef.current = false;

          setStageUpgradeNotice('🌱 YENİ DÖNGÜ: KÖYDEN BAŞLAYARAK YENİDEN İNŞA ET!');
          setTimeout(() => setStageUpgradeNotice(null), 3000);

          // Hemen yeni aşamanın ilk hedeflerini üret
          const isMobileNow = typeof window !== 'undefined' && window.innerWidth <= 768;
          const freshTargets = [];
          const count = isMobileNow ? 1 : 2;
          for (let i = 0; i < count; i++) {
            freshTargets.push(createTarget(freshTargets));
          }
          setTargets(freshTargets);
          targetsRef.current = freshTargets;
        }, totalVanishTime);
      }
    }
  }, [
    createTarget,
    scoreRef,
    setScore,
    livesRef,
    broadcastMyProgress,
    setTargets,
    targetsRef,
    setActiveTargetId,
    activeTargetIdRef,
  ]);

  return {
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
  };
}
