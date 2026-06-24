const User = require('../../models/User');
const { MESSAGES, sendReply } = require('../../utils/messages');
const { getRandomChallenge } = require('../../utils/challenges');

module.exports = async (ctx) => {
    const action = ctx.match[1];
    const targetUserId = parseInt(ctx.match[2], 10);
    const voterId = ctx.from.id;
    const voterName = ctx.from.first_name || 'Анонім';
    
    // 1. Отримуємо текст незалежно від того, чи це текст, чи підпис до відео
    const msg = ctx.callbackQuery.message;
    let text = msg.text || msg.caption || "";

    if (voterId === targetUserId) {
        return ctx.answerCbQuery(MESSAGES.challenge.blockVote, { show_alert: true });
    }

     const targetUser = await User.findOne({ userId: targetUserId });
     if (!targetUser || !targetUser.canRestore) {
         return ctx.answerCbQuery(MESSAGES.challenge.votingNotActive);
     }

    // 2. Більш точна перевірка на повторне голосування (шукаємо ім'я як окремий рядок)
    if (text.split('\n').some(line => line.includes(voterName))) {
        return ctx.answerCbQuery("Ти вже залишив свій голос! 😉");
    }

    if (action === 'yes') {
        const yesCount = (text.match(/✅/g) || []).length + 1;
        const VOTE_THRESHOLD = 3; 

        if (yesCount >= VOTE_THRESHOLD) {
            const restoredStreak = targetUser.maxStreak || 1;
            await User.updateOne(
                { userId: targetUserId }, 
                { $set: { 
                    isBroken: false, 
                    canRestore: false, 
                    activeChallenge: null, 
                    currentStreak: restoredStreak 
                }}
            );
            
            // Використовуємо HTML, оскільки в MESSAGES він зазвичай такий
            await ctx.editMessageText(MESSAGES.challenge.win(targetUser.name, restoredStreak), { parse_mode: 'HTML' });

            try {
                await ctx.unpinChatMessage(msg.message_id);
            } catch (e) {
                console.error("Не вдалося відкріпити повідомлення:", e);
            }

            return ctx.answerCbQuery("🔥 Челендж прийнято! Вогник відновлено.");
        } else {
            const updatedText = text + `\n✅ ${voterName}`;
            
            // Важливо: editMessageText може впасти, якщо це відео (потрібно editMessageCaption)
            const editOptions = {
                reply_markup: msg.reply_markup,
                parse_mode: 'HTML'
            };

            try {
                if (msg.caption) {
                    await ctx.editMessageCaption(updatedText, editOptions);
                } else {
                    await ctx.editMessageText(updatedText, editOptions);
                }
            } catch (e) {
                console.error("Помилка редагування голосування:", e);
            }
            return ctx.answerCbQuery(MESSAGES.challenge.countVote);
        }
    } else {
        // Відмова
        await User.updateOne({ userId: targetUserId }, { $set: { canRestore: false, activeChallenge: null } });
        const lossMsg = MESSAGES.challenge.loss + `\n\n❌ Відхилено: ${voterName}`;
        
        if (msg.caption) {
            await ctx.editMessageCaption(lossMsg, { parse_mode: 'HTML' });
        } else {
            await ctx.editMessageText(lossMsg, { parse_mode: 'HTML' });
        }
        return ctx.answerCbQuery(MESSAGES.challenge.cancelAttempt);
    }
}