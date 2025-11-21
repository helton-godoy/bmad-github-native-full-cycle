const Joi = require('joi');

/**
 * Validate registration payload
 */
function validateRegistration(data) {
    const schema = Joi.object({
        username: Joi.string().alphanum().min(3).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(8).required(),
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
        return { valid: false, errors: error.details.map(d => d.message) };
    }
    return { valid: true, value };
}

/**
 * Validate login payload
 */
function validateLogin(data) {
    const schema = Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required(),
    });

    const { error, value } = schema.validate(data, { abortEarly: false });
    if (error) {
        return { valid: false, errors: error.details.map(d => d.message) };
    }
    return { valid: true, value };
}

module.exports = { validateRegistration, validateLogin };
