'use client';

import { useMemo } from 'react';
import { Expense, formatINR } from '@/lib/types';
import { Flame } from 'lucide-react';

interface ExpenseCalendarViewProps {
  expenses: Expense[];
  selectedMonth: number; // 1-12
  selectedYear: number;
}

export function ExpenseCalendarView({ expenses, selectedMonth, selectedYear }: ExpenseCalendarViewProps) {
  const { daysInMonth, firstDayOfWeek, daySpendMap, streak } = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDay = new Date(selectedYear, selectedMonth - 1, 1).getDay(); // 0 = Sun

    const map: Record<number, { total: number; count: number }> = {};
    for (let d = 1; d <= totalDays; d++) {
      map[d] = { total: 0, count: 0 };
    }

    expenses.forEach(exp => {
      const parts = exp.date.split('-');
      if (parts.length === 3 && parseInt(parts[0]) === selectedYear && parseInt(parts[1]) === selectedMonth) {
        const day = parseInt(parts[2]);
        if (map[day]) {
          map[day].total += exp.amount;
          map[day].count += 1;
        }
      }
    });

    // Calculate zero-spend streak leading up to today
    let currentStreak = 0;
    const today = new Date();
    if (today.getFullYear() === selectedYear && today.getMonth() + 1 === selectedMonth) {
      const currentDay = today.getDate();
      for (let d = currentDay; d >= 1; d--) {
        if (map[d].total === 0) {
          currentStreak++;
        } else if (d !== currentDay) {
          break;
        }
      }
    }

    return { daysInMonth: totalDays, firstDayOfWeek: firstDay, daySpendMap: map, streak: currentStreak };
  }, [expenses, selectedMonth, selectedYear]);

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
      {/* Streak Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Spend Intensity Heatmap</h3>
        {streak > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 9999, background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)', fontSize: 13, fontWeight: 700 }}>
            <Flame size={16} /> {streak}-Day Zero Spend Streak!
          </div>
        )}
      </div>

      {/* Days of Week Header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, textAlign: 'center', marginBottom: 8 }}>
        {daysOfWeek.map(d => (
          <span key={d} style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>{d}</span>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {/* Empty padding cells for first week */}
        {Array.from({ length: firstDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} style={{ height: 48, borderRadius: 8, background: 'transparent' }} />
        ))}

        {/* Days */}
        {Array.from({ length: daysInMonth }).map((_, idx) => {
          const dayNum = idx + 1;
          const data = daySpendMap[dayNum] || { total: 0, count: 0 };
          const spent = data.total;

          let bg = 'var(--bg-elevated)';
          let dotColor = 'var(--success)';
          if (spent > 1500) {
            dotColor = 'var(--danger)';
            bg = 'color-mix(in srgb, var(--danger) 15%, transparent)';
          } else if (spent > 200) {
            dotColor = 'var(--warning)';
            bg = 'color-mix(in srgb, var(--warning) 15%, transparent)';
          } else if (spent === 0) {
            bg = 'color-mix(in srgb, var(--success) 10%, transparent)';
          }

          return (
            <div
              key={dayNum}
              style={{
                height: 52,
                borderRadius: 10,
                background: bg,
                border: '1px solid var(--border)',
                padding: 6,
                display: 'flex',
                flexDirection: 'column',
                justify: 'space-between',
                alignItems: 'center',
                transition: 'transform 0.2s',
                cursor: 'pointer'
              }}
              title={`Day ${dayNum}: ${formatINR(spent)} (${data.count} expenses)`}
            >
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{dayNum}</span>
              {spent > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: dotColor }}>
                  ₹{spent >= 1000 ? `${(spent / 1000).toFixed(1)}k` : Math.round(spent)}
                </span>
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
