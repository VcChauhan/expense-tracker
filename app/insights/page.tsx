'use client';

import { useState, useEffect } from 'react';
import { Settings, Expense } from '@/lib/types';
import { BrainCircuit } from 'lucide-react';
import FullAiInsights from '@/components/FullAiInsights';
import { AiCoachCard } from '@/components/AiCoachCard';

export default function InsightsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    Promise.all([
      fetch('/api/settings').then(r => r.json()),
      fetch('/api/expenses?limit=300').then(r => r.json())
    ]).then(([s, exps]) => {
      if (s && !s.error) setSettings(s);
      if (Array.isArray(exps)) setExpenses(exps);
      setLoading(false);
    }).catch(console.error);
  }, []);

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 24 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--accent)', padding: 8, borderRadius: 12, color: 'var(--bg-card)' }}>
            <BrainCircuit size={24} />
          </div>
          AI CFO Briefing
        </h1>
        <p className="page-subtitle" style={{ marginTop: 8 }}>Your personalized, 100% on-device AI financial report.</p>
      </div>

      <AiCoachCard
        salary={settings?.monthlyIncome || 0}
        expenses={expenses}
        categories={settings?.categories || []}
        savingsGoals={settings?.savingsGoals || []}
      />

      <FullAiInsights month={currentMonth} year={currentYear} />
    </div>
  );
}
