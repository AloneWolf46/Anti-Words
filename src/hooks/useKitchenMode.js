import { useState, useCallback } from 'react';
import { playDishSizzleSound, playFlowerBloomSound } from '../utils/sounds';

/**
 * Mutfak & Pizza Şefi Modu State ve Mekanik Hook'u
 */
export function useKitchenMode({ scoreRef, setScore, livesRef, broadcastMyProgress }) {
  const [kitchenChopTrigger, setKitchenChopTrigger] = useState(0);
  const [slicingTargets, setSlicingTargets] = useState([]);
  const [kitchenPizzaCount, setKitchenPizzaCount] = useState(0);
  const [kitchenIngredientCount, setKitchenIngredientCount] = useState(0);
  const [pizzaBounceTrigger, setPizzaBounceTrigger] = useState(0);
  const [pizzaCompleteBurst, setPizzaCompleteBurst] = useState(false);
  const [isPizzaLaunching, setIsPizzaLaunching] = useState(false);
  const [isOvenGlowing, setIsOvenGlowing] = useState(false);
  const [isNewPizzaArriving, setIsNewPizzaArriving] = useState(false);

  const resetKitchenMode = useCallback(() => {
    setKitchenChopTrigger(0);
    setSlicingTargets([]);
    setKitchenPizzaCount(0);
    setKitchenIngredientCount(0);
    setPizzaBounceTrigger(0);
    setPizzaCompleteBurst(false);
    setIsPizzaLaunching(false);
    setIsOvenGlowing(false);
    setIsNewPizzaArriving(false);
  }, []);

  const triggerKitchenSlice = useCallback((targetObj) => {
    playDishSizzleSound();
    const slicingTarget = { ...targetObj };
    setSlicingTargets((prev) => [...prev, slicingTarget]);

    // Dilimlenen malzeme tezgaha doğru kavisli olarak düşer (300ms sonra pizzaya çarpar)
    setTimeout(() => {
      setPizzaBounceTrigger((b) => b + 1);
    }, 300);

    // Pizza malzeme sayısını artır
    setKitchenIngredientCount((prevCount) => {
      const nextCount = prevCount + 1;
      if (nextCount >= 8) {
        // 8 malzemede Pizza Tamamlandı!
        setTimeout(() => {
          setPizzaCompleteBurst(true);
          playFlowerBloomSound();
          const chefBonus = 250;
          scoreRef.current += chefBonus;
          setScore(scoreRef.current);
          setKitchenPizzaCount((p) => p + 1);
          if (broadcastMyProgress) {
            broadcastMyProgress(scoreRef.current, livesRef.current);
          }

          // 500ms sonra: Pizza fırına doğru fırlasın!
          setTimeout(() => {
            setPizzaCompleteBurst(false);
            setIsPizzaLaunching(true);

            // 850ms sonra: Fırının ağzına varış ve alev parlaması
            setTimeout(() => {
              setIsOvenGlowing(true);
              playDishSizzleSound();

              // 350ms sonra: Fırlama biter, yeni pizza tezgaha pürüzsüz insin
              setTimeout(() => {
                setIsPizzaLaunching(false);
                setIsOvenGlowing(false);
                setKitchenIngredientCount(0);
                setIsNewPizzaArriving(true);

                setTimeout(() => {
                  setIsNewPizzaArriving(false);
                }, 450);
              }, 350);
            }, 850);
          }, 500);
        }, 320);
      }
      return nextCount;
    });

    setTimeout(() => {
      setSlicingTargets((prev) => prev.filter((s) => s.id !== slicingTarget.id));
    }, 600);
  }, [scoreRef, setScore, livesRef, broadcastMyProgress]);

  return {
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
  };
}
