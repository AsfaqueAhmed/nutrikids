import { allergenLabel, type Allergen, type Severity } from '@/lib/api/domain';

export interface AllergyBadgeProps {
  allergen: Allergen;
  severity: Severity;
  onRemove?: () => void;
}

export function AllergyBadge({ allergen, severity, onRemove }: AllergyBadgeProps) {
  const config = {
    SEVERE: {
      bg: 'bg-red-50',
      border: 'border-red-300',
      text: 'text-red-800',
      icon: '⛔',
      label: 'Severe',
    },
    MODERATE: {
      bg: 'bg-amber-50',
      border: 'border-amber-300',
      text: 'text-amber-800',
      icon: '⚠️',
      label: 'Moderate',
    },
    MILD: {
      bg: 'bg-yellow-50',
      border: 'border-yellow-300',
      text: 'text-yellow-800',
      icon: 'ℹ️',
      label: 'Mild',
    },
  }[severity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${config.bg} ${config.border} ${config.text}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span>{allergenLabel(allergen)}</span>
      <span className="text-[10px] uppercase font-bold opacity-75">({config.label})</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-1 text-slate-500 hover:text-red-700 font-bold focus:outline-none"
          aria-label={`Remove allergy ${allergenLabel(allergen)}`}
        >
          ×
        </button>
      )}
    </span>
  );
}
