import React from 'react';
import FallingWord from './FallingWord';
import FallingLog from './FallingLog';
import GrowingPlant from './GrowingPlant';
import FallingFood, { getFoodTypeForWord } from './FallingFood';
import ChefKnife from './ChefKnife';
import Projectile from './Projectile';
import AxeWeapon from './AxeWeapon';
import FootballBall from './FootballBall';
import CityIslandArea from './CityIslandArea';

export default function GameArea({
  targets,
  activeTargetId,
  projectiles = [],
  onProjectileComplete,
  gameMode = 'SINGLE',
  gameMap = 'CLASSIC',
  chopTrigger = 0,
  waterTrigger = 0,
  kitchenChopTrigger = 0,
  ballKickTrigger = 0,
  shootingBalls = [],
  goalCelebrations = [],
  goalsScored = 0,
  breakingTargets = [],
  bloomingTargets = [],
  slicingTargets = [],
  kitchenPizzaCount = 0,
  kitchenIngredientCount = 0,
  pizzaBounceTrigger = 0,
  pizzaCompleteBurst = false,
  isPizzaLaunching = false,
  isOvenGlowing = false,
  isNewPizzaArriving = false,
  // Şehir Mimarı Modu Prop'ları
  citySlots = [],
  cityPopulation = 0,
  cityStage = 'VILLAGE',
  completedBuildingCount = 0,
  recentBuildEffect = null,
  stageUpgradeNotice = null,
}) {
  const isCityMode = gameMap === 'CITY';
  const isWoodMode = gameMap === 'WOOD';
  const isGardenMode = gameMap === 'GARDEN';
  const isKitchenMode = gameMap === 'KITCHEN';
  const isFootballMode = gameMap === 'FOOTBALL';

  if (isCityMode) {
    return (
      <main className="modern-game-area city-island-game-area">
        <CityIslandArea
          targets={targets}
          activeTargetId={activeTargetId}
          citySlots={citySlots}
          cityPopulation={cityPopulation}
          cityStage={cityStage}
          completedBuildingCount={completedBuildingCount}
          recentBuildEffect={recentBuildEffect}
          stageUpgradeNotice={stageUpgradeNotice}
        />
      </main>
    );
  }

  // Odun modunda balta hedefi: aktif hedef varsa onda, yoksa en aşağıdaki (en tehlikeli) kütükte hazır bekler
  const axeTargetId = activeTargetId || (targets.length > 0 ? [...targets].sort((a, b) => b.y - a.y)[0]?.id : null);

  // Mutfak modunda şef bıçağı hedefi: aktif hedef varsa onda, yoksa en tehlikeli malzemede bekler
  const currentKitchenTarget =
    targets.find((t) => t.id === activeTargetId) ||
    (targets.length > 0 ? [...targets].sort((a, b) => b.y - a.y)[0] : null);

  // Bahçe modunda suluk hedefi: aktif hedef varsa onda, yoksa en yaşlı/sulanmayı bekleyen tohumda hazır bekler
  const currentCanTarget =
    targets.find((t) => t.id === activeTargetId) ||
    (targets.length > 0 ? [...targets].sort((a, b) => (b.lifeSpent || 0) - (a.lifeSpent || 0))[0] : null);
  const wateringCanTargetId = currentCanTarget ? currentCanTarget.id : null;

  const [isPouring, setIsPouring] = React.useState(false);
  const [droplets, setDroplets] = React.useState([]);

  React.useEffect(() => {
    if (!waterTrigger) return;
    setIsPouring(true);
    const timer = setTimeout(() => setIsPouring(false), 320);

    // Suluk başlığından dökülen parlak su damlacıkları
    const newDrops = Array.from({ length: 4 }).map((_, i) => ({
      id: `drop-${Date.now()}-${i}-${Math.random()}`,
      delay: i * 35,
      offsetX: (Math.random() - 0.5) * 6,
      size: Math.random() * 3 + 8,
    }));
    setDroplets((prev) => [...prev.slice(-8), ...newDrops]);

    return () => clearTimeout(timer);
  }, [waterTrigger]);

  React.useEffect(() => {
    if (droplets.length === 0) return;
    const timer = setTimeout(() => {
      setDroplets((prev) => prev.slice(4));
    }, 420);
    return () => clearTimeout(timer);
  }, [droplets]);

  return (
    <main
      className={`modern-game-area ${
        isWoodMode
          ? 'wood-cutting-area'
          : isGardenMode
          ? 'garden-growing-area'
          : isKitchenMode
          ? 'kitchen-cooking-area'
          : isFootballMode
          ? 'football-stadium-area'
          : ''
      }`}
    >
      {/* Hafif Atmosferik Sis / Doğa Güneş Işıltısı Katmanı */}
      <div
        className={`game-mist-layer ${
          isGardenMode
            ? 'garden-sunbeam-layer'
            : isKitchenMode
            ? 'kitchen-warm-glow-layer'
            : isFootballMode
            ? 'football-floodlights-layer'
            : ''
        }`}
      />

      {/* Bahçe, Mutfak, Futbol veya Siber Masa Üzerindeki Savunma Hattı Sınırı */}
      {isFootballMode ? (
        <div className="football-top-banner">
          <span className="football-badge-pill">
            ⚽ FUTBOL MODU // CEZA SAHASINDAN KALEYE ŞUT ÇEK, GOLLERİ AT!
          </span>
          {goalsScored > 0 && (
            <span className="football-goal-counter-pill">
              🏆 {goalsScored} GOL
            </span>
          )}
        </div>
      ) : isKitchenMode ? (
        <div className="modern-danger-boundary kitchen-danger-boundary">
          <div className="kitchen-board-wood-edge" />
          <span className="danger-boundary-label kitchen-label">
            🍳 ŞEF TEZGÂHI // MALZEMELERİ YERE DÜŞMEDEN DOĞRA!
          </span>
        </div>
      ) : !isGardenMode ? (
        <div className="modern-danger-boundary">
          <div className={`danger-laser-line ${isWoodMode ? 'danger-wood-line' : ''}`} />
          <span className="danger-boundary-label">
            {isWoodMode ? 'KÜTÜK SAVUNMA HATTI // MASAYA DÜŞMEDEN PARÇALA' : 'SAVUNMA HATTI // MASAYA ULAŞMADAN YAZ'}
          </span>
        </div>
      ) : (
        <div className="garden-top-banner">
          <span className="garden-badge-pill">🌸 BİTKİ BÜYÜTME MODU // DOĞRU YAZ, SU DAMLAT, ÇİÇEKLERİ AÇTIR!</span>
        </div>
      )}

      {/* Düşen / Büyüyen / Sahada Duran Hedefler */}
      {targets.map((target) => {
        if (isFootballMode) {
          return (
            <FootballBall
              key={target.id}
              word={target.word}
              typedIndex={target.typedIndex}
              positionX={target.x}
              positionY={target.y}
              isActive={target.id === activeTargetId}
              kickTrigger={target.id === activeTargetId ? ballKickTrigger : 0}
              lifeSpent={target.lifeSpent || 0}
              maxLife={target.maxLife || 18}
            />
          );
        }

        if (isGardenMode) {
          return (
            <GrowingPlant
              key={target.id}
              word={target.word}
              typedIndex={target.typedIndex}
              positionX={target.x}
              positionY={target.y}
              isActive={target.id === activeTargetId}
              hasWateringCan={target.id === wateringCanTargetId}
              isBlooming={false}
              waterTrigger={target.id === activeTargetId ? waterTrigger : 0}
            />
          );
        }

        if (isKitchenMode) {
          return (
            <FallingFood
              key={target.id}
              word={target.word}
              typedIndex={target.typedIndex}
              positionY={target.y}
              positionX={target.x}
              isActive={target.id === activeTargetId}
              foodId={target.foodId || getFoodTypeForWord(target.word, target.id).id}
            />
          );
        }

        if (isWoodMode) {
          return (
            <FallingLog
              key={target.id}
              word={target.word}
              typedIndex={target.typedIndex}
              positionY={target.y}
              positionX={target.x}
              isActive={target.id === activeTargetId}
              hasAxe={target.id === axeTargetId}
              chopTrigger={target.id === activeTargetId ? chopTrigger : 0}
            />
          );
        }

        return (
          <FallingWord
            key={target.id}
            targetId={target.id}
            word={target.word}
            typedIndex={target.typedIndex}
            positionY={target.y}
            positionX={target.x}
            isActive={target.id === activeTargetId}
            theme={target.theme}
          />
        );
      })}

      {/* Bahçe Modunda Tamamlanıp Açan Çiçekler (Bloom Animasyonu) */}
      {isGardenMode &&
        bloomingTargets.map((bTarget) => (
          <GrowingPlant
            key={bTarget.id}
            word={bTarget.word}
            typedIndex={bTarget.word.length}
            positionX={bTarget.x}
            positionY={bTarget.y}
            isActive={false}
            isBlooming={true}
          />
        ))}

      {/* Bahçe Modunda Bitkiler Arasında Süzülerek Geçen Tek Mavi Suluk */}
      {isGardenMode && currentCanTarget && (
        <div
          className={`garden-gliding-can-container ${isPouring ? 'can-pouring' : ''}`}
          style={{
            left: `${currentCanTarget.x}%`,
            top: `${currentCanTarget.y}%`,
          }}
        >
          <div className="plant-watering-can-wrap">
            <img
              src="/assets/plant/watering-can.png"
              alt="Suluk"
              className="watering-can-img"
              draggable={false}
            />

            {/* Suluk Ucundan Su Damlacıkları */}
            <div className="can-spout-droplets-emitter">
              {droplets.map((drop) => (
                <div
                  key={drop.id}
                  className="water-droplet-from-spout"
                  style={{
                    animationDelay: `${drop.delay}ms`,
                    width: `${drop.size}px`,
                    height: `${drop.size * 1.4}px`,
                    marginLeft: `${drop.offsetX}px`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Odun Modunda Parçalanmakta Olan Kütükler (Kırılma Animasyonu) */}
      {isWoodMode &&
        breakingTargets.map((bTarget) => (
          <FallingLog
            key={bTarget.id}
            word={bTarget.word}
            typedIndex={bTarget.word.length}
            positionY={bTarget.y}
            positionX={bTarget.x}
            isActive={false}
            isBreaking={true}
          />
        ))}

      {/* Mutfak Modunda Şef Bıçağı */}
      {isKitchenMode && currentKitchenTarget && (
        <ChefKnife
          targetX={currentKitchenTarget.x}
          targetY={currentKitchenTarget.y}
          chopTrigger={currentKitchenTarget.id === activeTargetId ? kitchenChopTrigger : 0}
        />
      )}

      {/* Mutfak Modunda Dilimlenen Malzemeler (Tavaya Uçma Animasyonu) */}
      {isKitchenMode &&
        slicingTargets.map((sTarget) => (
          <FallingFood
            key={`sliced-${sTarget.id}`}
            word={sTarget.word}
            typedIndex={sTarget.word.length}
            positionY={sTarget.y}
            positionX={sTarget.x}
            isActive={false}
            foodId={sTarget.foodId || getFoodTypeForWord(sTarget.word, sTarget.id).id}
            isSliced={true}
          />
        ))}

      {/* Mutfak & Pizza Modu Tezgah Üzeri Pizza Hazırlama İstasyonu */}
      {isKitchenMode && (
        <>
          {/* Fırının Ağzında Anlık Alev / Kıvılcım Parlaması */}
          {isOvenGlowing && <div className="kitchen-oven-glow-flash" />}

          <div className="kitchen-pizza-station">
            <div className="pizza-board-wrap">
              {/* Pişirme & Sıcaklık Buharı */}
              {!isPizzaLaunching && (
                <div className="pizza-steam-container">
                  <span className="pizza-steam-puff s1" />
                  <span className="pizza-steam-puff s2" />
                  <span className="pizza-steam-puff s3" />
                </div>
              )}

              {/* Dinamik Aşamalı Pizza Görseli (Boş Taban -> Yarı Malzemeli -> Tam Hazır -> Fırına Fırlama) */}
              <img
                key={`pizza-${isPizzaLaunching ? 'launch' : isNewPizzaArriving ? 'new' : kitchenIngredientCount >= 6 ? 'full' : kitchenIngredientCount >= 3 ? 'half' : 'base'}-${pizzaBounceTrigger}`}
                src={
                  isPizzaLaunching || kitchenIngredientCount >= 6
                    ? '/assets/food/pizza-full.png'
                    : kitchenIngredientCount >= 3
                    ? '/assets/food/pizza-half.png'
                    : '/assets/food/pizza-base.png'
                }
                alt="Hazırlanan Pizza"
                className={`pizza-stage-image ${
                  isPizzaLaunching
                    ? 'pizza-launch-to-oven'
                    : isNewPizzaArriving
                    ? 'pizza-new-slide-in'
                    : pizzaBounceTrigger > 0
                    ? 'pizza-drop-bounce'
                    : ''
                }`}
                draggable={false}
              />

              {/* Pizza Tamamlandığında Fırın Kutlaması & Altın Işık */}
              {pizzaCompleteBurst && !isPizzaLaunching && <div className="pizza-complete-burst" />}
            </div>

            {/* Pizza İlerleme ve Hazırlık Durumu */}
            <div className="pizza-status-badge">
              <span className="pizza-status-title">🍕 PİZZA:</span>
              <span className="pizza-status-counter">
                {isPizzaLaunching
                  ? '🚀 FIRINA GİDİYOR!'
                  : isOvenGlowing
                  ? '🔥 PİŞİYOR!'
                  : `${Math.min(kitchenIngredientCount, 8)} / 8 Malzeme`}
              </span>
              {kitchenPizzaCount > 0 && (
                <span className="pizza-total-made-pill" title="Tamamlanan Pizza Sayısı">
                  ✓ {kitchenPizzaCount} Hazır
                </span>
              )}
            </div>
          </div>
        </>
      )}

      {/* Futbol Modu: Kaleye Doğru Fırlayan Şut Topları */}
      {isFootballMode &&
        shootingBalls.map((shot) => (
          <div
            key={shot.id}
            className="shooting-ball-actor"
            style={{
              '--start-x': `${shot.startX}%`,
              '--start-y': `${shot.startY}%`,
              '--target-x': `${shot.targetX}%`,
              '--target-y': `${shot.targetY}%`,
            }}
          >
            <div className="shooting-ball-spin-wrap">
              <img
                src="/assets/football-ball.png"
                alt="Şut"
                className="shooting-ball-img"
                draggable={false}
              />
              <div className="shooting-ball-fire-trail" />
            </div>
          </div>
        ))}

      {/* Futbol Modu: Gol Anı Parıltısı ve Kutlama Balonu */}
      {isFootballMode &&
        goalCelebrations.map((goal) => (
          <div
            key={goal.id}
            className={`goal-celebration-burst ${goal.isMilestone ? 'is-milestone-goal' : 'is-normal-goal'}`}
            style={{
              left: `${goal.x}%`,
              top: `${goal.y}%`,
            }}
          >
            {goal.isMilestone && (
              <div className="goool-banner-wrap">
                <span className="goool-banner-text">{goal.milestoneText || 'GOOOL! ⚽'}</span>
                <span className="goool-bonus-text">+50 GOL BONUSU</span>
              </div>
            )}
            <div className="goal-net-impact-flash" />
            {goal.isMilestone && (
              <div className="goal-confetti-cluster">
                {Array.from({ length: 14 }).map((_, i) => (
                  <span key={i} className={`goal-sparkle-dot dot-${i}`} />
                ))}
              </div>
            )}
          </div>
        ))}

      {/* Klasik Modda Mermiler */}
      {!isWoodMode && !isGardenMode && !isKitchenMode && !isFootballMode && (
        projectiles.map((proj) => (
          <Projectile
            key={proj.id}
            id={proj.id}
            startX={proj.startX}
            startY={proj.startY}
            targetX={proj.targetX}
            targetY={proj.targetY}
            onComplete={onProjectileComplete}
          />
        ))
      )}
    </main>
  );
}

