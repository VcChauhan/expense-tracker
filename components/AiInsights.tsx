'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, PiggyBank, RefreshCcw, Compass } from 'lucide-react';

interface Insight {
  type: 'general' | 'savings_coaching' | 'rebalancing' | 'category_drift' | 'hike_advice';
  message: string;
}

export default function AiInsights({ month = 0, year, scope = 'monthly', context = 'dashboard', hikePercent }: { month?: number; year: number, scope?: 'monthly' | 'annual', context?: 'dashboard' | 'reports' | 'hike', hikePercent?: number }) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let url = `/api/insights/${context}?year=${year}&scope=${scope}`;
    if (context === 'dashboard' && month !== undefined) {
      url += `&month=${month + 1}`;
    }
    if (context === 'hike' && hikePercent !== undefined) {
      url += `&hikePercent=${hikePercent}`;
    }
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.insights && Array.isArray(data.insights)) {
          setInsights(data.insights);
        } else if (data.insight) {
          // Fallback for older responses
          setInsights([{ type: 'general', message: data.insight }]);
        }
      })
      .catch(() => {
        setInsights([{ type: 'general', message: 'Insights unavailable right now.' }]);
      })
      .finally(() => setLoading(false));
  }, [month, year]);

  if (loading) {
    return (
      <div className="card" style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12, padding: 20 }}>
        <span className="spinner" style={{ width: 16, height: 16, borderColor: 'var(--accent-primary)', borderTopColor: 'transparent' }} />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>AI is analyzing your spending...</span>
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
      {scope === 'annual' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: -4 }}>
          Updated as of today
        </div>
      )}
      {insights.map((insight, idx) => {
        let Icon = Sparkles;
        let colorStr = 'var(--accent-primary)';
        let bgStr = 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)';
        let borderStr = 'rgba(99, 102, 241, 0.2)';
        
        if (insight.type === 'savings_coaching') {
          Icon = PiggyBank;
          colorStr = 'var(--success)';
          bgStr = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)';
          borderStr = 'rgba(16, 185, 129, 0.2)';
        } else if (insight.type === 'rebalancing') {
          Icon = RefreshCcw;
          colorStr = 'var(--warning)';
          bgStr = 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)';
          borderStr = 'rgba(245, 158, 11, 0.2)';
        } else if (insight.type === 'category_drift') {
          Icon = Compass;
          colorStr = 'var(--primary)';
          bgStr = 'linear-gradient(135deg, rgba(147, 51, 234, 0.1) 0%, rgba(126, 34, 206, 0.05) 100%)';
          borderStr = 'rgba(147, 51, 234, 0.2)';
        } else if (insight.type === 'hike_advice') {
          Icon = TrendingUp;
          colorStr = 'var(--accent-primary)';
          bgStr = 'linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(79, 70, 229, 0.05) 100%)';
          borderStr = 'rgba(99, 102, 241, 0.2)';
        } else if (insight.type === 'general') {
          Icon = TrendingUp;
        }

        return (
          <div key={idx} className="card" style={{ 
            padding: '16px 20px', 
            background: bgStr,
            border: `1px solid ${borderStr}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16
          }}>
            <div style={{ flexShrink: 0, color: colorStr, marginTop: 2 }}>
              <Icon size={20} />
            </div>
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
                {insight.message}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
