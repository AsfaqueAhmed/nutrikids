import { describe, expect, it, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { UserActions } from './UserActions';
import * as useAdminUsersModule from './useAdminUsers';
import { AdminUser } from '@/lib/api/models';

vi.mock('./useAdminUsers');

describe('UserActions component', () => {
  const mockMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAdminUsersModule.useUpdateUser).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    });
  });

  const baseUser: AdminUser = {
    id: 'u-target',
    email: 'user@example.com',
    role: 'PARENT',
    disabled: false,
    emailVerified: true,
    childCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  it('disables controls with tooltip for current admin own account', () => {
    render(<UserActions user={baseUser} currentUserId="u-target" />);

    const select = screen.getByRole('combobox', { name: /role/i });
    const button = screen.getByRole('button', { name: /disable/i });

    expect(select).toBeDisabled();
    expect(button).toBeDisabled();
    expect(select).toHaveAttribute('title', "You can't change your own account.");
    expect(button).toHaveAttribute('title', "You can't change your own account.");
  });

  it('opens confirm dialog when disabling another user and calls mutateAsync on confirm', async () => {
    const user = userEvent.setup();
    render(<UserActions user={baseUser} currentUserId="u-admin" />);

    const disableBtn = screen.getByRole('button', { name: /disable/i });
    await user.click(disableBtn);

    expect(screen.getByText(/Disable user@example.com\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    await user.click(confirmBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'u-target',
      disabled: true,
    });
  });

  it('calls mutateAsync directly without confirm dialog when enabling a disabled user', async () => {
    const user = userEvent.setup();
    const disabledUser: AdminUser = { ...baseUser, disabled: true };
    render(<UserActions user={disabledUser} currentUserId="u-admin" />);

    const enableBtn = screen.getByRole('button', { name: /enable/i });
    await user.click(enableBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'u-target',
      disabled: false,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens confirm dialog when promoting a user to ADMIN', async () => {
    const user = userEvent.setup();
    render(<UserActions user={baseUser} currentUserId="u-admin" />);

    const select = screen.getByRole('combobox', { name: /role/i });
    await user.selectOptions(select, 'ADMIN');

    expect(screen.getByText(/Make user@example.com an admin\?/i)).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^confirm$/i });
    await user.click(confirmBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 'u-target',
      role: 'ADMIN',
    });
  });

  it('displays error in role="alert" when mutation fails', async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new Error('You cannot modify your own administrative status.')
    );
    const user = userEvent.setup();
    render(<UserActions user={baseUser} currentUserId="u-admin" />);

    const select = screen.getByRole('combobox', { name: /role/i });
    await user.selectOptions(select, 'NUTRITIONIST');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('You cannot modify your own administrative status.');
  });
});
