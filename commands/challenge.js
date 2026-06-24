const User = require('../models/User');
const { getUserDaysPassed } = require('../utils/dates');
const { MESSAGES, sendReply } = require('../utils/messages');

module.exports = async (ctx) => {
    const userId = ctx.from.id;
    const daysPassed = getUserDaysPassed();
    let user = await User.findOne({ userId });

    if (!user || !user.isBroken) {
        return ctx.reply(MESSAGES.challenge.notNeeded);
    }

    // ГОЛОВНА ПЕРЕВІРКА: чи є борг на цей момент
    if (user.completed + 1 < daysPassed) {
        const debt = daysPassed - user.completed - 1;
        const word = debt === 1 ? 'звіт' : (debt < 5 ? 'звіти' : 'звітів');
        return ctx.reply(MESSAGES.challenge.locked(debt, word));
    }

    // Дозволяємо активувати, якщо сьогодні ще НЕ здано (або якщо є невеликий борг)
    const msg = MESSAGES.challenge.intro;

    await ctx.reply(msg, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[{ text: MESSAGES.challenge.go, callback_data: `accept_challenge_${userId}` }]]
        }
    });
}