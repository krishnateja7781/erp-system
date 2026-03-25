const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

/**
 * Upload a file to Google Drive and return the file metadata.
 * The uploaded file is shared publicly so it can be attached to
 * Google Classroom assignments / submissions.
 */
exports.uploadToDrive = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file provided for upload.' });
        }

        const drive = google.drive({ version: 'v3', auth: req.googleClient });

        // 1. Upload file to Google Drive
        const fileMetadata = {
            name: req.file.originalname,
        };

        // If a target folder ID is provided, place the file there
        if (req.body.folderId) {
            fileMetadata.parents = [req.body.folderId];
        }

        const media = {
            mimeType: req.file.mimetype,
            body: fs.createReadStream(req.file.path),
        };

        const driveResponse = await drive.files.create({
            requestBody: fileMetadata,
            media,
            fields: 'id, name, webViewLink, webContentLink, mimeType',
        });

        // 2. Make the file readable by anyone with the link
        //    (required for Google Classroom attachments)
        await drive.permissions.create({
            fileId: driveResponse.data.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });

        // 3. Clean up the temporary local file
        fs.unlink(req.file.path, (err) => {
            if (err) console.error('Failed to remove temp file:', err);
        });

        res.status(201).json({
            success: true,
            file: {
                driveFileId: driveResponse.data.id,
                name: driveResponse.data.name,
                webViewLink: driveResponse.data.webViewLink,
                webContentLink: driveResponse.data.webContentLink,
                mimeType: driveResponse.data.mimeType,
            },
        });
    } catch (error) {
        // Clean up temp file on error
        if (req.file && req.file.path) {
            fs.unlink(req.file.path, () => {});
        }
        next(error);
    }
};

/**
 * Download / get a viewable link for a Google Drive file.
 * Returns the file metadata including download and view URLs.
 */
exports.getFileInfo = async (req, res, next) => {
    try {
        const { fileId } = req.params;

        if (!fileId) {
            return res.status(400).json({ error: 'File ID is required.' });
        }

        const drive = google.drive({ version: 'v3', auth: req.googleClient });

        const response = await drive.files.get({
            fileId,
            fields: 'id, name, webViewLink, webContentLink, mimeType, size',
        });

        res.status(200).json({ file: response.data });
    } catch (error) {
        next(error);
    }
};
