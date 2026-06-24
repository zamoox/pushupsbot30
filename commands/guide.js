const { MESSAGES, sendReply } = require('../utils/messages');

module.exports = (ctx) => {
    try {
        ctx.reply(MESSAGES.guide.text, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Помилка в rules:", e);
        ctx.reply("❌ Не вдалося завантажити правила.");
    }
};