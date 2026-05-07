const { Telegraf } = require('telegraf');
require('dotenv').config();
const startServer = require('./server');
const User = require('./models/User');
const Config = require('./models/Config');
const connectDB = require('./config/db');
const { getUserContext } = require('./utils/userContext');
const { getUserDaysPassed, getTargetForToday } = require('./utils/dates');
const { getRandomChallenge } = require('./utils/challenges');
const { MESSAGES, sendReply } = require('./utils/messages');

// 1. ІНІЦІАЛІЗАЦІЯ СЕРВЕРУ
startServer();

// 2. НАЛАШТУВАННЯ РЕЖИМУ
const testMode = true; // Змінюй на false для продакшену
 
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

        const { user, personalTarget, personalDay } = await getUserContext(userId, userName);

        const video = ctx.message.video || ctx.message.video_note;
        const duration = video.duration; 

        if (duration < 30) {
            return sendReply(ctx, MESSAGES.video.tooShort(duration));
        }

        const currentCompleted = user ? user.completed : 0;
        const isDoingChallenge = user && user.canRestore;

        if (currentCompleted >= personalDay && !isDoingChallenge) {
            return sendReply(ctx, MESSAGES.video.alreadyDone(userName, currentCompleted, personalDay));
        }

        // Визначаємо, чи є борг 2+ дні на момент завантаження
        const isCurrentlyDebtor = (personalDay - currentCompleted) >= 2;

        const saveProgress = async (sec) => {
            // Розрахунок стріку (якщо борг — 1, якщо вчасно — +1)
            let newStreak = user && !isCurrentlyDebtor ? (user.currentStreak || 0) + 1 : 1;
            const newMaxStreak = Math.max(user?.maxStreak || 0, newStreak);
            
            const update = {
                $set: { 
                    name: userName,
                    currentStreak: newStreak,
                    maxStreak: newMaxStreak,
                    isBroken: isCurrentlyDebtor || (user?.isBroken ?? false)
                },
                $inc: { 
                    // Додаємо +1 день ТІЛЬКИ якщо сьогоднішній план ще НЕ був закритий.
                    // Якщо план закритий (наприклад, челендж здається окремо) — додаємо 0.
                    completed: (user?.completed || 0) >= personalDay ? 0 : 1, 
                    totalSeconds: sec
                }
            };
        
            const updatedDoc = await User.findOneAndUpdate({ userId }, update, { upsert: true, new: true });
            return {updated: updatedDoc};
        };

        const diff = Math.abs(duration - personalTarget);

        if (diff <= 5 || duration >= personalTarget) {
            const { updated: updatedUser } = await saveProgress(duration);
            
            let challengeText = "";
            let extraMarkup = null;

            const isCleanNow = (personalDay - updatedUser.completed) < 2;

            if (isCurrentlyDebtor && isCleanNow && updatedUser.isBroken) {
                console.log('fire back propose');
                // Дозволяємо відновити вогник
                await User.updateOne({ userId }, { $set: { canRestore: true } });
                
                challengeText = `\n\n${MESSAGES.challenge.offerRestore}`;
                extraMarkup = {
                    inline_keyboard: [
                        [{ text: "👊 Повернути вогник", callback_data: 'accept_challenge' }]
                    ]
                };
            }

            // 1. ЛОГІКА ЧЕЛЕНДЖУ
            if (updatedUser.canRestore && updatedUser.activeChallenge) {
                if (updatedUser.completed >= personalDay) {
                    // Формуємо блок голосування
                    challengeText = MESSAGES.challenge.poll(updatedUser.activeChallenge, userName);
                    extraMarkup = {
                        inline_keyboard: [
                            [{ text: "✅ Гідно", callback_data: `vote_yes_${userId}` },
                            { text: "❌ Халява", callback_data: `vote_no_${userId}` }]
                        ]
                    };
                } else {
                    // Скидаємо, якщо борг лишився
                    await User.updateOne({ userId }, { $set: { canRestore: false, activeChallenge: null } });
                    challengeText = MESSAGES.challenge.debtStillExists;
                }
            }

            // 2. ФОРМУВАННЯ СТАТУСУ
            const finalMsg = MESSAGES.video.finalMsg(updatedUser, personalDay, duration, personalTarget)
            
            // 3. ВІДПРАВКА (Одним повідомленням)
            await ctx.reply(finalMsg, { 
                reply_to_message_id: ctx.message.message_id,
                reply_markup: extraMarkup,
                parse_mode: 'HTML' 
            });

        } else {
            sendReply(ctx, MESSAGES.video.almost(duration, personalTarget));
        }
    } catch (e) {
        console.error('Помилка при збереженні відео:', e);
        sendReply(ctx, MESSAGES.video.error);
    }
});

