#!/usr/bin/env node
/**
 * Production Initial Administrator Provisioning CLI Script
 *
 * Safely provisions an initial ADMIN user into the database using environment variables:
 *   ADMIN_EMAIL    - Administrator email address
 *   ADMIN_NAME     - Administrator full name (minimum 2 characters)
 *   ADMIN_PASSWORD - Administrator password (minimum 6 characters)
 *
 * Never accepts passwords via CLI arguments to avoid exposure in process tables or history.
 * Does not overwrite or modify existing accounts.
 */

require('dotenv').config();
const prisma = require('../src/config/db');
const { hashPassword } = require('../src/utils/password');

async function createAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim();
  const name = (process.env.ADMIN_NAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';

  // 1. Validation before database connection
  const errors = [];
  if (!name || name.length < 2) {
    errors.push('ADMIN_NAME environment variable is required (min 2 characters).');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('ADMIN_EMAIL environment variable is required and must be a valid email.');
  }

  if (!password || password.length < 6) {
    errors.push('ADMIN_PASSWORD environment variable is required (min 6 characters).');
  }

  if (errors.length > 0) {
    console.error('❌ Validation Error:');
    errors.forEach((err) => console.error(`   - ${err}`));
    process.exit(1);
  }

  try {
    // 2. Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true, email: true, role: true },
    });

    if (existing) {
      console.error(`❌ Safe Fail: An account with email "${email.toLowerCase()}" already exists (Role: ${existing.role}).`);
      console.error('   Aborting to prevent unintentional modification of existing accounts.');
      process.exit(1);
    }

    // 3. Hash password securely using existing utility
    const passwordHash = await hashPassword(password);

    // 4. Create ADMIN user
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'ADMIN',
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    console.log('✅ Initial Administrator account created successfully:');
    console.log(`   ID:    ${user.id}`);
    console.log(`   Name:  ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role:  ${user.role}`);
    console.log('   (Password was securely hashed and not logged)');
  } catch (err) {
    console.error('❌ Failed to create administrator account:', err.message || err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
