import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useHaptic } from '../../hooks/useHaptic';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
}) => {
  const { trigger } = useHaptic();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-[#0f172a]/90 rounded-[32px] w-full max-w-sm border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden animate-in zoom-in-95 duration-300 ring-1 ring-white/10">
        <div className="p-8 text-center">
          <div
            className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 ${
              isDestructive ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
            }`}
          >
            <AlertTriangle size={32} />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">{message}</p>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                trigger(isDestructive ? 'warning' : 'success');
                onConfirm();
                onClose();
              }}
              className={`flex-1 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                isDestructive
                  ? 'bg-red-600 hover:bg-red-500 shadow-red-900/20'
                  : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
