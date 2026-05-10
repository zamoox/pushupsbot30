const { Telegraf } = require('telegraf');
require('dotenv').config();
const startServer = require('./server');
const User = require('./models/User');
const connectDB = require('./config/db');
const { getUserContext } = require('./utils/userContext');
const { getUserDaysPassed, getTargetForToday, CHALLENGE_LIMIT } = require('./utils/dates');
const { getRandomChallenge } = require('./utils/challenges');
const { MESSAGES, sendReply } = require('./utils/messages');

// 1. ІНІЦІАЛІЗАЦІЯ СЕРВЕРУ
startServer();

// 2. НАЛАШТУВАННЯ РЕЖИМУ
const testMode = process.env.NODE_ENV !== 'production'; 
 
// 3. ОТРИМАННЯ ТОКЕНУ БОТА ТА БАЗИ ДАНИХ
const { token, mongoUri } =  testMode ? 
{ token: process.env.TEST_BOT_TOKEN, mongoUri: process.env.TEST_MONGO_URI} :
{ token: process.env.BOT_TOKEN, mongoUri: process.env.MONGO_URI};

connectDB(mongoUri);

// 4. ІНІЦІАЛІЗАЦІЯ БОТА
const bot = new Telegraf(token);

// --- 5. ОБРОБКА ВІДЕО ---
bot.on(['video', 'video_note'], async (ctx) => {
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
            
            const update = {
                $set: { 
                    currentStreak: newStreak,
                    maxStreak: newMaxStreak,
                    isBroken: isCurrentlyDebtor || (user?.isBroken ?? false)
                },
                $inc: { 
                    completed: (user?.completed || 0) >= personalDay ? 0 : 1, 
                    totalReps: reps
                }
            };
        
            const updatedDoc = await User.findOneAndUpdate({ userId }, update, { upsert: true, returnDocument: 'after' });
            return {updated: updatedDoc};
        };

        if (reps >= personalTarget) {
            const { updated: updatedUser } = await saveProgress(reps);
            
            let challengeText = "";
            let extraMarkup = null;

            const isCleanNow = (personalDay - updatedUser.completed) < 2;

            // КНОПКА "ПОВЕРНУТИ ВОГНИК"
            if (isCurrentlyDebtor && isCleanNow && updatedUser.isBroken) {
                await User.updateOne({ userId }, { $set: { canRestore: true } });
                
                challengeText = `\n\n${MESSAGES.challenge.offerRestore}`;
                extraMarkup = {
                    inline_keyboard: [
                        [{ text: "👊 Повернути вогник", callback_data: `accept_challenge_${userId}` }]
                    ]
                };
            }

            // ЛОГІКА ПЕРЕВІРКИ ЧЕЛЕНДЖУ (ГОЛОСУВАННЯ)
            if (updatedUser.canRestore && updatedUser.activeChallenge) {
                if (updatedUser.completed >= personalDay) {

                    challengeText = `\n\n${MESSAGES.challenge.poll(updatedUser.activeChallenge, userName)}`;

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
                    challengeText = MESSAGES.challenge.debtStillExists;
                }
            }

            const finalMsg = MESSAGES.video.finalMsg(updatedUser, personalDay, reps, personalTarget);
            
            await ctx.reply(finalMsg, { 
                reply_to_message_id: ctx.message.message_id,
                reply_markup: extraMarkup,
                parse_mode: 'HTML' 
            });

        } else {
            sendReply(ctx, MESSAGES.video.almost(reps, personalTarget));
        }
    } catch (e) {
        console.error('Помилка при збереженні відео:', e);
        sendReply(ctx, MESSAGES.video.error);
    }
});

// --- 6. КОМАНДИ ---

