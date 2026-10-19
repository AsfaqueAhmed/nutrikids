'use client';

import React, { useState } from 'react';
import { useUpdateUser } from './useAdminUsers';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AdminUser } from '@/lib/api/models';

export type UserActionsProps = {
  user: AdminUser;
  currentUserId?: string | null;
};

export function UserActions({ user, currentUserId }: UserActionsProps) {
  const { mutateAsync, isPending } = useUpdateUser();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [confirmDisableOpen, setConfirmDisableOpen] = useState(false);
  const [confirmAdminOpen, setConfirmAdminOpen] = useState(false);

  const isSelf = Boolean(currentUserId && user.id === currentUserId);
  const selfTooltip = "You can't change your own account.";

  const handleRoleChange = async (newRole: 'PARENT' | 'NUTRITIONIST' | 'ADMIN') => {
    setErrorMsg(null);
    if (newRole === 'ADMIN') {
      setConfirmAdminOpen(true);
      return;
    }
    try {
      await mutateAsync({ id: user.id, role: newRole });
      setSelectedRole(newRole);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleConfirmAdmin = async () => {
    setErrorMsg(null);
    try {
      await mutateAsync({ id: user.id, role: 'ADMIN' });
      setConfirmAdminOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleToggleDisabled = async () => {
    setErrorMsg(null);
    if (!user.disabled) {
      setConfirmDisableOpen(true);
      return;
    }
    // Enable without confirmation dialog
    try {
      await mutateAsync({ id: user.id, disabled: false });
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to enable account.');
    }
  };

  const handleConfirmDisable = async () => {
    setErrorMsg(null);
    try {
      await mutateAsync({ id: user.id, disabled: true });
      setConfirmDisableOpen(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to disable account.');
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {/* Role Selector */}
        <select
          aria-label="User role"
          disabled={isSelf || isPending}
          title={isSelf ? selfTooltip : 'Change user role'}
          value={user.role}
          onChange={(e) =>
            handleRoleChange(e.target.value as 'PARENT' | 'NUTRITIONIST' | 'ADMIN')
          }
          className="h-8 px-2 text-xs rounded border border-slate-200 bg-white font-medium text-slate-800 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:border-emerald-600"
        >
          <option value="PARENT">PARENT</option>
          <option value="NUTRITIONIST">NUTRITIONIST</option>
          <option value="ADMIN">ADMIN</option>
        </select>

        {/* Disable / Enable Button */}
        <button
          type="button"
          onClick={handleToggleDisabled}
          disabled={isSelf || isPending}
          title={isSelf ? selfTooltip : user.disabled ? 'Enable account' : 'Disable account'}
          className={`h-8 px-2.5 text-xs font-semibold rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            user.disabled
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-red-50 hover:text-red-700 hover:border-red-200'
          }`}
        >
          {user.disabled ? 'Enable' : 'Disable'}
        </button>
      </div>

      {errorMsg && (
        <div role="alert" className="text-[11px] font-semibold text-red-600 max-w-xs">
          {errorMsg}
        </div>
      )}

      {/* Confirm Disable Dialog */}
      <ConfirmDialog
        open={confirmDisableOpen}
        title="Disable Account"
        description={`Disable ${user.email}? They will be signed out and cannot sign in until re-enabled.`}
        confirmLabel="Confirm"
        destructive={true}
        loading={isPending}
        onConfirm={handleConfirmDisable}
        onCancel={() => setConfirmDisableOpen(false)}
      />

      {/* Confirm Admin Role Dialog */}
      <ConfirmDialog
        open={confirmAdminOpen}
        title="Grant Admin Role"
        description={`Make ${user.email} an admin?`}
        confirmLabel="Confirm"
        loading={isPending}
        onConfirm={handleConfirmAdmin}
        onCancel={() => {
          setConfirmAdminOpen(false);
        }}
      />
    </div>
  );
}
