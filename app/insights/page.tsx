'use client';

import { useState, useEffect } from 'react';
import { Settings } from '@/lib/types';
import { Sparkles, BrainCircuit } from 'lucide-react';
import FullAiInsights from '@/components/FullAiInsights';

export default function InsightsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(s => {
      if (s && !s.error) setSettings(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="page-container"><div className="loading-overlay"><div className="spinner" /></div></div>;

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: 32 }}>
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: 'var(--accent)', padding: 8, borderRadius: 12, color: 'var(--bg-card)' }}>
            <BrainCircuit size={24} />
          </div>
          AI CFO Briefing
        </h1>
        <p className="page-subtitle" style={{ marginTop: 8 }}>Your personalized, 100% AI-generated financial report.</p>
      </div>

      <FullAiInsights month={currentMonth} year={currentYear} />
    </div>
  );
}
