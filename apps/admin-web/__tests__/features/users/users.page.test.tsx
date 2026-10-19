import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import UsersPage from '@/app/(admin)/users/page';
import * as useAdminUsersModule from '@/features/users/useAdminUsers';
import * as useAdminSessionModule from '@/features/auth/useAdminSession';

vi.mock('@/features/users/useAdminUsers');
vi.mock('@/features/auth/useAdminSession');

describe('Users page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useAdminSessionModule.useAdminSession).mockReturnValue({
      status: 'authed',
      user: {
        id: 'u-admin-1',
        email: 'admin@nutrikids.com',
        role: 'ADMIN',
        emailVerified: true,
        timezone: 'UTC',
      },
      login: vi.fn(),
      logout: vi.fn(),
    });

    vi.mocked(useAdminUsersModule.useUpdateUser).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it('renders search, filters, table headers, and privacy notice', () => {
    vi.mocked(useAdminUsersModule.useAdminUsers).mockReturnValue({
      data: {
        items: [
          {
            id: 'u-1',
            email: 'parent@example.com',
            role: 'PARENT',
            disabled: false,
            emailVerified: true,
            childCount: 2,
            createdAt: '2026-01-15T10:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        limit: 10,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useAdminUsersModule.useAdminUsers>);

    render(<UsersPage />);

    expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument();
    expect(screen.getByText(/Child counts only\. No health data is shown here\./i)).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Verified')).toBeInTheDocument();
    expect(screen.getByText('Children')).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('parent@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
  });
});
