/**
 * Remove sensitive information from user object
 * @param {Object} user - User object
 * @returns {Object} Sanitized user object
 */
function sanitizeUser(user) {
  if (!user) return null;
  const userWithoutSensitiveData = { ...user };
  delete userWithoutSensitiveData.password;
  delete userWithoutSensitiveData.passwordHash;
  return userWithoutSensitiveData;
}

module.exports = {
  sanitizeUser,
};
