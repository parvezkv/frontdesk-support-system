import React from 'react';
import { Clock, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({ title, subtitle }) {
  const { user, switchPersona, DEMO_PERSONAS } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Title & Context */}
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      {/* SLA Working Hours Status & Fast Persona Switcher */}
      <div className="flex items-center space-x-4">
        {/* Working Hours Indicator */}
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs text-slate-600">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-medium">Working Hours: Mon-Fri 09:30 - 18:30 IST</span>
        </div>

        {/* Persona Switcher Quick Bar */}
        <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <span className="text-[11px] font-semibold text-slate-500 px-2 hidden sm:inline">Demo Switch:</span>
          {DEMO_PERSONAS.map((p) => {
            const isCurrent = user?.email === p.email;
            return (
              <button
                key={p.email}
                onClick={() => switchPersona(p)}
                className={`px-2.5 py-1 text-xs rounded-md font-medium transition-all ${
                  isCurrent
                    ? 'bg-white text-blue-700 font-bold shadow-xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
                title={`Switch to ${p.name} (${p.role})`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
