const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true }, // Corresponds to ERP User ID
    role: { type: String, required: true, enum: ['student', 'teacher', 'admin'] },
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    googleTokens: {
        access_token: String,
        refresh_token: String,
        expiry_date: Number,
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
