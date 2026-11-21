import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ResolveModal({ isOpen, onClose, ticket, onSuccess }) {
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!summary.trim() || summary.trim().length < 5) {
      setError('A resolution summary of at least 5 characters is mandatory.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.patch(`/tickets/${ticket.id}/status`, {
        status: 'RESOLVED',
        resolutionSummary: summary.trim(),
      });
      setSummary('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resolve ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-slate-900 text-sm">Resolve Ticket #{ticket?.ticketNumber}</h3>
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

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Resolution Summary *
            </label>
            <p className="text-[11px] text-slate-500 mb-2">
              Explain how the issue was resolved. This is recorded in the ticket history and shared with the customer.
            </p>
            <textarea
              rows={3}
              required
              placeholder="e.g. Cleared payment gateway cache, re-authorized merchant token, and verified successful test charge."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-emerald-50/60 p-2.5 rounded-lg border border-emerald-100">
            Marking as RESOLVED stops the resolution SLA clock and records <code>resolvedAt</code>. The customer or authorized agent may reopen within 7 calendar days if further assistance is required.
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
              disabled={submitting}
              className="px-4 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors"
            >
              {submitting ? 'Resolving...' : 'Confirm Resolution'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
