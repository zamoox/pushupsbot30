// utils/dates.js
const { DateTime } = require('luxon');
const { getConfigForExercise } = require('./exerciseConfig');

const START_DATE = { year: 2026, month: 6, day: 23 };
const CHALLENGE_LIMIT = 30; // Кінець челенджу

const getUserDaysPassed = (timezone = 'Europe/Kyiv') => {
    const start = DateTime.fromObject(START_DATE, { zone: timezone });
    const now = DateTime.now().setZone(timezone).startOf('day');

    const diff = now.diff(start, 'days').days;
    const actualDay = Math.max(1, Math.floor(diff + 1));

    return Math.min(actualDay, CHALLENGE_LIMIT);
};

/**
 * Чиста функція розрахунку цілі на основі підвантажених динамічних конфігів
 */
const getTargetForToday = (day, mode = 'normal', challengeType = 'pushups') => {
    const totalDays = parseInt(day, 10);
    
    // Динамічно дістаємо індивідуальні налаштування для вправи та режиму
    const { base, step, period, threshold } = getConfigForExercise(challengeType, mode);

    let currentTarget = base;
    let waveDayCounter = 1; // Лічильник днів усередині поточної хвилі

    // Симулюємо прогресію день за днем
    for (let d = 1; d <= totalDays; d++) {
        // Останній день челенджу (30) ігнорує будь-які відкати для фінального рекорду
        if (d === 30) {
            const maxLinear = base + (30 - 1) * step;
            return { reps: maxLinear, isRecovery: false };
        }

        // Перевіряємо триггер хвилі (відкату)
        if (waveDayCounter === period && currentTarget > threshold) {
            if (d === totalDays) {
                const reps = Math.max(base, Math.floor((currentTarget - step) / 2));
                return { reps, isRecovery: true };
            }
            
            currentTarget = Math.max(base, Math.floor((currentTarget - step) / 2));
            waveDayCounter = 1; 
        } else {
            if (d === totalDays) {
                return { reps: currentTarget, isRecovery: false };
            }
            currentTarget += step;
            waveDayCounter++;
        }
    }

    return { reps: currentTarget, isRecovery: false };
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};