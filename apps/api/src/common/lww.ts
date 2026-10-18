export function resolveLww(
  existing: { clientUpdatedAt: Date } | null,
  incoming: Date,
): { apply: boolean; superseded: boolean } {
  if (!existing) return { apply: true, superseded: false };
  if (incoming.getTime() >= existing.clientUpdatedAt.getTime())
    return { apply: true, superseded: false };
  return { apply: false, superseded: true };
}
