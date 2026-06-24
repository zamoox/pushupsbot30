const { getTargetForToday } = require('../utils/dates');
const { MESSAGES } = require('../utils/messages');
const { getUserContext } = require('../utils/userContext');
const { getLeague } = require('../utils/leagues'); // Шлях до твого файлу ліг

module.exports = async (ctx) => {
    try {
        const { user, personalDay } = await getUserContext(ctx.from.id, ctx.from.first_name);
        if (!user) return ctx.reply("Спочатку обери режим /mode 🦾");

        const currentTarget = getTargetForToday(personalDay, user.mode, user.challengeType);
        const nextTarget = getTargetForToday(personalDay + 1, user.mode, user.challengeType);
        
        // Тут викликається саме getLeague, яка поверне повний об'єкт { id, name, min }
        const league = getLeague(user.totalReps || 0);

        const msg = MESSAGES.personal.card(user, personalDay, currentTarget, nextTarget, league);

        await ctx.reply(msg, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('Помилка в команді /me:', e);
        ctx.reply("❌ Не вдалося відкрити профіль.");
    }
};