const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET || 'frontdesk_jwt_secret_fallback',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
};

if (!config.databaseUrl) {
  console.warn('⚠️ WARNING: DATABASE_URL is not set in environment variables.');
}

if (!process.env.JWT_SECRET) {
  console.warn('⚠️ WARNING: JWT_SECRET is not set. Using fallback development secret.');
}

module.exports = config;
