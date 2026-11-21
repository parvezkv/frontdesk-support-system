import React from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

export default function PriorityBadge({ priority, size = 'sm' }) {
  const configs = {
    URGENT: {
      label: 'Critical / Urgent',
      shortLabel: 'Urgent',
      bg: 'bg-rose-50 text-rose-700 border-rose-200',
      icon: ShieldAlert,
    },
    HIGH: {
      label: 'High',
      shortLabel: 'High',
      bg: 'bg-orange-50 text-orange-700 border-orange-200',
      icon: AlertTriangle,
    },
    MEDIUM: {
      label: 'Medium',
      shortLabel: 'Medium',
      bg: 'bg-sky-50 text-sky-700 border-sky-200',
      icon: Info,
    },
    LOW: {
      label: 'Low / Small',
      shortLabel: 'Low',
      bg: 'bg-slate-100 text-slate-700 border-slate-200',
      icon: Info,
    },
  };

  const config = configs[priority] || {
    label: priority || 'Normal',
    shortLabel: priority || 'Normal',
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    icon: Info,
  };

  const Icon = config.icon;
  const sizeClasses = size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : size === 'lg' ? 'px-3 py-1.5 text-xs font-semibold' : 'px-2.5 py-0.5 text-xs';

  return (
    <span className={`inline-flex items-center space-x-1 rounded-md font-semibold border ${config.bg} ${sizeClasses}`}>
      <Icon className={size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
      <span>{size === 'xs' ? config.shortLabel : config.label}</span>
    </span>
  );
}
