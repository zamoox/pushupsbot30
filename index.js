const { Telegraf } = require('telegraf');
require('dotenv').config();
const startServer = require('./server');
const User = require('./models/User');
const connectDB = require('./config/db');
const { getUserContext } = require('./utils/userContext');
const { getUserDaysPassed, getTargetForToday, CHALLENGE_LIMIT } = require('./utils/dates');
const { getRandomChallenge } = require('./utils/challenges');
const { MESSAGES, sendReply } = require('./utils/messages');

const acceptChallengeAction = require('./handlers/actions/acceptChallenge');
const setModeAction = require('./handlers/actions/setMode');
const voteAction = require('./handlers/actions/vote');
const videoHandler = require('./handlers/video');

const chooseMode = require('./commands/chooseMode');
const stats = require('./commands/stats');
const remind = require('./commands/remind');
const me = require('./commands/me');
const guide = require('./commands/guide');
const challenge = require('./commands/challenge');

// Імпортуємо планувальник
const { initDailyScheduler, sendDailyReport } = require('./services/scheduler');

// 1. ІНІЦІАЛІЗАЦІЯ СЕРВЕРУ
startServer();

// 2. НАЛАШТУВАННЯ РЕЖИМУ
const testMode = process.env.NODE_ENV !== 'production'; 
const groupChatId = process.env.GROUP_CHAT_ID;
const adminId = process.env.ADMIN_ID;
 
// 3. ОТРИМАННЯ ТОКЕНУ БОТА ТА БАЗИ ДАНИХ
const { token, mongoUri } =  testMode ? 
{ token: process.env.TEST_BOT_TOKEN, mongoUri: process.env.TEST_MONGO_URI} :
{ token: process.env.BOT_TOKEN, mongoUri: process.env.MONGO_URI};

connectDB(mongoUri);

// --- 4. ІНІЦІАЛІЗАЦІЯ БОТА ---
const bot = new Telegraf(token);

// --- ОБРОБКА ВІДЕО ---
bot.on(['video', 'video_note'], videoHandler);

// --- КОМАНДИ ---
bot.command('stats', stats); // Показати статистику
bot.command('me', me); // Юзер профіль
bot.command('remind', remind); // Нагадування юзерам
bot.command('guide', guide); // Інструкція по боту 
bot.command('challenge', challenge); // Отримати челендж
bot.command(['start', 'mode'], chooseMode);

// КОМАНДА ДЛЯ РУЧНОГО ТЕСТУ ТА ОНОВЛЕННЯ ПЛАНУ
bot.command('run_daily', async (ctx) => {
    try {
        console.log(`ℹ️ Користувач @${ctx.from.username || ctx.from.id} запустив run_daily вручну.`);
        
        // Викликаємо функцію генерації звіту
        const status = await sendDailyReport(bot, groupChatId);
        console.log(`📋 Результат ручного запуску: ${status}`);
        
    } catch (e) {
        console.error('❌ Помилка при ручному виклику run_daily:', e);
        await ctx.reply(`❌ Помилка тригеру: ${e.message}`).catch(() => {});
    }

    // Видаляємо текстовий виклик самого користувача, щоб не засмічувати чат командою
    try {
        await ctx.deleteMessage();
    } catch (e) {
        console.log('Не вдалося видалити повідомлення виклику команди');
    }
});

// --- ВІДНОВЛЕННЯ ВОГНИКА (ACCEPT) ---
bot.action(/setmode_(.+)/, setModeAction);
bot.action(/accept_challenge_(\d+)/, acceptChallengeAction);
bot.action(/vote_(yes|no)_(\d+)/, voteAction);

// 🔥 КРИТИЧНИЙ ФІКС: Ініціалізуємо автоматичний крон-планувальник на 00:00
if (groupChatId) {
    initDailyScheduler(bot, groupChatId);
    console.log(`📅 Автоматичний планувальник 00:00 активовано для чату: ${groupChatId}`);
} else {
    console.log('⚠️ Увага: GROUP_CHAT_ID не знайдено в .env. Крон не запущено.');
}

bot.launch();
console.log(`🚀 Бот стартує в режимі: ${testMode ? 'TEST' : 'PRODUCTION'}`);