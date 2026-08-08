'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { Expense, Category, formatINR, SHORT_MONTHS } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { Edit2, Trash2 } from 'lucide-react';

interface ExpenseTimelineViewProps {
  expenses: Expense[];
  viewMode: 'monthly' | 'annual';
  categories: Category[];

  onEdit?: (exp: Expense) => void;
  onDelete?: (id: string) => void;
}

const MONTH_COLORS = [
  '#4FD1A0', // 0 Jan - Teal
  '#FBBF24', // 1 Feb - Amber
  '#9E82FF', // 2 Mar - Violet
  '#F2707A', // 3 Apr - Red
  '#6BA5FF', // 4 May - Blue
  '#FBBF24', // 5 Jun - Amber
  '#F2707A', // 6 Jul - Red
  '#6BA5FF', // 7 Aug - Blue
  '#4FD1A0', // 8 Sep - Teal
  '#9E82FF', // 9 Oct - Violet
  '#FBBF24', // 10 Nov - Amber
  '#F2707A', // 11 Dec - Red
];

export function ExpenseTimelineView({ expenses, viewMode, categories, onEdit, onDelete }: ExpenseTimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  
  const [activeDate, setActiveDate] = useState({ date: '—', month: '—' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Geometry
  const ROW_H = 118;
  const MONTH_GAP = 100; // Extra vertical space for month divider
  const TOP_OFFSET = 170;
  const LEFT_X = 100;
  const RIGHT_X = 290;
  const CENTER_X = (LEFT_X + RIGHT_X) / 2;
  
  // Format data for easy rendering and compute cumulative gaps
  const enrichedExpenses = useMemo(() => {
    let cumulativeGap = 0;
    return expenses.map((exp, i) => {
      const d = new Date(exp.date);
      const cat = categories.find(c => c.id === exp.categoryId);
      const color = cat?.color || '#9CA3AF';
      const side = i % 2 === 0 ? 'left' : 'right';
      const x = side === 'left' ? LEFT_X : RIGHT_X;
      
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
      const monthStr = SHORT_MONTHS[d.getMonth()];
      const monthNumStr = (d.getMonth() + 1).toString().padStart(2, '0');
      const dateNum = d.getDate().toString().padStart(2, '0');
      
      // Determine if month changed for annual mode
      let isMonthBoundary = false;
      if (viewMode === 'annual' && i > 0) {
        const prevD = new Date(expenses[i-1].date);
        if (prevD.getMonth() !== d.getMonth()) {
          isMonthBoundary = true;
          cumulativeGap += MONTH_GAP;
        }
      }

      const y = i * ROW_H + 60 + cumulativeGap;

      return {
        ...exp,
        color,
        side,
        x,
        y,
        dayName,
        monthStr,
        monthNumStr,
        dateNum,
        monthIdx: d.getMonth(),
        year: d.getFullYear(),
        isMonthBoundary,
      };
    });
  }, [expenses, categories, viewMode]);

  const totalHeight = enrichedExpenses.length > 0 ? enrichedExpenses[enrichedExpenses.length - 1].y + 80 : 0;

  // Compute SVG Paths
  const paths = useMemo(() => {
    if (viewMode === 'monthly') {
      let d = '';
      enrichedExpenses.forEach((exp, i) => {
        d += (i === 0 ? `M ${exp.x} ${exp.y}` : ` C ${exp.x} ${exp.y - ROW_H/2}, ${exp.x} ${exp.y - ROW_H/2}, ${exp.x} ${exp.y}`);
      });
      return [{ d, color: 'var(--border)' }];
    } else {
      // Annual mode: group by month
      const monthPaths: { d: string, color: string }[] = [];
      let currentD = '';
      let lastMonthIdx = enrichedExpenses[0]?.monthIdx;

      enrichedExpenses.forEach((exp, i) => {
        if (exp.monthIdx !== lastMonthIdx) {
          // Month boundary! 
          // 1. Finish old path smoothly into the center gap
          const dividerY = exp.y - (ROW_H / 2) - (MONTH_GAP / 2);
          
          currentD += ` C ${CENTER_X} ${dividerY - 40}, ${CENTER_X} ${dividerY - 20}, ${CENTER_X} ${dividerY - 15}`;
          monthPaths.push({ d: currentD, color: MONTH_COLORS[lastMonthIdx] });
          
          // 2. Start new path smoothly out from the center gap
          currentD = `M ${CENTER_X} ${dividerY + 15}`;
          currentD += ` C ${CENTER_X} ${exp.y - 40}, ${exp.x} ${exp.y - 40}, ${exp.x} ${exp.y}`;
          
          lastMonthIdx = exp.monthIdx;
        } else {
          if (currentD === '') {
            currentD = `M ${exp.x} ${exp.y}`;
          } else {
            currentD += ` C ${exp.x} ${exp.y - ROW_H/2}, ${exp.x} ${exp.y - ROW_H/2}, ${exp.x} ${exp.y}`;
          }
        }
      });
      if (currentD) {
        monthPaths.push({ d: currentD, color: MONTH_COLORS[lastMonthIdx] });
      }
      return monthPaths;
    }
  }, [enrichedExpenses, viewMode]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('show');
      });
    }, { threshold: 0.4 });

    const rows = document.querySelectorAll('.c-row-animate');
    rows.forEach(r => observer.observe(r));

    return () => observer.disconnect();
  }, [enrichedExpenses]);

  // Scroll Sync for Backdrop
  useEffect(() => {
    const onScroll = () => {
      if (!window || !wrapRef.current) return;
      // We check window scroll because main layout might just use standard body scrolling
      // Calculate offset relative to the wrap
      const rect = wrapRef.current.getBoundingClientRect();
      // The "active line" on screen is roughly 30% down the viewport
      const activeY = (window.innerHeight * 0.3) - rect.top;

      let currentExp = enrichedExpenses[0];
      for (const exp of enrichedExpenses) {
        if (exp.y <= activeY) {
          currentExp = exp;
        } else {
          break; // Since they are ordered by y ascending
        }
      }

      if (currentExp) {
        setActiveDate({ date: currentExp.dateNum, month: currentExp.monthStr });
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Initial trigger
    onScroll();
    
    return () => window.removeEventListener('scroll', onScroll);
  }, [enrichedExpenses]);

  if (expenses.length === 0) {
    return <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>No expenses found.</div>;
  }

  return (
    <div style={{ position: 'relative', minHeight: totalHeight + TOP_OFFSET }}>
      
      {/* Sticky Backdrop */}
      <div className="a-backdrop">
        <div className="a-backdrop-inner" ref={backdropRef}>
          <div className="a-day">{activeDate.date}</div>
          <div className="a-month">{activeDate.month}</div>
        </div>
      </div>

      <div className="c-wrap" ref={wrapRef} style={{ paddingTop: TOP_OFFSET, height: totalHeight + TOP_OFFSET }}>
        
        {/* SVG Paths */}
        <svg className="c-svg" style={{ top: TOP_OFFSET, height: totalHeight, width: '100%' }}>
          {paths.map((p, idx) => (
            <path key={idx} d={p.d} fill="none" stroke={p.color} strokeWidth="2.5" strokeDasharray="1 8" strokeLinecap="round" />
          ))}
        </svg>

        {/* DOM Elements */}
        {enrichedExpenses.map((exp, i) => {
          const isFirstOfDay = i === 0 || enrichedExpenses[i-1].date !== exp.date;
          
          return (
            <div key={exp._id}>
              {/* Annual Mode Month Divider */}
              {exp.isMonthBoundary && (
                <div style={{ position: 'absolute', width: '100%', left: 0, top: TOP_OFFSET + exp.y - (ROW_H/2) - (MONTH_GAP/2) - 20, display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.8, zIndex: 0, pointerEvents: 'none' }}>
                  <div style={{ fontSize: 56, fontWeight: 800, color: 'var(--border)', letterSpacing: '0.05em' }}>
                    {exp.monthStr.toUpperCase()} {exp.year}
                  </div>
                </div>
              )}

              {/* Expense Card */}
              <div 
                className={`c-row c-row-animate ${exp.side}`}
                onClick={() => setExpandedId(expandedId === exp._id ? null : (exp._id || null))}
                style={{ 
                  top: TOP_OFFSET + exp.y - 26, 
                  cursor: 'pointer',
                  zIndex: expandedId === exp._id ? 10 : undefined,
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  gap: 0,
                  padding: expandedId === exp._id ? '10px 12px 12px 12px' : '10px 12px'
                }}
              >
                {/* Day Label (Tab on Top Border) */}
                {isFirstOfDay && (
                  <div 
                    className="c-date" 
                    style={{ 
                      top: -10,
                      ...(exp.side === 'left' ? { right: 16 } : { left: 16 })
                    }}
                  >
                    {exp.dayName} {exp.dateNum} {exp.monthStr}
                  </div>
                )}
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div className="c-icon" style={{ background: `${exp.color}22`, color: exp.color }}>
                    <CategoryIcon name={categories.find(c => c.id === exp.categoryId)?.name || ''} note={exp.note} size={16} />
                  </div>
                  <div className="c-row-mid" style={{ flex: 1, minWidth: 0 }}>
                    <div className="c-row-title">{exp.note || categories.find(c => c.id === exp.categoryId)?.name || 'Expense'}</div>
                    <div className="c-row-amt">{formatINR(exp.amount)}</div>
                  </div>
                </div>

                {expandedId === exp._id && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, paddingTop: 12, borderTop: '1px dashed var(--border)' }}>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEdit?.(exp); }} 
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}
                      >
                        <Edit2 size={14} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); if(exp._id) onDelete?.(exp._id); }} 
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 4 }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
