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
    
    // Налаштування для кожного режиму
    const settings = {
        easy:   { base: 5,  step: 1, period: 3, threshold: 15 }, 
        normal: { base: 10, step: 1, period: 4, threshold: 15 }, 
        hard:   { base: 10, step: 2, period: 4, threshold: 20 }
    };

    const { base, step, period, threshold } = settings[mode] || settings.normal;

    // 1. Рахуємо базову лінійну ціль
    const linearTarget = base + (d - 1) * step;

    // 2. ПЕРЕВІРКА НА ФІНАЛЬНИЙ ДЕНЬ
    // Останній день (30) завжди лінійний максимум без відкатів
    if (d === 30) return linearTarget;

    // 3. ЛОГІКА ВІДКАТУ
    // Відкат спрацьовує, якщо:
    // - День кратний періоду (3 для easy, 4 для інших)
    // - Лінійна ціль перевищила встановлений поріг (threshold)
    if (d % period === 0 && linearTarget > threshold) {
        // Розрахунок відкату: половина від цілі вчорашнього дня
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