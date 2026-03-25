/**
 * Remove sensitive information from user object
 * @param {Object} user - User object
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

module.exports = {
  sanitizeUser,
};
