export function Disclaimer({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-start gap-2">
        <span className="font-bold text-slate-700">Medical Notice:</span>
        <span>Guidance only, not medical advice. Consult a pediatrician for clinical concerns.</span>
      </div>
    );
  }

  return (
    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-700">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-base">📋</span>
        <h4 className="font-bold text-sm text-slate-900">Medical & Nutrition Disclaimer</h4>
      </div>
      <p className="text-xs text-slate-600 leading-relaxed">
        NutriKids provides automated meal planning, WHO-based growth tracking, and nutritional insights for informational purposes only. It does not provide medical diagnoses, treatment advice, or replace direct consultation with a qualified pediatrician or healthcare provider.
      </p>
    </div>
  );
}
