'use client';

import { useState, useEffect } from 'react';
import { Sparkles, TrendingUp, TrendingDown, Minus, Target, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatINR } from '@/lib/types';

interface MomComparison {
  category: string;
  trend: 'up' | 'down' | 'flat';
  difference: number;
  analysis: string;
}

interface FullReport {
  executiveSummary: string;
  momComparisons: MomComparison[];
  actionableSteps: string[];
}

export default function FullAiInsights({ month, year }: { month: number; year: number }) {
  const [report, setReport] = useState<FullReport | null>(null);
  const [rawData, setRawData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    
    // Explicitly fetching from the new full insights route
    fetch(`/api/insights/full?month=${month}&year=${year}`)
      .then(res => {
        if (!res.ok) throw new Error('API failed');
        return res.json();
      })
      .then(data => {
        if (data.report) {
          setReport(data.report);
          setRawData(data.rawData);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [month, year]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 64, height: 64, marginBottom: 24 }}>
          <div style={{ position: 'absolute', inset: 0, border: '4px solid var(--accent)', borderRadius: '50%', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
          <Sparkles size={24} color="var(--accent)" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', animation: 'pulse 2s infinite' }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>AI is analyzing your finances</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Comparing your spending patterns with last month...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px' }}>
        <AlertTriangle size={48} color="var(--warning)" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Insights Unavailable</h3>
        <p style={{ color: 'var(--text-muted)' }}>We couldn't generate your AI briefing right now. Please try again later.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Executive Summary */}
      <div style={{ 
        background: 'linear-gradient(145deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--success) 5%, transparent))',
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        borderRadius: 20,
        padding: 24,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <Sparkles size={20} color="var(--accent)" />
          <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1 }}>Executive Summary</h2>
        </div>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text-primary)', fontWeight: 500, margin: 0 }}>
          {report.executiveSummary}
        </p>
      </div>

      {/* MoM Comparisons */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={20} color="var(--text-muted)" /> Month-Over-Month Deep Dive
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.momComparisons?.map((comp, i) => {
            let trendColor = 'var(--text-muted)';
            let TrendIcon = Minus;
            
            if (comp.trend === 'up') {
              trendColor = 'var(--danger)';
              TrendIcon = TrendingUp;
            } else if (comp.trend === 'down') {
              trendColor = 'var(--success)';
              TrendIcon = TrendingDown;
            }
            const rawCat = rawData?.currentMonth?.categories?.find((c: any) => c.name === comp.category);

            return (
              <div key={i} style={{ 
                background: 'var(--bg-card)', 
                border: '1px solid var(--border)', 
                borderRadius: 16, 
                padding: 16 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>{comp.category}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: trendColor, fontSize: 14, fontWeight: 600, background: `color-mix(in srgb, ${trendColor} 10%, transparent)`, padding: '4px 10px', borderRadius: 100 }}>
                    <TrendIcon size={16} />
                    {comp.difference > 0 ? '+' : ''}{formatINR(Math.abs(comp.difference))}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {comp.analysis}
                </p>
                {rawCat && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 50, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Last Mo</div>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (rawCat.spentLastMonth / Math.max(rawCat.actualSpent, rawCat.spentLastMonth, rawCat.historical3MonthAverage, 1)) * 100)}%`, background: 'var(--text-muted)', opacity: 0.4, borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 50, textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>{formatINR(rawCat.spentLastMonth)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 50, fontSize: 11, color: 'var(--text-primary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>Current</div>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-input)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (rawCat.actualSpent / Math.max(rawCat.actualSpent, rawCat.spentLastMonth, rawCat.historical3MonthAverage, 1)) * 100)}%`, background: trendColor, borderRadius: 4 }} />
                      </div>
                      <div style={{ width: 50, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(rawCat.actualSpent)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      


      {/* Action Plan */}
      <div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={20} color="var(--warning)" /> Your Action Plan
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {report.actionableSteps?.map((step, i) => (
            <div key={i} style={{ 
              display: 'flex', 
              alignItems: 'flex-start', 
              gap: 16, 
              background: 'color-mix(in srgb, var(--warning) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--warning) 20%, transparent)',
              padding: 16,
              borderRadius: 16
            }}>
              <CheckCircle2 size={24} color="var(--warning)" style={{ flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: 15, color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}} />
    </div>
  );
}
