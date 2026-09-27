import React, { useEffect, useState } from 'react';

// Ada üzerindeki 7 parselin izometrik yüzde koordinatları ve derinlikleri (z-index)
export const CITY_PARCEL_SLOTS = [
  {
    id: 0,
    name: 'Kuzeybatı Parseli',
    x: 25.0,
    y: 34.0,
    baseWidth: 9.5,
    zIndex: 12,
  },
  {
    id: 1,
    name: 'Kuzey Merkez Parseli',
    x: 50.5,
    y: 36.5,
    baseWidth: 10.0,
    zIndex: 14,
  },
  {
    id: 2,
    name: 'Kuzeydoğu Parseli',
    x: 66.5,
    y: 24.5,
    baseWidth: 9.5,
    zIndex: 10,
  },
  {
    id: 3,
    name: 'Güneybatı Parseli',
    x: 37.0,
    y: 55.0,
    baseWidth: 11.5,
    zIndex: 22,
  },
  {
    id: 4,
    name: 'Güney Merkez Parseli',
    x: 57.0,
    y: 73.0,
    baseWidth: 12.0,
    zIndex: 26,
  },
  {
    id: 5,
    name: 'Güneydoğu Parseli',
    x: 71.5,
    y: 52.0,
    baseWidth: 11.0,
    zIndex: 20,
  },
  {
    id: 6,
    name: 'Ada Zirve Platosu (Anıt)',
    x: 32.5,
    y: 15.5,
    baseWidth: 9.0,
    zIndex: 8,
  },
];

const BASE = import.meta.env.BASE_URL;

// 3 Aşamanın bina bilgileri ve görsel yolları
export const CITY_BUILDING_STAGES = {
  VILLAGE: [
    { slotId: 0, name: 'Ahşap Kulübe', img: `${BASE}assets/city/village_asset_01_wood_cabin.png`, pop: 85 },
    { slotId: 1, name: 'Taş Kulübe', img: `${BASE}assets/city/village_asset_03_stone_hut.png`, pop: 110 },
    { slotId: 2, name: 'Keşif Çadırı', img: `${BASE}assets/city/village_asset_02_canvas_tent.png`, pop: 45 },
    { slotId: 3, name: 'Sazdan Köy Evi', img: `${BASE}assets/city/village_asset_05_straw_cottage.png`, pop: 95 },
    { slotId: 4, name: 'Ormancı Kulübesi', img: `${BASE}assets/city/village_asset_01_wood_cabin.png`, pop: 80 },
    { slotId: 5, name: 'Balıkçı Barınağı', img: `${BASE}assets/city/village_asset_03_stone_hut.png`, pop: 120 },
  ],
  TOWN: [
    { slotId: 0, name: 'Taş Fırın & Pastane', img: `${BASE}assets/city/town_asset_02_bakery.png`, pop: 650 },
    { slotId: 1, name: 'Merkez Şehir Kafe', img: `${BASE}assets/city/town_asset_04_cafe.png`, pop: 580 },
    { slotId: 2, name: 'Kasaba Marketi', img: `${BASE}assets/city/town_asset_03_grocery_store.png`, pop: 720 },
    { slotId: 3, name: 'Müstakil Villa', img: `${BASE}assets/city/town_asset_01_suburban_house.png`, pop: 850 },
    { slotId: 4, name: 'Belediye Konağı', img: `${BASE}assets/city/town_asset_05_town_hall.png`, pop: 1200 },
    { slotId: 5, name: 'Halk Kütüphanesi', img: `${BASE}assets/city/city_slot_asset_04_library.png`, pop: 950 },
  ],
  METRO: [
    { slotId: 0, name: 'Cam Gökdelen', img: `${BASE}assets/city/metro_asset_01_glass_skyscraper.png`, pop: 4500, tall: true },
    { slotId: 1, name: 'Gümüş Finans Plazası', img: `${BASE}assets/city/metro_asset_02_silver_plaza.png`, pop: 5200, tall: true },
    { slotId: 2, name: 'İkiz Plazalar', img: `${BASE}assets/city/metro_asset_05_twin_plaza.png`, pop: 6800, tall: true },
    { slotId: 3, name: 'Metropol Gözlem Kulesi', img: `${BASE}assets/city/city_slot_asset_05_city_tower.png`, pop: 4200, tall: true },
    { slotId: 4, name: 'Modern AVM Plazası', img: `${BASE}assets/city/city_slot_asset_01_market.png`, pop: 5500 },
    { slotId: 5, name: 'Lüks Rezidans', img: `${BASE}assets/city/city_slot_asset_03_apartment.png`, pop: 4800 },
    { slotId: 6, name: 'Kristal Ada Anıtı', img: `${BASE}assets/city/metro_asset_04_monument.png`, pop: 10000, monument: true },
  ],
};

