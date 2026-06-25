const User = require('../models/User');
const Config = require('../models/Config'); // <-- Додаємо модель конфігу
const { getUserDaysPassed, getTargetForToday } = require('../utils/dates');

const getUserContext = async (userId, userName = 'Анонім') => {
    // 1. Шукаємо юзера в базі
    const user = await User.findOne({ userId });

    // 2. Витягуємо глобальну дисципліну чату, яку сьогодні о 00:00 обрав крон
    const globalConfig = await Config.findOne({});
    const globalChallengeType = globalConfig?.currentChallengeType || 'pushups';

    const timezone = user?.timezone || 'Europe/Kyiv';
    const personalDay = getUserDaysPassed(timezone);

    // 3. Передаємо актуальний тип: або той, що у юзера, або якщо юзер новий — глобальний з конфігу!
    const activeType = user?.challengeType || globalChallengeType;

    const personalTarget = getTargetForToday(personalDay, user?.mode || 'normal', activeType);

    return { 
        user, 
        userName: user?.name || userName,
        personalDay, 
        personalTarget,
        timezone,
    };
};

module.exports = { getUserContext };