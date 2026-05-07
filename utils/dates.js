const { DateTime } = require('luxon');

const START_DATE = { year: 2026, month: 5, day: 8 };
const CHALLENGE_LIMIT = 30; // Вкажи тут кінець челенджу (30 або 40 днів)

const getUserDaysPassed = (timezone = 'Europe/Kyiv') => {
    const start = DateTime.fromObject(START_DATE, { zone: timezone });
    const now = DateTime.now().setZone(timezone).startOf('day');

    const diff = now.diff(start, 'days').days;
    const actualDay = Math.max(1, Math.floor(diff + 1));

    // Повертаємо день, але лічильник зупиниться на CHALLENGE_LIMIT
    return Math.min(actualDay, CHALLENGE_LIMIT);
};

const getTargetForToday = (day, mode = 'normal') => {
    const d = parseInt(day);
    
    const settings = {
        easy:   { base: 5,  step: 1, period: 3 }, // Хвиля 3 дні
        normal: { base: 10, step: 1, period: 4 }, // Хвиля 4 дні
        hard:   { base: 10, step: 2, period: 4 }  // Хвиля 4 дні
    };

    const { base, step, period } = settings[mode] || settings.normal;
    const WAVE_THRESHOLD = 15; // Поріг активації відкатів

    // 1. Рахуємо лінійну ціль
    const linearTarget = base + (d - 1) * step;

    // 2. Перевіряємо умови для відкату:
    // - День кратний періоду (3 або 4)
    // - Поточна лінійна ціль БІЛЬША за поріг (15)
    if (d % period === 0 && linearTarget > WAVE_THRESHOLD) {
        const previousDayTarget = base + (d - 2) * step;
        return Math.max(base, Math.floor(previousDayTarget / 2));
    }

    return linearTarget;
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};