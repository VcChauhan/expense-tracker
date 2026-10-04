'use client';

import { useState, useEffect, useMemo } from 'react';
import { formatINR } from '@/lib/types';
import { Search, ChevronDown, ChevronUp, AlertTriangle, TrendingUp, Sparkles, ShieldCheck } from 'lucide-react';
import { chatWithLocalCopilot } from '@/lib/onDeviceAiClient';

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

interface MicroLeak {
  name: string;
  count: number;
  total: number;
  monthlyProrated: number;
}

export function SubscriptionAudit() {
  const [leaks, setLeaks] = useState<Leak[]>([]);
  const [microLeaks, setMicroLeaks] = useState<MicroLeak[]>([]);
  const [weekendBurn, setWeekendBurn] = useState<{ weekendTotal: number; weekdayTotal: number; isWeekendHeavy: boolean } | null>(null);
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
        if (Array.isArray(data.microLeaks)) {
          setMicroLeaks(data.microLeaks);
        }
        if (data.weekendBurn) {
          setWeekendBurn(data.weekendBurn);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || leaks.length === 0) return null;

  const hasHike = leaks.some(l => l.isPriceHike);

  const totalAnnualCost = useMemo(() => {
    return leaks.reduce((sum, l) => sum + (l.annualCost || l.amount * 12), 0);
  }, [leaks]);

  const [aiAdvice, setAiAdvice] = useState<string>('');

  useEffect(() => {
    if (leaks.length === 0) return;
    let active = true;
    const prompt = `You are an on-device personal financial advisor. Review these recurring subscription charges:
${leaks.map(l => `${l.name}: ₹${l.amount}/mo (₹${l.annualCost}/yr)${l.isPriceHike ? ` [+${l.hikePercent}% price hike]` : ''}`).join(', ')}.
Total Annual Cost: ₹${totalAnnualCost}.
In 1 or 2 concise, direct sentences under 30 words, recommend a concrete optimization to eliminate waste or save money. Do not use markdown.`;

    chatWithLocalCopilot(prompt, { leaks, totalAnnualCost })
      .then(res => {
        if (active && res && !res.includes('currently offline') && !res.includes("couldn't reach")) {
          setAiAdvice(res.trim());
        }
      })
      .catch(() => {});

    return () => { active = false; };
  }, [leaks, totalAnnualCost]);

  const defaultAdvice = useMemo(() => {
    if (hasHike) {
      const hikeItem = leaks.find(l => l.isPriceHike);
      return `Price increase detected on ${hikeItem?.name || 'a subscription'} (+${hikeItem?.hikePercent || 0}%). Audit whether it is actively used or cancel to save ₹${hikeItem?.annualCost?.toLocaleString('en-IN') || 0}/yr.`;
    }
    return `You have ${leaks.length} recurring subscriptions totalling ₹${totalAnnualCost.toLocaleString('en-IN')}/year. Switching to annual billing on core services can save up to ~₹${Math.round(totalAnnualCost * 0.15).toLocaleString('en-IN')}/yr.`;
  }, [leaks, totalAnnualCost, hasHike]);

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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '16px 0 10px', color: 'var(--text-secondary)' }}>
            <AlertTriangle size={14} color="var(--warning)" />
            <span style={{ fontSize: 12, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Review Subscriptions & Price Changes</span>
          </div>

          {/* AI Subscription Advisor Banner */}
          <div style={{
            marginBottom: 16,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: 'var(--accent-dim)', color: 'var(--accent-2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              <Sparkles size={14} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  ✦ Gemma 2B Subscription Advisor
                </span>
                <span style={{ fontSize: 9.5, color: '#10b981', display: 'flex', alignItems: 'center', gap: 3, fontWeight: 700 }}>
                  <ShieldCheck size={10} /> 100% Private
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.45, fontWeight: 500 }}>
                {aiAdvice || defaultAdvice}
              </div>
            </div>
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

          {/* Micro-Spends Creeping Radar */}
          {microLeaks.length > 0 && (
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent-2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                ⚡ Micro-Spend Leaks (Frequent Small Charges)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {microLeaks.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {m.name} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({m.count}x)</span>
                    </div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--danger)' }}>
                      ~{formatINR(m.monthlyProrated)}/mo
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weekend vs Weekday Burn Callout */}
          {weekendBurn && weekendBurn.isWeekendHeavy && (
            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>🗓️</span>
              <div style={{ fontSize: 12, color: 'var(--text-primary)' }}>
                <span style={{ fontWeight: 700 }}>Weekend Outflow Alert:</span> Weekend spending ({formatINR(weekendBurn.weekendTotal)}) represents over 40% of total outlay.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
