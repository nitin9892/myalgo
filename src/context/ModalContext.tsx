'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmModal from '@/components/ConfirmModal';

export interface ModalOptions {
  title?: string;
  message: string;
  type?: 'danger' | 'warning' | 'success' | 'info';
  confirmText?: string;
  cancelText?: string;
}

interface ModalContextType {
  showConfirm: (options: ModalOptions | string) => Promise<boolean>;
  showAlert: (options: ModalOptions | string) => Promise<void>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'warning' | 'success' | 'info';
    confirmText: string;
    cancelText: string;
    isAlertOnly: boolean;
    resolve: (val: boolean) => void;
  } | null>(null);

  const showConfirm = useCallback((options: ModalOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setModalState({
        isOpen: true,
        title: opts.title || 'Confirm Action',
        message: opts.message,
        type: opts.type || 'warning',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        isAlertOnly: false,
        resolve: (val: boolean) => {
          setModalState(null);
          resolve(val);
        },
      });
    });
  }, []);

  const showAlert = useCallback((options: ModalOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setModalState({
        isOpen: true,
        title: opts.title || (opts.type === 'danger' ? 'Notice' : opts.type === 'success' ? 'Success' : 'Notice'),
        message: opts.message,
        type: opts.type || 'info',
        confirmText: opts.confirmText || 'OK',
        cancelText: '',
        isAlertOnly: true,
        resolve: () => {
          setModalState(null);
          resolve();
        },
      });
    });
  }, []);

  return (
    <ModalContext.Provider value={{ showConfirm, showAlert }}>
      {children}
      {modalState && (
        <ConfirmModal
          isOpen={modalState.isOpen}
          title={modalState.title}
          message={modalState.message}
          type={modalState.type}
          confirmText={modalState.confirmText}
          cancelText={modalState.cancelText}
          isAlertOnly={modalState.isAlertOnly}
          onConfirm={() => modalState.resolve(true)}
          onCancel={() => modalState.resolve(false)}
        />
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    return {
      showConfirm: async (opts: ModalOptions | string) => {
        const msg = typeof opts === 'string' ? opts : opts.message;
        return typeof window !== 'undefined' ? window.confirm(msg) : true;
      },
      showAlert: async (opts: ModalOptions | string) => {
        const msg = typeof opts === 'string' ? opts : opts.message;
        if (typeof window !== 'undefined') window.alert(msg);
      },
    };
  }
  return context;
}
