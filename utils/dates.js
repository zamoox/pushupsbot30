const { DateTime } = require('luxon');
const Config = require('../models/Config'); // Імпортуємо модель конфігу

const START_DATE = { year: 2026, month: 3, day: 19 };

const getUserDaysPassed = async (timezone = 'Europe/Kyiv') => {
    const start = DateTime.fromObject(START_DATE, { zone: timezone });
    const now = DateTime.now().setZone(timezone).startOf('day');

    const diff = now.diff(start, 'days').days;
    const actualDay = Math.max(1, Math.floor(diff + 1));

    // Отримуємо ліміт з бази (30 або 40)
    try {
        const config = await Config.findOne();
        const limit = config ? config.challengeLimit : 40;
        
        // Повертаємо день, але не більше за встановлений ліміт
        return Math.min(actualDay, limit);
    } catch (e) {
        // Якщо база недоступна, повертаємо реальний день, але зі старим дефолтом
        return Math.min(actualDay, 27);
    }
};

const getTargetForToday = (day) => {
    // Формула лишається та ж сама, вона ідеально масштабується
    return 30 + (Math.max(0, day - 1) * 5);
};

module.exports = { getUserDaysPassed, getTargetForToday };