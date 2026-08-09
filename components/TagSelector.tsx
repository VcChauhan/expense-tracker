'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface TagSelectorProps {
  selectedTags: string[];
  onChange: (tags: string[]) => void;
  suggestedTags?: string[];
}

export function TagSelector({ selectedTags, onChange, suggestedTags = [] }: TagSelectorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newTag, setNewTag] = useState('');

  const toggleTag = (tag: string) => {
    const formatted = tag.toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!formatted) return;
    
    if (selectedTags.includes(formatted)) {
      onChange(selectedTags.filter(t => t !== formatted));
    } else {
      onChange([...selectedTags, formatted]);
    }
  };

  const handleAdd = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (newTag.trim()) {
      toggleTag(newTag.trim());
      setNewTag('');
      setIsAdding(false);
    }
  };

  // Combine suggested tags and selected tags so selected custom tags stay visible in the list
  const allVisibleTags = Array.from(new Set([...suggestedTags, ...selectedTags]));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Tags</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {allVisibleTags.map(tag => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              style={{
                padding: '6px 12px',
                borderRadius: 9999,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
                background: isSelected ? 'var(--accent)' : 'var(--bg-elevated)',
                color: isSelected ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {tag}
              {isSelected && <X size={12} />}
            </button>
          );
        })}

        {isAdding ? (
          <form onSubmit={handleAdd} style={{ display: 'flex', alignItems: 'center' }}>
            <input
              autoFocus
              type="text"
              placeholder="new tag"
              value={newTag}
              onChange={e => setNewTag(e.target.value)}
              onBlur={() => {
                if (newTag.trim()) handleAdd();
                else setIsAdding(false);
              }}
              style={{
                padding: '5px 10px',
                borderRadius: 9999,
                border: '1px solid var(--accent)',
                background: 'var(--bg)',
                color: 'var(--text-primary)',
                fontSize: 13,
                width: 90,
                outline: 'none'
              }}
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            style={{
              padding: '6px 10px',
              borderRadius: 9999,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px dashed var(--border)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <Plus size={14} /> Add
          </button>
        )}
      </div>
    </div>
  );
}
