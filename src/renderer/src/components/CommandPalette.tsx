import { useEffect, useMemo, useRef, useState } from 'react';
import type { CommandDescriptor } from '../../../shared/types';

interface Props {
  commands: CommandDescriptor[];
  onClose(): void;
}

export default function CommandPalette({ commands, onClose }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.title.toLowerCase().includes(q) || (c.category ?? '').toLowerCase().includes(q)
    );
  }, [commands, query]);

  const run = (id: string): void => {
    void window.harnessShell.runCommand(id);
    onClose();
  };

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="输入命令…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') onClose();
            if (e.key === 'Enter' && filtered[0]) run(filtered[0].id);
          }}
        />
        <ul className="palette-list">
          {filtered.map((c) => (
            <li key={c.id} className="palette-item" onClick={() => run(c.id)}>
              <span className="palette-title">{c.title}</span>
              {c.category && <span className="palette-category">{c.category}</span>}
            </li>
          ))}
          {filtered.length === 0 && <li className="palette-empty">无匹配命令</li>}
        </ul>
      </div>
    </div>
  );
}
