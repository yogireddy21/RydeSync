const Joi = require('joi');

const envSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  MONGODB_URI: Joi.string().required(),
  REDIS_URL: Joi.string().allow('').default(''),
  REDIS_HOST: Joi.string().allow('').default(''),
  REDIS_PORT: Joi.number().allow('').default(6379),
  REDIS_PASSWORD: Joi.string().allow('').default(''),
  JWT_SECRET: Joi.string().required(),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_ACCESS_EXPIRY: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRY: Joi.string().default('7d'),
}).unknown(true);

const { error, value } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation failed: ${error.message}`);
}

module.exports = value;