module.exports = (err, req, res, next) => {
    console.error('[Error Handler]:', err.message || err);

    // If error originated from Google API regarding tokens
    if (err.code === 401 || (err.response && err.response.status === 401)) {
        return res.status(401).json({
            error: 'Google Authentication expired or revoked. Please re-link your account.'
        });
    }

    // General Google API errors (e.g. 403 insufficient permissions)
    if (err.response && err.response.status) {
        return res.status(err.response.status).json({
            error: err.response.data.error.message || 'Google API Error'
        });
    }

    const status = err.status || 500;
    res.status(status).json({ error: err.message || 'Internal Server Error' });
};
