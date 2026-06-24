const User = require('../../models/User');
const { MESSAGES, sendReply } = require('../../utils/messages');

module.exports = async (ctx) => {
    const newMode = ctx.match[1];
    const userId = ctx.from.id;
    const firstName = ctx.from.first_name || 'Атлет';
    const username = ctx.from.username || null; // 🔥 Хватаємо юзернейм без @

    await User.updateOne(
        { userId }, 
        { $set: { mode: newMode, name: firstName, username: username } }, // 🔥 Записуємо в базу
        { upsert: true }
    );
    
    await ctx.answerCbQuery(`Режим ${newMode} обрано!`);
    await ctx.editMessageText(MESSAGES.settings.modeSelected(newMode, firstName), { parse_mode: 'HTML' });
}
