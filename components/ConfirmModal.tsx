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

  const isDelete = title.toLowerCase().includes('delete') || message.toLowerCase().includes('delete');

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)', padding: 20,
      backdropFilter: 'blur(8px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{ 
        width: '100%', maxWidth: 380, 
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.3)',
        animation: 'scaleIn 0.2s ease-out' 
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ color: isDelete ? 'var(--danger)' : 'var(--accent)' }}>
            <AlertCircle size={24} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h3>
        </div>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: 1.5 }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer'
          }} onClick={onCancel}>Cancel</button>
          <button style={{
            padding: '10px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
            background: isDelete ? 'linear-gradient(to right, #DC2626, #B91C1C)' : 'linear-gradient(to right, var(--accent), #5B4FE0)', 
            color: 'white', border: 'none', cursor: 'pointer'
          }} onClick={onConfirm}>
            {isDelete ? 'Yes, Delete' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
