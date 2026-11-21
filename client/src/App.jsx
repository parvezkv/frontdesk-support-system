import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Database, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Layers, 
  ShieldCheck, 
  Sparkles,
  Ticket
} from 'lucide-react';
import api from './services/api';

export default function App() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/health');
      setHealth(response.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Cannot connect to backend server');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">Frontdesk</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                iNav Tech Machine Test
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Foundation Initialized</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
            Customer Support Ticket Management System
          </h1>
          <p className="mt-3 text-base text-slate-600 max-w-2xl mx-auto">
            Full-stack integrated solution engineered with React 18, Vite, Tailwind CSS, Node.js, Express, PostgreSQL, and Prisma ORM.
          </p>
        </div>

        {/* Backend & DB Health Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center space-x-3">
              <Server className="w-5 h-5 text-indigo-600" />
              <h2 className="text-lg font-semibold text-slate-800">System Foundation Connectivity</h2>
            </div>
            <button
              onClick={checkHealth}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-indigo-200 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Re-check</span>
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Express Server Health */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-4">
              <div className="p-2.5 rounded-lg bg-white shadow-sm border border-slate-100">
                <Server className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Express Backend</p>
                <div className="mt-1 flex items-center space-x-2">
                  {loading ? (
                    <span className="text-sm font-medium text-slate-500">Checking...</span>
                  ) : health?.status === 'UP' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700">Online (:5000)</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span className="text-sm font-bold text-rose-700">Offline / Error</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">API Endpoint: /api/health</p>
              </div>
            </div>

            {/* PostgreSQL Health */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start space-x-4">
              <div className="p-2.5 rounded-lg bg-white shadow-sm border border-slate-100">
                <Database className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">PostgreSQL + Prisma</p>
                <div className="mt-1 flex items-center space-x-2">
                  {loading ? (
                    <span className="text-sm font-medium text-slate-500">Checking...</span>
                  ) : health?.database === 'CONNECTED' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-bold text-emerald-700">Database Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 text-rose-600" />
                      <span className="text-sm font-bold text-rose-700">Database Unreachable</span>
                    </>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">Database: frontdesk_db</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Stack Specs & Architecture Verification */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">Integrated Architecture</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Unified workspace orchestrating <code>/client</code> and <code>/server</code> via root scripts, sharing a centralized database.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">Security & Business Rules</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              RBAC roles (ADMIN, AGENT, CUSTOMER), bcrypt password hashing, and stateless JWT Bearer token authentication.
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center mb-3">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-slate-800 text-base">Clean Foundation Ready</h3>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
              Environment configurations, Prisma migrations, seed scripts, and Tailwind CSS configured and ready for review.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
