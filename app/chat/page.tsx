'use client';

import { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Sparkles, TrendingUp, Search, CheckCircle2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Message {
  _id?: string;
  role: 'user' | 'ai';
  content: string;
  metadata?: any;
}

function DraftExpenseCard({ data }: { data: any }) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (success) {
    return (
      <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--shape-medium)', background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
          <CheckCircle2 size={18} /> Expense Confirmed!
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: data.amount,
          categoryId: data.categoryId,
          accountId: data.accountId,
          note: data.note,
          date: data.date
        })
      });
      setSuccess(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 12, padding: 16, borderRadius: 'var(--shape-large)', background: 'var(--md-sys-color-surface)', border: '1px solid var(--md-sys-color-outline-variant)', color: 'var(--md-sys-color-on-surface)' }}>
      <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, color: 'var(--md-sys-color-primary)' }}>₹{data.amount.toFixed(2)}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Category</span><span>{data.emoji} {data.categoryName}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Account</span><span>{data.accountName || 'Cash / None'}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Note</span><span style={{ textAlign: 'right' }}>{data.note}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Date</span><span>{data.date}</span></div>
      </div>
      <button onClick={handleConfirm} disabled={loading} style={{ width: '100%', marginTop: 16, padding: 12, borderRadius: 24, background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', border: 'none', fontWeight: 600, cursor: loading ? 'default' : 'pointer' }}>
        {loading ? 'Adding...' : 'Confirm & Add'}
      </button>
    </div>
  );
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/chat/history');
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const confirmClearHistory = async () => {
    try {
      await fetch('/api/chat/history', { method: 'DELETE' });
      setMessages([]);
      setShowConfirm(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearHistoryClick = () => {
    setShowConfirm(true);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'ai', content: data.content, metadata: data.metadata }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: data.content || data.error || 'Something went wrong.' }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'ai', content: 'Network error. Please try again later.' }]);
    } finally {
      setLoading(false);
    }
  };

  const renderMetadata = (meta: any) => {
    if (!meta || !meta.type) return null;

    if (meta.type === 'transactions' && meta.data && meta.data.length > 0) {
      return (
        <div style={{ marginTop: 12, overflowX: 'auto', borderRadius: 'var(--shape-medium)', border: '1px solid var(--md-sys-color-outline-variant)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, background: 'var(--md-sys-color-surface)' }}>
            <thead style={{ background: 'var(--md-sys-color-surface-container)' }}>
              <tr>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: 'var(--md-sys-color-on-surface-variant)' }}>Date</th>
                <th style={{ padding: '8px', textAlign: 'left', fontWeight: 500, color: 'var(--md-sys-color-on-surface-variant)' }}>Note</th>
                <th style={{ padding: '8px', textAlign: 'right', fontWeight: 500, color: 'var(--md-sys-color-on-surface-variant)' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {meta.data.slice(0, 5).map((exp: any, i: number) => (
                <tr key={i} style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                  <td style={{ padding: '8px', color: 'var(--md-sys-color-on-surface)' }}>{exp.date.split('-').slice(1).join('/')}</td>
                  <td style={{ padding: '8px', color: 'var(--md-sys-color-on-surface)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{exp.notes || 'Expense'}</td>
                  <td style={{ padding: '8px', textAlign: 'right', fontWeight: 500, color: 'var(--md-sys-color-on-surface)' }}>₹{exp.amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {meta.data.length > 5 && (
            <div style={{ padding: '8px', fontSize: 11, textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)', background: 'var(--md-sys-color-surface-container)' }}>
              + {meta.data.length - 5} more transactions
            </div>
          )}
        </div>
      );
    }

    if (meta.type === 'affordability' && meta.data) {
      const isAffordable = meta.data.remaining >= meta.data.target;
      return (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--shape-medium)', background: isAffordable ? 'var(--md-sys-color-primary-container)' : 'var(--md-sys-color-error-container)', color: isAffordable ? 'var(--md-sys-color-on-primary-container)' : 'var(--md-sys-color-on-error-container)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span>Target amount:</span>
            <span style={{ fontWeight: 600 }}>₹{meta.data.target}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Remaining budget:</span>
            <span style={{ fontWeight: 600 }}>₹{meta.data.remaining}</span>
          </div>
        </div>
      );
    }

    if (meta.type === 'draft_expense' && meta.data) {
      return <DraftExpenseCard data={meta.data} />;
    }

    return null;
  };

  return (
    <div className="layout">
      <header className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 className="header-title">AI Assistant</h1>
        </div>
        <button onClick={handleClearHistoryClick} style={{ background: 'transparent', border: 'none', color: 'var(--md-sys-color-on-surface-variant)', cursor: 'pointer', padding: 8 }}>
          <Trash2 size={20} />
        </button>
      </header>

      <main className="content" style={{ display: 'flex', flexDirection: 'column', paddingBottom: 80, height: '100%', overflowY: 'hidden' }}>
        
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {historyLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--md-sys-color-on-surface-variant)', marginTop: 40 }}>Loading chat...</div>
          ) : messages.length === 0 ? (
            <div style={{ textAlign: 'center', marginTop: 40 }}>
              <div style={{ display: 'inline-flex', padding: 16, borderRadius: '50%', background: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)', marginBottom: 16 }}>
                <Sparkles size={32} />
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--md-sys-color-on-surface)', marginBottom: 8 }}>Chat with your Finances</h2>
              <p style={{ color: 'var(--md-sys-color-on-surface-variant)', fontSize: 14, marginBottom: 24 }}>Ask me anything about your spending habits, trends, and budgets.</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
                <button onClick={() => sendMessage("What were my highest expenses this month?")} style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 'var(--shape-large)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 300, cursor: 'pointer', color: 'var(--md-sys-color-on-surface)' }}>
                  <TrendingUp size={18} className="icon-secondary" />
                  <span style={{ fontSize: 14 }}>Highest expenses this month</span>
                </button>
                <button onClick={() => sendMessage("How much did I spend on food this year?")} style={{ background: 'var(--md-sys-color-surface-container)', border: '1px solid var(--md-sys-color-outline-variant)', borderRadius: 'var(--shape-large)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 300, cursor: 'pointer', color: 'var(--md-sys-color-on-surface)' }}>
                  <Search size={18} className="icon-secondary" />
                  <span style={{ fontSize: 14 }}>Total spent on Food this year</span>
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '12px 16px',
                  borderRadius: 'var(--shape-large)',
                  background: msg.role === 'user' ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-surface-container)',
                  color: msg.role === 'user' ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface)',
                  borderTopRightRadius: msg.role === 'user' ? 4 : 'var(--shape-large)',
                  borderTopLeftRadius: msg.role === 'ai' ? 4 : 'var(--shape-large)',
                  fontSize: 14,
                  lineHeight: 1.5,
                  boxShadow: 'var(--elevation-1)'
                }}>
                  {msg.content}
                  {renderMetadata(msg.metadata)}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ maxWidth: '85%', padding: '12px 16px', borderRadius: 'var(--shape-large)', background: 'var(--md-sys-color-surface-container)', color: 'var(--md-sys-color-on-surface-variant)', borderTopLeftRadius: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div className="dot-typing"></div>
                <span style={{ fontSize: 12 }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: '16px', background: 'var(--md-sys-color-surface)', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} style={{ display: 'flex', gap: 8, position: 'relative' }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your finances..."
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px 48px 12px 16px',
                borderRadius: 24,
                border: '1px solid var(--md-sys-color-outline)',
                background: 'var(--md-sys-color-surface-container-low)',
                color: 'var(--md-sys-color-on-surface)',
                fontSize: 14,
                outline: 'none'
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{
                position: 'absolute',
                right: 4,
                top: 4,
                bottom: 4,
                width: 40,
                borderRadius: '50%',
                background: input.trim() ? 'var(--md-sys-color-primary)' : 'transparent',
                color: input.trim() ? 'var(--md-sys-color-on-primary)' : 'var(--md-sys-color-on-surface-variant)',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: input.trim() && !loading ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </main>

      <ConfirmModal
        isOpen={showConfirm}
        title="Clear Chat History"
        message="Are you sure you want to clear your entire chat history? This action cannot be undone."
        onConfirm={confirmClearHistory}
        onCancel={() => setShowConfirm(false)}
      />

      <style dangerouslySetInnerHTML={{__html: `
        .dot-typing {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background-color: var(--md-sys-color-primary);
          animation: dot-typing 1.5s infinite linear;
        }
        @keyframes dot-typing {
          0% { box-shadow: 10px 0 0 0 var(--md-sys-color-primary), 20px 0 0 0 var(--md-sys-color-primary); }
          25% { box-shadow: 10px -5px 0 0 var(--md-sys-color-primary), 20px 0 0 0 var(--md-sys-color-primary); }
          50% { box-shadow: 10px 0 0 0 var(--md-sys-color-primary), 20px -5px 0 0 var(--md-sys-color-primary); }
          75% { box-shadow: 10px 0 0 0 var(--md-sys-color-primary), 20px 0 0 0 var(--md-sys-color-primary); }
          100% { box-shadow: 10px 0 0 0 var(--md-sys-color-primary), 20px 0 0 0 var(--md-sys-color-primary); }
        }
      `}} />
    </div>
  );
}
