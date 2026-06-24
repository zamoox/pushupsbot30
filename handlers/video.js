const User = require('../models/User');
const { getTargetForToday, getUserDaysPassed } = require('../utils/dates');
const { getUserContext } = require('../utils/userContext');
const { MESSAGES, sendReply } = require('../utils/messages');

module.exports = async (ctx) => {
    try {
        const userId = ctx.from.id;
        const userName = ctx.from.first_name || 'Анонім';

        const caption = ctx.message.caption || ""; 
        const match = caption.match(/\d+/); 
        const reps = match ? parseInt(match[0], 10) : 0; 

        if (!reps || reps <= 0) {
            return sendReply(ctx, MESSAGES.video.noCaption);
        }

        const { user, personalTarget, personalDay } = await getUserContext(userId, userName);

        const currentCompleted = user ? user.completed : 0;
        const isDoingChallenge = user && user.canRestore;

        if (currentCompleted >= personalDay && !isDoingChallenge) {
            return sendReply(ctx, MESSAGES.video.alreadyDone(userName, currentCompleted, personalDay));
        }

        const isCurrentlyDebtor = (personalDay - currentCompleted) >= 2;

        const saveProgress = async (reps) => {
            let newStreak = user && !isCurrentlyDebtor ? (user.currentStreak || 0) + 1 : 1;
            const newMaxStreak = Math.max(user?.maxStreak || 0, newStreak);
            
            // ДИНАМІЧНИЙ ШЛЯХ ДО КОНКРЕТНОЇ ДИСЦИПЛІНИ В БАЗІ
            const exercisePath = `exercises.${user.challengeType || 'pushups'}`;
            
            const update = {
                $set: { 
                    currentStreak: newStreak,
                    maxStreak: newMaxStreak,
                    isBroken: isCurrentlyDebtor || (user?.isBroken ?? false)
                },
                $inc: { 
                    completed: (user?.completed || 0) >= personalDay ? 0 : 1, 
                    totalReps: reps,          // Загальний тоннаж
                    [exercisePath]: reps      // Запис окремо в поточну дисципліну дня
                }
            };
        
            const updatedDoc = await User.findOneAndUpdate({ userId }, update, { upsert: true, returnDocument: 'after' });
            return { updated: updatedDoc };
        };

        // Перевірка виконання норми
        if (reps >= personalTarget.reps) {
            const { updated: updatedUser } = await saveProgress(reps);
            
            let challengeText = "";
            let extraMarkup = null;

            const isCleanNow = (personalDay - updatedUser.completed) < 2;

            // 1. ЛОГІКА ПЕРЕВІРКИ ЧЕЛЕНДЖУ (СУД ГРОМАДИ)
            // Цей блок має вищий пріоритет. Якщо юзер виконував спецзавдання — запускаємо голосування
            if (updatedUser.canRestore && updatedUser.activeChallenge) {
                if (updatedUser.completed >= personalDay) {
                    // Додаємо залізобетонне візуальне розмежування, щоб текст не нашаровувався
                    challengeText = `\n\n\n────────────────────────\n` + 
                                    `${MESSAGES.challenge.poll(updatedUser.activeChallenge, userName)}`;

                    extraMarkup = {
                        inline_keyboard: [
                            [
                                { text: "✅ Гідно", callback_data: `vote_yes_${userId}` },
                                { text: "❌ Халява", callback_data: `vote_no_${userId}` }
                            ]
                        ]
                    };
                } else {
                    // Якщо відео здано, але лічильник днів каже, що боргів ще повно
                    await User.updateOne({ userId }, { $set: { canRestore: false, activeChallenge: null } });
                    challengeText = `\n\n${MESSAGES.challenge.debtStillExists}`;
                }
            } 
            // 2. КНОПКА "П ПОВЕРНУТИ ВОГНИК" (З'являється, тільки якщо немає активного голосування)
            else if (isCurrentlyDebtor && isCleanNow && updatedUser.isBroken) {
                await User.updateOne({ userId }, { $set: { canRestore: true } });
                
                challengeText = `\n\n${MESSAGES.challenge.offerRestore}`;
                extraMarkup = {
                    inline_keyboard: [
                        [{ text: "👊 Повернути вогник", callback_data: `accept_challenge_${userId}` }]
                    ]
                };
            }

            // Збираємо до купи фінальний репорт
            const finalMsg = MESSAGES.video.finalMsg(updatedUser, personalDay, reps, personalTarget) + challengeText;
            
            const sentMessage = await ctx.reply(finalMsg, { 
                reply_to_message_id: ctx.message.message_id,
                reply_markup: extraMarkup,
                parse_mode: 'HTML' 
            });

            // Закріплюємо голосування в групі, щоб пацани не пропустили суд
            if (extraMarkup && extraMarkup.inline_keyboard && updatedUser.activeChallenge) {
                try {
                    await ctx.pinChatMessage(sentMessage.message_id, { disable_notification: true });
                } catch (e) {
                    console.error('Не вдалося закріпити повідомлення суду:', e);
                }
            }

        } else {
            // Передаємо чисту цифру цілі та тип вправи
            sendReply(ctx, MESSAGES.video.almost(reps, personalTarget.reps, user.challengeType));
        }
    } catch (e) {
        console.error('Помилка при збереженні відео:', e);
        sendReply(ctx, MESSAGES.video.error);
    }
};