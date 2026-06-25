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

        // 🔥 ЗАЛІЗОБЕТОННИЙ ФІКС: Дисципліна береться строго з прорахованого контексту
        const currentChallengeType = personalTarget.challengeType || user?.challengeType || 'pushups';

        const currentCompleted = user ? user.completed : 0;
        const isDoingChallenge = user && user.canRestore;

        if (currentCompleted >= personalDay && !isDoingChallenge) {
            return sendReply(ctx, MESSAGES.video.alreadyDone(userName, currentCompleted, personalDay));
        }

        const isCurrentlyDebtor = (personalDay - currentCompleted) >= 2;

        const saveProgress = async (reps) => {
            let newStreak = user && !isCurrentlyDebtor ? (user.currentStreak || 0) + 1 : 1;
            const newMaxStreak = Math.max(user?.maxStreak || 0, newStreak);
            
            // Динамічний шлях до поточної дисципліни
            const exercisePath = `exercises.${currentChallengeType}`;
            
            const update = {
                $set: { 
                    currentStreak: newStreak,
                    maxStreak: newMaxStreak,
                    isBroken: isCurrentlyDebtor || (user?.isBroken ?? false),
                    challengeType: currentChallengeType // Одразу синхронізуємо тип
                },
                $inc: { 
                    completed: (user?.completed || 0) >= personalDay ? 0 : 1, 
                    totalReps: reps,          
                    [exercisePath]: reps      
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
            if (updatedUser.canRestore && updatedUser.activeChallenge) {
                if (updatedUser.completed >= personalDay) {
                    challengeText = `\n────────────────────────\n` + 
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
                    await User.updateOne({ userId }, { $set: { canRestore: false, activeChallenge: null } });
                    challengeText = `\n\n${MESSAGES.challenge.debtStillExists}`;
                }
            } 
            // 2. КНОПКА "ПОВЕРНУТИ ВОГНИК"
            else if (isCurrentlyDebtor && isCleanNow && updatedUser.isBroken) {
                await User.updateOne({ userId }, { $set: { canRestore: true } });
                
                challengeText = `\n\n${MESSAGES.challenge.offerRestore}`;
                extraMarkup = {
                    inline_keyboard: [
                        [{ text: "👊 Повернути вогник", callback_data: `accept_challenge_${userId}` }]
                    ]
                };
            }

            // 🔥 Передаємо ОНОВЛЕНИЙ тип прямо у функцію збірки повідомлення, щоб захиститися від null
            // Тимчасово підміняємо тип в об'єкті, якщо старий був порожній
            updatedUser.challengeType = currentChallengeType;

            const finalMsg = MESSAGES.video.finalMsg(updatedUser, personalDay, reps, personalTarget) + challengeText;
            
            const sentMessage = await ctx.reply(finalMsg, { 
                reply_to_message_id: ctx.message.message_id,
                reply_markup: extraMarkup,
                parse_mode: 'HTML' 
            });

            if (extraMarkup && extraMarkup.inline_keyboard && updatedUser.activeChallenge) {
                try {
                    await ctx.pinChatMessage(sentMessage.message_id, { disable_notification: true });
                } catch (e) {
                    console.error('Не вдалося закріпити повідомлення суду:', e);
                }
            }

        } else {
            sendReply(ctx, MESSAGES.video.almost(reps, personalTarget.reps, currentChallengeType));
        }
    } catch (e) {
        console.error('Помилка при збереженні відео:', e);
        sendReply(ctx, MESSAGES.video.error);
    }
};