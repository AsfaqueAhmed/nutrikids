import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
const DB_URL =
  process.env.DATABASE_URL || 'postgresql://nutrikids:nutrikids@localhost:5433/nutrikids';

describe('Admin Web Live Integration', () => {
  it('logs in as admin, fetches stats, creates & publishes article, confirms in parent list, and disables user', async () => {
    const adminEmail = `admin-${Date.now()}@test.nutrikids.com`;
    const password = 'Password123!';

    // 1. Register admin candidate
    const regRes = await fetch(`${API_BASE}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    expect(regRes.ok).toBe(true);

    // 2. Promote to ADMIN via prisma db execute
    execSync(
      `echo "UPDATE \\"User\\" SET role='ADMIN' WHERE email='${adminEmail}';" | pnpm --filter api exec prisma db execute --stdin --url "${DB_URL}"`,
      { stdio: 'inherit' }
    );

    // 3. Log in as ADMIN to get fresh token with ADMIN role
    const loginRes = await fetch(`${API_BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    expect(loginRes.ok).toBe(true);
    const loginData = await loginRes.json();
    const adminToken = loginData.accessToken;
    expect(adminToken).toBeDefined();

    const adminHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    };

    // 4. GET /v1/admin/stats
    const statsRes = await fetch(`${API_BASE}/v1/admin/stats`, {
      headers: adminHeaders,
    });
    expect(statsRes.ok).toBe(true);
    const stats = await statsRes.json();
    expect(stats.totalUsers).toBeDefined();
    expect(stats.signupsByDay).toBeDefined();

    // 5. Create & publish article
    const slug = `live-test-art-${Date.now()}`;
    const createArticleRes = await fetch(`${API_BASE}/v1/admin/articles`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({
        kind: 'ARTICLE',
        title: 'Live Published Article',
        slug,
        summary: 'Testing publishing workflow',
        body: '# Great Live Content\n\nEvidence-based advice for parents.',
        category: 'Nutrition',
        status: 'PUBLISHED',
      }),
    });
    expect(createArticleRes.ok).toBe(true);
    const createdArticle = await createArticleRes.json();
    expect(createdArticle.slug).toBe(slug);
    expect(createdArticle.status).toBe('PUBLISHED');

    // 6. Confirm article appears in public parent list
    const publicListRes = await fetch(`${API_BASE}/v1/articles`, {
      headers: adminHeaders,
    });
    expect(publicListRes.ok).toBe(true);
    const publicList = await publicListRes.json();
    const foundInPublic = publicList.items.some((item: { slug: string }) => item.slug === slug);
    expect(foundInPublic).toBe(true);

    // 7. Register a user to test disablement
    const userToDisableEmail = `user-disable-${Date.now()}@test.nutrikids.com`;
    const userRegRes = await fetch(`${API_BASE}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userToDisableEmail, password }),
    });
    expect(userRegRes.ok).toBe(true);

    // 8. Find user ID from admin users list
    const usersListRes = await fetch(`${API_BASE}/v1/admin/users?q=${encodeURIComponent(userToDisableEmail)}`, {
      headers: adminHeaders,
    });
    expect(usersListRes.ok).toBe(true);
    const usersList = await usersListRes.json();
    expect(usersList.items.length).toBeGreaterThanOrEqual(1);
    const targetUser = usersList.items.find((u: { email: string }) => u.email === userToDisableEmail);
    expect(targetUser).toBeDefined();

    // 9. Disable user
    const disableRes = await fetch(`${API_BASE}/v1/admin/users/${targetUser.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ disabled: true }),
    });
    expect(disableRes.ok).toBe(true);
    const updatedUser = await disableRes.json();
    expect(updatedUser.disabled).toBe(true);

    // 10. Confirm login for disabled user returns 401 with ACCOUNT_DISABLED
    const disabledLoginRes = await fetch(`${API_BASE}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userToDisableEmail, password }),
    });
    expect(disabledLoginRes.ok).toBe(false);
    const errorBody = await disabledLoginRes.json();
    expect(errorBody.code).toBe('ACCOUNT_DISABLED');
  });
});
