export function ProvisionalTag({
  note = 'Guidance only, not medical advice',
}: {
  note?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 border border-slate-300 text-slate-700 text-xs font-medium">
      <span className="font-bold text-slate-900 uppercase tracking-wider text-[10px] bg-slate-200 px-1 py-0.5 rounded">
        Provisional
      </span>
      <span>{note}</span>
    </div>
  );
}
