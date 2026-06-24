const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
    challengeLimit: { type: Number, default: 30 },
    isExtended: { type: Boolean, default: false },
    
    // ПОЛЯ ДЛЯ КЕРУВАННЯ ДИСЦИПЛІНОЮ ДНЯ
    currentChallengeType: { type: String, default: 'pushups' },
    lastUpdatedDate: { type: String, default: null }, // Формат: 'YYYY-MM-DD'
    
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Config', configSchema, 'config');