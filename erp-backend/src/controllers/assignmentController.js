const { google } = require('googleapis');

exports.createAssignment = async (req, res, next) => {
    try {
        const { title, description, maxPoints, dueDate, dueTime, driveFileIds } = req.body;
        const { courseId } = req.params;

        if (!title) {
            return res.status(400).json({ error: 'Assignment title is required' });
        }

        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        // dueDate expected as { year, month, day }
        const requestBody = {
            title,
            description,
            maxPoints: maxPoints || 100,
            workType: 'ASSIGNMENT',
            state: 'PUBLISHED',
            materials: [],
        };

        if (dueDate && dueDate.year && dueDate.month && dueDate.day) {
            requestBody.dueDate = dueDate;
        }
        if (dueTime && dueTime.hours !== undefined) {
            requestBody.dueTime = dueTime;
        }

        // Attach Google Drive files as materials if provided
        if (driveFileIds && Array.isArray(driveFileIds) && driveFileIds.length > 0) {
            requestBody.materials = driveFileIds.map(fileId => ({
                driveFile: { driveFile: { id: fileId } }
            }));
        }

        const response = await classroomAPI.courses.courseWork.create({
            courseId,
            requestBody
        });

        res.status(201).json({ success: true, assignment: response.data });
    } catch (error) {
        next(error);
    }
};

exports.listAssignments = async (req, res, next) => {
    try {
        const { courseId } = req.params;
        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        const response = await classroomAPI.courses.courseWork.list({
            courseId,
            courseWorkStates: ['PUBLISHED']
        });

        res.status(200).json({ assignments: response.data.courseWork || [] });
    } catch (error) {
        next(error);
    }
};