// --- 6. КОМАНДИ ---

bot.command('stats', async (ctx) => {
    try {
        // 1. Отримуємо ліміт один раз на початку
        const config = await Config.findOne();
        const limit = config ? config.challengeLimit : 27;

        // Отримуємо загальний день (враховуючи ліміт)
        const daysPassed = await getUserDaysPassed('Europe/Kyiv');
        const targetToday = getTargetForToday(daysPassed);
        
        let users = await User.find();

        // 2. Використовуємо for...of для асинхронних оновлень в базі
        for (let u of users) {
            const userTZ = u.timezone || 'Europe/Kyiv';
            const personalDays = await getUserDaysPassed(userTZ); // Це вже враховує ліміт з бази
            
            // Зберігаємо розрахований день прямо в об'єкті юзера, щоб не рахувати знову
            u.tempPersonalDay = personalDays; 
            
            const diff = personalDays - u.completed;

            if (diff >= 2 && (u.currentStreak > 0 || !u.isBroken)) {
                await User.updateOne(
                    { _id: u._id }, 
                    { $set: { currentStreak: 0, isBroken: true } }
                );
                u.currentStreak = 0;
                u.isBroken = true;
            }
        }

        // 3. ТЕПЕР сортуємо (синхронно, бо дані вже є в u.tempPersonalDay)
        users.sort((a, b) => {
            const aDiff = a.tempPersonalDay - a.completed;
            const bDiff = b.tempPersonalDay - b.completed;
            
            const aIsDebtor = aDiff >= 2;
            const bIsDebtor = bDiff >= 2;

            if (aIsDebtor && !bIsDebtor) return 1;
            if (!aIsDebtor && bIsDebtor) return -1;
            return b.totalSeconds - a.totalSeconds;
        });

        // 4. Формуємо повідомлення (використовуємо звичайний for, бо дані вже розраховані)
        let msg = MESSAGES.stats.statsHeader(daysPassed, targetToday);

        if (users.length === 0) {
            msg += MESSAGES.stats.noStats;
        } else {
            for (const [position, user] of users.entries()) {
                const personalDays = user.tempPersonalDay; // Беремо вже готове значення
                const diff = personalDays - user.completed;
                const isDebtor = diff >= 2;

                msg += MESSAGES.stats.userInfo(user, position, isDebtor, diff, personalDays);
            }
        }

        const prefix = typeof testMode !== 'undefined' && testMode ? '🛠 [TEST MODE]\n' : '';
        await ctx.reply(prefix + msg, { parse_mode: 'HTML' });

    } catch (e) {
        console.error('Помилка в stats:', e);
        ctx.reply("❌ Помилка статистики.");
    }
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

bot.command('remind', async (ctx) => {
    try {
        // 1. Отримуємо актуальний ліміт
        const config = await Config.findOne();
        const limit = config ? config.challengeLimit : 27;

        const users = await User.find();
        const daysPassed = await getUserDaysPassed('Europe/Kyiv');
        const targetToday = getTargetForToday(daysPassed);

        let ironList = '';
        let debtList = '';
        let heavyDebtList = '';
        let hasAnyDebtor = false;

        // 2. Використовуємо for...of для коректної роботи await
        for (const u of users) {
            const userTZ = u.timezone || 'Europe/Kyiv';
            // Чекаємо на розрахунок дня (враховуючи асинхронність та ліміт бази)
            const personalDays = await getUserDaysPassed(userTZ);

            const diff = personalDays - u.completed;
            const userTag = `[${u.name || 'Атлет'}](tg://user?id=${u.userId})`;

            if (diff >= 1) {
                hasAnyDebtor = true;

                if (diff >= 5) {
                    heavyDebtList += `💀 ${userTag} — борг **${diff} дн.** (Повна яма)\n`;
                } else if (diff >= 2) {
                    debtList += `🔻 ${userTag} — борг ${diff} дн. (Вогник 🔥 потух)\n`;
                } else if (diff === 1) {
                    ironList += `⚠️ ${userTag} — сьогодні дедлайн, або прощавай вогник!\n`;
                }
            }
        }

        if (!hasAnyDebtor) {
            return ctx.reply("😎 **Всі красунчики!** Боржників немає, вогники горять. Від душі!");
        }

        // 3. Формуємо повідомлення (враховуємо ліміт у заголовку, якщо хочеш)
        let msg = `📣 **ЗБІР ПО ТРИВОЗІ** (Ціль: ${limit} дн.)\n`;
        msg += `⏱ План на сьогодні: **${targetToday} сек** \n`;
        msg += `--------------------------\n\n`;

        if (ironList) msg += `🔥 **БИТВА ЗА ВОГНИКИ:**\n${ironList}\n`;
        if (debtList) msg += `📉 **СПИСОК ШТРАФНИКІВ:**\n${debtList}\n`;
        if (heavyDebtList) msg += `🚨 **ЖОРСТКІ ЗАВАЛИ:**\n${heavyDebtList}\n`;

        msg += `\nПідтягуйте хвости, пацани! Чекаємо відоси! 👇`;

        await ctx.reply(msg, { parse_mode: 'Markdown' });

    } catch (e) {
        console.error('Помилка в remind:', e);
        ctx.reply("❌ Бот шось тупить, не зміг нагадати.");
    }
});

bot.command('challenge', async (ctx) => {
    const userId = ctx.from.id;
    const daysPassed = await getUserDaysPassed();
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
            inline_keyboard: [[{ text: MESSAGES.challenge.go, callback_data: 'accept_challenge' }]]
        }
    });
});

