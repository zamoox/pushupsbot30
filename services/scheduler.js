const cron = require('node-cron');
const User = require('../models/User');
const Config = require('../models/Config'); 
const { getUserDaysPassed, getTargetForToday } = require('../utils/dates');
const { CHALLENGE_TYPES, getRandomDailyExercise } = require('../utils/challenges');
const { MESSAGES } = require('../utils/messages');

// Тимчасова змінна в пам'яті для анти-флуду повідомлень
let lastReportMessageId = null;

/**
 * Гучна функція формування та відправки щоденного рапорту в чат.
 * Запускається о 06:00 ранку, або вручну через /run_daily
 */
const sendDailyReport = async (bot, chatId) => {
    try {
        console.log('⏰ [Звіт] Розрахунок та формування ранкового рапорту...');
        
        // Читаємо поточну дисципліну дня, яку о 01:00 вже виставив тихий крон
        const currentConfig = await Config.findOne({});
        const currentExerciseType = currentConfig?.currentChallengeType || 'pushups';

        let users = await User.find();
        if (users.length === 0) return "Нікого немає в базі.";

        // СОРТУВАННЯ ЗА СКЛАДНІСТЮ (Hard -> Normal -> Easy)
        const modeWeights = { hard: 3, normal: 2, easy: 1 };
        users.sort((a, b) => {
            const weightA = modeWeights[a.mode] || 0;
            const weightB = modeWeights[b.mode] || 0;
            return weightB - weightA;
        });

        const daysPassed = getUserDaysPassed('Europe/Kyiv');
        const globalExe = CHALLENGE_TYPES[currentExerciseType] || { name: 'Віджимання', unit: 'разів' };
        const modeTags = { easy: '🟢', normal: '🟡', hard: '🔴' };

        // Збірка заголовка повідомлення з MESSAGES
        let msg = MESSAGES.scheduler.dailyReportHeader(daysPassed, globalExe.name);

        for (const user of users) {
            const userTZ = user.timezone || 'Europe/Kyiv';
            const personalDay = getUserDaysPassed(userTZ);
            
            const targetData = getTargetForToday(personalDay, user.mode, currentExerciseType);
            const recoveryMarker = targetData.isRecovery ? ' 🔋 <i>(Відновлення)</i>' : ' 🎯';
            const modeIcon = modeTags[user.mode] || '💀';

            const userTag = user.username 
                ? `@${user.username}` 
                : `<a href="tg://user?id=${user.userId}">${user.name || 'Атлет'}</a>`;

            // Формування рядка користувача з MESSAGES
            msg += MESSAGES.scheduler.dailyReportUserRow(modeIcon, userTag, user.mode, targetData.reps, globalExe.unit, recoveryMarker);
        }

        // Футер з MESSAGES
        msg += MESSAGES.scheduler.dailyReportFooter();

        // Anti-flood ліміти
        if (lastReportMessageId) {
            try {
                await bot.telegram.deleteMessage(chatId, lastReportMessageId);
            } catch (e) {
                console.log('Старе повідомлення плану вже видалене користувачами або застаріло');
            }
        }

        // Відправляємо новий звіт
        const sentMsg = await bot.telegram.sendMessage(chatId, msg, { parse_mode: 'HTML' });
        lastReportMessageId = sentMsg.message_id;

        // Закріплюємо новий план мовчки
        try {
            await bot.telegram.pinChatMessage(chatId, sentMsg.message_id, { disable_notification: true });
        } catch (e) {
            console.error('Не вдалося закріпити щоденний план у групі:', e);
        }

        return "Успішно оновлено!";

    } catch (e) {
        console.error('❌ Помилка при генерації рапорту:', e);
        return `Помилка: ${e.message}`;
    }
};

/**
 * Ініціалізація автоматичних крон-задач.
 */
const initDailyScheduler = (bot, chatId) => {
    
    // 1. 🤫 ТИХА РОТАЦІЯ О 01:00 НОЧІ (Дедлайн закритий, міняємо базу під новий день)
    cron.schedule('0 1 * * *', async () => {
        console.log('⏰ [Тиха ротація 01:00] Зміна дисципліни дня в базі...');
        try {
            const currentConfig = await Config.findOne({});
            const lastExerciseType = currentConfig?.currentChallengeType || null;
            
            const nextExerciseType = getRandomDailyExercise(lastExerciseType);
            const todayStr = new Date().toISOString().split('T')[0];

            await Config.findOneAndUpdate(
                {}, 
                { 
                    $set: { 
                        currentChallengeType: nextExerciseType, 
                        lastUpdatedDate: todayStr,
                        updatedAt: new Date()
                    } 
                },
                { upsert: true }
            );

            // Синхронізуємо тип вправи усім активним юзерам
            await User.updateMany({}, { $set: { challengeType: nextExerciseType } });
            console.log(`🎰 Дисципліну тихо змінено на: ${nextExerciseType}`);
        } catch (e) {
            console.error('❌ Помилка при тихій ротації:', e);
        }
    }, {
        scheduled: true,
        timezone: "Europe/Kyiv"
    });

    // 2. 📣 ГУЧНИЙ ЗВІТ О 06:00 РАНКУ (Усі прокинулися, таймзони вирівняні, публікуємо норми)
    cron.schedule('0 6 * * *', async () => {
        console.log('⏰ [Звіт 06:00] Автоматичне відправлення ранкового рапорту...');
        await sendDailyReport(bot, chatId);
    }, {
        scheduled: true,
        timezone: "Europe/Kyiv"
    });
};

module.exports = { 
    initDailyScheduler,
    sendDailyReport 
};