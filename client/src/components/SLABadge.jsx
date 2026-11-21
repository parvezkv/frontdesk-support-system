import React from 'react';
import { Clock, PauseCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function SLABadge({ ticket, type = 'response' }) {
  if (!ticket) return null;

  const isPaused = ticket.status === 'WAITING_FOR_CUSTOMER';
  const isTerminal = ticket.status === 'CLOSED';
  const isResolved = ticket.status === 'RESOLVED';

  if (isTerminal) {
    return (
      <span className="inline-flex items-center space-x-1 text-[11px] text-slate-500 font-medium">
        <span>Closed</span>
      </span>
    );
  }

  if (type === 'response') {
    if (ticket.firstResponseAt) {
      return (
        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Met ({ticket.firstResponseAtIST || 'Responded'})</span>
        </span>
      );
    }

    if (isPaused) {
      return (
        <span className="inline-flex items-center space-x-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-200">
          <PauseCircle className="w-3 h-3 text-purple-600" />
          <span>Paused</span>
        </span>
      );
    }

    const isOverdue = ticket.responseDueAt && new Date(ticket.responseDueAt) < new Date();

    if (isOverdue) {
      return (
        <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>Overdue ({ticket.responseDueAtIST || 'Due passed'})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
        <Clock className="w-3 h-3 text-slate-400" />
        <span>Due {ticket.responseDueAtIST || 'Pending'}</span>
      </span>
    );
  }

  if (type === 'resolution') {
    if (isResolved) {
      return (
        <span className="inline-flex items-center space-x-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-medium border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>Resolved ({ticket.resolvedAtIST || 'Done'})</span>
        </span>
      );
    }

    if (isPaused) {
      return (
        <span className="inline-flex items-center space-x-1 text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-[11px] font-medium border border-purple-200">
          <PauseCircle className="w-3 h-3 text-purple-600" />
          <span>Paused</span>
        </span>
      );
    }

    const isOverdue = ticket.resolutionDueAt && new Date(ticket.resolutionDueAt) < new Date();

    if (isOverdue) {
      return (
        <span className="inline-flex items-center space-x-1 text-rose-700 bg-rose-50 px-2 py-0.5 rounded text-[11px] font-semibold border border-rose-200">
          <AlertCircle className="w-3 h-3 text-rose-600" />
          <span>Overdue ({ticket.resolutionDueAtIST || 'Due passed'})</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center space-x-1 text-slate-600 bg-slate-50 px-2 py-0.5 rounded text-[11px] font-medium border border-slate-200">
        <Clock className="w-3 h-3 text-slate-400" />
        <span>Due {ticket.resolutionDueAtIST || 'Pending'}</span>
      </span>
    );
  }

  return null;
}