bot.action('accept_challenge', async (ctx) => {
    const challenge = getRandomChallenge();
    // Зберігаємо challenge в базу юзеру, щоб потім вивести в описі голосування
    await User.updateOne({ userId: ctx.from.id }, { $set: { canRestore: true, activeChallenge: challenge } });
    
    await ctx.answerCbQuery();
    await ctx.editMessageText(MESSAGES.challenge.accept(challenge));
});

bot.action(/vote_(yes|no)_(\d+)/, async (ctx) => {
    const action = ctx.match[1];
    const targetUserId = ctx.match[2];
    const voterId = ctx.from.id;
    const voterName = ctx.from.first_name || 'Анонім';

    // 1. Захист від самострілу
    if (voterId == targetUserId) {
        return ctx.answerCbQuery(MESSAGES.challenge.blockVote, { show_alert: true });
    }

    const targetUser = await User.findOne({ userId: targetUserId });
    if (!targetUser || !targetUser.canRestore) {
        return ctx.answerCbQuery(MESSAGES.challenge.votingNotActive);
    }

    let text = ctx.callbackQuery.message.text;

    // 2. Перевірка, чи цей юзер вже голосував (шукаємо його ім'я в тексті)
    if (text.includes(voterName)) {
        return ctx.answerCbQuery("Ти вже залишив свій голос! 😉", { show_alert: false });
    }

    if (action === 'yes') {
        // Рахуємо поточну кількість ✅
        let yesCount = (text.match(/✅/g) || []).length + 1;
        const VOTE_THRESHOLD = 3; 

        if (yesCount >= VOTE_THRESHOLD) {
            // ФІНАЛ: Відновлення стріку
            const potentialStreak = (targetUser.maxStreak || 0) + 1;
            const restoredStreak = Math.min(potentialStreak, targetUser.completed);

            await User.updateOne(
                { userId: targetUserId }, 
                { $set: { 
                    isBroken: false, 
                    canRestore: false, 
                    activeChallenge: null, 
                    currentStreak: restoredStreak,
                    maxStreak: Math.max(targetUser.maxStreak, restoredStreak)
                }}
            );
            
            await ctx.editMessageText(MESSAGES.challenge.win(targetUser.name, restoredStreak), { parse_mode: 'HTML' });
            return ctx.answerCbQuery("Рішення прийнято! Вогник горить! 🔥");
        } else {
            // ПРОМІЖНИЙ ЕТАП: Додаємо ✅ та ім'я того, хто проголосував
            const updatedText = text + `\n✅ ${voterName}`;
            
            await ctx.editMessageText(updatedText, {
                reply_markup: ctx.callbackQuery.message.reply_markup,
                parse_mode: 'HTML'
            });
            return ctx.answerCbQuery(MESSAGES.challenge.countVote);
        }
    } else {
        // ВІДХИЛЕНО: Один голос "Проти" скасовує все (або можна теж зробити лічильник)
        await User.updateOne({ userId: targetUserId }, { $set: { canRestore: false, activeChallenge: null } });
        await ctx.editMessageText(MESSAGES.challenge.loss + `\n(Скасовано: ${voterName} ❌)`, { parse_mode: 'HTML' });
        return ctx.answerCbQuery(MESSAGES.challenge.cancelAttempt);
    }
});

