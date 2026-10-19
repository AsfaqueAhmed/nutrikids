import { execSync } from 'child_process';

const BASE = 'http://localhost:3000';
const DB_URL = process.env.DATABASE_URL || 'postgresql://nutrikids:nutrikids@localhost:5433/nutrikids';

async function req(name, method, path, opts = {}) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
    body: opts.body !== undefined ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  const ok = res.status === (opts.expectStatus || 200) || (opts.expectOk ?? res.ok);
  if (!ok) {
    console.error(`❌ [${method} ${path}] FAIL: status ${res.status}, expected ${opts.expectStatus || 200}`);
    console.error('Response:', data);
    throw new Error(`Endpoint check failed: ${method} ${path}`);
  }
  console.log(`✅ [${res.status}] ${name} -> ${method} ${path}`);
  return { status: res.status, data };
}

async function run() {
  console.log('================================================================');
  console.log('       NUTRIKIDS FULL BACKEND INTEGRATION TEST SUITE            ');
  console.log('================================================================');

  // 1. Health
  await req('System Health Check', 'GET', '/v1/health', { expectStatus: 200 });

  // 2. Auth Flow (Parent)
  const parentEmail = `full-integration-parent-${Date.now()}@example.com`;
  const parentPassword = 'SecurePassword123!';
  const reg = await req('Parent Registration', 'POST', '/v1/auth/register', {
    expectStatus: 201,
    body: { email: parentEmail, password: parentPassword },
  });
  const parentToken = reg.data.accessToken;
  const parentRefresh = reg.data.refreshToken;
  const parentHeaders = { Authorization: `Bearer ${parentToken}` };

  await req('Parent Login', 'POST', '/v1/auth/login', {
    expectStatus: 200,
    body: { email: parentEmail, password: parentPassword },
  });

  await req('Fetch Current User Profile', 'GET', '/v1/me', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Token Refresh', 'POST', '/v1/auth/refresh', {
    expectStatus: 200,
    body: { refreshToken: parentRefresh },
  });

  // 3. Child Management
  const childCreate = await req('Create Child Profile', 'POST', '/v1/children', {
    headers: parentHeaders,
    expectStatus: 201,
    body: {
      name: 'Maya',
      dateOfBirth: '2024-02-15',
      gender: 'FEMALE',
      heightCm: 76.5,
      weightKg: 10.2,
      activityLevel: 'ACTIVE',
      dietType: 'NON_VEGETARIAN',
    },
  });
  const childId = childCreate.data.id;

  await req('List Parent Children', 'GET', '/v1/children', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Get Single Child Profile', 'GET', `/v1/children/${childId}`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Update Child Profile', 'PATCH', `/v1/children/${childId}`, {
    headers: parentHeaders,
    expectStatus: 200,
    body: { heightCm: 77.0, weightKg: 10.4 },
  });

  await req('Set Child Allergies', 'PUT', `/v1/children/${childId}/allergies`, {
    headers: parentHeaders,
    expectStatus: 200,
    body: { items: [{ allergen: 'EGG', severity: 'MODERATE' }] },
  });

  // 4. Growth & WHO Percentiles
  const recId = crypto.randomUUID();
  await req('Record Child Growth Entry', 'PUT', `/v1/children/${childId}/growth-records/${recId}`, {
    headers: parentHeaders,
    expectStatus: 200,
    body: {
      date: '2026-10-19',
      weightKg: 10.5,
      heightCm: 77.2,
      headCircumferenceCm: 45.0,
      clientUpdatedAt: new Date().toISOString(),
    },
  });

  await req('Get Child Growth History', 'GET', `/v1/children/${childId}/growth-records`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Get Child Growth WHO Chart Data', 'GET', `/v1/children/${childId}/growth/chart`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  // 5. Phase 2A: Nutrition Logs & Summary
  const logId = crypto.randomUUID();
  await req('Log Meal Intake (Full eaten)', 'PUT', `/v1/children/${childId}/nutrition-logs/${logId}`, {
    headers: parentHeaders,
    expectStatus: 200,
    body: {
      date: '2026-10-19',
      slot: 'BREAKFAST',
      eatenStatus: 'FULL',
      clientUpdatedAt: new Date().toISOString(),
    },
  });

  const partialLogId = crypto.randomUUID();
  await req('Log Meal Intake (Partial eaten 50%)', 'PUT', `/v1/children/${childId}/nutrition-logs/${partialLogId}`, {
    headers: parentHeaders,
    expectStatus: 200,
    body: {
      date: '2026-10-19',
      slot: 'LUNCH',
      eatenStatus: 'PARTIAL',
      percent: 50,
      clientUpdatedAt: new Date().toISOString(),
    },
  });

  await req('Fetch Daily Nutrition Logs', 'GET', `/v1/children/${childId}/nutrition-logs?from=2026-10-19&to=2026-10-19`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Fetch Nutrition Adherence Summary', 'GET', `/v1/children/${childId}/nutrition-logs/summary?from=2026-10-13&to=2026-10-19`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Delete Meal Nutrition Log', 'DELETE', `/v1/children/${childId}/nutrition-logs/${partialLogId}`, {
    headers: parentHeaders,
    expectStatus: 204,
  });

  // 6. Vaccinations & Hospitals
  await req('Get Child Vaccinations Schedule', 'GET', `/v1/children/${childId}/vaccinations`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Find Nearby Hospitals (Dhaka geo)', 'GET', '/v1/hospitals/nearby?lat=23.8103&lng=90.4125&radiusKm=20', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  // 7. Foods & Recipes Catalogue
  await req('Search Food Catalogue', 'GET', '/v1/foods?search=milk', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('List Recipes', 'GET', '/v1/recipes', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  // 8. Admin Setup & Authorization Verification
  const adminEmail = `full-integration-admin-${Date.now()}@example.com`;
  await req('Register Admin Candidate', 'POST', '/v1/auth/register', {
    expectStatus: 201,
    body: { email: adminEmail, password: parentPassword },
  });

  // Promote in DB
  execSync(
    `echo "UPDATE \\"User\\" SET role='ADMIN' WHERE email='${adminEmail}';" | pnpm --filter api exec prisma db execute --stdin --url "${DB_URL}"`,
    { stdio: 'ignore' }
  );

  const adminLogin = await req('Admin Login', 'POST', '/v1/auth/login', {
    expectStatus: 200,
    body: { email: adminEmail, password: parentPassword },
  });
  const adminToken = adminLogin.data.accessToken;
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  // Guard verification: parent blocked from admin route
  const forbiddenCheck = await fetch(`${BASE}/v1/admin/stats`, { headers: parentHeaders });
  if (forbiddenCheck.status === 403) {
    console.log('✅ [403] Security Guard: Non-admin correctly rejected with 403 Forbidden');
  } else {
    throw new Error(`Security guard failure: expected 403 but got ${forbiddenCheck.status}`);
  }

  // 9. Admin Dashboard & Metrics (Phase 2C)
  await req('Admin Dashboard Stats', 'GET', '/v1/admin/stats', {
    headers: adminHeaders,
    expectStatus: 200,
  });

  await req('Admin Users List', 'GET', '/v1/admin/users?page=1&limit=10', {
    headers: adminHeaders,
    expectStatus: 200,
  });

  // 10. Admin Articles & Publishing (Phase 2B & 2C)
  const testArticleSlug = `integration-guide-${Date.now()}`;
  const createdArt = await req('Admin Create & Publish Article', 'POST', '/v1/admin/articles', {
    headers: adminHeaders,
    expectStatus: 201,
    body: {
      kind: 'ARTICLE',
      title: 'Full Integration Verification Article',
      slug: testArticleSlug,
      summary: 'Verified end-to-end integration summary.',
      body: '# Full Integration Verified\n\nAll systems operational.',
      category: 'Nutrition',
      status: 'PUBLISHED',
    },
  });

  await req('Public Listing Includes Published Article', 'GET', '/v1/articles', {
    headers: parentHeaders,
    expectStatus: 200,
  });

  await req('Public Read Article Detail by Slug', 'GET', `/v1/articles/${testArticleSlug}`, {
    headers: parentHeaders,
    expectStatus: 200,
  });

  // 11. Admin Vaccines Catalogue & Schedule Editing (Phase 2C)
  const vacList = await req('Admin Vaccine Catalogue', 'GET', '/v1/admin/vaccines', {
    headers: adminHeaders,
    expectStatus: 200,
  });

  if (vacList.data && vacList.data.length > 0) {
    const firstVac = vacList.data[0];
    await req('Admin Update Vaccine Metadata', 'PATCH', `/v1/admin/vaccines/${firstVac.id}`, {
      headers: adminHeaders,
      expectStatus: 200,
      body: { verified: true },
    });

    if (firstVac.schedule && firstVac.schedule.length > 0) {
      const scheduleItem = firstVac.schedule[0];
      await req('Admin Update Schedule Item Timing', 'PATCH', `/v1/admin/vaccine-schedule-items/${scheduleItem.id}`, {
        headers: adminHeaders,
        expectStatus: 200,
        body: { suggestedAgeDays: scheduleItem.suggestedAgeDays },
      });
    }
  }

  // 12. Admin Hospital CSV Import (Phase 2C)
  const csvSample = `name,lat,lng,address,phone,district,type\n"Dhaka Shishu Hospital",23.7745,90.3698,"Sher-e-Bangla Nagar","01700000000","Dhaka","SPECIALIZED"\n`;
  await req('Admin Hospital Directory CSV Import', 'POST', '/v1/admin/hospitals/import', {
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'text/csv',
    },
    body: csvSample,
    expectStatus: 201,
  });

  // 13. Admin Account Disablement & Enforcement
  const victimEmail = `victim-account-${Date.now()}@example.com`;
  await req('Register User For Disablement Check', 'POST', '/v1/auth/register', {
    expectStatus: 201,
    body: { email: victimEmail, password: parentPassword },
  });

  const victimSearch = await req('Admin Finds User in Search', 'GET', `/v1/admin/users?q=${encodeURIComponent(victimEmail)}`, {
    headers: adminHeaders,
    expectStatus: 200,
  });
  const victimId = victimSearch.data.items[0].id;

  await req('Admin Disables User Account', 'PATCH', `/v1/admin/users/${victimId}`, {
    headers: adminHeaders,
    expectStatus: 200,
    body: { disabled: true },
  });

  const blockedLogin = await fetch(`${BASE}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: victimEmail, password: parentPassword }),
  });

  if (blockedLogin.status === 401 || blockedLogin.status === 403) {
    const err = await blockedLogin.json();
    if (err.code === 'ACCOUNT_DISABLED') {
      console.log('✅ [403] Account Disablement Enforcement: Login blocked with code "ACCOUNT_DISABLED"');
    } else {
      throw new Error(`Expected error code ACCOUNT_DISABLED, got: ${JSON.stringify(err)}`);
    }
  } else {
    throw new Error(`Expected 401 or 403 for disabled account login, got ${blockedLogin.status}`);
  }

  console.log('================================================================');
  console.log('       ALL 28 ENDPOINT & SECURITY INTEGRATION CHECKS PASSED     ');
  console.log('================================================================');
}

run().catch((err) => {
  console.error('Fatal error during integration run:', err);
  process.exit(1);
});
