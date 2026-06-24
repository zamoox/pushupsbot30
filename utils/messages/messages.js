const { CHALLENGE_LIMIT } = require('../dates');
const { ICON, FOOTER } = require('./helpers');
const { CHALLENGE_TYPES } = require('../challenges');

const sendReply = (ctx, text, extra = {}) => {
    const options = typeof extra === 'string' ? { parse_mode: extra } : extra;
    return ctx.reply(text, { parse_mode: 'Markdown', ...options });
};

// Допоміжна функція для отримання назви та юніту вправи
const getExerciseInfo = (type) => {
    return CHALLENGE_TYPES[type] || { name: 'Віджимання', unit: 'разів' };
};

const MESSAGES = {
    video: {
        getAbsurdInsult: () => {
            const phrases = [
                "Ти що, намагаєшся спокусити паркет? Це не підхід, це мікро-спазми! 🤨",
                "Гравітація сьогодні надто сильна, чи ти просто забув, як концентрувати чакру в м'язах?",
                "Підлога від тебе навіть не відсунулась. Ти маєш штовхати планету, а не просто лежати на ній!",
                "Це тренування чи клінч у боксі? Розривай дистанцію! Де амплітуда?",
                "Навіть хворий кіт, коли потягується вранці, робить це з більшою амплітудою. Давай по-справжньому!",
                "Твоє тіло щойно подало на тебе в суд за ігнорування. Працюй!"
            ];
            return phrases[Math.floor(Math.random() * phrases.length)];
        },

        tooShort: (reps, type) => {
            const exe = getExerciseInfo(type);
            return `🥱 ${MESSAGES.video.getAbsurdInsult()} (${reps} ${exe.unit} — це знущання з фізики)`;
        },

        alreadyDone: (name, comp, day) => `✋ Охолонь, ${name}! Ти й так сьогодні достатньо помучив планету (${comp}/${day} дн.). Залиш трохи сил на завтра.`,

        almost: (reps, target, type) => {
            const exe = getExerciseInfo(type);
            return `${ICON.WARN} Майже пробив стратосферу, але гравітація перемогла. Замовляли ${target} ${exe.unit} [${exe.name}], а в тебе ${reps}. Падай і дороблюй!`;
        },
        
        successHigh: (reps, target, type) => {
            const exe = getExerciseInfo(type);
            return `${ICON.FIRE} Обережно, ти так Землю з орбіти зіб'єш! Перевиконав план (+${reps - target} ${exe.unit}). Абсолютна машина!`;
        },
        
        successOk: `✅ База виконана. М'язи горять, гравітація покарана.`,

        icon: (isBroken) => isBroken ? '🦾' : '🔥',

        statusMessage: (reps, target, type) => reps > target ? MESSAGES.video.successHigh(reps, target, type) : MESSAGES.video.successOk,

        tooLow: (target, reps, type) => {
            const exe = getExerciseInfo(type);
            return `${ICON.WARN} Збій системи! Треба було ${target} ${exe.unit}, а детектор зафіксував лише ${reps}.`;
        },

        finalMsg: (user, personalDay, reps, targetData) => {
            const exe = getExerciseInfo(user.challengeType);
            const status = MESSAGES.video.statusMessage(reps, targetData.reps, user.challengeType);
            const challenge = user.activeChallenge ? `\n\n🎯 <b>АКТИВНЕ СПЕЦЗАВДАННЯ:</b>\n👉 ${user.activeChallenge}` : '';
            
            return `${status}${challenge}\n\n` +
                   `📊 Результат: ${user.completed}/${personalDay} дн.\n` +
                   `🏋️‍♂️ Дисципліна дня: <b>${exe.name}</b>\n` +
                   `⚡️ Стрік: ${user.currentStreak} ${MESSAGES.video.icon(user.isBroken)} | Загальний тоннаж: ${user.totalReps || 0} ${exe.unit}.`;
        },

        error: "❌ Матриця дала збій при збереженні відео. Зверніться до архітектора.",
        noCaption: "❌ Братику, ти забув головне! Напиши **кількість повторень** цифрами у підписі (caption) до відео, бо мої нейромережі ще не вміють рахувати по відео."
    },
    stats: {
        statsHeader: (day, getTargetFn, currentChallengeType = 'pushups') => {
            const exe = CHALLENGE_TYPES[currentChallengeType] || { name: 'Віджимання', unit: 'разів' };

            let header = `🏆 <b>ТАБЛИЦЯ ЛІДЕРІВ</b>\n`;
            header += `📅 <b>( День челенджу: ${day} / ${CHALLENGE_LIMIT} )</b>\n`;
            header += `────────────────────────\n`;
            header += `🏋️‍♂️ Дисципліна дня: <b>${exe.name}</b>\n`;
            header += `🎯 <b>Цілі на сьогодні:</b>\n\n`;

            const modes = [
                { key: 'easy', name: 'Easy', icon: '🟢' },
                { key: 'normal', name: 'Normal', icon: '🟡' },
                { key: 'hard', name: 'Hard', icon: '🔴' }
            ];

            modes.forEach(m => {
                const targetData = getTargetFn(day, m.key, currentChallengeType);
                const recoveryIcon = targetData.isRecovery ? ' 🔋' : '';
                header += ` ├ ${m.icon} ${m.name}: <b>${targetData.reps}</b> ${exe.unit}${recoveryIcon}\n`;
            });

            header += `────────────────────────\n\n`;
            return header;
        },
        
        userIcon: (isDebtor, position) => isDebtor ? ICON.DEBTOR : 
            (position === 0 ? ICON.MEDALS[0] : position === 1 ? ICON.MEDALS[1] : position === 2 ? ICON.MEDALS[2] : ICON.DEFAULT),

        userDebtorText: (isDebtor, diff) => isDebtor ? ` <i>(Борг: ${diff} дн. 💀)</i>` : '',

        userStreak: (u) => (!u.isBroken ? ` ${u.currentStreak}🔥` : ` ${u.currentStreak}`),

        userModeTag: (mode) => {
            const modes = { easy: '🟢', normal: '🟡', hard: '🔴' };
            return modes[mode] || '💀';
        },

        userInfo: (user, position, isDebtor, diff, personalDays) => {
            const userIcon = MESSAGES.stats.userIcon(isDebtor, position);
            const debtorText = MESSAGES.stats.userDebtorText(isDebtor, diff);
            const userStreak = MESSAGES.stats.userStreak(user);
            const modeTag = MESSAGES.stats.userModeTag(user.mode);
            const exe = getExerciseInfo(user.challengeType || 'pushups');
            const total = user.totalReps || 0; 

            const exStats = user.exercises || {};
            const p = exStats.pushups || 0;
            const s = exStats.squats || 0;
            const a = exStats.abs || 0;
            
            return `${userIcon}${modeTag} <b>${user.name || 'Анонім'}</b>${debtorText}\n` +
                `└ Днів: ${user.completed}/${personalDays} | ${ICON.RECORD}: ${user.maxStreak || 0} | Стрік:${userStreak}\n` +
                `└ 📊 <b>Прогрес:</b> ✊ ${p} | 🦵 ${s} | 🧱 ${a} (Усього: <b>${user.totalReps || 0}</b>)\n\n`;
        },

        remindHeader: (targetData, type = 'pushups') => {
            const exe = getExerciseInfo(type);
            return `📣 <b>ЗБІР ПО ТРИВОЗІ</b>\n` +
                   `🏋️‍♂️ Дисципліна: <b>${exe.name}</b>\n` +
                   `${ICON.TARGET} План на сьогодні: <b>${targetData.reps} ${exe.unit}</b> ${targetData.isRecovery ? '🔋 (Відновлення)' : ''}\n` +
                   `--------------------------\n\n`;
        },
        
        noStats: "Поки що ніхто не наважився кинути виклик гравітації.",
        remindNoDebtors: `😎 <b>Всі титани в строю!</b> Боржників немає, вогники палають ${ICON.FIRE}.`,
        remindFooter: FOOTER?.REMIND || ''
    },
    guide: {
        text: `
📖 <b>МАНУАЛ ПО ЗНИЩЕННЮ СЛАБКОСТІ v2.0</b>

1️⃣ <b>[ ОБРАННЯ ШЛЯХУ ]</b>
Перш ніж почати, обери свою складність командою /mode.

🟢 <b>EASY:</b> Старт від 5-10 повторень, крок +1. Відкат кожні 3 дні.
🟡 <b>NORMAL:</b> Старт від 10-20 повторень, крок +1. Відкат кожні 4 дні.
🔴 <b>HARD:</b> Старт від 10-20 повторень, крок <b>до +4</b>. Відкат кожні 4 дні.

2️⃣ <b>[ РОТАЦІЯ ДИСЦИПЛІН ]</b>
Кожен день о 00:00 бот обирає <b>випадкову дисципліну на день для всього чату</b> (Віджимання, Присідання або Прес). Поточне завдання автоматично закріплюється в групі.

3️⃣ <b>[ ВІДЕО ТА ЗВІТНІСТЬ ]</b>
Скидаєш відео (звичайне або кружечок) у чат.
❗️ <b>ОБОВ'ЯЗКОВО</b> вказуй кількість повторень <b>ЦИФРАМИ</b> у підписі (caption) до відео. Без цифри бот тебе не помітить.

4️⃣ <b>[ СИСТЕМА «ХВИЛІ» ]</b>
Коли ціль перевищує встановлений поріг, бот вмикає режим розвантаження: ціль <b>падає вдвічі</b>, плавно повертаючись до послідовного росту без стрибків. Актуальну ціль дивись у /me або в закріпленому повідомленні.

5️⃣ <b>[ ВОГНИК ТА БОРГИ ]</b>
✅ <b>Вчасно:</b> отримуєш 🔥 та +1 до стріку.
🔻 <b>Борг (1 день):</b> вогник під загрозою, стрік завмирає.
💀 <b>Борг (2+ дні):</b> вогник гасне. Стрік обнуляється, активні челенджі згорають.

6️⃣ <b>[ РИТУАЛ ВОСКРЕСІННЯ ]</b>
Щоб повернути вогник: закрий борги відео-звітами, натисни <b>"👊 Повернути вогник"</b> під своїм відео та виконай випадкове спецзавдання. Якщо 3+ учасники натиснуть <b>"✅ Гідно"</b> — вогник 🔥 воскресне!

<i>Команди: /stats, /me, /mode, /guide, /challenge.</i>
    `,
    },
    challenge: {
        intro: `👊 РИТУАЛ ПОВЕРНЕННЯ ВОГНИКА\n\n` +
                    `Ти втратив своє полум'я, але ще можеш спокутувати гріхи!\n` +
                    `Твій сьогоднішній звіт буде зараховано як спецзавдання.\n\n` +
                    `👉 Тобі випаде рандомний абсурдний челендж. Виконаєш його під час тренування — вогник повернеться.\n\n` +
                    `Ризикнеш своєю репутацією?`,

        go: `🚀 Я готовий страждати!`,

        accept: (challenge) => `🚀 Виклик прийнято! Твоя доля на сьогодні:\n\n👉 ${challenge}\n\nЗнімай відео (з цифрою в підписі!), скидай сюди і готуйся до суду присяжних!`,

        blockVote: "😂 Е, ні! Сам себе не похвалиш — ніхто не похвалить, але тут так не працює. Чекай рішення громади!",

        notNeeded: `😎 Твоя чакра в нормі, вогник горить! Тобі не потрібні ритуали воскресіння.`,

        locked: (debt, word) => `${ICON.WARN} Доступ заблоковано!\n\n` +
            `Ти надто глибоко в ямі. \n` +
            `Тобі треба здати ${debt} ${word}, щоб просто вийти в нуль. \n\n` +
            `Відіжми свої борги, і тільки тоді приходь за челенджем! 👊`,

        poll: (challenge, name) => `\n\n🥁 СУД ГРОМАДИ!\n\nСпецзавдання: "${challenge}"\n\nЧи гідний ${name} повернути свій вогник 🔥?!`,

        win: (name, streak) => `🔥 ВОГНИК ВОСКРЕС!\n\nГромада визнала, що ${name} — абсолютна машина. Рекордний стрік у **${streak}** 🔥 повністю відновлено!`,

        loss: `${ICON.BROKEN} <b>ЧЕЛЕНДЖ ВІДХИЛЕНО.</b> Громада відчула фальш і халяву. Вогник залишається в небутті.`,
        
        debtStillExists: `\n\n${ICON.WARN} Ти здав відео, але математика безжальна: ти все ще боржник. Вогник не повернуто.`,

        votingNotActive: "Цей суд уже закрито.",
        cancelAttempt: "Спроба анульована.",
        countVote: "Твій голос зараховано в протокол.",
        offerRestore: `⚡️ <b>Карма очищена! (Борги закрито)</b>\nБажаєш повернути свій вогник 🔥 через ритуал спецзавдання?`,
    },
    personal: {
        card: (u, day, targetData, nextTargetData, league) => {
            const modeEmoji = MESSAGES.stats.userModeTag(u.mode);
            const streakIcon = MESSAGES.video.icon(u.isBroken);
            const exe = getExerciseInfo(u.challengeType);
            
            // Налаштування статусів відкатів
            const todayTargetText = targetData.isRecovery 
                ? `<b>${targetData.reps} ${exe.unit}</b> 🔋 (Фаза відновлення)` 
                : `<b>${targetData.reps} ${exe.unit}</b>`;

            // Безпечно дістаємо статистику по кожній дисципліні з нового об'єкта exercises
            const exStats = u.exercises || {};
            const pushupsCount = exStats.pushups || 0;
            const squatsCount = exStats.squats || 0;
            const absCount = exStats.abs || 0;

            return `👤 <b>ПЕРСОНАЛЬНИЙ ПРОФІЛЬ</b>\n\n` +
                `<b>Атлет:</b> ${u.name}\n` +
                `<b>Ранг:</b> <b>${league.name}</b>\n` +
                `<b>Режим:</b> ${modeEmoji} ${u.mode.toUpperCase()}\n` +
                `──────────────\n\n` +
                `🎯<b>Твоя ціль на сьогодні:</b> \n ${exe.name} ${todayTargetText}\n\n` +
               
                `───────────────\n` +
                `🔥 <b>Поточний стрік:</b> ${u.currentStreak} ${streakIcon}\n` +
                `🏆 <b>Рекордний стрік:</b> ${u.maxStreak || 0}\n` +
                `💪 <b>Загальний тоннаж:</b> ${u.totalReps || 0} повторень\n\n` +
                `📊 <b>ПРОКАЧКА ЗА ДИСЦИПЛІНАМИ:</b>\n` +
                ` ├ ✊ Віджимання: <b>${pushupsCount}</b> разів\n` +
                ` ├ 🦵 Присідання: <b>${squatsCount}</b> разів\n` +
                ` └ 🧱 Прес / Скручування: <b>${absCount}</b> разів\n\n` +
                `👻 <b>Активний челендж:</b> ${u.activeChallenge || 'Челендж відсутній'}\n\n` +
                `<i>Використовуй /mode, щоб змінити складність.</i>`;
        }
    },
    settings: {
        chooseMode: "⚙️ <b>ОБЕРИ СВІЙ РІВЕНЬ СКЛАДНОСТІ</b>\n\n" +
                "Від цього залежить твоя щоденна норма та швидкість прогресу. " +
                "Хвильова система працює всюди: періодично вмикається розвантаження (50% від норми) для суперкомпенсації м'язів.\n\n" +
                "🟢 <b>EASY</b>\n" +
                "└ Старт: від 5 повторень\n" +
                "└ Прогрес: повільний (+1 щодня)\n" +
                "└ <i>Для тих, хто тільки прокинувся або відновлюється.</i>\n\n" +
                "🟡 <b>NORMAL</b>\n" +
                "└ Старт: від 10-20 повторень\n" +
                "└ Прогрес: стабільний (+1 щодня)\n" +
                "└ <i>Золотий стандарт. Рівномірний розвиток.</i>\n\n" +
                "🔴 <b>HARD</b>\n" +
                "└ Старт: від 10-20 повторень\n" +
                "└ Прогрес: агресивний (до +4 щодня)\n" +
                "└ <i>Шлях титана. Для тих, хто готовий розривати залізо.</i>",
        
        modeSelected: (mode, userName) => `✅ <b> ${userName} активував режим ${mode.toUpperCase()}!</b>\nТвій план оновлено під поточну дисципліну. Вдалого тренування! 🦾`
    }
};

module.exports = {
    MESSAGES,
    sendReply 
};