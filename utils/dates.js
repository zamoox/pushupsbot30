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

    let effectiveCounter = 0; // Скільки днів реально просунули прогресію вперед
    let result = { reps: base, isRecovery: false };

    for (let d = 1; d <= totalDays; d++) {
        // Позиція дня всередині хвилі: 1..period
        const waveDayCounter = ((d - 1) % period) + 1;
        
        // Вираховуємо лінійну ціль на основі накопичених ефективних днів
        const linearTarget = base + effectiveCounter * step;
        
        // Умова розвантаження (30-й день завжди ігнорує відкати для фінального рекорду)
        const isRecoveryDay = d !== 30 && waveDayCounter === period && linearTarget > threshold;

        if (isRecoveryDay) {
            // День відновлення: ділимо лінійний трек навпіл
            // АЛЕ effectiveCounter НЕ інкрементуємо — день "заморожує" прогресію для d+1
            result = { 
                reps: Math.max(base, Math.floor(linearTarget / 2)), 
                isRecovery: true 
            };
        } else {
            // Звичайний день: забираємо повну лінійну ціль і штовхаємо лічильник вперед
            result = { 
                reps: linearTarget, 
                isRecovery: false 
            };
            effectiveCounter++; 
        }
    }

    // 🔥 ШИТТЯ КОНТЕКСТУ: Повертаємо об'єкт разом із назвою дисципліни
    return {
        reps: result.reps,
        isRecovery: result.isRecovery,
        challengeType: challengeType
    };
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};