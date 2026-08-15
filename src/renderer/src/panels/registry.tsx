import type { ComponentType } from 'react';
import { FileIcon, TerminalIcon, SessionsIcon, TasksIcon, McpIcon } from './icons';
import FilesPanel from './FilesPanel';
import TerminalPanel from './TerminalPanel';
import SessionsPanel from './SessionsPanel';
import TasksPanel from './TasksPanel';
import McpPanel from './McpPanel';

export interface PanelDefinition {
  id: string;
  title: string;
  icon: ComponentType<{ size?: number }>;
  component: ComponentType;
}

/**
 * 面板注册表：新增一个面板只需在此登记，活动栏会自动出现对应按钮。
 * 每个面板是独立 React 组件，通过 window.harnessShell 访问原生能力。
 */
export const panels: PanelDefinition[] = [
  { id: 'files', title: '文件', icon: FileIcon, component: FilesPanel },
  { id: 'terminal', title: '终端', icon: TerminalIcon, component: TerminalPanel },
  { id: 'sessions', title: '会话', icon: SessionsIcon, component: SessionsPanel },
  { id: 'tasks', title: '任务', icon: TasksIcon, component: TasksPanel },
  { id: 'mcp', title: 'MCP', icon: McpIcon, component: McpPanel },
];
