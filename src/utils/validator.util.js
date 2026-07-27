const Joi = require('joi');

/**
 * Validate registration payload
 */
function validateRegistration(data) {
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Registration data is required and must be an object'] };
  }

  const schema = Joi.object({
    username: Joi.string().min(3).max(30).pattern(/^[a-zA-Z0-9_]+$/).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
  });

  const { error, value } = schema.validate(data, { abortEarly: false, stripUnknown: true });
  if (error) {
    return { valid: false, errors: error.details.map((d) => d.message) };
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
    return { valid: false, errors: error.details.map((d) => d.message) };
  }
  return { valid: true, value };
}

module.exports = { validateRegistration, validateLogin };
