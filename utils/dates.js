// utils/dates.js
const { DateTime } = require('luxon');
const { getConfigForExercise } = require('./exerciseConfig');

const START_DATE = { year: 2026, month: 6, day: 25 };
const CHALLENGE_LIMIT = 30; // Кінець челенджу

const getUserDaysPassed = (timezone = 'Europe/Kyiv') => {
    const start = DateTime.fromObject(START_DATE, { zone: timezone });
    const now = DateTime.now().setZone(timezone).startOf('day');

    const diff = now.diff(start, 'days').days;
    const actualDay = Math.max(1, Math.floor(diff + 1));

    return Math.min(actualDay, CHALLENGE_LIMIT);
};

/**
 * Чиста функція розрахунку цілі на основі динамічних конфігів з модульною симуляцією хвиль
 */
const getTargetForToday = (day, mode = 'normal', challengeType = 'pushups') => {
    const totalDays = parseInt(day, 10);
    const config = getConfigForExercise(challengeType, mode);
    const { base, step, period, threshold } = config;

    let effectiveCounter = 0; // скільки днів реально "просунули" прогресію
    let result = { reps: base, isRecovery: false };

    for (let d = 1; d <= totalDays; d++) {
        const waveDayCounter = ((d - 1) % period) + 1;
        const linearTarget = base + effectiveCounter * step;
        const isRecoveryDay = d !== 30 && waveDayCounter === period && linearTarget > threshold;

        if (isRecoveryDay) {
            // День відновлення: показуємо занижене число,
            // АЛЕ не рухаємо effectiveCounter — цей день "випадає" з рахунку
            result = { reps: Math.max(base, Math.floor(linearTarget / 2)), isRecovery: true };
        } else {
            result = { reps: linearTarget, isRecovery: false };
            effectiveCounter++; // тільки звичайні дні просувають прогресію
        }
    }
    return result;
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};