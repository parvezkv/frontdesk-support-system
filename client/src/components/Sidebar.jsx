import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Inbox,
  AlertTriangle,
  PauseCircle,
  UserCheck,
  PlusCircle,
  LogOut,
  Shield,
  Headphones,
  User,
  Users
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ onOpenNewTicket }) {
  const { user, isStaff, isAdmin, logout, switchPersona, DEMO_PERSONAS } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItemClass = ({ isActive }) =>
    `flex items-center space-x-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
      isActive
        ? 'bg-slate-800 text-white font-semibold'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;

  return (
    <aside className="w-64 bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 space-x-3">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-900/40">
          <Headphones className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center space-x-1.5">
            <span className="font-bold text-white text-base tracking-tight">Frontdesk</span>
            <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] rounded font-semibold">
              SaaS
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Enterprise Support Desk</p>
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="p-4">
        <button
          onClick={onOpenNewTicket}
          className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-colors"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Ticket</span>
        </button>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        <div className="px-3 pb-1 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
          Workspace
        </div>

        <NavLink to="/dashboard" className={navItemClass}>
          <LayoutDashboard className="w-4 h-4 text-blue-400" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink to="/tickets" end className={navItemClass}>
          <Inbox className="w-4 h-4 text-slate-400" />
          <span>All Tickets</span>
        </NavLink>

        {isStaff && (
          <NavLink to={`/tickets?assignedAgentId=${user?.id}`} className={navItemClass}>
            <UserCheck className="w-4 h-4 text-emerald-400" />
            <span>Assigned to Me</span>
          </NavLink>
        )}

        <div className="pt-4 px-3 pb-1 text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
          SLA & Lifecycle
        </div>

        <NavLink to="/tickets?overdue=true" className={navItemClass}>
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>Overdue Tickets</span>
        </NavLink>

        <NavLink to="/tickets?waitingForCustomer=true" className={navItemClass}>
          <PauseCircle className="w-4 h-4 text-purple-400" />
          <span>Waiting for Customer</span>
        </NavLink>
      </div>

      {/* Demo Persona Switcher Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1">
            <Users className="w-3 h-3 text-slate-400" />
            <span>Switch Persona</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {DEMO_PERSONAS.map((p) => {
            const isActive = user?.email === p.email;
            return (
              <button
                key={p.email}
                onClick={() => switchPersona(p)}
                className={`px-2 py-1 text-[11px] rounded text-left font-medium truncate transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                title={`${p.name} (${p.role})`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Current User & Logout Section */}
      <div className="p-3.5 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center space-x-2.5 overflow-hidden">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-blue-400 flex-shrink-0">
            {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="truncate">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-white truncate max-w-[100px]">{user?.name}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-mono">
                {user?.role}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition-colors"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
}
