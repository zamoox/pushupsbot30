const User = require('../models/User');
const Config = require('../models/Config'); // 🔥 Обов'язково імпортуємо модель конфігу
const { getTargetForToday, getUserDaysPassed } = require('../utils/dates');
const { MESSAGES } = require('../utils/messages');

module.exports = async (ctx) => {
    try {
        const daysPassed = getUserDaysPassed('Europe/Kyiv');
        
        // 1. ФІКС: Тягнемо з бази актуальну дисципліну дня, яку згенерував крон/ручний запуск
        const globalConfig = await Config.findOne({});
        const currentChallengeType = globalConfig?.currentChallengeType || 'pushups';

        let users = await User.find();

        for (let u of users) {
            const userTZ = u.timezone || 'Europe/Kyiv';
            const personalDays = getUserDaysPassed(userTZ);
            u.tempPersonalDay = personalDays; 
            const diff = personalDays - u.completed;

            if (diff >= 2 && (u.currentStreak > 0 || !u.isBroken || u.activeChallenge)) {
                await User.updateOne({ _id: u._id }, { 
                    $set: { 
                        currentStreak: 0,
                        isBroken: true,
                        canRestore: false,
                        activeChallenge: null
                    } 
                });
                u.currentStreak = 0;
                u.isBroken = true;
            }
        }

        users.sort((a, b) => {
            const aIsDebtor = (a.tempPersonalDay - a.completed) >= 2;
            const bIsDebtor = (b.tempPersonalDay - b.completed) >= 2;
            if (aIsDebtor && !bIsDebtor) return 1;
            if (!aIsDebtor && bIsDebtor) return -1;
            return b.totalReps - a.totalReps;
        });

        // 2. ФІКС: Передаємо поточну дисципліну третім аргументом у statsHeader!
        let msg = MESSAGES.stats.statsHeader(daysPassed, getTargetForToday, currentChallengeType);

        if (users.length === 0) {
            msg += MESSAGES.stats.noStats;
        } else {
            for (const [position, user] of users.entries()) {
                const diff = user.tempPersonalDay - user.completed;
                msg += MESSAGES.stats.userInfo(user, position, diff >= 2, diff, user.tempPersonalDay);
            }
        }
        
        await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('Помилка в stats:', e);
        ctx.reply("❌ Помилка статистики.");
    }
};