bot.command('start_vote_40', async (ctx) => {
    // Тільки ти (або адмін) можеш це запустити
    const messageText = `🎉 <b>ВІТАЮ ВСІХ АТЛЕТІВ! 27 ДНІВ ПОЗАДУ!</b>\n\n` +
    `Ви — справжні машини. План виконано, результат закріплено. Але чи готові ми до справжнього виклику — <b>40 днів</b>?\n\n` +
    `Пропоную продовжити наш челендж. Нам потрібно 3 голоси «ЗА», щоб офіційно подовжити термін.\n\n` +
    `<b>Голосуємо:</b>`;

    await ctx.reply(messageText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [
                    { text: "🔥 Йдемо до 40!", callback_data: "vote40_yes" },
                    { text: "🏠 Мені вистачить", callback_data: "vote40_no" }
                ]
            ]
        }
    });
});

// --- ОБРОБКА ГОЛОСУВАННЯ ЗА 40 ДНІВ ---
bot.action(/vote40_(yes|no)/, async (ctx) => {
    const action = ctx.match[1];
    const voterName = ctx.from.first_name || 'Анонім';
    let text = ctx.callbackQuery.message.text;

    // Перевірка, щоб один юзер не голосував двічі (по нікнейму в тексті)
    if (text.includes(voterName)) {
        return ctx.answerCbQuery("Ти вже проголосував! 😉");
    }

    if (action === 'yes') {
        // Рахуємо кількість галочок ✅ у тексті
        let yesCount = (text.match(/✅/g) || []).length + 1;
        const THRESHOLD = 1; // Треба 3 голоси

        if (yesCount >= THRESHOLD) {
            // 🚀 ФІНАЛ: Оновлюємо базу та текст
            try {
                await Config.findOneAndUpdate(
                    {}, 
                    { challengeLimit: 40, isExtended: true, updatedAt: new Date() }, 
                    { upsert: true }
                );

                await ctx.editMessageText(
                    `🚀 <b>РІШЕННЯ ПРИЙНЯТО!</b>\n\nНаша нова ціль — <b>40 ДНІВ</b>. Назад шляху немає! Тільки вперед! 🔥`, 
                    { parse_mode: 'HTML' }
                );
                return ctx.answerCbQuery("Ціль оновлено до 40 днів!");
            } catch (err) {
                console.error(err);
                return ctx.answerCbQuery("Помилка оновлення бази.");
            }
        } else {
            // ПРОМІЖНИЙ ЕТАП: Додаємо нікнейм у список під текстом
            const updatedText = text + `\n✅ ${voterName}`;
            await ctx.editMessageText(updatedText, {
                reply_markup: ctx.callbackQuery.message.reply_markup,
                parse_mode: 'HTML'
            });
            return ctx.answerCbQuery("Голос зараховано!");
        }
    } else {
        // Якщо натиснули "Достатньо"
        return ctx.answerCbQuery("Думку прийнято, чекаємо рішення більшості.");
    }
});

// --- 7. ЗАПУСК ---
bot.launch();
console.log(`🚀 Бот стартує в режимі: ${testMode ? 'TEST' : 'PRODUCTION'}`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));