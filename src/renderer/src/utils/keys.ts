export interface KeyCombo {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
}

/** 解析 'Ctrl+K' / 'Ctrl+Shift+B' 这类快捷键字符串。 */
export function parseAccelerator(acc: string): KeyCombo {
  const combo: KeyCombo = { key: '', ctrl: false, alt: false, shift: false, meta: false };
  for (const part of acc.trim().split('+')) {
    const v = part.trim().toLowerCase();
    if (v === 'ctrl' || v === 'control') combo.ctrl = true;
    else if (v === 'alt' || v === 'option') combo.alt = true;
    else if (v === 'shift') combo.shift = true;
    else if (v === 'meta' || v === 'cmd' || v === 'super' || v === 'win') combo.meta = true;
    else combo.key = v;
  }
  return combo;
}

export function matchesKey(event: KeyboardEvent, accelerator: string): boolean {
  const combo = parseAccelerator(accelerator);
  if (!combo.key) return false;
  return (
    event.key.toLowerCase() === combo.key &&
    event.ctrlKey === combo.ctrl &&
    event.altKey === combo.alt &&
    event.shiftKey === combo.shift &&
    event.metaKey === combo.meta
  );
}
