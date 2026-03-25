const jwt = require('jsonwebtoken');

// 1. Verify standard ERP JWT
exports.verifyToken = (req, res, next) => {
    // Support token via Authorization header OR query param (needed for OAuth popup flow)
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ error: 'Unauthorized: No token provided' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // Contains id, role, etc.
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
};

// 2. Role-based Access Control
exports.requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ error: 'Unauthorized: User role not found' });
        }
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                error: `Forbidden: Requires one of roles: ${allowedRoles.join(', ')}`
            });
        }
        next();
    };
};
