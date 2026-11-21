import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Lock,
  Clock,
  Shield,
  Send,
  UserCheck,
  UserMinus,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  CheckCircle2,
  Download,
  AlertCircle,
  AlertTriangle,
  Mail,
  Phone,
  User,
  Info
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import SLABadge from '../components/SLABadge';
import ReassignModal from '../components/ReassignModal';
import ResolveModal from '../components/ResolveModal';
import ReopenModal from '../components/ReopenModal';
import ExportModal from '../components/ExportModal';

export default function TicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isStaff, isAdmin } = useAuth();

  const [ticket, setTicket] = useState(null);
  const [slaData, setSlaData] = useState(null);
  const [events, setEvents] = useState([]);
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation', 'internalNotes', 'events'
  const [composerMode, setComposerMode] = useState('reply'); // 'reply', 'internalNote'
  const [messageContent, setMessageContent] = useState('');
  const [internalNoteContent, setInternalNoteContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Modals state
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);

  const showToast = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4500);
  };

  useEffect(() => {
    loadTicketData();
  }, [id, user]);

  const loadTicketData = async () => {
    try {
      setLoading(true);
      const [ticketRes, slaRes] = await Promise.all([
        api.get(`/tickets/${id}`),
        api.get(`/tickets/${id}/sla`).catch(() => ({ data: { sla: null } })),
      ]);

      const t = ticketRes.data.ticket;
      setTicket(t);
      setSlaData(slaRes.data.sla);

      // If staff, also load chronological audit events
      if (isStaff) {
        try {
          const eventsRes = await api.get(`/tickets/${id}/events`);
          setEvents(eventsRes.data.events || []);
        } catch (e) {
          console.warn('Could not load events:', e);
        }
      }
    } catch (err) {
      console.error('Failed to load ticket details:', err);
      showToast(err.response?.data?.message || 'Could not load ticket details', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1. Send Public Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/tickets/${ticket.id}/messages`, {
        content: messageContent.trim(),
      });
      setMessageContent('');
      showToast('Public reply sent successfully');
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to send message', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 2. Add Internal Note (Staff only)
  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNoteContent.trim()) return;

    try {
      setSubmitting(true);
      await api.post(`/tickets/${ticket.id}/internal-notes`, {
        content: internalNoteContent.trim(),
      });
      setInternalNoteContent('');
      showToast('Internal note saved privately');
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add internal note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Take Ticket (Atomic with 409 Conflict handling)
  const handleTakeTicket = async () => {
    try {
      await api.post(`/tickets/${ticket.id}/assign`, {});
      showToast('You have claimed this ticket.');
      await loadTicketData();
    } catch (err) {
      if (err.response?.status === 409) {
        showToast('Conflict: This ticket has already been taken by another agent.', 'error');
      } else {
        showToast(err.response?.data?.message || 'Failed to claim ticket', 'error');
      }
    }
  };

  // 4. Release Ticket
  const handleReleaseTicket = async () => {
    try {
      await api.post(`/tickets/${ticket.id}/release`, {});
      showToast('Ticket released back to unassigned queue');
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to release ticket', 'error');
    }
  };

  // 5. Change Priority (Recalculates SLA)
  const handlePriorityChange = async (newPriority) => {
    try {
      await api.patch(`/tickets/${ticket.id}/priority`, { priority: newPriority });
      showToast(`Priority updated to ${newPriority}. SLA deadlines recalculated.`);
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update priority', 'error');
    }
  };

  // 6. Set Status: WAITING_FOR_CUSTOMER (pauses SLA)
  const handleSetWaitingCustomer = async () => {
    try {
      await api.patch(`/tickets/${ticket.id}/status`, {
        status: 'WAITING_FOR_CUSTOMER',
      });
      showToast('Ticket set to WAITING_FOR_CUSTOMER. SLA timers paused.');
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // 7. Resume / Set Status: IN_PROGRESS (resumes SLA)
  const handleSetInProgress = async () => {
    try {
      await api.patch(`/tickets/${ticket.id}/status`, {
        status: 'IN_PROGRESS',
      });
      showToast('Ticket returned to IN_PROGRESS. SLA timers resumed.');
      await loadTicketData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // 8. Export Ticket
  const handleExport = async () => {
    try {
      const res = await api.get(`/tickets/${ticket.id}/export`);
      setExportData(res.data.export);
      setShowExportModal(true);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to export conversation', 'error');
    }
  };

  if (loading && !ticket) {
    return (
      <div className="p-12 text-center text-xs text-slate-400">
        Loading ticket #{id}...
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="p-12 text-center space-y-3">
        <p className="text-sm font-semibold text-slate-700">Ticket not found or access denied</p>
        <button
          onClick={() => navigate('/tickets')}
          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
        >
          ← Return to Tickets Queue
        </button>
      </div>
    );
  }

  const isAssignedToMe = ticket.assignedAgentId === user?.id;
  const isTerminal = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED';
  const isWaitingCustomer = ticket.status === 'WAITING_FOR_CUSTOMER';

  return (
    <div className="p-6 space-y-5">
      {/* Toast Alert */}
      {notification && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold flex items-center space-x-2 transition-all ${
            notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {notification.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Top Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate('/tickets')}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Back to Tickets"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                #{ticket.ticketNumber}
              </span>
              <h1 className="text-base font-bold text-slate-900">{ticket.subject}</h1>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-slate-500 mt-0.5">
              <span>Customer: <strong className="text-slate-800">{ticket.customer?.name}</strong></span>
              <span>•</span>
              <span>Created: {ticket.createdAtIST}</span>
            </div>
          </div>
        </div>

        {/* Quick Export Button */}
        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Thread</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ================= LEFT COLUMN: CONVERSATION, INTERNAL NOTES, AUDIT (8 cols) ================= */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col min-h-[580px]">
            {/* Tabs Header */}
            <div className="px-5 border-b border-slate-200 flex items-center space-x-6 text-xs font-semibold bg-white">
              <button
                onClick={() => setActiveTab('conversation')}
                className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
                  activeTab === 'conversation'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Customer Conversation ({ticket.messages?.length || 0})</span>
              </button>

              {/* 🔒 Internal Notes Tab strictly hidden from Customers! */}
              {isStaff && (
                <button
                  onClick={() => setActiveTab('internalNotes')}
                  className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
                    activeTab === 'internalNotes'
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-slate-500 hover:text-amber-700'
                  }`}
                >
                  <Lock className="w-4 h-4 text-amber-600" />
                  <span>Private Internal Notes ({ticket.internalNotes?.length || 0})</span>
                </button>
              )}

              {/* Audit Trail Tab */}
              {isStaff && (
                <button
                  onClick={() => setActiveTab('events')}
                  className={`py-3.5 border-b-2 flex items-center space-x-1.5 transition-colors ${
                    activeTab === 'events'
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Shield className="w-4 h-4 text-slate-500" />
                  <span>Audit Trail ({events.length || ticket.events?.length || 0})</span>
                </button>
              )}
            </div>

            {/* Tab Body */}
            <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-slate-50/50">
              {/* TAB 1: CUSTOMER CONVERSATION */}
              {activeTab === 'conversation' && (
                <div className="space-y-4">
                  {/* Original Customer Problem Description */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-800">{ticket.customer?.name}</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase">
                          Initial Inquiry
                        </span>
                      </div>
                      <span className="font-mono text-[11px]">{ticket.createdAtIST}</span>
                    </div>
                    <p className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {ticket.description}
                    </p>
                  </div>

                  {/* Thread Messages */}
                  {ticket.messages?.map((msg) => {
                    const isAgent = msg.sender?.role === 'AGENT' || msg.sender?.role === 'ADMIN';
                    return (
                      <div
                        key={msg.id}
                        className={`p-4 rounded-xl text-xs shadow-xs border ${
                          isAgent
                            ? 'bg-blue-50/70 border-blue-200 ml-8'
                            : 'bg-white border-slate-200 mr-8'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-800">{msg.sender?.name}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                isAgent ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {msg.sender?.role}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {msg.createdAtIST || new Date(msg.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">
                          {msg.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: STAFF INTERNAL NOTES (Staff Only) */}
              {activeTab === 'internalNotes' && isStaff && (
                <div className="space-y-4">
                  {/* Warning Banner */}
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center space-x-2.5 font-medium">
                    <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <span>
                      Internal notes are private to authenticated agents and administrators. They are <strong>strictly never exposed</strong> in customer-facing APIs, exports, or conversation views.
                    </span>
                  </div>

                  {ticket.internalNotes?.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      No internal notes recorded for this ticket yet.
                    </div>
                  ) : (
                    ticket.internalNotes?.map((note) => (
                      <div
                        key={note.id}
                        className="p-4 rounded-xl bg-amber-50/60 border border-amber-200 text-xs shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-amber-900">{note.author?.name}</span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                              {note.author?.role}
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-800 font-mono">
                            {note.createdAtIST || new Date(note.createdAt).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-amber-950 font-mono text-[11px] whitespace-pre-wrap leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: AUDIT TRAIL / CHRONOLOGICAL HISTORY */}
              {activeTab === 'events' && isStaff && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                    <span>Immutable Audit History ({events.length} events)</span>
                    <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-emerald-200">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      <span>PostgreSQL Database Trigger Protected (Append-Only)</span>
                    </span>
                  </div>

                  {(events.length > 0 ? events : ticket.events || []).map((ev, idx) => (
                    <div
                      key={ev.id || idx}
                      className="p-3.5 rounded-lg bg-white border border-slate-200 text-xs shadow-xs space-y-1.5"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 font-semibold">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800">
                              {ev.eventType}
                            </span>
                            <span className="text-slate-800">
                              {ev.oldValue && ev.newValue && ev.oldValue !== ev.newValue ? (
                                <span>
                                  <span className="text-slate-400 line-through mr-1">{ev.oldValue}</span>
                                  <span className="text-slate-400 font-bold mr-1">➔</span>
                                  <span className="text-slate-800 font-bold">{ev.newValue}</span>
                                </span>
                              ) : (
                                <span>{ev.newValue || ev.oldValue}</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                            <span>Actor:</span>
                            <strong className="text-slate-700">{ev.actor?.name || 'System'}</strong>
                            <span className="text-[10px] text-slate-400">({ev.actor?.role || 'SYSTEM'})</span>
                          </div>

                          {/* Event Metadata (Reasons, Notes, Pauses) */}
                          {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded border border-slate-100 mt-1 space-y-0.5">
                              {ev.metadata.resolutionSummary && (
                                <p><strong>Resolution:</strong> {ev.metadata.resolutionSummary}</p>
                              )}
                              {ev.metadata.reason && (
                                <p><strong>Reason:</strong> {ev.metadata.reason}</p>
                              )}
                              {ev.metadata.pausedWorkingMinutes && (
                                <p><strong>Paused Minutes:</strong> {ev.metadata.pausedWorkingMinutes} working min</p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-right text-[11px] text-slate-400 whitespace-nowrap pl-4">
                          <div className="flex items-center space-x-1 justify-end">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{ev.createdAtIST}</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">#{idx + 1}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Composer */}
            <div className="p-4 border-t border-slate-200 bg-white">
              {isTerminal ? (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600 text-center font-medium">
                  This ticket is permanently <strong>CLOSED</strong>. New replies cannot be submitted.
                </div>
              ) : isStaff ? (
                <div className="space-y-3">
                  {/* Mode Selector Toggle */}
                  <div className="flex items-center space-x-2 text-xs font-semibold">
                    <button
                      onClick={() => setComposerMode('reply')}
                      className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors ${
                        composerMode === 'reply'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Public Reply to Customer</span>
                    </button>
                    <button
                      onClick={() => setComposerMode('internalNote')}
                      className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 transition-colors ${
                        composerMode === 'internalNote'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>Private Internal Note</span>
                    </button>
                  </div>

                  {composerMode === 'reply' ? (
                    <form onSubmit={handleSendMessage} className="space-y-2.5">
                      <textarea
                        rows={3}
                        required
                        placeholder="Write a message to the customer..."
                        value={messageContent}
                        onChange={(e) => setMessageContent(e.target.value)}
                        className="w-full p-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          Sending this reply satisfies the First Response SLA target if pending.
                        </span>
                        <button
                          type="submit"
                          disabled={submitting || !messageContent.trim()}
                          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{submitting ? 'Sending...' : 'Send Public Reply'}</span>
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handleAddInternalNote} className="space-y-2.5">
                      <textarea
                        rows={3}
                        required
                        placeholder="Add an internal note (for support staff & admins only)..."
                        value={internalNoteContent}
                        onChange={(e) => setInternalNoteContent(e.target.value)}
                        className="w-full p-3 text-xs rounded-lg border border-amber-300 bg-amber-50/20 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-amber-700 font-medium">
                          🔒 Internal notes are private and never visible to the customer.
                        </span>
                        <button
                          type="submit"
                          disabled={submitting || !internalNoteContent.trim()}
                          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>{submitting ? 'Saving...' : 'Add Private Note'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Customer Message Composer */
                <form onSubmit={handleSendMessage} className="space-y-2.5">
                  <textarea
                    rows={3}
                    required
                    placeholder="Reply to the support team..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    className="w-full p-3 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      {isWaitingCustomer
                        ? 'Sending a reply will automatically resume the SLA clock.'
                        : 'Your reply will be sent to the assigned support agent.'}
                    </span>
                    <button
                      type="submit"
                      disabled={submitting || !messageContent.trim()}
                      className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-xs transition-colors"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* ================= RIGHT COLUMN: METADATA, SLA, & LIFECYCLE CONTROLS (4 cols) ================= */}
        <div className="lg:col-span-4 space-y-4">
          {/* 1. SLA Performance & Deadline Target Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  SLA Target & Deadlines
                </h3>
              </div>
              <PriorityBadge priority={ticket.priority} size="xs" />
            </div>

            {/* Paused Alert if Waiting */}
            {isWaitingCustomer && (
              <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-800 text-xs flex items-center space-x-2">
                <PauseCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="font-semibold">
                  SLA Timers Paused (Waiting for Customer)
                </span>
              </div>
            )}

            <div className="space-y-3 text-xs">
              {/* Response SLA */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">First Response:</span>
                <div>
                  <SLABadge ticket={ticket} type="response" />
                </div>
              </div>

              {/* Resolution SLA */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Resolution Target:</span>
                <div>
                  <SLABadge ticket={ticket} type="resolution" />
                </div>
              </div>

              {/* Remaining Time from SLA Service */}
              {slaData && !isTerminal && !isResolved && (
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Remaining Working Time:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {slaData.resolutionRemainingWorkingMinutes} min (~{(slaData.resolutionRemainingWorkingMinutes / 60).toFixed(1)} hrs)
                    </span>
                  </div>
                  {slaData.totalPausedWorkingMinutes > 0 && (
                    <div className="flex items-center justify-between text-[11px] text-purple-700">
                      <span>Total Paused Minutes:</span>
                      <span className="font-mono font-bold">{slaData.totalPausedWorkingMinutes} min</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 2. Customer Profile Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
              Customer Information
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex items-center space-x-2 text-slate-700 font-medium">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span>{ticket.customer?.name}</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>{ticket.customer?.email}</span>
              </div>
              {ticket.customer?.phone && (
                <div className="flex items-center space-x-2 text-slate-600">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{ticket.customer?.phone}</span>
                </div>
              )}
            </div>
          </div>

          {/* 3. Assignment & Ownership Controls Card (Staff Only) */}
          {isStaff && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                Assignment & Ownership
              </h3>

              <div className="text-xs">
                <span className="text-slate-500">Assigned Agent: </span>
                {ticket.assignedAgent ? (
                  <strong className="text-slate-800">{ticket.assignedAgent.name} ({ticket.assignedAgent.role})</strong>
                ) : (
                  <span className="text-amber-700 font-bold">Unassigned Queue</span>
                )}
              </div>

              <div className="space-y-2 pt-1">
                {!ticket.assignedAgent ? (
                  <button
                    onClick={handleTakeTicket}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-lg text-xs shadow-xs transition-colors"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>Take / Claim Ticket</span>
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShowReassignModal(true)}
                      className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition-colors"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Reassign</span>
                    </button>
                    {(isAssignedToMe || isAdmin) && (
                      <button
                        onClick={handleReleaseTicket}
                        className="flex items-center justify-center space-x-1 py-1.5 px-2 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 text-slate-700 font-semibold rounded-lg text-xs border border-slate-200 transition-colors"
                      >
                        <UserMinus className="w-3.5 h-3.5" />
                        <span>Release</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Status & Lifecycle Transition Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
              Status & Lifecycle
            </h3>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Current Status:</span>
              <StatusBadge status={ticket.status} size="sm" />
            </div>

            {isStaff && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* WAITING_FOR_CUSTOMER */}
                {ticket.status !== 'WAITING_FOR_CUSTOMER' && !isResolved && !isTerminal && (
                  <button
                    onClick={handleSetWaitingCustomer}
                    className="w-full flex items-center justify-center space-x-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    <PauseCircle className="w-4 h-4" />
                    <span>Wait for Customer (Pause SLA)</span>
                  </button>
                )}

                {/* Return to IN_PROGRESS */}
                {isWaitingCustomer && (
                  <button
                    onClick={handleSetInProgress}
                    className="w-full flex items-center justify-center space-x-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Resume (In Progress)</span>
                  </button>
                )}

                {/* RESOLVED */}
                {!isResolved && !isTerminal && (
                  <button
                    onClick={() => setShowResolveModal(true)}
                    className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg text-xs shadow-xs transition-colors"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Resolve Ticket</span>
                  </button>
                )}

                {/* REOPEN */}
                {isResolved && (
                  <button
                    onClick={() => setShowReopenModal(true)}
                    className="w-full flex items-center justify-center space-x-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-semibold py-2 px-3 rounded-lg text-xs transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Reopen Ticket (7-Day Window)</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 5. Priority Control Card (Staff Only) */}
          {isStaff && !isTerminal && !isResolved && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                Update Priority
              </h3>
              <p className="text-[11px] text-slate-500">
                Updating priority recalculates response & resolution due dates immediately.
              </p>
              <select
                value={ticket.priority}
                onChange={(e) => handlePriorityChange(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                <option value="LOW">Low / Small (8h / 5 days)</option>
                <option value="MEDIUM">Medium (4h / 3 days)</option>
                <option value="HIGH">High (3h / 1 day)</option>
                <option value="URGENT">Critical / Urgent (2h / Same day)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <ReassignModal
        isOpen={showReassignModal}
        onClose={() => setShowReassignModal(false)}
        ticket={ticket}
        onSuccess={loadTicketData}
      />

      <ResolveModal
        isOpen={showResolveModal}
        onClose={() => setShowResolveModal(false)}
        ticket={ticket}
        onSuccess={loadTicketData}
      />

      <ReopenModal
        isOpen={showReopenModal}
        onClose={() => setShowReopenModal(false)}
        ticket={ticket}
        onSuccess={loadTicketData}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        data={exportData}
      />
    </div>
  );
}
