import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Inbox,
  Clock,
  PauseCircle,
  AlertTriangle,
  CheckCircle2,
  UserCheck,
  ArrowRight,
  PlusCircle,
  Activity,
  Calendar,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import PriorityBadge from '../components/PriorityBadge';
import StatusBadge from '../components/StatusBadge';

export default function DashboardPage({ onOpenNewTicket }) {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/tickets/stats');
      setStats(res.data.stats);
      setRecentActivity(res.data.recentActivity || []);
    } catch (err) {
      console.error('Failed to load dashboard stats:', err);
      setError('Could not load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      id: 'open',
      label: 'Open Tickets',
      count: stats?.totalOpen ?? 0,
      icon: Inbox,
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      border: 'hover:border-blue-300',
      description: 'Awaiting triage or assignment',
      filter: { status: 'OPEN' },
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      count: stats?.inProgress ?? 0,
      icon: Clock,
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      border: 'hover:border-amber-300',
      description: 'Active agent investigation',
      filter: { status: 'IN_PROGRESS' },
    },
    {
      id: 'waiting',
      label: 'Waiting for Customer',
      count: stats?.waitingCustomer ?? 0,
      icon: PauseCircle,
      bg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      border: 'hover:border-purple-300',
      description: 'SLA timer paused until reply',
      filter: { waitingForCustomer: 'true' },
    },
    {
      id: 'overdue',
      label: 'Overdue Tickets',
      count: stats?.overdue ?? 0,
      icon: AlertTriangle,
      bg: stats?.overdue > 0 ? 'bg-rose-50' : 'bg-slate-50',
      iconColor: stats?.overdue > 0 ? 'text-rose-600' : 'text-slate-400',
      border: stats?.overdue > 0 ? 'border-rose-200 hover:border-rose-300' : 'hover:border-slate-300',
      badge: stats?.overdue > 0 ? 'Action Required' : null,
      description: 'SLA target breached in working hrs',
      filter: { overdue: 'true' },
    },
    {
      id: 'resolved',
      label: 'Resolved Tickets',
      count: stats?.resolved ?? 0,
      icon: CheckCircle2,
      bg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      border: 'hover:border-emerald-300',
      description: 'Reopenable within 7 calendar days',
      filter: { status: 'RESOLVED' },
    },
    {
      id: 'assigned_me',
      label: isStaff ? 'Assigned to Me' : 'My Total Tickets',
      count: isStaff ? (stats?.assignedAgentId ?? stats?.assignedToMe ?? 0) : (stats?.total ?? 0),
      icon: UserCheck,
      bg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      border: 'hover:border-indigo-300',
      description: isStaff ? 'Owned active workload' : 'Total submitted tickets',
      filter: isStaff ? { assignedAgentId: user?.id } : {},
    },
  ];

  const handleCardClick = (filter) => {
    const params = new URLSearchParams(filter);
    navigate(`/tickets?${params.toString()}`);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Welcome back, {user?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Role: <span className="font-semibold text-slate-700">{user?.role}</span> • Real-time SLA engine and support operations
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/tickets')}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"
          >
            Browse All Tickets
          </button>
          <button
            onClick={onOpenNewTicket}
            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Ticket</span>
          </button>
        </div>
      </div>

      {/* KPI Stat Cards Grid (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => handleCardClick(card.filter)}
              className={`bg-white p-5 rounded-xl border border-slate-200 shadow-xs cursor-pointer transition-all hover:shadow-sm ${card.border}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-medium text-slate-500">{card.label}</span>
                  <div className="text-2xl font-bold text-slate-900 mt-1.5 tracking-tight">
                    {loading ? '...' : card.count}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center ${card.iconColor}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{card.description}</span>
                {card.badge && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                    {card.badge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* SLA Policy & Engine Health Card */}
      <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <h3 className="font-bold text-sm tracking-tight">SLA Business Rules & Working Hours Engine</h3>
            </div>
            <p className="text-xs text-slate-300">
              Operating Schedule: <strong>Monday to Friday, 9:30 AM – 6:30 PM (Asia/Kolkata)</strong>. Weekends and configured holidays are strictly excluded from SLA time calculations.
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Urgent: 2h / Same Day
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Medium: 4h / 3 Days
            </span>
            <span className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              Low: 8h / 5 Days
            </span>
          </div>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Recent Support Activity</h3>
          </div>
          <button
            onClick={() => navigate('/tickets')}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
          >
            <span>View All Tickets</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading recent activity...</div>
          ) : recentActivity.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No recent ticket events recorded.</div>
          ) : (
            recentActivity.map((event) => (
              <div
                key={event.id}
                onClick={() => event.ticket?.id && navigate(`/tickets/${event.ticket.id}`)}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs">
                    {event.ticket && (
                      <span className="font-bold text-slate-900 hover:text-blue-600">
                        #{event.ticket.ticketNumber}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-700">
                      {event.eventType}
                    </span>
                    <span className="text-slate-600 truncate max-w-md">
                      {event.newValue || event.oldValue || event.ticket?.subject}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                    <span>Actor: <strong className="text-slate-600">{event.actor?.name || 'System'}</strong></span>
                    <span>•</span>
                    <span>Role: {event.actor?.role || 'SYSTEM'}</span>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-400 whitespace-nowrap pl-4">
                  <span>{event.createdAtIST || new Date(event.createdAt).toLocaleTimeString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