bot.command('stats', async (ctx) => {
    try {
        const daysPassed = getUserDaysPassed('Europe/Kyiv');
        const allTargets = {
            easy: getTargetForToday(daysPassed, 'easy'),
            normal: getTargetForToday(daysPassed, 'normal'),
            hard: getTargetForToday(daysPassed, 'hard')
        };
        
        let users = await User.find();

        for (let u of users) {
            const userTZ = u.timezone || 'Europe/Kyiv';
            const personalDays = getUserDaysPassed(userTZ);
            u.tempPersonalDay = personalDays; 
            const diff = personalDays - u.completed;

            if (diff >= 2 && (u.currentStreak > 0 || !u.isBroken)) {
                await User.updateOne({ _id: u._id }, { $set: { currentStreak: 0, isBroken: true } });
                u.currentStreak = 0;
                u.isBroken = true;
            }
        }

        users.sort((a, b) => {
            const aIsDebtor = (a.tempPersonalDay - a.completed) >= 2;
            const bIsDebtor = (b.tempPersonalDay - b.completed) >= 2;
            if (aIsDebtor && !bIsDebtor) return 1;
            if (!aIsDebtor && bIsDebtor) return -1;
            return b.totalReps - a.totalReps;
        });

        let msg = MESSAGES.stats.statsHeader(daysPassed, allTargets);

        if (users.length === 0) {
            msg += MESSAGES.stats.noStats;
        } else {
            for (const [position, user] of users.entries()) {
                const diff = user.tempPersonalDay - user.completed;
                msg += MESSAGES.stats.userInfo(user, position, diff >= 2, diff, user.tempPersonalDay);
            }
        }

        const prefix = testMode ? '🛠 [TEST MODE]\n' : '';
        await ctx.reply(prefix + msg, { parse_mode: 'HTML' });
    } catch (e) {
        console.error('Помилка в stats:', e);
        ctx.reply("❌ Помилка статистики.");
    }
});

// --- ВІДНОВЛЕННЯ ВОГНИКА (ACCEPT) ---
bot.action(/accept_challenge_(\d+)/, async (ctx) => {
    const targetUserId = parseInt(ctx.match[1], 10);
    if (ctx.from.id !== targetUserId) {
        return ctx.answerCbQuery("❌ Це не твій виклик!", { show_alert: true });
    }

    try {
        const user = await User.findOne({ userId: targetUserId });
        const personalDay = getUserDaysPassed(user?.timezone || 'Europe/Kyiv');
        if ((personalDay - (user?.completed || 0)) >= 2) {
            return ctx.answerCbQuery("💀 Закрий борги спочатку!", { show_alert: true });
        }

        const challenge = getRandomChallenge();
        await User.updateOne({ userId: targetUserId }, { $set: { canRestore: true, activeChallenge: challenge } });
        
        await ctx.answerCbQuery();
        await ctx.editMessageText(MESSAGES.challenge.accept(challenge), { parse_mode: 'HTML' });
    } catch (e) {
        console.error(e);
        ctx.answerCbQuery("Помилка...");
    }
});



bot.command(['start', 'mode'], async (ctx) => {
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
});

bot.action(/setmode_(.+)/, async (ctx) => {
    const newMode = ctx.match[1];
    const userId = ctx.from.id;
    const userName = ctx.from.first_name || 'Атлет';

    await User.updateOne({ userId }, { $set: { mode: newMode, name: userName } }, { upsert: true });
    await ctx.answerCbQuery(`Режим ${newMode} обрано!`);
    await ctx.editMessageText(MESSAGES.settings.modeSelected(newMode, userName), { parse_mode: 'HTML' });
});

bot.command('me', async (ctx) => {
    const { user, personalDay } = await getUserContext(ctx.from.id, ctx.from.first_name);
    if (!user) return ctx.reply("Спочатку обери режим /mode 🦾");

    const currentTarget = getTargetForToday(personalDay, user.mode);
    const nextTarget = getTargetForToday(personalDay + 1, user.mode);
    await ctx.reply(MESSAGES.personal.card(user, personalDay, currentTarget, nextTarget), { parse_mode: 'HTML' });
});

// --- КОМАНДА ПРАВИЛ ---
bot.command('guide', (ctx) => {
    try {
        ctx.reply(MESSAGES.guide.text, { parse_mode: 'HTML' });
    } catch (e) {
        console.error("Помилка в rules:", e);
        ctx.reply("❌ Не вдалося завантажити правила.");
    }
});

bot.command('challenge', async (ctx) => {
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
});

// --- ГОЛОСУВАННЯ ---
bot.action(/vote_(yes|no)_(\d+)/, async (ctx) => {
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
});

bot.command('remind', async (ctx) => {
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
});

bot.launch();
console.log(`🚀 Бот стартує в режимі: ${testMode ? 'TEST' : 'PRODUCTION'}`);