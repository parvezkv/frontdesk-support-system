const http = require('http');
const { execSync } = require('child_process');
const path = require('path');
const app = require('./src/app');
const prisma = require('./src/config/db');

let server;
const PORT = 5098;

function request(urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const { method = 'GET', headers = {}, body } = options;
    const req = http.request(
      {
        host: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runProvisioningTests() {
  console.log('🧪 Starting User Provisioning & Registration Security Test Suite...\n');
  server = app.listen(PORT);

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAILED: ${message}`);
      failed++;
    }
  }

  // Track created test emails for cleanup
  const createdTestEmails = [];

  try {
    // 0. Login as existing seeded personas to get real tokens
    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'admin@frontdesk.com', password: 'password123' },
    });
    const adminToken = adminLogin.data.token;

    const agentLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'agent.sarah@frontdesk.com', password: 'password123' },
    });
    const agentToken = agentLogin.data.token;

    const customerLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@example.com', password: 'password123' },
    });
    const customerToken = customerLogin.data.token;

    console.log('1. Anonymous Registration:');
    // Test 1: Anonymous CUSTOMER registration succeeds
    const emailCust1 = `test.cust.${Date.now()}@example.com`;
    createdTestEmails.push(emailCust1);
    const res1 = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Anonymous Customer',
        email: emailCust1,
        password: 'securePassword123!',
      },
    });
    assert(res1.status === 201 && res1.data.user?.role === 'CUSTOMER', 'Anonymous CUSTOMER registration succeeds with role CUSTOMER');
    assert(Boolean(res1.data.user?.customerId), 'Anonymous CUSTOMER registration creates linked customer record');

    // Test 2: Anonymous ADMIN registration is rejected
    const emailAdminFake = `fake.admin.${Date.now()}@example.com`;
    const res2 = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Attacker Admin',
        email: emailAdminFake,
        password: 'securePassword123!',
        role: 'ADMIN',
      },
    });
    assert(res2.status === 403, 'Anonymous ADMIN registration is rejected with 403 Forbidden');

    // Test 3: Anonymous AGENT registration is rejected
    const emailAgentFake = `fake.agent.${Date.now()}@example.com`;
    const res3 = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Attacker Agent',
        email: emailAgentFake,
        password: 'securePassword123!',
        role: 'AGENT',
      },
    });
    assert(res3.status === 403, 'Anonymous AGENT registration is rejected with 403 Forbidden');

    console.log('\n2. Authenticated Admin Role Provisioning:');
    // Test 4: Authenticated ADMIN can create an AGENT
    const emailAgentNew = `new.agent.${Date.now()}@frontdesk.com`;
    createdTestEmails.push(emailAgentNew);
    const res4 = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'New Support Agent',
        email: emailAgentNew,
        password: 'agentSecurePass123!',
        role: 'AGENT',
      },
    });
    assert(res4.status === 201 && res4.data.user?.role === 'AGENT', 'Authenticated ADMIN can create an AGENT');

    // Test 5: Authenticated ADMIN can create another ADMIN
    const emailAdminNew = `new.admin.${Date.now()}@frontdesk.com`;
    createdTestEmails.push(emailAdminNew);
    const res5 = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Secondary Admin',
        email: emailAdminNew,
        password: 'adminSecurePass123!',
        role: 'ADMIN',
      },
    });
    assert(res5.status === 201 && res5.data.user?.role === 'ADMIN', 'Authenticated ADMIN can create another ADMIN');

    console.log('\n3. Privilege Escalation Prevention:');
    // Test 6: Authenticated AGENT cannot create an ADMIN or AGENT
    const emailAgentEsc = `esc.agent.${Date.now()}@frontdesk.com`;
    const res6a = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: {
        name: 'Agent Spawn Agent',
        email: emailAgentEsc,
        password: 'password123',
        role: 'AGENT',
      },
    });
    assert(res6a.status === 403, 'Authenticated AGENT cannot create an AGENT (403 Forbidden)');

    const res6b = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${agentToken}` },
      body: {
        name: 'Agent Spawn Admin',
        email: emailAgentEsc,
        password: 'password123',
        role: 'ADMIN',
      },
    });
    assert(res6b.status === 403, 'Authenticated AGENT cannot create an ADMIN (403 Forbidden)');

    // Test 7: Authenticated CUSTOMER cannot create an ADMIN or AGENT
    const emailCustEsc = `esc.cust.${Date.now()}@example.com`;
    const res7a = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        name: 'Cust Spawn Admin',
        email: emailCustEsc,
        password: 'password123',
        role: 'ADMIN',
      },
    });
    assert(res7a.status === 403, 'Authenticated CUSTOMER cannot create an ADMIN (403 Forbidden)');

    const res7b = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: `Bearer ${customerToken}` },
      body: {
        name: 'Cust Spawn Agent',
        email: emailCustEsc,
        password: 'password123',
        role: 'AGENT',
      },
    });
    assert(res7b.status === 403, 'Authenticated CUSTOMER cannot create an AGENT (403 Forbidden)');

    console.log('\n4. Token Validation & Middleware Security:');
    // Test 8: Invalid or expired Bearer token is rejected
    const res8 = await request('/api/auth/register', {
      method: 'POST',
      headers: { Authorization: 'Bearer invalid.malformed.token' },
      body: {
        name: 'Invalid Token Test',
        email: `invalid.token.${Date.now()}@example.com`,
        password: 'password123',
        role: 'AGENT',
      },
    });
    assert(res8.status === 401, 'Invalid Bearer token is rejected with 401 Unauthorized');

    console.log('\n5. CLI Initial Admin Provisioning Script:');
    // Test 9: Duplicate administrator email fails safely in create-admin.js
    const scriptPath = path.join(__dirname, 'scripts', 'create-admin.js');
    let duplicateRejected = false;
    try {
      execSync(`node "${scriptPath}"`, {
        env: {
          ...process.env,
          ADMIN_EMAIL: 'admin@frontdesk.com',
          ADMIN_NAME: 'Duplicate Admin',
          ADMIN_PASSWORD: 'secureAdminPassword999!',
        },
        stdio: 'pipe',
      });
    } catch (err) {
      duplicateRejected = err.status !== 0;
    }
    assert(duplicateRejected, 'CLI create-admin script fails safely when email already exists (non-zero exit code)');

    // Verify existing admin@frontdesk.com was NOT modified
    const adminAfter = await prisma.user.findUnique({
      where: { email: 'admin@frontdesk.com' },
      select: { name: true, role: true },
    });
    assert(adminAfter.name === 'System Administrator' && adminAfter.role === 'ADMIN', 'Existing admin account name and role were preserved');

    console.log('\n6. Password Hash Storage Security:');
    // Test 10: Created passwords are stored as bcrypt hashes
    const newUserRecord = await prisma.user.findUnique({
      where: { email: emailCust1 },
      select: { passwordHash: true },
    });
    const isBcrypt = typeof newUserRecord?.passwordHash === 'string' &&
      (newUserRecord.passwordHash.startsWith('$2a$') || newUserRecord.passwordHash.startsWith('$2b$'));
    assert(isBcrypt, 'Created user password is stored as a valid bcrypt hash');
    assert(newUserRecord?.passwordHash !== 'securePassword123!', 'Plaintext password is never stored in the database');

  } finally {
    // Clean up test users
    if (createdTestEmails.length > 0) {
      await prisma.customer.deleteMany({
        where: { email: { in: createdTestEmails } },
      });
      await prisma.user.deleteMany({
        where: { email: { in: createdTestEmails } },
      });
    }

    server.close();
    await prisma.$disconnect();
  }

  console.log('\n===============================================================');
  console.log(`User Provisioning Results: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runProvisioningTests().catch((err) => {
  console.error('Fatal error during provisioning test run:', err);
  if (server) server.close();
  process.exit(1);
});
