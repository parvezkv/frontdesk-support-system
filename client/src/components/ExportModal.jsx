import React from 'react';
import { X, Download, FileText } from 'lucide-react';

export default function ExportModal({ isOpen, onClose, data }) {
  if (!isOpen || !data) return null;

  const handleDownload = () => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket-${data.ticket?.ticketNumber || 'export'}-conversation.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Ticket #{data.ticket?.ticketNumber} Export
              </h3>
              <p className="text-[11px] text-slate-500">
                Scope: {data.exportType || 'Standard Conversation Export'} (Internal notes strictly excluded from customer exports)
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 font-mono text-xs text-slate-800">
          <pre className="whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
        </div>

        <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
          <span className="text-xs text-slate-500">
            Total Messages: {data.messages?.length || 0}
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download JSON</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
