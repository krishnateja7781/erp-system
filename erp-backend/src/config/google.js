const { google } = require('googleapis');
require('dotenv').config();

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Scopes for Google Forms integration ONLY (used with Forms credentials)
const FORMS_SCOPES = [
    'https://www.googleapis.com/auth/forms.body',
    'https://www.googleapis.com/auth/forms.responses.readonly',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.metadata.readonly',
    'openid',
    'email',
    'profile',
];

// Combined scopes alias for backward compatibility
const SCOPES = FORMS_SCOPES;

module.exports = { oauth2Client, SCOPES, FORMS_SCOPES };

