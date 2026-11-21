import React, { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ReassignModal({ isOpen, onClose, ticket, onSuccess }) {
  const [agents, setAgents] = useState([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadAgents();
    }
  }, [isOpen]);

  const loadAgents = async () => {
    try {
      const res = await api.get('/tickets/agents');
      const list = res.data.agents || [];
      // Filter out currently assigned agent
      const candidates = list.filter((a) => a.id !== ticket?.assignedAgentId);
      setAgents(candidates);
      if (candidates.length > 0) {
        setSelectedAgentId(candidates[0].id);
      }
    } catch (err) {
      console.error('Failed to load agents:', err);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgentId) {
      setError('Please select an agent to reassign this ticket to.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post(`/tickets/${ticket.id}/reassign`, {
        agentId: selectedAgentId,
      });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reassign ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 text-sm">Reassign Ticket #{ticket?.ticketNumber}</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="text-xs text-slate-600">
            Currently assigned to: <strong className="text-slate-800">{ticket?.assignedAgent?.name || 'Unassigned'}</strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select New Agent</label>
            {agents.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No other agents available.</p>
            ) : (
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white"
              >
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} ({agent.role} - {agent.email})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
            Reassignment will close the previous agent's assignment record, create a new active assignment, and append an immutable event in the audit trail.
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || agents.length === 0}
              className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm"
            >
              {submitting ? 'Reassigning...' : 'Confirm Reassign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
