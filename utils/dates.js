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
        easy:   { base: 5,  step: 1 },
        normal: { base: 10, step: 1 },
        hard:   { base: 10, step: 2 }
    };

    const { base, step } = settings[mode] || settings.normal;

    // 1. Рахуємо ціль так, ніби відкату немає (лінійний прогрес)
    const linearTarget = base + (d - 1) * step;

    // 2. Логіка "М'якого відкату"
    if (d % 4 === 0) {
        // Беремо ціль попереднього дня (d-1) і ділимо на 2
        const previousDayTarget = base + (d - 2) * step;
        return Math.max(base, Math.floor(previousDayTarget / 2));
    }

    // 3. Для звичайних днів повертаємо лінійний прогрес
    return linearTarget;
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};