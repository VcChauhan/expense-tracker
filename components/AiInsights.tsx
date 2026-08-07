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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
        {[1, 2].map(i => (
          <div key={i} style={{ 
            height: 60, 
            borderRadius: 12, 
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            animation: 'pulse 1.5s infinite ease-in-out',
            opacity: 0.6
          }} />
        ))}
      </div>
    );
  }

  if (insights.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 32 }}>
      {scope === 'annual' && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', marginBottom: -4 }}>
          Updated as of today
        </div>
      )}
      {insights.map((insight, idx) => {
        let Icon = Sparkles;
        let typeColor = 'var(--accent)';
        
        if (insight.type === 'savings_coaching') {
          Icon = PiggyBank;
          typeColor = 'var(--accent)';
        } else if (insight.type === 'rebalancing') {
          Icon = RefreshCcw;
          typeColor = 'var(--warning)';
        } else if (insight.type === 'category_drift') {
          Icon = Compass;
          typeColor = 'var(--warning)';
        } else if (insight.type === 'hike_advice') {
          Icon = TrendingUp;
          typeColor = 'var(--success)';
        } else if (insight.type === 'general') {
          Icon = TrendingUp;
          typeColor = 'var(--accent)';
        }

        return (
          <div key={idx} style={{ 
            padding: 14, 
            background: `color-mix(in srgb, ${typeColor} 8%, transparent)`,
            borderLeft: `3px solid ${typeColor}`,
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            borderTopLeftRadius: 4,
            borderBottomLeftRadius: 4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12
          }}>
            <div style={{ flexShrink: 0, color: typeColor, marginTop: 2 }}>
              <Icon size={18} />
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
