'use client';

import { useState, useEffect } from 'react';

export default function AiInsights({ month, year }: { month: number; year: number }) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/insights?month=${month + 1}&year=${year}`)
      .then(res => res.json())
      .then(data => {
        if (data.insight) setInsight(data.insight);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [month, year]);

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12, padding: 20 }}>
        <span className="spinner" style={{ width: 16, height: 16, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Gemini is analyzing your spending...</span>
      </div>
    );
  }

  if (!insight) return null;

  return (
    <div className="card" style={{ 
      marginBottom: 32, 
      padding: 20, 
      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 16
    }}>
      <div style={{ fontSize: 24, flexShrink: 0 }}>✨</div>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px 0' }}>Smart Insights</h3>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
          {insight}
        </p>
      </div>
    </div>
  );
}
