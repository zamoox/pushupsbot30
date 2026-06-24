const cron = require('node-cron');
const User = require('../models/User');
const Config = require('../models/Config'); 
const { getUserDaysPassed, getTargetForToday } = require('../utils/dates');
const { CHALLENGE_TYPES, getRandomDailyExercise } = require('../utils/challenges');

// Тимчасова змінна в пам'яті для анти-флуду повідомлень
let lastReportMessageId = null;

/**
 * Основна функція формування та відправки щоденного рапорту в чат.
 */
const sendDailyReport = async (bot, chatId) => {
    try {
        console.log('⏰ Розрахунок нового дня та вибір дисципліни...');
        
        const currentConfig = await Config.findOne({});
        const lastExerciseType = currentConfig?.currentChallengeType || null;

        // 2. ГЕНЕРУЄМО НОВУ ВПРАВУ, ЯКА ГАРАНТОВАНО НЕ ДОРІВНЮЄ ВЧОРАШНІЙ
        const nextExerciseType = getRandomDailyExercise(lastExerciseType);
        const todayStr = new Date().toISOString().split('T')[0];

        console.log(`🎰 Вчора було: ${lastExerciseType} -> Сьогодні обрано: ${nextExerciseType}`);

        // 2. Оновлюємо глобальний конфіг у базі
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

        // 3. Синхронізуємо дисципліну всім юзерам
        await User.updateMany({}, { $set: { challengeType: nextExerciseType } });

        let users = await User.find();
        if (users.length === 0) return "Нікого немає в базі.";

        // 🔥 СОРТУВАННЯ ЗА СКЛАДНІСТЮ (Hard -> Normal -> Easy)
        const modeWeights = { hard: 3, normal: 2, easy: 1 };
        users.sort((a, b) => {
            const weightA = modeWeights[a.mode] || 0;
            const weightB = modeWeights[b.mode] || 0;
            return weightB - weightA; // Сортування за спаданням сили режиму
        });

        const daysPassed = getUserDaysPassed('Europe/Kyiv');
        const globalExe = CHALLENGE_TYPES[nextExerciseType] || { name: 'Віджимання', unit: 'разів' };
        const modeTags = { easy: '🟢', normal: '🟡', hard: '🔴' };

        let msg = `☀️ <b>НОВИЙ ДЕНЬ — НОВИЙ ВИКЛИК!</b>\n`;
        msg += `📅 <b>День челенджу: ${daysPassed}/30</b>\n`;
        msg += `🏋️‍♂️ Головна дисципліна сьогодні: <b>${globalExe.name}</b>\n`;
        msg += `────────────────────────\n\n`;
        msg += `Пацани, ось ваші індивідуальні норми на сьогодні:\n\n`;

        for (const user of users) {
            const userTZ = user.timezone || 'Europe/Kyiv';
            const personalDay = getUserDaysPassed(userTZ);
            
            const targetData = getTargetForToday(personalDay, user.mode, nextExerciseType);
            const recoveryMarker = targetData.isRecovery ? ' 🔋 <i>(Відновлення)</i>' : ' 🎯';
            const modeIcon = modeTags[user.mode] || '💀';

            const userTag = user.username 
                ? `@${user.username}` 
                : `<a href="tg://user?id=${user.userId}">${user.name || 'Атлет'}</a>`;

            // Додав іконку режиму біля імені для кращої візуалізації ранжирування
            msg += `👤 ${modeIcon} ${userTag} <i>(${user.mode.toUpperCase()})</i>\n`;
            msg += `└ 🔥 <b>Ціль:</b> ${targetData.reps} ${globalExe.unit}${recoveryMarker}\n\n`;
        }

        msg += `────────────────────────\n`;
        msg += `❗️ <b>Нагадування:</b> Здаєте відео та <b>ОБОВ'ЯЗКОВО</b> пишете чисту цифру виконаного у підписі.`;

        // 4. Anti-flood ліміти
        if (lastReportMessageId) {
            try {
                await bot.telegram.deleteMessage(chatId, lastReportMessageId);
            } catch (e) {
                console.log('Старе повідомлення плану вже видалене користувачами');
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
 * Ініціалізація автоматичного планувальника.
 */
const initDailyScheduler = (bot, chatId) => {
    // Нагадую: після тестування заміни '* * * * *' назад на '0 0 * * *'
    cron.schedule('0 0 * * *', async () => {
        console.log('⏰ Автоматичний запуск плану за розкладом (00:00)...');
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