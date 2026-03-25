const { oauth2Client } = require('../config/google');
const User = require('../models/User');

exports.attachGoogleClient = async (req, res, next) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        if (!user || !user.googleTokens || !user.googleTokens.access_token) {
            return res.status(403).json({ error: 'Google Account not linked. Please authorize via /api/google/auth first.' });
        }

        // Set credentials on a new client instance per request to avoid leaks across users
        const client = new oauth2Client.constructor(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI
        );
        client.setCredentials(user.googleTokens);

        // Auto-refresh logic happens automatically by googleapis if refresh_token is set
        // We listen for the event to save the new access_token to DB
        client.on('tokens', async (tokens) => {
            const updates = { 'googleTokens.access_token': tokens.access_token };
            if (tokens.refresh_token) updates['googleTokens.refresh_token'] = tokens.refresh_token;
            if (tokens.expiry_date) updates['googleTokens.expiry_date'] = tokens.expiry_date;
            await User.findOneAndUpdate({ id: req.user.id }, { $set: updates });
        });

        req.googleClient = client;
        next();
    } catch (err) {
        next(err);
    }
};
