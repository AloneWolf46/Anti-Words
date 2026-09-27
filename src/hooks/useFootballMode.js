import { useState, useRef, useCallback } from 'react';
import { playBallKickSound, playGoalSound, playNetRustleSound } from '../utils/sounds';

/**
 * Futbol & Şut Modu State ve Mekanik Hook'u
 */
export function useFootballMode() {
  const [ballKickTrigger, setBallKickTrigger] = useState(0);
  const [shootingBalls, setShootingBalls] = useState([]);
  const [goalCelebrations, setGoalCelebrations] = useState([]);
  const [goalsScored, setGoalsScored] = useState(0);
  const goalsScoredRef = useRef(0);

  const resetFootballMode = useCallback(() => {
    setBallKickTrigger(0);
    setShootingBalls([]);
    setGoalCelebrations([]);
    setGoalsScored(0);
    goalsScoredRef.current = 0;
  }, []);

  const triggerFootballShot = useCallback((target, prng = Math.random) => {
    playBallKickSound(true);
    goalsScoredRef.current += 1;
    const currentGoals = goalsScoredRef.current;
    setGoalsScored(currentGoals);

    const goalTargetX = Math.floor(40 + prng() * 20);
    const goalTargetY = Math.floor(36 + prng() * 12);
    const shotId = `shot-${Date.now()}-${Math.random()}`;
    const newShot = {
      id: shotId,
      startX: target.x,
      startY: target.y,
      targetX: goalTargetX,
      targetY: goalTargetY,
      word: target.word,
    };

    setShootingBalls((prev) => [...prev, newShot]);

    setTimeout(() => {
      const isMilestone = currentGoals % 10 === 0;
      if (isMilestone) {
        playGoalSound();
      } else {
        playNetRustleSound();
      }

      const goalId = `goal-${Date.now()}`;
      setGoalCelebrations((prev) => [
        ...prev,
        {
          id: goalId,
          x: goalTargetX,
          y: goalTargetY,
          isMilestone,
          milestoneText: `🔥 ${currentGoals}. GOL! SÜPER GOLCÜ!`,
        },
      ]);

      setTimeout(() => {
        setGoalCelebrations((prev) => prev.filter((g) => g.id !== goalId));
      }, isMilestone ? 1600 : 700);

      setShootingBalls((prev) => prev.filter((s) => s.id !== shotId));
    }, 460);
  }, []);

  return {
    ballKickTrigger,
    setBallKickTrigger,
    shootingBalls,
    goalCelebrations,
    goalsScored,
    goalsScoredRef,
    triggerFootballShot,
    resetFootballMode,
  };
}
