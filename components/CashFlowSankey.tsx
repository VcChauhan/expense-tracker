'use client';

import { useMemo, useState } from 'react';
import { Waves } from 'lucide-react';
import { formatINR, Category } from '@/lib/types';

interface CashFlowSankeyProps {
  income: number;
  spent: number;
  categories: Category[];
  categoryTotals: { _id: string; total: number }[];
}

interface FlowNode {
  id: string;
  label: string;
  color: string;
  value: number;
  yTop: number;
  yBottom: number;
}

const WIDTH = 320;
const HEIGHT = 280;
const NODE_W = 12;
const X0 = 10;          // Income column
const X1 = 148;         // Spent / Saved column
const X2 = WIDTH - 22;  // Category column
const TOP_PAD = 8;
const GAP = 6; // vertical gap between stacked nodes in the same column

// Builds a smooth ribbon between two vertical bands using cubic beziers.
function ribbonPath(x0: number, y0Top: number, y0Bottom: number, x1: number, y1Top: number, y1Bottom: number) {
  const midX = (x0 + x1) / 2;
  return `M ${x0},${y0Top}
    C ${midX},${y0Top} ${midX},${y1Top} ${x1},${y1Top}
    L ${x1},${y1Bottom}
    C ${midX},${y1Bottom} ${midX},${y0Bottom} ${x0},${y0Bottom}
    Z`;
}

