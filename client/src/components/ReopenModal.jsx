import React, { useState } from 'react';
import { X, RefreshCw, AlertCircle } from 'lucide-react';
import api from '../services/api';

export default function ReopenModal({ isOpen, onClose, ticket, onSuccess }) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);
      await api.post(`/tickets/${ticket.id}/reopen`, {
        reason: reason.trim(),
      });
      setReason('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reopen ticket.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <RefreshCw className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-slate-900 text-sm">Reopen Ticket #{ticket?.ticketNumber}</h3>
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
              Reason for Reopening (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Customer reported recurring payment failure under high concurrency..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <div className="text-[11px] text-slate-500 bg-amber-50/60 p-2.5 rounded-lg border border-amber-200">
            <strong>Business Rule 7:</strong> Reopening is permitted within 7 calendar days of resolution. Beyond this window, a new ticket must be filed. Reopening returns status to <strong>IN_PROGRESS</strong> and recalculates SLA deadlines.
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
              className="px-4 py-1.5 text-xs bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-lg shadow-sm transition-colors"
            >
              {submitting ? 'Reopening...' : 'Confirm Reopen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
