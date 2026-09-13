'use client';

import { useMemo, useState } from 'react';
import { Expense, Category, formatINR } from '@/lib/types';
import { Flame, Edit2, Trash2, X, Receipt } from 'lucide-react';
import { CategoryIcon } from './CategoryIcon';
import { PaymentMethodBadge } from './PaymentMethodSelector';

interface ExpenseCalendarViewProps {
  expenses: Expense[];
  selectedMonth: number; // 1-12
  selectedYear: number;
  categories?: Category[];
  onEdit?: (exp: Expense) => void;
  onDelete?: (id: string) => void;
}

export function ExpenseCalendarView({ expenses, selectedMonth, selectedYear, categories = [], onEdit, onDelete }: ExpenseCalendarViewProps) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

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

  // Reset the selected day if it no longer falls within the current month
  // (e.g. the user navigated to a different month while a day was selected).
  useMemo(() => {
    if (selectedDay !== null && selectedDay > daysInMonth) setSelectedDay(null);
  }, [daysInMonth, selectedDay]);

  const getCategoryById = (id: string) => categories.find(c => c.id === id);

  // Transactions shown below the grid: the selected day's expenses, or
  // every expense in the current filtered set when nothing is selected.
  const visibleExpenses = useMemo(() => {
    const list = selectedDay === null
      ? expenses
      : expenses.filter(exp => {
          const parts = exp.date.split('-');
          return parts.length === 3
            && parseInt(parts[0]) === selectedYear
            && parseInt(parts[1]) === selectedMonth
            && parseInt(parts[2]) === selectedDay;
        });
    return [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }, [expenses, selectedDay, selectedMonth, selectedYear]);

  const visibleTotal = visibleExpenses.reduce((s, e) => s + e.amount, 0);
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

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
          const isSelected = selectedDay === dayNum;

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
            <button
              key={dayNum}
              onClick={() => setSelectedDay(isSelected ? null : dayNum)}
              aria-pressed={isSelected}
              aria-label={`${MONTH_NAMES[selectedMonth - 1]} ${dayNum}: ${formatINR(spent)} across ${data.count} expense${data.count === 1 ? '' : 's'}`}
              style={{
                height: 52,
                borderRadius: 10,
                background: bg,
                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                padding: isSelected ? 5 : 6,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                boxShadow: isSelected ? '0 4px 12px -2px color-mix(in srgb, var(--accent) 40%, transparent)' : 'none',
                cursor: 'pointer',
                font: 'inherit',
              }}
              title={`Day ${dayNum}: ${formatINR(spent)} (${data.count} expenses)`}
            >
              <span style={{ fontSize: 12, fontWeight: isSelected ? 800 : 600, color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{dayNum}</span>
              {spent > 0 ? (
                <span style={{ fontSize: 10, fontWeight: 700, color: dotColor }}>
                  ₹{spent >= 1000 ? `${(spent / 1000).toFixed(1)}k` : Math.round(spent)}
                </span>
              ) : (
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)' }} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Transactions for the selected day, or all of them ── */}
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} color="var(--accent)" />
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {selectedDay === null
                ? `All Transactions (${visibleExpenses.length})`
                : `${MONTH_NAMES[selectedMonth - 1]} ${selectedDay} (${visibleExpenses.length})`}
            </h4>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{formatINR(visibleTotal)}</span>
            {selectedDay !== null && (
              <button
                onClick={() => setSelectedDay(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                  borderRadius: 99, padding: '4px 10px', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-secondary)', cursor: 'pointer',
                }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {visibleExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', fontSize: 13 }}>
            No transactions on this day.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleExpenses.map(exp => {
              const cat = getCategoryById(exp.categoryId);
              return (
                <div key={exp._id} style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 14 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: cat?.color ? `${cat.color}22` : 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: cat?.color || 'var(--text-secondary)', marginRight: 12,
                  }}>
                    <CategoryIcon name={cat?.name ?? ''} note={exp.note} size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {exp.note || cat?.name || 'Unknown'}
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      {selectedDay === null && <span>{exp.date.split('-').slice(1).reverse().join('/')}</span>}
                      {selectedDay === null && <span>•</span>}
                      <span>{cat?.name}</span>
                      <span>•</span>
                      <PaymentMethodBadge method={exp.paymentMethod || 'upi'} />
                    </div>
                  </div>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: 10 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--danger)' }}>{formatINR(exp.amount)}</span>
                    {(onEdit || onDelete) && (
                      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                        {onEdit && (
                          <button onClick={() => onEdit(exp)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                            <Edit2 size={12} />
                          </button>
                        )}
                        {onDelete && exp._id && (
                          <button onClick={() => onDelete(exp._id!)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
