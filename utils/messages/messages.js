const { CHALLENGE_LIMIT } = require('../dates');
const { ICON, FOOTER } = require('./helpers');

const sendReply = (ctx, text, extra = {}) => {
    const options = typeof extra === 'string' ? { parse_mode: extra } : extra;
    return ctx.reply(text, { parse_mode: 'Markdown', ...options });
};

const MESSAGES = {
    video: {
        getAbsurdInsult: () => {
            const phrases = [
                "Ти що, намагаєшся спокусити паркет? Це не віджимання, це мікро-спазми! 🤨",
                "Гравітація сьогодні надто сильна, чи ти просто забув, як концентрувати чакру в руках?",
                "Підлога від тебе навіть не відсунулась. Ти маєш штовхати планету вниз, а не просто лежати на ній!",
                "Це віджимання чи клінч у боксі? Розривай дистанцію з підлогою! Де амплітуда?",
                "Навіть хворий кіт, коли потягується вранці, робить це з більшою амплітудою. Давай по-справжньому!",
                "Твої трицепси щойно подали на тебе в суд за ігнорування. Працюй!"
            ];
            return phrases[Math.floor(Math.random() * phrases.length)];
        },

        tooShort: (reps) => `🥱 ${MESSAGES.video.getAbsurdInsult()} (${reps} разів — це знущання з фізики)`,

        alreadyDone: (name, comp, day) => `✋ Охолонь, ${name}! Ти й так сьогодні достатньо побив підлогу (${comp}/${day} дн.). Залиш трохи планети на завтра.`,

        almost: (reps, target) => `${ICON.WARN} Майже пробив стратосферу, але гравітація перемогла. Замовляли ${target}, а в тебе ${reps}. Падай і дороблюй!`,
        
        successHigh: (reps, target) => `${ICON.FIRE} Обережно, ти так Землю з орбіти зіб'єш! Перевиконав план (+${reps - target} разів). Абсолютна машина!`,
        
        successOk: `✅ База виконана. Гравітація покарана.`,

        icon: (isBroken) => isBroken ? '🦾' : '🔥',

        statusMessage: (reps, target) => reps > target ? MESSAGES.video.successHigh(reps, target) : MESSAGES.video.successOk,

        tooLow: (target, reps) => `${ICON.WARN} Збій системи! Треба було ${target} разів, а детектор зафіксував лише ${reps}.`,

        statsSuffix: (comp, day, streak, icon, total) => 
            `${ICON.STAT} Результат: ${comp}/${day} дн.\n${ICON.BOLT} Стрік: ${streak} ${icon} | Всього: *${total} разів.*`,

        finalMsg: (user, personalDay, reps, target) => `${MESSAGES.video.statusMessage(reps, target)}${user.activeChallenge ? '\n\n' + user.activeChallenge : ''}\n\n` +
                            `📊 Результат: ${user.completed}/${personalDay} дн.\n` +
                            `⚡️ Стрік: ${user.currentStreak} ${MESSAGES.video.icon(user.isBroken)} | Загальний тоннаж: ${user.totalReps || 0} разів.`,

        error: "❌ Матриця дала збій при збереженні відео. Зверніться до архітектора.",

        noCaption: "❌ Братику, ти забув головне! Напиши **кількість віджимань** цифрами у підписі (caption) до відео, бо мої нейромережі ще не вміють рахувати по відео."
    },
    stats: {
        statsHeader: (day, targets) => {
            // targets — це тепер об'єкт з цілями для кожного режиму
            return `🏆 ТАБЛИЦЯ ЛІДЕРІВ \n<b>( День ${day} / ${CHALLENGE_LIMIT} )</b>\n` +
                `--------------------------\n` +
                `🎯 <b>Цілі на сьогодні:</b>\n` +
                `🟢 Easy: <b>${targets.easy}</b>  \n` +
                `🟡 Normal: <b>${targets.normal}</b>  \n` +
                `🔴 Hard: <b>${targets.hard}</b>\n` +
                `--------------------------\n`;
        },
        
        userIcon: (isDebtor, position) => isDebtor ? ICON.DEBTOR : 
            (position === 0 ? ICON.MEDALS[0] : position === 1 ? ICON.MEDALS[1] : position === 2 ? ICON.MEDALS[2] : ICON.DEFAULT),

        userDebtorText: (isDebtor, diff) => isDebtor ? ` <i>(Борг: ${diff} дн. 💀)</i>` : '',

        userStreak: (u) => (!u.isBroken ? ` ${u.currentStreak}🔥` : ` ${u.currentStreak}`),

        userModeTag: (mode) => {
            const modes = {
                easy: '🟢',
                normal: '🟡',
                hard: '🔴'
            };
            return modes[mode] || '💀';
        },

        userInfo: (user, position, isDebtor, diff, personalDays) => {
            const userIcon = MESSAGES.stats.userIcon(isDebtor, position);
            const debtorText = MESSAGES.stats.userDebtorText(isDebtor, diff);
            const userStreak = MESSAGES.stats.userStreak(user);
            const modeTag = MESSAGES.stats.userModeTag(user.mode); // Отримуємо емодзі режиму
            const total = user.totalReps || 0; 
            
            return `${userIcon}${modeTag} <b>${user.name || 'Анонім'}</b>${debtorText}\n` +
                `└ Днів: ${user.completed}/${personalDays} | ${ICON.RECORD}: ${user.maxStreak || 0} | Стрік:${userStreak}\n` +
                `└ Віджався: <b>${total} разів</b>\n\n`;
        },

        remindHeader: (target) => 
            `📣 <b>ЗБІР ПО ТРИВОЗІ</b>\n${ICON.TARGET} План на сьогодні: <b>${target} разів</b>\n--------------------------\n\n`,
        
        noStats: "Поки що ніхто не наважився кинути виклик гравітації.",
        remindNoDebtors: `😎 <b>Всі титани в строю!</b> Боржників немає, вогники палають ${ICON.FIRE}.`,
        remindFooter: FOOTER?.REMIND || ''
    },
guide: {
        text: `
📖 <b>МАНУАЛ ПО ЗНИЩЕННЮ СЛАБКОСТІ v2.0</b>

1️⃣ <b>[ ОБРАННЯ ШЛЯХУ ]</b>
Перш ніж почати, обери свою складність командою /mode.

🟢 <b>EASY:</b> Старт 5 разів, крок +1. Відкат кожні 3 дні.
🟡 <b>NORMAL:</b> Старт 10 разів, крок +1. Відкат кожні 4 дні.
🔴 <b>HARD:</b> Старт 10 разів, крок <b>+2</b>. Відкат кожні 4 дні.

2️⃣ <b>[ ВІДЕО ТА ЗВІТНІСТЬ ]</b>
Скидаєш відео (звичайне або кружечок) у чат.
❗️ <b>ОБОВ'ЯЗКОВО</b> вказуй кількість віджимань <b>ЦИФРАМИ</b> у підписі (caption) до відео. Без цифри бот тебе не помітить.

3️⃣ <b>[ СИСТЕМА «ХВИЛІ» ]</b>
Коли ціль перевищує 10–15 разів, бот вмикає режим відновлення: кожні 3 або 4 дні (залежно від режиму) ціль <b>падає вдвічі</b>. Це не халява, це стратегічний перепочинок перед новим піком. 
Актуальну ціль на сьогодні та завтра дивись у /me.

4️⃣ <b>[ ВОГНИК ТА БОРГИ ]</b>
✅ <b>Вчасно:</b> отримуєш 🔥 та +1 до стріку.
🔻 <b>Борг (1 день):</b> вогник під загрозою, стрік завмирає.
💀 <b>Борг (2+ дні):</b> вогник гасне. Ти офіційно "зламаний". Стрік обнуляється.

5️⃣ <b>[ РИТУАЛ ВОСКРЕСІННЯ ]</b>
Щоб повернути вогник (і свій рекордний стрік):
1. Наздожени графік (закрий пропущені дні звичайними відео).
2. Натисни кнопку <b>"👊 Повернути вогник"</b> під своїм відео.
3. Виконай треш-завдання від бота. Якщо 3+ учасники натиснуть <b>"✅ Гідно"</b> — вогник 🔥 повстане з попелу!

<i>Команди: /stats, /me, /mode, /guide.</i>
    `,
    },
    challenge: {
        intro: `👊 РИТУАЛ ПОВЕРНЕННЯ ВОГНИКА\n\n` +
                    `Ти втратив своє полум'я, але ще можеш спокутувати гріхи!\n` +
                    `Твій сьогоднішній звіт буде зараховано як спецзавдання.\n\n` +
                    `👉 Тобі випаде рандомний абсурдний челендж. Виконаєш його під час віджимань — вогник повернеться.\n\n` +
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

        win: (name) => `🔥 ВОГНИК ВОСКРЕС!\n\nГромада одноголосно (або майже) визнала, що ${name} — абсолютна машина.`,

        loss: `${ICON.BROKEN} <b>ЧЕЛЕНДЖ ВІДХИЛЕНО.</b> Громада відчула фальш і халяву. Вогник залишається в небутті.`,
        
        debtStillExists: `\n\n${ICON.WARN} Ти здав відео, але математика безжальна: ти все ще боржник. Вогник не повернуто.`,

        votingNotActive: "Цей суд уже закрито.",

        cancelAttempt: "Спроба анульована.",

        countVote: "Твій голос зараховано в протокол.",

        offerRestore: `⚡️ <b>Карма очищена! (Борги закрито)</b>\nБажаєш повернути свій вогник 🔥 через ритуал спецзавдання?`,
    },
    personal: {
        card: (u, day, target, nextTarget) => {
            const modeEmoji = MESSAGES.stats.userModeTag(u.mode);
            const streakIcon = MESSAGES.video.icon(u.isBroken);
            
            return `👤 <b>ПЕРСОНАЛЬНИЙ ПРОФІЛЬ</b>\n\n` +
                `<b>Атлет:</b> ${u.name}\n` +
                `<b>Режим:</b> ${modeEmoji} ${u.mode.toUpperCase()}\n` +
                `--------------------------\n` +
                `📈 <b>День:</b> ${day}/${CHALLENGE_LIMIT}\n` +
                `🎯 <b>Ціль на сьогодні:</b> <b>${target} разів</b>\n` +
                `⏭ <b>Завтра буде:</b> ${nextTarget} разів\n` +
                `--------------------------\n` +
                `🔥 <b>Поточний стрік:</b> ${u.currentStreak} ${streakIcon}\n` +
                `🏆 <b>Рекордний стрік:</b> ${u.maxStreak || 0}\n` +
                `💪 <b>Всього віджався:</b> ${u.totalReps || 0}\n` +
                `✅ <b>Виконано днів:</b> ${u.completed}\n\n` +
                `👻 <b>Активний челендж:</b> ${u.activeChallenge || 'Челендж відсутній'}\n\n` +
                `<i>Використовуй /mode, щоб змінити складність.</i>`;
        }
    },
    settings: {
        chooseMode: "⚙️ <b>ОБЕРИ СВІЙ РІВЕНЬ СКЛАДНОСТІ</b>\n\n" +
                "Від цього залежить твоя щоденна норма та швидкість прогресу. " +
                "Хвильова система працює всюди: кожен 4-й день — розвантаження (50% від норми).\n\n" +
                "🟢 <b>EASY</b>\n" +
                "└ Старт: 5 разів\n" +
                "└ Прогрес: +1 щодня\n" +
                "└ <i>Для тих, хто тільки прокинувся або відновлюється.</i>\n\n" +
                "🟡 <b>NORMAL</b>\n" +
                "└ Старт: 10 разів\n" +
                "└ Прогрес: +1 щодня\n" +
                "└ <i>Золотий стандарт. Стабільний розвиток.</i>\n\n" +
                "🔴 <b>HARD</b>\n" +
                "└ Старт: 10 разів\n" +
                "└ Прогрес: +2 щодня\n" +
                "└ <i>Шлях титана. Тільки для тих, хто готовий штовхати планету.</i>",
    
        modeSelected: (mode, userName) => `✅ <b> ${userName} активував режим ${mode.toUpperCase()}!</b>\nТвій план оновлено. Вдалого тренування! 🦾`
    }
}

module.exports = {
    MESSAGES,
    sendReply 
};