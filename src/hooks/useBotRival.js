import { useEffect } from 'react';

/**
 * 1v1 Maçlarda Bot Rakip Simülasyon Hook'u
 */
export function useBotRival({
  gameStatus,
  gameMode,
  botInfoRef,
  gameStatusRef,
  isPausedRef,
  setRivalData,
  rivalDataRef,
  setParticipantsList,
  triggerGameOver,
}) {
  useEffect(() => {
    if (gameStatus !== 'PLAYING' || gameMode !== '1V1') return;
    if (!botInfoRef.current || !botInfoRef.current.active) return;

    const botInterval = setInterval(() => {
      if (gameStatusRef.current !== 'PLAYING' || isPausedRef.current) return;
      const bot = botInfoRef.current;
      if (!bot || !bot.active || bot.lives <= 0) return;

      const now = Date.now();
      const deltaSec = Math.min(1.5, Math.max(0.2, (now - (bot.lastTick || now)) / 1000));
      bot.lastTick = now;

      // Hıza göre kelime/saniye oranı (WPM / 60)
      const wordsPerSec = bot.baseWpm / 60;
      // %20 rastgele insansı dalgalanma
      const jitter = 0.8 + Math.random() * 0.4;
      const addedWordsFraction = wordsPerSec * deltaSec * jitter;
      bot.accumulatedWordFraction = (bot.accumulatedWordFraction || 0) + addedWordsFraction;

      if (bot.accumulatedWordFraction >= 1) {
        const completedCount = Math.floor(bot.accumulatedWordFraction);
        bot.accumulatedWordFraction -= completedCount;
        bot.words += completedCount;

        // Her tamamlanan kelime için puan (+12 ile +24 arası)
        const earnedScore = completedCount * (12 + Math.floor(Math.random() * 12));
        bot.score += earnedScore;

        // Anlık insansı WPM dalgalanması (+- 4)
        bot.currentWpm = Math.max(15, Math.round(bot.baseWpm + (Math.random() * 8 - 4)));

        // Zorluğa göre çok nadir can kaybetme simülasyonu
        const failChance = bot.difficulty === 'easy' ? 0.04 : bot.difficulty === 'medium' ? 0.015 : 0.003;
        if (Math.random() < failChance) {
          bot.lives = Math.max(0, bot.lives - 1);
        }

        const nextRivalData = {
          name: bot.name,
          score: bot.score,
          lives: bot.lives,
          wpm: bot.currentWpm,
          words: bot.words,
          accuracy: bot.accuracy,
          isEliminated: bot.lives <= 0,
        };

        setRivalData(nextRivalData);
        rivalDataRef.current = nextRivalData;

        // Katılımcı listesinde de botu güncelle
        setParticipantsList((prev) =>
          prev.map((p) =>
            p.name === bot.name || p.isBot
              ? { ...p, stats: { ...nextRivalData } }
              : p
          )
        );

        if (bot.lives <= 0) {
          triggerGameOver('victory');
        }
      }
    }, 700);

    return () => {
      clearInterval(botInterval);
    };
  }, [gameStatus, gameMode]);
}
