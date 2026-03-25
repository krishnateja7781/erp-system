const { oauth2Client, SCOPES } = require('../config/google');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ─── Issue JWT for ERP users ────────────────────────────
// Called by the Next.js frontend to bridge iron-session ↔ Express JWT auth.
// The frontend sends the user info from their session, and we return a JWT.
exports.issueToken = async (req, res) => {
    try {
        const { id, role, name, email } = req.body;
        if (!id || !role) {
            return res.status(400).json({ error: 'Missing id or role' });
        }

        // Upsert user in MongoDB so Google tokens can be stored later
        await User.findOneAndUpdate(
            { id },
            { $setOnInsert: { id, role, name: name || '', email: email || '' } },
            { upsert: true, new: true }
        );

        const token = jwt.sign(
            { id, role, name: name || '', email: email || '' },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(200).json({ success: true, token });
    } catch (error) {
        console.error('Issue Token Error:', error);
        res.status(500).json({ error: 'Failed to issue token' });
    }
};

// Initiate OAuth flow
exports.googleAuth = (req, res) => {
    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', // Crucial for receiving a refresh_token
        prompt: 'consent',      // Force consent to always get refresh_token
        scope: SCOPES,
        // Pass ERP user ID to track who is authenticating
        // req.user comes from the verifyToken middleware
        state: req.user.id
    });
    res.redirect(url);
};

// Handle OAuth callback
exports.googleCallback = async (req, res) => {
    const { code, state: userId } = req.query;

    if (!code || !userId) {
        return res.status(400).json({ error: 'Missing code or user state' });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        // Construct the updates
        const updates = {
            'googleTokens.access_token': tokens.access_token,
            'googleTokens.expiry_date': tokens.expiry_date
        };
        // Only update refresh_token if one was actually provided
        if (tokens.refresh_token) {
            updates['googleTokens.refresh_token'] = tokens.refresh_token;
        }

        // Upsert or update the user tokens
        const user = await User.findOneAndUpdate(
            { id: userId },
            { $set: updates },
            { new: true, upsert: false }
        );

        // If user record doesn't exist yet, create it so token storage works
        if (!user) {
            await User.create({
                id: userId,
                role: 'student', // Fallback role – the ERP should sync the correct role
                googleTokens: {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    expiry_date: tokens.expiry_date,
                }
            });
        }

        // Post success message to opener popup and close
        const frontendUrl = process.env.FRONTEND_URL || '*';
        res.send(`
            <html><body>
            <script>
                if (window.opener) {
                    window.opener.postMessage("google-auth-success", "${frontendUrl}");
                }
                window.close();
            </script>
            <p>Google Account linked successfully. You can close this window.</p>
            </body></html>
        `);
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        res.status(500).json({ error: 'OAuth Callback failed' });
    }
};

// Check if user has linked Google account
exports.googleStatus = async (req, res) => {
    try {
        const user = await User.findOne({ id: req.user.id });
        const linked = !!(user && user.googleTokens && user.googleTokens.access_token);
        res.status(200).json({ linked });
    } catch (error) {
        res.status(500).json({ error: 'Failed to check Google status' });
    }
};
