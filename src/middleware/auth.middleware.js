const { verifyToken } = require('../utils/jwt.util');

/**
 * Authentication middleware to protect routes
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
        return res.status(401).json({ error: 'AUTH_HEADER_MISSING' });
    }

    const token = authHeader.split(' ')[1]; // Expect Bearer <token>
    if (!token) {
        return res.status(401).json({ error: 'TOKEN_MISSING' });
    }

    try {
        const payload = verifyToken(token);
        req.user = payload; // Attach payload to request
        next();
    } catch (err) {
        const status = err.message === 'TOKEN_EXPIRED' ? 401 : 403;
        return res.status(status).json({ error: err.message });
    }
}

module.exports = authMiddleware;
