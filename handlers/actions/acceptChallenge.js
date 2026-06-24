const User = require('../../models/User');
const { MESSAGES } = require('../../utils/messages');
const { getUserDaysPassed } = require('../../utils/dates'); // ✅ Фікс: Додали імпорт дати
const { getRandomQuiz } = require('../../utils/challenges'); // ✅ Фікс: Оновили назву функції рандому

module.exports = async (ctx) => {
    const targetUserId = parseInt(ctx.match[1], 10);
    if (ctx.from.id !== targetUserId) {
        return ctx.answerCbQuery("❌ Це не твій виклик!", { show_alert: true });
    }

    try {
        const user = await User.findOne({ userId: targetUserId });
        if (!user) {
            return ctx.answerCbQuery("❌ Користувача не знайдено в матриці.", { show_alert: true });
        }

        const personalDay = getUserDaysPassed(user.timezone || 'Europe/Kyiv');
        
        // Перевірка суворої заблокованості (якщо боргів 2 або більше)
        if ((personalDay - user.completed) >= 2) {
            return ctx.answerCbQuery("💀 Доступ заблоковано! Закрий борги спочатку відео-звітами.", { show_alert: true });
        }

        // ✅ Фікс: Передаємо поточну дисципліну дня користувача, щоб отримати тематичний квіз
        const challenge = getRandomQuiz(user.challengeType || 'pushups'); 
        
        // Оновлюємо прапорці та зберігаємо згенероване спецзавдання
        await User.updateOne(
            { userId: targetUserId }, 
            { $set: { canRestore: true, activeChallenge: challenge } }
        );
        
        await ctx.answerCbQuery("🔥 Спецзавдання активовано!");
        
        // Редагуємо текст інлайн-картки, прокидаючи туди текст челенджу
        await ctx.editMessageText(MESSAGES.challenge.accept(challenge), { parse_mode: 'HTML' });
        
    } catch (e) {
        console.error('❌ Помилка в acceptChallengeAction:', e);
        ctx.answerCbQuery("❌ Помилка активації ритуалу... Спробуй знову.");
    }
};