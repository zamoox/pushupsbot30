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
 * Оновлений чистий рушій симуляції хвиль
 * @param {number|string} day - Поточний день
 * @param {string} mode - Рівень складності (easy, normal, hard)
 * @param {string} challengeType - Дисципліна (pushups, squats, abs)
 */
/**
 * Чиста функція розрахунку цілі на основі динамічних конфігів
 */
const getTargetForToday = (day, mode = 'normal', challengeType = 'pushups') => {
    const totalDays = parseInt(day, 10);
    
    // Динамічно дістаємо індивідуальні налаштування для вправи та режиму
    const config = getConfigForExercise(challengeType, mode);
    const { base, step, period, threshold } = config;

    let currentTarget = base;
    let waveDayCounter = 1; // Лічильник днів усередині поточної хвилі

    for (let d = 1; d <= totalDays; d++) {
        
        // 1. ПЕРЕВІРКА: Якщо це цільовий день, розрахунок завершено — аналізуємо його стан
        if (d === totalDays) {
            // Останній день челенджу (30) завжди ігнорує відкати для епічного фіналу
            if (d === 30) {
                return { reps: currentTarget, isRecovery: false };
            }
            
            // Перевіряємо, чи є поточний день точкою хвильового розвантаження
            const isRecoveryDay = waveDayCounter === period && currentTarget > threshold;
            if (isRecoveryDay) {
                // Відкат: половина від накопиченого максимуму (за вирахуванням останнього кроку)
                const reps = Math.max(base, Math.floor((currentTarget - step) / 2));
                return { reps, isRecovery: true };
            }
            
            return { reps: currentTarget, isRecovery: false };
        }

        // 2. МОДИФІКАЦІЯ СТАНУ ДЛЯ НАСТУПНОГО ДНЯ
        // Симулюємо, що відбудеться з параметрами, коли цей день мине
        if (waveDayCounter === period && currentTarget > threshold) {
            currentTarget = Math.max(base, Math.floor((currentTarget - step) / 2));
            currentTarget += step;
            waveDayCounter = 2; // Хвиля скинулась, перший крок нової хвилі вже зроблено
        } else {
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