import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ isOpen, title = 'Confirm Action', message, onConfirm, onCancel }: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: 20
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, animation: 'scaleIn 0.2s ease-out' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ color: 'var(--danger)' }}>
            <AlertCircle size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        </div>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary" onClick={onConfirm} style={{ background: 'var(--danger)', color: 'white', border: 'none' }}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}
