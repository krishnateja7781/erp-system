const { google } = require('googleapis');
const { oauth2Client } = require('../config/google');
const User = require('../models/User');

// ─── Helper: set credentials and return clients ──────────
async function getAuthenticatedClients(userId) {
    const user = await User.findOne({ id: userId });
    if (!user || !user.googleTokens || !user.googleTokens.access_token) {
        const err = new Error('Not connected to Google Workspace. Please authorize via the Connect button.');
        err.statusCode = 401;
        throw err;
    }
    oauth2Client.setCredentials(user.googleTokens);
    return {
        drive: google.drive({ version: 'v3', auth: oauth2Client }),
        forms: google.forms({ version: 'v1', auth: oauth2Client }),
    };
}

// ─── List forms from Google Drive ────────────────────────
exports.getForms = async (req, res) => {
    try {
        const { drive } = await getAuthenticatedClients(req.user.id);
        const response = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.form' and trashed=false",
            fields: 'files(id, name, webViewLink, createdTime, modifiedTime)',
            orderBy: 'modifiedTime desc',
            pageSize: 30
        });
        res.status(200).json({ forms: response.data.files || [] });
    } catch (error) {
        console.error('Get Forms Error:', error?.response?.data || error.message);
        const status = error.statusCode || 500;
        // Friendly messages for common errors
        const gCode = error?.code || error?.response?.data?.error?.code;
        if (gCode === 403 || status === 403) {
            return res.status(403).json({ 
                error: 'Permission denied. Your connected account needs to re-authorize with updated scopes. Please disconnect and re-connect your Google Account.',
                needsReconnect: true
            });
        }
        res.status(status).json({ error: error.message || 'Failed to fetch forms from Google Drive' });
    }
};

// ─── Create a new Google Form ─────────────────────────────
exports.createForm = async (req, res) => {
    try {
        const { title, description } = req.body;
        const { forms } = await getAuthenticatedClients(req.user.id);

        const response = await forms.forms.create({
            requestBody: {
                info: {
                    title: title || 'New ERP Quiz',
                    documentTitle: title || 'New ERP Quiz',
                }
            }
        });

        // If description is provided, add it via batchUpdate
        if (description && response.data.formId) {
            try {
                await forms.forms.batchUpdate({
                    formId: response.data.formId,
                    requestBody: {
                        requests: [{
                            updateFormInfo: {
                                info: { description },
                                updateMask: 'description'
                            }
                        }]
                    }
                });
            } catch (e) {
                // Non-fatal - form was still created
                console.warn('Could not add description:', e.message);
            }
        }

        res.status(200).json({ form: response.data });
    } catch (error) {
        console.error('Create Form Error:', error?.response?.data || error.message);
        const gCode = error?.code || error?.response?.data?.error?.code;
        if (gCode === 403) {
            return res.status(403).json({
                error: 'Permission denied. Please disconnect and reconnect your Google Account to grant Forms permissions.',
                needsReconnect: true
            });
        }
        res.status(500).json({ error: error.message || 'Failed to create Google Form' });
    }
};

// ─── Get responses for a form ─────────────────────────────
exports.getResponses = async (req, res) => {
    try {
        const { formId } = req.params;
        const { forms } = await getAuthenticatedClients(req.user.id);
        const response = await forms.forms.responses.list({ formId });
        res.status(200).json({ responses: response.data.responses || [] });
    } catch (error) {
        console.error('Get Responses Error:', error?.response?.data || error.message);
        res.status(500).json({ error: error.message || 'Failed to fetch form responses' });
    }
};

// ─── Disconnect Google account (clear tokens) ─────────────
exports.disconnectGoogle = async (req, res) => {
    try {
        await User.findOneAndUpdate(
            { id: req.user.id },
            { $unset: { googleTokens: 1 } }
        );
        res.status(200).json({ success: true, message: 'Google account disconnected.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect Google account' });
    }
};
