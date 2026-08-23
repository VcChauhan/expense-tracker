'use client';

import { useState } from 'react';
import { formatINR, QuickTemplate, Category } from '@/lib/types';
import { CategoryIcon } from './CategoryIcon';
import { Plus, X } from 'lucide-react';

interface QuickTemplatesProps {
  templates: QuickTemplate[];
  categories: Category[];
  onSelect: (template: QuickTemplate) => void;
  onSave: (templates: QuickTemplate[]) => void;
}

export function QuickTemplates({ templates, categories, onSelect, onSave }: QuickTemplatesProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState(categories[0]?.id ?? '');
  const [newIcon, setNewIcon] = useState('📝');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleSaveNew = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newName.trim();
    const amount = parseFloat(newAmount);
    if (!name || isNaN(amount) || amount <= 0) return;

    const template: QuickTemplate = {
      id: crypto.randomUUID(),
      name,
      amount,
      categoryId: newCategoryId,
      tags: [],
      icon: newIcon || '📝',
    };

    onSave([...templates, template]);
    setNewName('');
    setNewAmount('');
    setNewIcon('📝');
    setNewCategoryId(categories[0]?.id ?? '');
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    onSave(templates.filter(t => t.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.3px' }}>
        Quick Templates
      </label>

      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* Template Chips */}
        {templates.map(template => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template)}
            onMouseEnter={() => setHoveredId(template.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              position: 'relative',
              padding: '8px 16px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.2s',
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: 15 }}>{template.icon}</span>
            <span>{template.name}</span>
            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
              {formatINR(template.amount)}
            </span>

            {/* Delete X button */}
            {hoveredId === template.id && (
              <span
                role="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(template.id);
                }}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'var(--danger)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  animation: 'qtFadeIn 0.15s ease-out',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                }}
              >
                <X size={12} />
              </span>
            )}
          </button>
        ))}

        {/* Add Button / Inline Form */}
        {!isAdding && (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              padding: '8px 14px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px dashed var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>

      {/* Inline Add Form */}
      {isAdding && (
        <form
          onSubmit={handleSaveNew}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: 12,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            animation: 'qtSlideIn 0.25s ease-out',
          }}
        >
          {/* Icon Input */}
          <input
            type="text"
            placeholder="😊"
            value={newIcon}
            onChange={e => setNewIcon(e.target.value)}
            maxLength={2}
            style={{
              width: 42,
              padding: '6px 0',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontSize: 18,
              textAlign: 'center',
              outline: 'none',
            }}
          />

          {/* Name Input */}
          <input
            autoFocus
            type="text"
            placeholder="Name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            style={{
              flex: 1,
              minWidth: 80,
              padding: '7px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />

          {/* Amount Input */}
          <input
            type="number"
            placeholder="₹ Amount"
            value={newAmount}
            onChange={e => setNewAmount(e.target.value)}
            style={{
              width: 90,
              padding: '7px 12px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
            }}
          />

          {/* Category Dropdown */}
          <select
            value={newCategoryId}
            onChange={e => setNewCategoryId(e.target.value)}
            style={{
              padding: '7px 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              color: 'var(--text-primary)',
              fontSize: 13,
              outline: 'none',
              cursor: 'pointer',
              minWidth: 100,
            }}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.emoji} {cat.name}
              </option>
            ))}
          </select>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="submit"
              style={{
                padding: '7px 16px',
                borderRadius: 10,
                border: 'none',
                background: 'var(--accent)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setNewName('');
                setNewAmount('');
                setNewIcon('📝');
              }}
              style={{
                padding: '7px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'opacity 0.2s',
              }}
            >
              Cancel
            </button>
          </div>

          {/* Inline keyframe styles */}
          <style>{`
            @keyframes qtSlideIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes qtFadeIn {
              from { opacity: 0; transform: scale(0.7); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
        </form>
      )}

      {/* Keyframes for delete button when form is not shown */}
      {!isAdding && (
        <style>{`
          @keyframes qtFadeIn {
            from { opacity: 0; transform: scale(0.7); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>
      )}
    </div>
  );
}
