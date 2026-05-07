const { DateTime } = require('luxon');

const START_DATE = { year: 2026, month: 5, day: 5 };
const CHALLENGE_LIMIT = 30; // Вкажи тут кінець челенджу (30 або 40 днів)

const getUserDaysPassed = (timezone = 'Europe/Kyiv') => {
    const start = DateTime.fromObject(START_DATE, { zone: timezone });
    const now = DateTime.now().setZone(timezone).startOf('day');

    const diff = now.diff(start, 'days').days;
    const actualDay = Math.max(1, Math.floor(diff + 1));

    // Повертаємо день, але лічильник зупиниться на CHALLENGE_LIMIT
    return Math.min(actualDay, CHALLENGE_LIMIT);
};

const getTargetForToday = (day) => {
    return 10 + (day - 1); 
};

module.exports = { 
    getUserDaysPassed, 
    getTargetForToday, 
    CHALLENGE_LIMIT 
};