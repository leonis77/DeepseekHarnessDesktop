/** 内置插件目录（主进程写入 profile bundles，设置面板展示开关）。 */
export interface BundledPluginInfo {
  id: string;
  name: string;
  description: string;
}

export const BUNDLED_PLUGINS: BundledPluginInfo[] = [
  { id: 'dsh-plugin-genui', name: 'GenUI 生成界面', description: '根据需求自动生成前端界面与组件' },
  { id: 'oh-my-dsh', name: 'oh-my-dsh', description: 'DSH 增强配置与便捷命令集合' },
  { id: 'dsh-voice-webspeech', name: '语音（Web Speech）', description: '浏览器语音输入/朗读' },
  { id: 'dsh-message-edit', name: '消息编辑', description: '编辑已发送的消息并重发' },
  { id: 'dsh-git-status', name: 'Git 状态', description: '侧边栏显示仓库状态与提交图' },
  { id: 'dsh-vision-router', name: '视觉路由', description: '按图片内容自动路由到视觉模型' },
];

export const BUNDLED_PLUGIN_IDS = BUNDLED_PLUGINS.map((p) => p.id);
