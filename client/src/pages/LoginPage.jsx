import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Headphones, Lock, Mail, AlertCircle, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, switchPersona, DEMO_PERSONAS } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  const handleDemoClick = async (persona) => {
    setLoading(true);
    setError(null);
    const result = await switchPersona(persona);
    setLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full">
        {/* Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-xl bg-blue-600 text-white items-center justify-center shadow-lg shadow-blue-500/20 mb-3">
            <Headphones className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Frontdesk Support</h1>
          <p className="text-xs text-slate-500 mt-1">Enterprise Customer Support & SLA Tracking Platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-7">
          <h2 className="text-sm font-bold text-slate-800 mb-1">Sign In to Your Account</h2>
          <p className="text-xs text-slate-500 mb-5">Enter your credentials to access the support desk</p>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@frontdesk.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold py-2.5 rounded-lg shadow-sm transition-colors mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Personas */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
              1-Click Demo Evaluation Profiles
            </p>
            <div className="space-y-1.5">
              {DEMO_PERSONAS.map((p) => (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => handleDemoClick(p)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 text-left transition-all text-xs"
                >
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2 h-2 rounded-full ${
                      p.role === 'ADMIN' ? 'bg-purple-500' : p.role === 'AGENT' ? 'bg-blue-500' : 'bg-emerald-500'
                    }`} />
                    <span className="font-semibold text-slate-800">{p.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({p.role})</span>
                  </div>
                  <span className="text-[11px] text-blue-600 font-medium">Login →</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-[11px] text-slate-400 mt-6">
          Frontdesk Support Platform • Full-Stack Machine Test Evaluation
        </p>
      </div>
    </div>
  );
}
