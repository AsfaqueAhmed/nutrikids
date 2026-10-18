export type StatusType =
  | 'given'
  | 'given_late'
  | 'due'
  | 'overdue'
  | 'upcoming'
  | 'checked'
  | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const configs: Record<
    StatusType,
    { bg: string; border: string; text: string; icon: string; defaultLabel: string }
  > = {
    given: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      text: 'text-emerald-800',
      icon: '✓',
      defaultLabel: 'Given',
    },
    given_late: {
      bg: 'bg-teal-50',
      border: 'border-teal-300',
      text: 'text-teal-800',
      icon: '✓',
      defaultLabel: 'Given Late',
    },
    due: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-800',
      icon: '⏰',
      defaultLabel: 'Due Now',
    },
    overdue: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: '⚠️',
      defaultLabel: 'Overdue',
    },
    upcoming: {
      bg: 'bg-slate-50',
      border: 'border-slate-300',
      text: 'text-slate-700',
      icon: '🗓️',
      defaultLabel: 'Upcoming',
    },
    checked: {
      bg: 'bg-emerald-50',
      border: 'border-emerald-300',
      text: 'text-emerald-800',
      icon: '✓',
      defaultLabel: 'Done',
    },
    pending: {
      bg: 'bg-slate-50',
      border: 'border-slate-300',
      text: 'text-slate-600',
      icon: '○',
      defaultLabel: 'Pending',
    },
  };

  const config = configs[status] || configs.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${config.bg} ${config.border} ${config.text}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{label || config.defaultLabel}</span>
    </span>
  );
}
