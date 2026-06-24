const LEAGUES = [
    { id: 'diamond', name: '💎 ДІАМАНТОВА ЛІГА (1000+ разів) 💎', min: 1000 },
    { id: 'platinum', name: '🛡 ПЛАТИНОВА ЛІГА (600-999 разів) 🛡', min: 600 },
    { id: 'gold',     name: '👑 ЗОЛОТА ЛІГА (300-599 разів) 👑', min: 300 },
    { id: 'silver',   name: '⚔️ СРІБНА ЛІГА (100-299 разів) ⚔️', min: 100 },
    { id: 'bronze',   name: '🪵 БРОНЗОВА ЛІГА (0-99 разів) 🪵', min: 0 }
];

const getLeagueId = (totalReps) => {
    if (totalReps >= 1000) return 'diamond';
    if (totalReps >= 600)  return 'platinum';
    if (totalReps >= 300)  return 'gold';
    if (totalReps >= 100)  return 'silver';
    return 'bronze';
};

/**
 * Нова функція: повертає повний об'єкт ліги, щоб бот міг прочитати .name
 */
const getLeague = (totalReps) => {
    const id = getLeagueId(totalReps);
    return LEAGUES.find(league => league.id === id) || LEAGUES[LEAGUES.length - 1];
};

module.exports = {
    LEAGUES,
    getLeagueId,
    getLeague // 🔥 Експортуємо нову функцію
};