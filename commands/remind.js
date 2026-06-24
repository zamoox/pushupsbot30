const User = require('../models/User');
const { getUserDaysPassed } = require('../utils/dates');

module.exports = async (ctx) => {
    const users = await User.find();
    const daysPassed = getUserDaysPassed('Europe/Kyiv');
    let ironList = '', debtList = '', heavyDebtList = '';

    for (const u of users) {
        const pDays = getUserDaysPassed(u.timezone || 'Europe/Kyiv');
        const diff = pDays - u.completed;
        const tag = `[${u.name || 'Атлет'}](tg://user?id=${u.userId})`;

        if (diff === 1) ironList += `⚠️ ${tag} — сьогодні дедлайн!\n`;
        else if (diff >= 5) heavyDebtList += `💀 ${tag} — борг **${diff} дн.**\n`;
        else if (diff >= 2) debtList += `🔻 ${tag} — борг ${diff} дн.\n`;
    }

    let msg = `📣 **ЗБІР ПО ТРИВОЗІ**\n--------------------------\n\n`;
    if (ironList) msg += `🔥 **БИТВА ЗА ВОГНИКИ:**\n${ironList}\n`;
    if (debtList) msg += `📉 **СПИСОК ШТРАФНИКІВ:**\n${debtList}\n`;
    if (heavyDebtList) msg += `🚨 **ЖОРСТКІ ЗАВАЛИ:**\n${heavyDebtList}\n`;

    await ctx.reply(msg || "😎 Всі красунчики!", { parse_mode: 'Markdown' });
}