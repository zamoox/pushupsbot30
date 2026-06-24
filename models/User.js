const mongoose = require('mongoose');

const challengeTypeEnum = ['combined', 'pushups', 'squats', 'abs'];

// Схема для детальної статистики по кожній дисципліні окремо
// Це дозволить легко додавати нові вправи в майбутньому
const exercisesStatsSchema = new mongoose.Schema({
    pushups: { type: Number, default: 0 },
    squats:  { type: Number, default: 0 },
    abs:     { type: Number, default: 0 }
    // pullups: { type: Number, default: 0 } <-- ось так просто додаси нову вправу потім
}, { _id: false }); // _id: false прибирає генерацію зайвих ID для внутрішнього об'єкта

// Головна схема користувача
const userSchema = new mongoose.Schema({
    userId: { type: Number, unique: true },
    name: String,
    username: { type: String, default: null }, // Твій нікнейм для авто-тегів @username
    completed: { type: Number, default: 0 },
    
    // Загальний тоннаж по всіх вправах разом (історичний максимум)
    totalReps: { type: Number, default: 0 }, 
    
    // 🔥 НОВЕ ПОЛЕ: Внутрішній об'єкт, де розділено лічильники для кожної дисципліни
    exercises: {
        type: exercisesStatsSchema,
        default: () => ({}) // Автоматично створює об'єкт з дефолтними нулями при реєстрації юзера
    },

    maxStreak: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    isBroken: { type: Boolean, default: false },
    canRestore: { type: Boolean, default: false },
    
    activeChallenge: { type: String, default: null },
    activePollId: { type: String, default: null },

    timezone: { type: String, default: 'Europe/Kyiv' },
    mode: { type: String, enum: ['easy', 'normal', 'hard'], default: 'normal' },

    challengeType: { type: String, enum: challengeTypeEnum, default: 'pushups' },
    lastCombinedType: { type: String, enum: challengeTypeEnum, default: null },
});

module.exports = mongoose.model('User', userSchema);