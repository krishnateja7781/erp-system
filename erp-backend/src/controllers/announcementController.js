const { google } = require('googleapis');

exports.createAnnouncement = async (req, res, next) => {
    try {
        const { text } = req.body;
        const { courseId } = req.params;

        if (!text) {
            return res.status(400).json({ error: 'Announcement text is required' });
        }

        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        const response = await classroomAPI.courses.announcements.create({
            courseId,
            requestBody: {
                text,
                state: 'PUBLISHED',
                assigneeMode: 'ALL_STUDENTS'
            }
        });

        res.status(201).json({ success: true, announcement: response.data });
    } catch (error) {
        next(error);
    }
};

exports.listAnnouncements = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        const response = await classroomAPI.courses.announcements.list({
            courseId,
            announcementStates: ['PUBLISHED']
        });

        res.status(200).json({ announcements: response.data.announcements || [] });
    } catch (error) {
        next(error);
    }
};
