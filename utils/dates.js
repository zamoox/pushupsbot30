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
    const totalDays = parseInt(day);
    
    const settings = {
        easy:   { base: 5,  step: 1, period: 3, threshold: 15 }, 
        normal: { base: 10, step: 1, period: 4, threshold: 15 }, 
        hard:   { base: 10, step: 2, period: 4, threshold: 20 }
    };

    const { base, step, period, threshold } = settings[mode] || settings.normal;

    let currentTarget = base;
    let waveDayCounter = 1; // Рахує дні всередині поточної хвилі

    // Симулюємо ріст день за днем від 1 до цільового дня
    for (let d = 1; d <= totalDays; d++) {
        // Останній день челенджу (30) ігнорує будь-які відкати
        if (d === 30) {
            // Рахуємо чистий лінійний максимум на 30-й день, якщо це кінець
            // Або залишаємо поточну логіку накопичення. Для епічного фіналу:
            const maxLinear = base + (30 - 1) * step;
            return { reps: maxLinear, isRecovery: false };
        }

        // Перевіряємо, чи поточний день є днем відкату
        // Він має бути кратним періоду і перевищувати поріг
        if (waveDayCounter === period && currentTarget > threshold) {
            if (d === totalDays) {
                // Розрахунок відкату: половина від цілі вчорашнього дня
                const reps = Math.max(base, Math.floor((currentTarget - step) / 2));
                return { reps, isRecovery: true };
            }
            
            // Якщо цей день уже пройшов у симуляції:
            // Зменшуємо ціль вдвічі для старту наступної хвилі
            currentTarget = Math.max(base, Math.floor((currentTarget - step) / 2));
            waveDayCounter = 1; // Скидаємо лічильник хвилі
        } else {
            if (d === totalDays) {
                return { reps: currentTarget, isRecovery: false };
            }
            // Крокуємо вгору по порядку
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