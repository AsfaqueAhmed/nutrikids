import { describe, it, expect } from 'vitest';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

describe('Web Live Integration', () => {
  it('registers user, creates child, logs meal intake, verifies summary, and reads articles', async () => {
    const email = `parent-${Date.now()}@test.nutrikids.com`;
    const password = 'Password123!';

    // 1. Register
    const regRes = await fetch(`${API_BASE}/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!regRes.ok) {
      const err = await regRes.text();
      throw new Error(`Register failed (${regRes.status}): ${err}`);
    }

    const regData = await regRes.json();
    const token = regData.accessToken;
    expect(token).toBeDefined();

    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    // 2. Create child
    const childRes = await fetch(`${API_BASE}/v1/children`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        name: 'Aiden',
        dateOfBirth: '2024-01-01',
        gender: 'MALE',
      }),
    });

    expect(childRes.ok).toBe(true);
    const child = await childRes.json();
    expect(child.id).toBeDefined();

    // 3. PUT nutrition log
    const logId = crypto.randomUUID();
    const logRes = await fetch(`${API_BASE}/v1/children/${child.id}/nutrition-logs/${logId}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify({
        date: '2026-10-19',
        slot: 'LUNCH',
        eatenStatus: 'FULL',
        clientUpdatedAt: new Date().toISOString(),
      }),
    });

    expect(logRes.ok).toBe(true);
    const logBody = await logRes.json();
    expect(logBody.data.eatenStatus).toBe('FULL');

    // 4. Read back logs
    const listRes = await fetch(
      `${API_BASE}/v1/children/${child.id}/nutrition-logs?from=2026-10-19&to=2026-10-19`,
      { headers: authHeaders }
    );
    expect(listRes.ok).toBe(true);
    const logs = await listRes.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].slot).toBe('LUNCH');

    // 5. Read summary
    const summaryRes = await fetch(
      `${API_BASE}/v1/children/${child.id}/nutrition-logs/summary?from=2026-10-13&to=2026-10-19`,
      { headers: authHeaders }
    );
    expect(summaryRes.ok).toBe(true);
    const summary = await summaryRes.json();
    expect(summary.loggedCount).toBeGreaterThanOrEqual(1);

    // 6. Read public articles
    const articlesRes = await fetch(`${API_BASE}/v1/articles`, {
      headers: authHeaders,
    });
    expect(articlesRes.ok).toBe(true);
    const articlesPage = await articlesRes.json();
    expect(articlesPage.items).toBeDefined();
  });
});
