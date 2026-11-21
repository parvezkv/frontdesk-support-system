import React from 'react';
import { PauseCircle, CheckCircle2, AlertCircle, Clock, Archive } from 'lucide-react';

export default function StatusBadge({ status, size = 'sm' }) {
  const configs = {
    OPEN: {
      label: 'Open',
      bg: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: Clock,
    },
    IN_PROGRESS: {
      label: 'In Progress',
      bg: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: Clock,
    },
    WAITING_FOR_CUSTOMER: {
      label: 'Waiting for Customer',
      bg: 'bg-purple-50 text-purple-700 border-purple-200',
      icon: PauseCircle,
    },
    RESOLVED: {
      label: 'Resolved',
      bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      icon: CheckCircle2,
    },
    CLOSED: {
      label: 'Closed',
      bg: 'bg-slate-100 text-slate-700 border-slate-300',
      icon: Archive,
    },
  };

  const config = configs[status] || {
    label: status || 'Unknown',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: AlertCircle,
  };

  const Icon = config.icon;
  const sizeClasses = size === 'xs' ? 'px-2 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1.5 text-xs font-semibold' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`inline-flex items-center space-x-1 rounded-full font-medium border ${config.bg} ${sizeClasses}`}>
      <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{config.label}</span>
    </span>
  );
}
