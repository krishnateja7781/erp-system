require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/errorHandler');

// Initialize App
const app = express();

// Connect to Database
connectDB();

// Middlewares
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express.json());

// Main Routes
app.use('/api/google', require('./src/routes/authRoutes'));
app.use('/api/google/forms', require('./src/routes/formRoutes'));
app.use('/api/classroom', require('./src/routes/classroomRoutes'));
app.use('/api/classroom', require('./src/routes/announcementRoutes'));
app.use('/api/classroom', require('./src/routes/assignmentRoutes'));
app.use('/api/classroom', require('./src/routes/submissionRoutes'));
app.use('/api/drive', require('./src/routes/driveRoutes'));

// 404 Route
app.use((req, res, next) => {
    res.status(404).json({ error: 'Endpoint Not Found' });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`ERP Google Classroom Integration Backend running on port ${PORT}`));
