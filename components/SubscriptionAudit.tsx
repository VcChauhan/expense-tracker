'use client';

import { useState, useEffect } from 'react';
import { formatINR } from '@/lib/types';
import { Search, ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';

interface Leak {
  name: string;
  amount: number;
  prevAmount?: number;
  isPriceHike?: boolean;
  hikePercent?: number;
  frequency: number;
  lastCharged: string;
  annualCost: number;
}

export function SubscriptionAudit() {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/analytics/leaks')
      .then(r => r.json())
      .then(data => {
        if (data.leaks) {
          const filtered = data.leaks.filter((l: Leak) => l.amount > 50).slice(0, 5);
          setLeaks(filtered);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || leaks.length === 0) return null;

  const hasHike = leaks.some(l => l.isPriceHike);

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, marginBottom: 24, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
      {/* Banner Header */}
      <div 
        onClick={() => setExpanded(!expanded)}
        style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', background: expanded ? 'var(--bg-elevated)' : 'transparent', transition: 'background 0.2s' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 15%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
            <Search size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Subscription & Leak Audit</span>
              {hasHike && (
                <span style={{ padding: '2px 8px', borderRadius: 9999, background: 'color-mix(in srgb, var(--danger) 15%, transparent)', color: 'var(--danger)', fontSize: 11, fontWeight: 700 }}>
                  Price Hike Detected
                </span>
              )}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
              {leaks.length} recurring {leaks.length === 1 ? 'charge' : 'charges'} detected
            </div>
          </div>
        </div>
        <div>
          {expanded ? <ChevronUp color="var(--text-muted)" size={20} /> : <ChevronDown color="var(--text-muted)" size={20} />}
        </div>
      </div>

      {/* Expandable List */}
      {expanded && (
        <div style={{ padding: '0 20px 20px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0', color: 'var(--text-secondary)' }}>
            <AlertTriangle size={14} color="var(--warning)" />
            <span style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Review Subscriptions & Price Changes</span>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {leaks.map((leak, idx) => (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 12, border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {leak.name === 'Unnamed Charge' ? 'Unknown Subscription' : leak.name}
                    </span>
                    {leak.isPriceHike && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 2 }}>
                        <TrendingUp size={12} /> +{leak.hikePercent}% hike
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                    Charged {leak.frequency} times recently {leak.prevAmount && leak.isPriceHike ? `(was ${formatINR(leak.prevAmount)})` : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                    {formatINR(leak.amount)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--danger)', fontWeight: 600 }}>
                    {formatINR(leak.annualCost)}/yr
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
