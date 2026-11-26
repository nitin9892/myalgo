'use client';

import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Info, X, Copy, Check } from 'lucide-react';

export interface ConfirmModalProps {
  isOpen: boolean;
  type?: 'danger' | 'warning' | 'success' | 'info';
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isAlertOnly?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  isOpen,
  type = 'warning',
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isAlertOnly = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [copiedIp, setCopiedIp] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    if (onCancel) onCancel();
    else onConfirm();
  };

  // Check if message has an IP address like [ 42.108.78.14 ]
  const ipMatch = message.match(/\[\s*([0-9a-fA-F:.]+)\s*\]/);
  const detectedIp = ipMatch ? ipMatch[1] : null;

  const copyIpToClipboard = async () => {
    if (!detectedIp) return;
    try {
      await navigator.clipboard.writeText(detectedIp);
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2500);
    } catch {}
  };

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return (
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-rose-500/20">
            <AlertOctagon className="w-6 h-6 animate-pulse" />
          </div>
        );
      case 'warning':
        return (
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20">
            <AlertTriangle className="w-6 h-6" />
          </div>
        );
      case 'success':
        return (
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center shrink-0 shadow-lg shadow-cyan-500/20">
            <Info className="w-6 h-6" />
          </div>
        );
    }
  };

  const getConfirmButtonClasses = () => {
    switch (type) {
      case 'danger':
        return 'bg-rose-500 hover:bg-rose-600 text-white shadow-lg shadow-rose-500/30';
      case 'warning':
        return 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-black shadow-lg shadow-amber-500/25';
      case 'success':
        return 'bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black shadow-lg shadow-emerald-500/25';
      case 'info':
      default:
        return 'bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black shadow-lg shadow-cyan-500/25';
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Line */}
        <div className={`absolute top-0 left-0 right-0 h-1.5 ${
          type === 'danger' ? 'bg-rose-500' : (type === 'warning' ? 'bg-amber-500' : (type === 'success' ? 'bg-emerald-500' : 'bg-cyan-500'))
        }`} />

        {/* Header Row */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            {getIcon()}
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {isAlertOnly ? 'System Alert' : 'Action Confirmation'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Box */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 text-xs sm:text-sm text-slate-200 leading-relaxed font-medium whitespace-pre-line max-h-[55vh] overflow-y-auto">
          {message}

          {/* If an IP address is detected in the message, provide a 1-tap Copy IP button right inside the modal */}
          {detectedIp && (
            <div className="mt-3 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-400 font-mono">
                Detected: <strong className="text-emerald-400">{detectedIp}</strong>
              </span>
              <button
                type="button"
                onClick={copyIpToClipboard}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 text-xs font-bold transition-all active:scale-95"
              >
                {copiedIp ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedIp ? 'Copied!' : 'Copy IP'}
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-1">
          {!isAlertOnly && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 font-semibold text-xs sm:text-sm border border-slate-700 transition-all active:scale-95"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center justify-center ${
              isAlertOnly ? 'w-full' : ''
            } ${getConfirmButtonClasses()}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