export function CashFlowSankey({ income, spent, categories, categoryTotals }: CashFlowSankeyProps) {
  const [hoveredFlow, setHoveredFlow] = useState<string | null>(null);

  const model = useMemo(() => {
    const totalsMap: Record<string, number> = {};
    for (const ct of categoryTotals) totalsMap[ct._id] = ct.total;

    const catRows = categories
      .map(c => ({ id: c.id, label: c.name, color: c.color || '#9CA3AF', value: totalsMap[c.id] ?? 0 }))
      .filter(c => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const topCats = catRows.slice(0, 6);
    const otherTotal = catRows.slice(6).reduce((s, c) => s + c.value, 0);
    if (otherTotal > 0) topCats.push({ id: '__other', label: 'Other', color: '#6B7280', value: otherTotal });

    const saved = Math.max(0, income - spent);
    // Reference total for scaling: income when we have it, otherwise fall
    // back to spend alone (two-column mode — no Income/Saved nodes).
    const hasIncome = income > 0;
    const total = hasIncome ? income : spent;
    if (total <= 0 || catRows.length === 0) return null;

    const usableH = HEIGHT - TOP_PAD * 2;

    // Column 2: categories, stacked to fill the same vertical extent as "Spent"
    const spentUsableH = hasIncome ? usableH * (spent / total) : usableH;
    const spentTop = TOP_PAD;
    let cursor = spentTop;
    const catNodes: FlowNode[] = topCats.map(c => {
      const h = Math.max(6, spentUsableH * (c.value / spent) - GAP);
      const node: FlowNode = { id: c.id, label: c.label, color: c.color, value: c.value, yTop: cursor, yBottom: cursor + h };
      cursor += h + GAP;
      return node;
    });

    // "Spent" node always exists — it's the source for every category ribbon,
    // whether or not we also have an Income/Saved stage upstream of it.
    const spentNode: FlowNode = { id: '__spent', label: 'Spent', color: 'var(--danger)', value: spent, yTop: spentTop, yBottom: spentTop + spentUsableH };

    if (!hasIncome) {
      return { hasIncome, incomeNode: null, spentNode, savedNode: null, catNodes, saved: 0, spent, income };
    }

    // Column 1: Saved, stacked below Spent
    const savedH = Math.max(6, usableH * (saved / total) - GAP);
    const savedNode: FlowNode = { id: '__saved', label: 'Saved', color: 'var(--success)', value: saved, yTop: spentNode.yBottom + GAP, yBottom: spentNode.yBottom + GAP + savedH };

    // Column 0: single Income node spanning the full extent
    const incomeNode: FlowNode = { id: '__income', label: 'Income', color: 'var(--accent)', value: income, yTop: TOP_PAD, yBottom: savedNode.yBottom };

    return { hasIncome, incomeNode, spentNode, savedNode, catNodes, saved, spent, income };
  }, [income, spent, categories, categoryTotals]);

  if (!model) {
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 16px', marginBottom: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        Log a few expenses this month to see your cash flow.
      </div>
    );
  }

  const { hasIncome, incomeNode, spentNode, savedNode, catNodes } = model;
  const spentX = hasIncome ? X1 : X0; // when there's no income, Spent becomes the leftmost column

  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '20px 16px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Waves size={18} color="var(--accent)" />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cash Flow</h2>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 12px 0' }}>
        {hasIncome ? 'Income to spend to category, all in one picture' : 'Spend by category (set your income in Settings to see the full flow)'}
      </p>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" height={HEIGHT}>
        {/* Ribbons: Income -> Spent/Saved */}
        {hasIncome && incomeNode && spentNode && savedNode && (
          <>
            <path
              d={ribbonPath(X0 + NODE_W, incomeNode.yTop, spentNode.yBottom, X1, spentNode.yTop, spentNode.yBottom)}
              fill="var(--danger)"
              opacity={hoveredFlow === null || hoveredFlow === 'spent' ? 0.28 : 0.08}
              onMouseEnter={() => setHoveredFlow('spent')}
              onMouseLeave={() => setHoveredFlow(null)}
              style={{ transition: 'opacity 0.15s ease', cursor: 'pointer' }}
            />
            <path
              d={ribbonPath(X0 + NODE_W, spentNode.yBottom, incomeNode.yBottom, X1, savedNode.yTop, savedNode.yBottom)}
              fill="var(--success)"
              opacity={hoveredFlow === null || hoveredFlow === 'saved' ? 0.28 : 0.08}
              onMouseEnter={() => setHoveredFlow('saved')}
              onMouseLeave={() => setHoveredFlow(null)}
              style={{ transition: 'opacity 0.15s ease', cursor: 'pointer' }}
            />
          </>
        )}

        {/* Ribbons: Spent -> Categories */}
        {(() => {
          let acc = spentNode.yTop;
          return catNodes.map(cat => {
            const share = cat.value / (spentNode.value || 1);
            const segH = (spentNode.yBottom - spentNode.yTop) * share;
            const segTop = acc;
            const segBottom = acc + segH;
            acc = segBottom;
            return (
              <path
                key={cat.id}
                d={ribbonPath(spentX + NODE_W, segTop, segBottom, X2, cat.yTop, cat.yBottom)}
                fill={cat.color}
                opacity={hoveredFlow === null || hoveredFlow === cat.id ? 0.3 : 0.08}
                onMouseEnter={() => setHoveredFlow(cat.id)}
                onMouseLeave={() => setHoveredFlow(null)}
                style={{ transition: 'opacity 0.15s ease', cursor: 'pointer' }}
              />
            );
          });
        })()}

        {/* Nodes */}
        {hasIncome && incomeNode && (
          <g>
            <rect x={X0} y={incomeNode.yTop} width={NODE_W} height={incomeNode.yBottom - incomeNode.yTop} rx={3} fill="var(--accent)" />
            <text x={X0 + NODE_W + 6} y={(incomeNode.yTop + incomeNode.yBottom) / 2 - 4} fontSize={10.5} fontWeight={700} fill="var(--text-primary)">Income</text>
            <text x={X0 + NODE_W + 6} y={(incomeNode.yTop + incomeNode.yBottom) / 2 + 9} fontSize={9.5} fill="var(--text-muted)">{formatINR(incomeNode.value)}</text>
          </g>
        )}
        <g>
          <rect x={spentX} y={spentNode.yTop} width={NODE_W} height={spentNode.yBottom - spentNode.yTop} rx={3} fill="var(--danger)" />
          {hasIncome ? (
            <>
              <text x={spentX - 6} y={(spentNode.yTop + spentNode.yBottom) / 2 - 4} fontSize={10} fontWeight={700} fill="var(--text-primary)" textAnchor="end">Spent</text>
              <text x={spentX - 6} y={(spentNode.yTop + spentNode.yBottom) / 2 + 9} fontSize={9} fill="var(--text-muted)" textAnchor="end">{formatINR(spentNode.value)}</text>
            </>
          ) : (
            <>
              <text x={spentX + NODE_W + 6} y={spentNode.yTop + 12} fontSize={10} fontWeight={700} fill="var(--text-primary)">Total Spent</text>
              <text x={spentX + NODE_W + 6} y={spentNode.yTop + 25} fontSize={9} fill="var(--text-muted)">{formatINR(spentNode.value)}</text>
            </>
          )}
        </g>
        {hasIncome && savedNode && savedNode.value > 0 && (
          <g>
            <rect x={X1} y={savedNode.yTop} width={NODE_W} height={savedNode.yBottom - savedNode.yTop} rx={3} fill="var(--success)" />
            <text x={X1 - 6} y={(savedNode.yTop + savedNode.yBottom) / 2 - 4} fontSize={10} fontWeight={700} fill="var(--text-primary)" textAnchor="end">Saved</text>
            <text x={X1 - 6} y={(savedNode.yTop + savedNode.yBottom) / 2 + 9} fontSize={9} fill="var(--text-muted)" textAnchor="end">{formatINR(savedNode.value)}</text>
          </g>
        )}
        {catNodes.map(cat => (
          <g key={cat.id}>
            <rect x={X2} y={cat.yTop} width={NODE_W} height={Math.max(2, cat.yBottom - cat.yTop)} rx={3} fill={cat.color} />
            {(cat.yBottom - cat.yTop) > 14 && (
              <>
                <text x={X2 + NODE_W + 6} y={(cat.yTop + cat.yBottom) / 2 - 4} fontSize={10} fontWeight={700} fill="var(--text-primary)">
                  {cat.label.length > 10 ? cat.label.slice(0, 9) + '…' : cat.label}
                </text>
                <text x={X2 + NODE_W + 6} y={(cat.yTop + cat.yBottom) / 2 + 9} fontSize={9} fill="var(--text-muted)">
                  {formatINR(cat.value)}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
