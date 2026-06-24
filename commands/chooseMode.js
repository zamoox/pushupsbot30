const { MESSAGES, sendReply } = require('../utils/messages');

module.exports = async (ctx) => {
    await ctx.reply(MESSAGES.settings.chooseMode, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [ 
                [
                    { text: "🟢 EASY", callback_data: "setmode_easy" },
                    { text: "🟡 NORMAL", callback_data: "setmode_normal" },
                    { text: "🔴 HARD", callback_data: "setmode_hard" }
                ]
            ]
        }
    });
};