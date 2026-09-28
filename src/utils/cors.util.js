/**
 * Retrieves the allowed origins list based on CORS_ALLOWED_ORIGINS env variable
 * or default behavior depending on NODE_ENV.
 *
 * @param {string} [envOrigins=process.env.CORS_ALLOWED_ORIGINS] - Comma-separated allowed origins
 * @param {string} [nodeEnv=process.env.NODE_ENV] - Current Node environment
 * @returns {string[]} Array of allowed origin strings
 */
function getAllowedOrigins(envOrigins = process.env.CORS_ALLOWED_ORIGINS, nodeEnv = process.env.NODE_ENV) {
  if (envOrigins) {
    return envOrigins
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }
  return nodeEnv === 'production' ? [] : ['http://localhost:3000'];
}

/**
 * Validates request origin for CORS middleware.
 *
 * @param {string|undefined} origin - The request origin
 * @param {function} callback - Express CORS callback (err, allow)
 * @param {Object} [options] - Configuration options override
 * @param {string} [options.envOrigins]
 * @param {string} [options.nodeEnv]
 */
function validateOrigin(origin, callback, options = {}) {
  const nodeEnv = options.nodeEnv !== undefined ? options.nodeEnv : process.env.NODE_ENV;
  const envOrigins = options.envOrigins !== undefined ? options.envOrigins : process.env.CORS_ALLOWED_ORIGINS;
  const isProduction = nodeEnv === 'production';

  // Requests without origin header (e.g., mobile apps, curl, server-to-server)
  if (!origin) {
    if (isProduction) {
      return callback(new Error('Origin required in production'));
    }
    return callback(null, true);
  }

  const allowedOrigins = getAllowedOrigins(envOrigins, nodeEnv);

  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }

  return callback(new Error('Not allowed by CORS'));
}

module.exports = {
  getAllowedOrigins,
  validateOrigin,
};
