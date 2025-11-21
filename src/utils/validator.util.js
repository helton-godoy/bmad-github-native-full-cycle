/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate username format
 * @param {string} username - Username
 * @returns {boolean} True if valid (3-20 chars, alphanumeric + underscore)
 */
function isValidUsername(username) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
    return usernameRegex.test(username);
}

/**
 * Validate password strength
 * @param {string} password - Password
 * @returns {boolean} True if valid (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
 */
function isValidPassword(password) {
    if (password.length < 8) return false;
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasUppercase && hasLowercase && hasNumber;
}

/**
 * Validate registration input
 * @param {Object} data - Registration data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateRegistration(data) {
    const errors = [];

    if (!data.username) {
        errors.push('Username is required');
    } else if (!isValidUsername(data.username)) {
        errors.push('Username must be 3-20 characters, alphanumeric and underscore only');
    }

    if (!data.email) {
        errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.password) {
        errors.push('Password is required');
    } else if (!isValidPassword(data.password)) {
        errors.push('Password must be at least 8 characters with 1 uppercase, 1 lowercase, and 1 number');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validate login input
 * @param {Object} data - Login data
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateLogin(data) {
    const errors = [];

    if (!data.email) {
        errors.push('Email is required');
    } else if (!isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }

    if (!data.password) {
        errors.push('Password is required');
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

module.exports = {
    isValidEmail,
    isValidUsername,
    isValidPassword,
    validateRegistration,
    validateLogin,
};