export default function CityIslandArea({
  targets = [],
  activeTargetId = null,
  citySlots = [], // Her slotun mevcut binası [{ slotId, stage, name, img, level }]
  cityPopulation = 0,
  cityStage = 'VILLAGE', // 'VILLAGE' | 'TOWN' | 'METRO' | 'COMPLETED'
  completedBuildingCount = 0,
  recentBuildEffect = null, // { slotId, name, stage, time }
  stageUpgradeNotice = null, // 'Kasaba Seviyesine Ulaşıldı!'
}) {
  return (
    <div className="city-island-canvas-wrapper">
      {/* ANA ADA VİEWPORT VE İZOMETRİK PARSELLER */}
      <div className="city-island-viewport">
        <div className="city-island-scene">
          {/* 4K İzometrik Zemin Adası */}
          <img
            src={`${BASE}assets/city/city_building_ground_island_4k.png`}
            alt="Kelime Adası Zemini"
            className="city-ground-island-img"
            draggable={false}
          />

          {/* 7 Adet Parsel ve Binaları */}
          {CITY_PARCEL_SLOTS.map((slot) => {
            const slotData = citySlots.find((s) => s.slotId === slot.id);
            const activeTarget = targets.find((t) => t.slotId === slot.id);
            const isTargeted = activeTarget && activeTarget.id === activeTargetId;

            return (
              <div
                key={slot.id}
                className={`city-parcel-container ${activeTarget ? 'has-active-target' : ''} ${isTargeted ? 'is-currently-typing' : ''}`}
                style={{
                  left: `${slot.x}%`,
                  top: `${slot.y}%`,
                  width: `${slot.baseWidth}%`,
                  zIndex: isTargeted ? 160 : (activeTarget ? 130 : slot.zIndex),
                }}
              >
                {/* Boş Arsa Taban Halkası */}
                {!slotData && (
                  <div className={`empty-plot-foundation ${activeTarget ? 'active-blueprint' : ''}`}>
                    <span className="plot-marker-text">
                      {slot.id === 6 ? '🏛️ ANIT ALANI' : `ARSA #${slot.id + 1}`}
                    </span>
                  </div>
                )}

                {/* İnşa Edilmiş Bina Görseli */}
                {slotData && slotData.img && (
                  <div
                    className={`building-graphic-box ${slotData.tall ? 'tall-skyscraper' : ''} ${slotData.monument ? 'grand-monument' : ''} ${recentBuildEffect?.slotId === slot.id ? 'just-built-bounce' : ''} ${slotData.demolishing ? 'demolish-vanish' : ''}`}
                  >
                    <img
                      src={slotData.img}
                      alt={slotData.name}
                      className="building-rendered-img"
                      draggable={false}
                    />
                  </div>
                )}

                {/* Parsel Üstünde Asılı Sade Şantiye Kelime Kartı */}
                {activeTarget && (() => {
                  const typedLen = activeTarget.typedIndex || 0;
                  const typedPart = activeTarget.word.slice(0, typedLen);
                  const activeChar = isTargeted ? (activeTarget.word[typedLen] || '') : '';
                  const remainingPart = isTargeted
                    ? activeTarget.word.slice(typedLen + 1)
                    : activeTarget.word.slice(typedLen);

                  return (
                    <div className={`construction-blueprint-card ${isTargeted ? 'is-targeted-card' : ''}`}>
                      <div className={`blueprint-word-box ${isTargeted ? 'active-target-word' : 'idle-target-word'}`}>
                        {typedPart && <span className="word-typed-faded">{typedPart}</span>}
                        {isTargeted && activeChar && <span className="word-active-char">{activeChar}</span>}
                        <span className="word-untyped-bright">{remainingPart}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
