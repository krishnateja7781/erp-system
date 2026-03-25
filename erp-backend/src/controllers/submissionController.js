const { google } = require('googleapis');

exports.submitAssignment = async (req, res, next) => {
    try {
        const { courseId, assignmentId } = req.params;
        const { driveFileId } = req.body;

        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        // 1. Fetch the student's submission resource ID for this coursework
        const submissionsList = await classroomAPI.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: assignmentId,
            userId: 'me'
        });

        if (!submissionsList.data.studentSubmissions || submissionsList.data.studentSubmissions.length === 0) {
            return res.status(404).json({ error: 'No submission resource found for this user.' });
        }

        const submissionId = submissionsList.data.studentSubmissions[0].id;

        // 2. Attach a Google Drive file if provided (Optional depending on assignment type)
        if (driveFileId) {
            await classroomAPI.courses.courseWork.studentSubmissions.modifyAttachments({
                courseId,
                courseWorkId: assignmentId,
                id: submissionId,
                requestBody: {
                    addAttachments: [{ driveFile: { id: driveFileId } }]
                }
            });
        }

        // 3. Turn in the assignment
        await classroomAPI.courses.courseWork.studentSubmissions.turnIn({
            courseId,
            courseWorkId: assignmentId,
            id: submissionId,
            requestBody: {}
        });

        res.status(200).json({ success: true, message: 'Assignment submitted successfully' });
    } catch (error) {
        next(error);
    }
};

exports.listSubmissions = async (req, res, next) => {
    try {
        const { courseId, assignmentId } = req.params;
        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        const response = await classroomAPI.courses.courseWork.studentSubmissions.list({
            courseId,
            courseWorkId: assignmentId
        });

        res.status(200).json({ submissions: response.data.studentSubmissions || [] });
    } catch (error) {
        next(error);
    }
};
