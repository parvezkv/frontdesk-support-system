import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  PlusCircle,
  RefreshCw,
  AlertTriangle,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  ArrowUpDown,
  CheckCircle2
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SLABadge from '../components/SLABadge';

export default function TicketListPage({ onOpenNewTicket }) {
  const { user, isStaff } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tickets, setTickets] = useState([]);
  const [agents, setAgents] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  // Filters from URL or default
  const statusParam = searchParams.get('status') || 'ALL';
  const priorityParam = searchParams.get('priority') || 'ALL';
  const agentParam = searchParams.get('assignedAgentId') || 'ALL';
  const overdueParam = searchParams.get('overdue') === 'true';
  const waitingParam = searchParams.get('waitingForCustomer') === 'true';
  const searchParam = searchParams.get('search') || '';
  const pageParam = parseInt(searchParams.get('page')) || 1;

  const [search, setSearch] = useState(searchParam);

  // Load agents list for the filter dropdown
  useEffect(() => {
    if (isStaff) {
      api.get('/tickets/agents')
        .then((res) => setAgents(res.data.agents || []))
        .catch((err) => console.error('Failed to load agents filter:', err));
    }
  }, [isStaff]);

  // Load tickets whenever searchParams change
  useEffect(() => {
    loadTickets();
  }, [searchParams]);

  // Debounced search sync to URL
  useEffect(() => {
    const handler = setTimeout(() => {
      if (search !== searchParam) {
        updateFilter('search', search.trim() ? search.trim() : null);
      }
    }, 350);
    return () => clearTimeout(handler);
  }, [search]);

  const loadTickets = async () => {
    try {
      setLoading(true);
      const params = {
        page: pageParam,
        limit: 10,
      };
      if (statusParam !== 'ALL') params.status = statusParam;
      if (priorityParam !== 'ALL') params.priority = priorityParam;
      if (agentParam !== 'ALL') params.assignedAgentId = agentParam;
      if (overdueParam) params.overdue = 'true';
      if (waitingParam) params.waitingForCustomer = 'true';
      if (searchParam) params.search = searchParam;

      const res = await api.get('/tickets', { params });
      setTickets(res.data.data || []);
      setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to load tickets list:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === null || value === undefined || value === '' || value === 'ALL') {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    // Always reset to page 1 on filter changes unless changing page itself
    if (key !== 'page') {
      next.delete('page');
    }
    setSearchParams(next);
  };

  const resetFilters = () => {
    setSearch('');
    setSearchParams(new URLSearchParams());
  };

  const hasActiveFilters =
    statusParam !== 'ALL' ||
    priorityParam !== 'ALL' ||
    agentParam !== 'ALL' ||
    overdueParam ||
    waitingParam ||
    searchParam;

  return (
    <div className="p-6 space-y-5">
      {/* Page Title & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Support Tickets</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage, triage, and monitor customer issues and SLA commitments
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadTickets}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
            title="Refresh List"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
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

      {/* Filter Control Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by ticket #, subject or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Status Filter */}
          <div className="md:col-span-2">
            <select
              value={statusParam}
              onChange={(e) => updateFilter('status', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_CUSTOMER">Waiting for Customer</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="md:col-span-2">
            <select
              value={priorityParam}
              onChange={(e) => updateFilter('priority', e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Critical / Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low / Small</option>
            </select>
          </div>

          {/* Assigned Agent Filter (Staff Only) */}
          {isStaff && (
            <div className="md:col-span-2">
              <select
                value={agentParam}
                onChange={(e) => updateFilter('assignedAgentId', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                <option value="ALL">All Assignees</option>
                <option value="unassigned">Unassigned Only</option>
                <option value={user?.id}>Assigned to Me</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reset Filters */}
          {hasActiveFilters && (
            <div className="md:col-span-2 flex items-center">
              <button
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1.5 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>

        {/* Quick Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
          <span className="text-slate-400 font-medium text-[11px]">Quick Views:</span>

          <button
            onClick={() => updateFilter('overdue', overdueParam ? null : 'true')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
              overdueParam
                ? 'bg-rose-100 text-rose-800 border border-rose-300 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>Overdue Tickets</span>
          </button>

          <button
            onClick={() => updateFilter('waitingForCustomer', waitingParam ? null : 'true')}
            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
              waitingParam
                ? 'bg-purple-100 text-purple-800 border border-purple-300 font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5 text-purple-600" />
            <span>Waiting for Customer</span>
          </button>

          {isStaff && (
            <button
              onClick={() => updateFilter('assignedAgentId', agentParam === user?.id ? null : user?.id)}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                agentParam === user?.id
                  ? 'bg-blue-100 text-blue-800 border border-blue-300 font-bold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>My Assigned Tickets</span>
            </button>
          )}

          <div className="ml-auto text-slate-400 text-[11px]">
            Found <strong>{pagination.total}</strong> tickets
          </div>
        </div>
      </div>

      {/* Enterprise Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Ticket</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Assigned Agent</th>
                <th className="py-3 px-4">First Response SLA</th>
                <th className="py-3 px-4">Resolution SLA</th>
                <th className="py-3 px-4 text-right">Created (IST)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    Loading tickets queue...
                  </td>
                </tr>
              ) : tickets.length === 0 ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-600 mb-1">No tickets match the selected criteria</p>
                    <p className="text-[11px]">Try modifying filters or search query, or create a new support ticket.</p>
                  </td>
                </tr>
              ) : (
                tickets.map((t) => {
                  const isResponseOverdue = !t.firstResponseAt && t.responseDueAt && new Date(t.responseDueAt) < new Date() && t.status !== 'WAITING_FOR_CUSTOMER' && t.status !== 'RESOLVED' && t.status !== 'CLOSED';
                  const isResolutionOverdue = t.resolutionDueAt && new Date(t.resolutionDueAt) < new Date() && t.status !== 'WAITING_FOR_CUSTOMER' && t.status !== 'RESOLVED' && t.status !== 'CLOSED';
                  const isTicketOverdue = isResponseOverdue || isResolutionOverdue;

                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/tickets/${t.id}`)}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors ${
                        isTicketOverdue ? 'bg-rose-50/30' : ''
                      }`}
                    >
                      {/* Ticket Number */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 group-hover:text-blue-600 font-mono">
                          #{t.ticketNumber}
                        </span>
                      </td>

                      {/* Subject */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{t.subject}</div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</div>
                      </td>

                      {/* Customer */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{t.customer?.name}</div>
                        <div className="text-[10px] text-slate-400">{t.customer?.email}</div>
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <PriorityBadge priority={t.priority} size="xs" />
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <StatusBadge status={t.status} size="xs" />
                      </td>

                      {/* Assigned Agent */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {t.assignedAgent ? (
                          <div className="flex items-center space-x-1 text-slate-700 font-medium">
                            <span>{t.assignedAgent.name}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium border border-amber-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Response SLA */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SLABadge ticket={t} type="response" />
                      </td>

                      {/* Resolution SLA */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <SLABadge ticket={t} type="resolution" />
                      </td>

                      {/* Created Date */}
                      <td className="py-3 px-4 whitespace-nowrap text-right text-slate-500 font-mono text-[11px]">
                        {t.createdAtIST || new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/60">
          <span className="text-slate-500">
            Showing Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
          </span>

          <div className="flex items-center space-x-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => updateFilter('page', pagination.page - 1)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center space-x-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => updateFilter('page', pagination.page + 1)}
              className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 flex items-center space-x-1"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
