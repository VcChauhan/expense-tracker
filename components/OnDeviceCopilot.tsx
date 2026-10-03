'use client';

import { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, ShieldCheck, User, RefreshCw } from 'lucide-react';
import { checkOnDeviceAi, chatWithLocalCopilot, OnDeviceAiStatus } from '@/lib/onDeviceAiClient';
import { lightTap, successBuzz } from '@/lib/haptics';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
}

interface OnDeviceCopilotProps {
  salary: number;
  totalSpent: number;
  budget: number;
  categories: any[];
  expenses: any[];
}

export function OnDeviceCopilot({ salary, totalSpent, budget, categories, expenses }: OnDeviceCopilotProps) {
  const [aiStatus, setAiStatus] = useState<OnDeviceAiStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'ai',
      text: "Hello! I'm your on-device Financial Copilot powered by Gemma 2B. All calculations and reasoning run 100% on your device's GPU — zero financial data ever leaves your phone. What would you like to explore?",
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkOnDeviceAi().then(setAiStatus);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isThinking]);

  const quickPrompts = [
    'Can I afford a ₹15,000 expense this month?',
    'What is my biggest spending category?',
    'How can I save ₹5,000 more this month?',
    'Am I on track with my monthly budget?',
  ];

  async function handleSend(textToSend?: string) {
    const query = (textToSend || input).trim();
    if (!query || isThinking) return;

    lightTap();
    setInput('');

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    const context = {
      monthlySalary: salary,
      monthlyTotalSpent: totalSpent,
      monthlyBudget: budget,
      remainingBudget: Math.max(0, budget - totalSpent),
      savingsRetained: Math.max(0, salary - totalSpent),
      topCategories: categories.slice(0, 5).map(c => ({ name: c.name, budget: c.monthlyBudget })),
      recentExpensesCount: expenses.length,
    };

    try {
      const answer = await chatWithLocalCopilot(query, context);
      successBuzz();
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: answer,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Local copilot error:', err);
      const errMsg: Message = {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: "I couldn't reach the on-device engine right now. Please ensure the Companion App is active in the background!",
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsThinking(false);
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: 24,
      border: '1px solid var(--border-glow)',
      boxShadow: 'var(--shadow-glow)',
      marginBottom: 24,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 12%, transparent), transparent)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 12,
            background: 'var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-2)',
          }}>
            <Bot size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>AI Financial Copilot</span>
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: 99,
                background: aiStatus?.available ? 'rgba(16,185,129,0.15)' : 'var(--bg-elevated)',
                color: aiStatus?.available ? '#10b981' : 'var(--text-muted)',
                border: `1px solid ${aiStatus?.available ? 'rgba(16,185,129,0.3)' : 'var(--border)'}`,
              }}>
                {aiStatus?.available ? '✦ On-Device Gemma Active' : '✦ Pattern AI'}
              </span>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <ShieldCheck size={12} color="#10b981" /> 100% Private • Processed strictly on device GPU
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            checkOnDeviceAi().then(setAiStatus);
            setMessages([
              {
                id: 'welcome-reset',
                sender: 'ai',
                text: "Chat context refreshed. What financial decision would you like to review?",
                time: 'Just now',
              },
            ]);
          }}
          title="Reset Chat"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 8,
          }}
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Messages area */}
      <div style={{
        padding: '16px 20px',
        maxHeight: '340px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        {messages.map(m => {
          const isAi = m.sender === 'ai';
          return (
            <div
              key={m.id}
              style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                flexDirection: isAi ? 'row' : 'row-reverse',
              }}
            >
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                flexShrink: 0,
                marginTop: 2,
                background: isAi ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isAi ? 'var(--accent-2)' : 'var(--text-primary)',
              }}>
                {isAi ? <Sparkles size={14} /> : <User size={14} />}
              </div>

              <div style={{
                maxWidth: '82%',
                padding: '10px 14px',
                borderRadius: 16,
                background: isAi ? 'var(--bg-elevated)' : 'var(--accent-grad)',
                color: isAi ? 'var(--text-primary)' : '#fff',
                border: isAi ? '1px solid var(--border)' : 'none',
                fontSize: 13.5,
                lineHeight: 1.5,
                fontWeight: isAi ? 500 : 600,
              }}>
                {m.text}
                <div style={{
                  fontSize: 10,
                  opacity: 0.65,
                  marginTop: 4,
                  textAlign: isAi ? 'left' : 'right',
                }}>
                  {m.time}
                </div>
              </div>
            </div>
          );
        })}

        {isThinking && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'var(--accent-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-2)',
            }}>
              <Sparkles size={14} className="spin" />
            </div>
            <div style={{
              padding: '8px 12px',
              borderRadius: 14,
              background: 'var(--bg-elevated)',
              fontSize: 12.5,
              color: 'var(--text-secondary)',
            }}>
              Gemma 2B is analyzing your finances on-device...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested prompts chips */}
      <div style={{
        padding: '0 16px 10px',
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {quickPrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSend(p)}
            style={{
              flexShrink: 0,
              padding: '6px 11px',
              borderRadius: 99,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s ease',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form
        onSubmit={e => {
          e.preventDefault();
          handleSend();
        }}
        style={{
          display: 'flex',
          gap: 8,
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--bg-card)',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask anything about your spending or budgets..."
          style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isThinking}
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: 'var(--accent-grad)',
            color: '#fff',
            border: 'none',
            cursor: !input.trim() || isThinking ? 'not-allowed' : 'pointer',
            opacity: !input.trim() || isThinking ? 0.5 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
