import React, { useState, useEffect } from 'react';
import { 
  Ticket, 
  MessageSquare, 
  Lock, 
  User, 
  Clock, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Shield, 
  FileText, 
  RefreshCw, 
  Search, 
  Plus, 
  X, 
  Download, 
  AlertTriangle,
  UserCheck,
  PauseCircle,
  PlayCircle
} from 'lucide-react';
import api from './services/api';

const DEMO_USERS = [
  { label: 'Admin', email: 'admin@frontdesk.com', role: 'ADMIN', name: 'System Administrator' },
  { label: 'Agent Sarah', email: 'agent.sarah@frontdesk.com', role: 'AGENT', name: 'Sarah Connor' },
  { label: 'Agent Alex', email: 'agent.alex@frontdesk.com', role: 'AGENT', name: 'Alex Murphy' },
  { label: 'Customer John', email: 'john.doe@example.com', role: 'CUSTOMER', name: 'John Doe' },
  { label: 'Customer Jane', email: 'jane.smith@example.com', role: 'CUSTOMER', name: 'Jane Smith' },
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(DEMO_USERS[1]); // Default to Agent Sarah
  const [token, setToken] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [activeTab, setActiveTab] = useState('conversation'); // 'conversation', 'internalNotes', 'events'
  const [composerMode, setComposerMode] = useState('reply'); // 'reply', 'internalNote'
  const [messageContent, setMessageContent] = useState('');
  const [internalNoteContent, setInternalNoteContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportData, setExportData] = useState(null);
  const [notification, setNotification] = useState(null);

  // New Ticket Form State
  const [newSubject, setNewSubject] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState('MEDIUM');

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // 1. Authenticate user when persona changes
  const switchUser = async (user) => {
    try {
      setLoading(true);
      const res = await api.post('/auth/login', {
        email: user.email,
        password: 'password123',
      });
      localStorage.setItem('frontdesk_token', res.data.token);
      setToken(res.data.token);
      setCurrentUser(res.data.user);
      // Reset composer mode if switched to customer
      if (res.data.user.role === 'CUSTOMER') {
        setComposerMode('reply');
        setActiveTab('conversation');
      }
      showNotification(`Switched active persona to ${res.data.user.name} (${res.data.user.role})`);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Initial login
  useEffect(() => {
    switchUser(currentUser);
  }, []);

  // 2. Load tickets whenever user/token or filters change
  const loadTickets = async () => {
    if (!token) return;
    try {
      const params = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search.trim()) params.search = search.trim();
      const res = await api.get('/tickets', { params });
      setTickets(res.data.data || []);
      // If selected ticket exists, refresh it
      if (selectedTicket) {
        loadTicketDetail(selectedTicket.id);
      } else if (res.data.data?.length > 0) {
        loadTicketDetail(res.data.data[0].id);
      } else {
        setSelectedTicket(null);
      }
    } catch (err) {
      console.error('Error loading tickets:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadTickets();
    }
  }, [token, statusFilter]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (token) loadTickets();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 3. Load full ticket details
  const loadTicketDetail = async (ticketId) => {
    try {
      const res = await api.get(`/tickets/${ticketId}`);
      setSelectedTicket(res.data.ticket);
    } catch (err) {
      console.error('Error loading ticket detail:', err);
      showNotification('Could not load ticket details', 'error');
    }
  };

  // 4. Send Public Message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageContent.trim() || !selectedTicket) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${selectedTicket.id}/messages`, {
        content: messageContent.trim(),
      });
      setMessageContent('');
      showNotification('Message posted successfully');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send message', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Add Internal Note (Staff only)
  const handleAddInternalNote = async (e) => {
    e.preventDefault();
    if (!internalNoteContent.trim() || !selectedTicket) return;
    setSubmitting(true);
    try {
      await api.post(`/tickets/${selectedTicket.id}/internal-notes`, {
        content: internalNoteContent.trim(),
      });
      setInternalNoteContent('');
      showNotification('Private internal note saved');
      await loadTicketDetail(selectedTicket.id);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to add internal note', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 6. Ticket Assignment Actions (Take / Release)
  const handleTakeTicket = async () => {
    try {
      await api.post(`/tickets/${selectedTicket.id}/assign`, {});
      showNotification('You have taken this ticket');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to take ticket', 'error');
    }
  };

  const handleReleaseTicket = async () => {
    try {
      await api.post(`/tickets/${selectedTicket.id}/release`, {});
      showNotification('Ticket released back to unassigned queue');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to release ticket', 'error');
    }
  };

  // 7. Status Actions (Wait for customer, resolve)
  const handleSetWaitingCustomer = async () => {
    try {
      await api.patch(`/tickets/${selectedTicket.id}/status`, {
        status: 'WAITING_FOR_CUSTOMER',
      });
      showNotification('Ticket marked WAITING_FOR_CUSTOMER. SLA clock paused.');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  const handleResolveTicket = async () => {
    const summary = window.prompt('Enter resolution summary for this ticket:');
    if (!summary || summary.trim().length < 5) {
      showNotification('A resolution summary of at least 5 characters is required.', 'error');
      return;
    }
    try {
      await api.patch(`/tickets/${selectedTicket.id}/status`, {
        status: 'RESOLVED',
        resolutionSummary: summary.trim(),
      });
      showNotification('Ticket marked RESOLVED successfully');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to resolve ticket', 'error');
    }
  };

  // 7b. Reopen Resolved Ticket (Rule 7: within 7 calendar days)
  const handleReopenTicket = async () => {
    const reason = window.prompt('Enter reason for reopening this ticket (within 7-calendar-day window):');
    if (reason === null) return;
    try {
      await api.post(`/tickets/${selectedTicket.id}/reopen`, { reason: reason.trim() });
      showNotification('Ticket reopened successfully. Status changed to IN_PROGRESS.');
      await loadTicketDetail(selectedTicket.id);
      await loadTickets();
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to reopen ticket', 'error');
    }
  };

  // 8. Create New Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    if (!newSubject.trim() || !newDescription.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/tickets', {
        subject: newSubject.trim(),
        description: newDescription.trim(),
        priority: newPriority,
      });
      showNotification(`Ticket #${res.data.ticket.ticketNumber} created successfully!`);
      setShowNewModal(false);
      setNewSubject('');
      setNewDescription('');
      setNewPriority('MEDIUM');
      await loadTickets();
      setSelectedTicket(res.data.ticket);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to create ticket', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // 9. Export Ticket
  const handleExport = async () => {
    try {
      const res = await api.get(`/tickets/${selectedTicket.id}/export`);
      setExportData(res.data.export);
      setShowExportModal(true);
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to export ticket', 'error');
    }
  };

  const isStaff = currentUser?.role === 'ADMIN' || currentUser?.role === 'AGENT';

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center space-x-2 transition-all ${
          notification.type === 'error' ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header & Persona Selector */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-100">
              <Ticket className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-slate-900 text-lg tracking-tight">Frontdesk</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                iNav Tech Support
              </span>
            </div>
          </div>

          {/* Quick Persona Switcher */}
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-slate-500 font-medium">Logged in as</p>
              <p className="text-sm font-bold text-slate-800">{currentUser?.name}</p>
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
              {DEMO_USERS.map((user) => (
                <button
                  key={user.email}
                  onClick={() => switchUser(user)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                    currentUser?.email === user.email
                      ? 'bg-white text-indigo-700 shadow-sm font-bold border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                  }`}
                  title={`${user.name} (${user.role})`}
                >
                  {user.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="max-w-7xl mx-auto w-full flex-1 p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Tickets List (4 cols) */}
        <div className="lg:col-span-4 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-7.5rem)]">
          {/* List Controls */}
          <div className="p-3.5 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center space-x-2">
                <span>Tickets Queue</span>
                <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 font-medium">
                  {tickets.length}
                </span>
              </h2>
              <button
                onClick={() => setShowNewModal(true)}
                className="inline-flex items-center space-x-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1.5 rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Ticket</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search subject or #ticket..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs">
              {['ALL', 'OPEN', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'].map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-2 py-1 rounded-md font-medium whitespace-nowrap transition-colors ${
                    statusFilter === filter
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filter === 'WAITING_FOR_CUSTOMER' ? 'Waiting' : filter.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {tickets.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                No tickets match the current filter or persona permissions.
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => loadTicketDetail(t.id)}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-50/60 border-l-4 border-l-indigo-600'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-900">#{t.ticketNumber}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        t.priority === 'URGENT'
                          ? 'bg-rose-100 text-rose-700'
                          : t.priority === 'HIGH'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {t.priority}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 line-clamp-1">{t.subject}</p>
                    <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{t.description}</p>

                    <div className="flex items-center justify-between mt-2.5 text-[11px] text-slate-500">
                      <span className="truncate max-w-[120px]">{t.customer?.name}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.status === 'OPEN'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : t.status === 'IN_PROGRESS'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : t.status === 'WAITING_FOR_CUSTOMER'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {t.status === 'WAITING_FOR_CUSTOMER' ? 'Waiting' : t.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Ticket Workspace & Communications (8 cols) */}
        <div className="lg:col-span-8 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-[calc(100vh-7.5rem)]">
          {selectedTicket ? (
            <>
              {/* Ticket Header & Actions */}
              <div className="p-4 border-b border-slate-200 bg-white space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-900 text-white">
                        #{selectedTicket.ticketNumber}
                      </span>
                      <h1 className="text-base font-bold text-slate-900">{selectedTicket.subject}</h1>
                    </div>
                    <div className="flex items-center space-x-3 text-xs text-slate-500 mt-1">
                      <span>Customer: <strong className="text-slate-800">{selectedTicket.customer?.name}</strong></span>
                      <span>•</span>
                      <span>Assigned: <strong className="text-slate-800">{selectedTicket.assignedAgent?.name || 'Unassigned'}</strong></span>
                      <span>•</span>
                      <span>Created: {selectedTicket.createdAtIST}</span>
                    </div>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center space-x-2">
                    {isStaff && (
                      <>
                        {!selectedTicket.assignedAgent ? (
                          <button
                            onClick={handleTakeTicket}
                            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Take Ticket</span>
                          </button>
                        ) : selectedTicket.assignedAgent?.id === currentUser.id ? (
                          <button
                            onClick={handleReleaseTicket}
                            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors"
                          >
                            Release
                          </button>
                        ) : null}

                        {selectedTicket.status !== 'WAITING_FOR_CUSTOMER' && selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                          <button
                            onClick={handleSetWaitingCustomer}
                            className="text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                          >
                            <PauseCircle className="w-3.5 h-3.5" />
                            <span>Wait for Customer</span>
                          </button>
                        )}

                        {selectedTicket.status !== 'RESOLVED' && selectedTicket.status !== 'CLOSED' && (
                          <button
                            onClick={handleResolveTicket}
                            className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            Resolve
                          </button>
                        )}

                        {selectedTicket.status === 'RESOLVED' && (
                          <button
                            onClick={handleReopenTicket}
                            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-medium px-2.5 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                            title="Reopen ticket within 7-calendar-day window"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Reopen Ticket</span>
                          </button>
                        )}

                        {selectedTicket.status === 'CLOSED' && (
                          <span className="text-xs bg-slate-100 text-slate-600 border border-slate-300 font-medium px-2.5 py-1.5 rounded-lg">
                            Closed (Terminal)
                          </span>
                        )}
                      </>
                    )}

                    <button
                      onClick={handleExport}
                      className="text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1"
                      title="Export Conversation"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                  </div>
                </div>

                {/* SLA Banner */}
                <div className={`p-2.5 rounded-lg text-xs flex items-center justify-between border ${
                  selectedTicket.status === 'CLOSED'
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : selectedTicket.status === 'RESOLVED'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : selectedTicket.status === 'WAITING_FOR_CUSTOMER'
                    ? 'bg-purple-50 border-purple-200 text-purple-900'
                    : 'bg-slate-50 border-slate-200 text-slate-700'
                }`}>
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>
                      {selectedTicket.status === 'CLOSED' ? (
                        <span>Ticket is permanently <strong>CLOSED</strong>. To report follow-up issues, please create a new ticket.</span>
                      ) : selectedTicket.status === 'RESOLVED' ? (
                        <span>Ticket is <strong>RESOLVED</strong>. Eligible for reopening within 7 calendar days of resolution.</span>
                      ) : (
                        <span>SLA Target: <strong>{selectedTicket.priority}</strong> (Hours: Mon-Fri 09:30 - 18:30 IST)</span>
                      )}
                    </span>
                    {selectedTicket.status === 'WAITING_FOR_CUSTOMER' && (
                      <span className="font-bold text-purple-700 flex items-center space-x-1 ml-2">
                        <PauseCircle className="w-3.5 h-3.5" />
                        <span>SLA Paused</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4">
                    <span>Response Due: <strong>{selectedTicket.responseDueAtIST || 'N/A'}</strong></span>
                    <span>Resolution Due: <strong>{selectedTicket.resolutionDueAtIST || 'N/A'}</strong></span>
                  </div>
                </div>

                {/* Navigation Tabs (Customer only sees Conversation; Staff sees Conversation, Internal Notes, Timeline) */}
                <div className="flex items-center space-x-4 border-b border-slate-100 text-xs font-semibold">
                  <button
                    onClick={() => setActiveTab('conversation')}
                    className={`pb-2 border-b-2 transition-all flex items-center space-x-1.5 ${
                      activeTab === 'conversation'
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Customer Conversation ({selectedTicket.messages?.length || 0})</span>
                  </button>

                  {/* 🔒 Internal Notes Tab strictly hidden from Customers! */}
                  {isStaff && (
                    <button
                      onClick={() => setActiveTab('internalNotes')}
                      className={`pb-2 border-b-2 transition-all flex items-center space-x-1.5 ${
                        activeTab === 'internalNotes'
                          ? 'border-amber-600 text-amber-700'
                          : 'border-transparent text-slate-500 hover:text-amber-700'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Staff Internal Notes ({selectedTicket.internalNotes?.length || 0})</span>
                    </button>
                  )}

                  {isStaff && (
                    <button
                      onClick={() => setActiveTab('events')}
                      className={`pb-2 border-b-2 transition-all flex items-center space-x-1.5 ${
                        activeTab === 'events'
                          ? 'border-indigo-600 text-indigo-600'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Audit Trail ({selectedTicket.events?.length || 0})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Tab Content Display Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                
                {/* 1. Customer Conversation Tab */}
                {activeTab === 'conversation' && (
                  <div className="space-y-3">
                    {/* Initial Ticket Description Box */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                        <span className="font-bold text-slate-800">{selectedTicket.customer?.name} (Original Request)</span>
                        <span>{selectedTicket.createdAtIST}</span>
                      </div>
                      <p className="text-xs text-slate-700 whitespace-pre-wrap">{selectedTicket.description}</p>
                    </div>

                    {/* Thread Messages */}
                    {selectedTicket.messages?.map((msg) => {
                      const isAgent = msg.sender?.role === 'AGENT' || msg.sender?.role === 'ADMIN';
                      return (
                        <div
                          key={msg.id}
                          className={`p-3.5 rounded-lg border text-xs shadow-sm ${
                            isAgent
                              ? 'bg-indigo-50/70 border-indigo-200 ml-6'
                              : 'bg-white border-slate-200 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-slate-800">{msg.sender?.name || 'User'}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                isAgent ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-200 text-slate-700'
                              }`}>
                                {msg.sender?.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-500">{msg.createdAtIST}</span>
                          </div>
                          <p className="text-slate-800 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* 2. Staff Internal Notes Tab (Rendered ONLY if Staff) */}
                {activeTab === 'internalNotes' && isStaff && (
                  <div className="space-y-3">
                    <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center space-x-2 font-medium">
                      <Lock className="w-4 h-4 text-amber-700 flex-shrink-0" />
                      <span>These internal notes are private to support staff and are NEVER visible to the customer.</span>
                    </div>

                    {selectedTicket.internalNotes?.length === 0 ? (
                      <div className="text-center py-8 text-xs text-slate-400">
                        No internal notes recorded for this ticket yet.
                      </div>
                    ) : (
                      selectedTicket.internalNotes?.map((note) => (
                        <div key={note.id} className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 text-xs shadow-sm">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-amber-900">{note.author?.name}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold uppercase bg-amber-200 text-amber-900">
                                {note.author?.role}
                              </span>
                            </div>
                            <span className="text-[11px] text-amber-800">{note.createdAtIST}</span>
                          </div>
                          <p className="text-amber-950 whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
                            {note.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* 3. Audit Trail Tab (Chronological Append-Only History) */}
                {activeTab === 'events' && isStaff && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-medium">
                      <span>Chronological Audit History ({selectedTicket.events?.length || 0} events)</span>
                      <span className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                        <Shield className="w-3 h-3" />
                        <span>Database-level Append-Only Protected</span>
                      </span>
                    </div>

                    {selectedTicket.events?.map((ev, idx) => (
                      <div key={ev.id || idx} className="p-3 rounded-lg bg-white border border-slate-200 text-xs shadow-xs hover:border-slate-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center space-x-2">
                              <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                                ev.eventType.includes('RESOLVED') || ev.eventType.includes('REOPENED')
                                  ? 'bg-amber-100 text-amber-800'
                                  : ev.eventType.includes('PAUSED') || ev.eventType.includes('RESUMED')
                                  ? 'bg-purple-100 text-purple-800'
                                  : ev.eventType.includes('ASSIGN')
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}>
                                {ev.eventType}
                              </span>
                              <span>
                                {ev.oldValue && ev.newValue && ev.oldValue !== ev.newValue ? (
                                  <span>
                                    <span className="text-slate-500 line-through mr-1">{ev.oldValue}</span>
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
                              <span className="font-medium text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded">
                                {ev.actor?.name || 'System Automation'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                ({ev.actor?.role || 'SYSTEM'})
                              </span>
                            </div>

                            {/* Metadata context if available */}
                            {ev.metadata && (ev.metadata.reason || ev.metadata.resolutionSummary || ev.metadata.pausedWorkingMinutes) && (
                              <p className="text-[11px] text-slate-600 bg-slate-50 p-1.5 rounded border border-slate-100 mt-1">
                                {ev.metadata.resolutionSummary && <span>Resolution: {ev.metadata.resolutionSummary}</span>}
                                {ev.metadata.reason && <span>Reason: {ev.metadata.reason}</span>}
                                {ev.metadata.pausedWorkingMinutes && <span>Paused Working Minutes: {ev.metadata.pausedWorkingMinutes} min</span>}
                              </p>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-400 whitespace-nowrap pl-3">
                            <div className="flex items-center space-x-1 justify-end">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{ev.createdAtIST}</span>
                            </div>
                            <span className="text-[9px] text-slate-400 font-mono">#{idx + 1}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Communication Composer */}
              <div className="p-3.5 border-t border-slate-200 bg-white">
                {/* Staff Toggle: Public Reply vs Internal Note */}
                {isStaff ? (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-xs font-semibold">
                      <button
                        onClick={() => setComposerMode('reply')}
                        className={`px-3 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                          composerMode === 'reply'
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Public Reply to Customer</span>
                      </button>
                      <button
                        onClick={() => setComposerMode('internalNote')}
                        className={`px-3 py-1 rounded-md transition-colors flex items-center space-x-1.5 ${
                          composerMode === 'internalNote'
                            ? 'bg-amber-600 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>Private Staff Note</span>
                      </button>
                    </div>

                    {composerMode === 'reply' ? (
                      <form onSubmit={handleSendMessage} className="space-y-2">
                        <textarea
                          rows={2}
                          value={messageContent}
                          onChange={(e) => setMessageContent(e.target.value)}
                          placeholder="Write a public reply visible to the customer..."
                          className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-slate-500">
                            Sent to customer conversation & records SLA response time.
                          </span>
                          <button
                            type="submit"
                            disabled={submitting || !messageContent.trim()}
                            className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>{submitting ? 'Sending...' : 'Send Reply'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      <form onSubmit={handleAddInternalNote} className="space-y-2">
                        <textarea
                          rows={2}
                          value={internalNoteContent}
                          onChange={(e) => setInternalNoteContent(e.target.value)}
                          placeholder="Write an internal note (only visible to support agents & admins)..."
                          className="w-full p-2.5 text-xs rounded-lg border border-amber-300 bg-amber-50/30 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-amber-700 font-medium">
                            🔒 Private Note: Invisible to the customer.
                          </span>
                          <button
                            type="submit"
                            disabled={submitting || !internalNoteContent.trim()}
                            className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            <span>{submitting ? 'Saving...' : 'Add Internal Note'}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ) : (
                  /* Customer Reply Composer */
                  <form onSubmit={handleSendMessage} className="space-y-2">
                    <textarea
                      rows={2}
                      value={messageContent}
                      onChange={(e) => setMessageContent(e.target.value)}
                      placeholder="Write a message to our support team..."
                      className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-500">
                        {selectedTicket.status === 'WAITING_FOR_CUSTOMER'
                          ? 'Sending a message will automatically resume the SLA clock.'
                          : 'Visible to assigned support agents.'}
                      </span>
                      <button
                        type="submit"
                        disabled={submitting || !messageContent.trim()}
                        className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>{submitting ? 'Sending...' : 'Send Message'}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400">
              <Ticket className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">Select a ticket to view the conversation</p>
              <p className="text-xs text-slate-400 mt-1">Choose from the queue on the left or create a new ticket</p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">Create New Support Ticket</h3>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cannot access payment gateway"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-white"
                >
                  <option value="LOW">Small / Low (8h response, 5 days resolution)</option>
                  <option value="MEDIUM">Medium (4h response, 3 days resolution)</option>
                  <option value="HIGH">High (3h response, 1 day resolution)</option>
                  <option value="URGENT">Critical / Urgent (2h response, same day resolution)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Detailed Description</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide complete details regarding the problem..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm"
                >
                  {submitting ? 'Creating...' : 'Submit Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && exportData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6 border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Ticket Export</h3>
                <p className="text-xs text-slate-500">{exportData.exportType}</p>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto my-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-mono">
              <pre className="whitespace-pre-wrap">{JSON.stringify(exportData, null, 2)}</pre>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `ticket-${exportData.ticket.ticketNumber}-export.json`;
                  a.click();
                }}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
