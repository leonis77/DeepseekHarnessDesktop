import type { ReactNode } from 'react';
import { ChatIcon, SettingsIcon, SearchIcon } from '../panels/icons';
import { panels } from '../panels/registry';

type ShellView = 'harness' | 'settings' | 'sessions';

interface Props {
  view: ShellView;
  activePanelId: string | null;
  onSelectView(view: ShellView): void;
  onTogglePanel(id: string): void;
  onOpenPalette(): void;
}

function ActButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick(): void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button className={'act-btn' + (active ? ' active' : '')} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

export default function ActivityBar({ view, activePanelId, onSelectView, onTogglePanel, onOpenPalette }: Props) {
  return (
    <nav className="activitybar">
      <ActButton active={view === 'harness'} onClick={() => onSelectView('harness')} title="Harness">
        <ChatIcon />
      </ActButton>
      <ActButton active={view === 'settings'} onClick={() => onSelectView('settings')} title="设置">
        <SettingsIcon />
      </ActButton>
      <div className="act-divider" />
      {panels.map((panel) => {
        const Icon = panel.icon;
        return (
          <ActButton key={panel.id} active={activePanelId === panel.id} onClick={() => onTogglePanel(panel.id)} title={panel.title}>
            <Icon />
          </ActButton>
        );
      })}
      <div className="act-spacer" />
      <ActButton onClick={onOpenPalette} title="命令面板 (Ctrl+K)">
        <SearchIcon />
      </ActButton>
    </nav>
  );
}
