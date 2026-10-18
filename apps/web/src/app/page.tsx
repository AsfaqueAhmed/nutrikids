import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Top Bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">
              N
            </span>
            <span className="font-bold text-xl tracking-tight text-slate-900">NutriKids</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-slate-700 hover:text-slate-900 px-3 py-2"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 px-4 py-2 rounded-lg border border-emerald-700"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-4 py-16 flex-1 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold uppercase tracking-wider mb-6">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          NutriKids Parent Web App
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight max-w-2xl leading-tight mb-4">
          Evidence-based nutrition & growth tracking for your children
        </h1>

        <p className="text-lg text-slate-600 max-w-xl mb-8 leading-relaxed">
          Allergy-safe meal planning, WHO standard growth charts, vaccine schedules, and offline-first peace of mind.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto mb-16">
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg border border-emerald-700 text-center transition-colors"
          >
            Create Free Account
          </Link>
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-100 text-slate-800 font-semibold rounded-lg border border-slate-300 text-center transition-colors"
          >
            Sign In
          </Link>
        </div>

        {/* Flat Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full text-left">
          <div className="p-5 rounded-xl border border-slate-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold mb-3">
              🛡️
            </div>
            <h2 className="font-bold text-slate-900 mb-1">Strict Allergy Safety</h2>
            <p className="text-sm text-slate-600 leading-normal">
              Hard blocks on severe allergens and explicit confirmations on mild or moderate sensitivities.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center font-bold mb-3">
              📈
            </div>
            <h2 className="font-bold text-slate-900 mb-1">WHO Growth Percentiles</h2>
            <p className="text-sm text-slate-600 leading-normal">
              Track height, weight, and head circumference mapped precisely against World Health Organization curves.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white">
            <div className="w-10 h-10 rounded-lg bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center font-bold mb-3">
              ⚡
            </div>
            <h2 className="font-bold text-slate-900 mb-1">Offline-Ready PWA</h2>
            <p className="text-sm text-slate-600 leading-normal">
              Log meals, growth, and grocery checks with automatic outbox synchronization when reconnected.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
        <p>© 2026 NutriKids Platform. Guidance only, not medical advice.</p>
      </footer>
    </div>
  );
}
