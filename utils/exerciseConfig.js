const EXERCISE_CONFIG = {
    pushups: {
        easy:   { base: 5,  step: 1, period: 3, threshold: 15 }, 
        normal: { base: 10, step: 1, period: 4, threshold: 15 }, 
        hard:   { base: 10, step: 2, period: 4, threshold: 20 }
    },
    squats: {
        easy:   { base: 5, step: 1, period: 3, threshold: 20 }, 
        normal: { base: 10, step: 2, period: 4, threshold: 30 }, 
        hard:   { base: 15, step: 3, period: 4, threshold: 40 }
    },
    abs: {
        easy:   { base: 5, step: 1, period: 3, threshold: 25 }, 
        normal: { base: 10, step: 2, period: 4, threshold: 30 }, 
        hard:   { base: 20, step: 3, period: 4, threshold: 40 }
    }
};

/**
 * Допоміжна функція для безпечного отримання конфігу.
 * Якщо дисципліну чи режим не знайдено — повертає дефолтний normal для віджимань.
 */
const getConfigForExercise = (exerciseType, mode) => {
    const exercise = EXERCISE_CONFIG[exerciseType] || EXERCISE_CONFIG.pushups;
    return exercise[mode] || exercise.normal;
};

module.exports = {
    EXERCISE_CONFIG,
    getConfigForExercise
};