import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import type { ModelApiPreset, ModelApiState, ModelProviderConfig } from '../shared/types';
import { resolveDshHome } from './fs';

/**
 * 桌面端「模型 / API」配置：把 API Key 写进 $DSH_HOME/.credentials.yaml（dsh 热重载，无需重启），
 * 把 provider 写进 $DSH_HOME/settings.yaml 的 llm-pi-ai.providers.*。
 * 用 dsh 同款 yaml 库，保留注释/格式，安全合并。
 */

export const MODEL_PRESETS: ModelApiPreset[] = [
  {
    id: 'zhipu',
    name: '智谱 GLM',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyRef: 'ZAI_API_KEY',
    models: ['glm-4.6v-flash'],
    input: ['text', 'image'],
    hint: 'glm-4.6v-flash 永久免费 + 大陆直连（推荐）',
  },
  {
    id: 'dashscope',
    name: '阿里百炼 DashScope',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyRef: 'DASHSCOPE_API_KEY',
    models: ['qwen-vl-plus'],
    input: ['text', 'image'],
    hint: '新用户 90 天免费额度（Qwen-VL）',
  },
  {
    id: 'siliconflow',
    name: '硅基流动 SiliconFlow',
    baseURL: 'https://api.siliconflow.cn/v1',
    apiKeyRef: 'SILICONFLOW_API_KEY',
    models: ['Qwen/Qwen2.5-VL-7B-Instruct'],
    input: ['text', 'image'],
    hint: '大陆直连，¥14 赠金',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseURL: 'https://openrouter.ai/api/v1',
    apiKeyRef: 'OPENROUTER_API_KEY',
    models: ['google/gemma-4-31b-it:free'],
    input: ['text', 'image'],
    hint: '需代理；免费模型 50 次/天',
  },
];

function credentialsPath(): string {
  return path.join(resolveDshHome(), '.credentials.yaml');
}

function settingsPath(): string {
  return path.join(resolveDshHome(), 'settings.yaml');
}

function readYaml(file: string): Record<string, unknown> {
  try {
    const text = fs.readFileSync(file, 'utf8');
    const parsed = YAML.parse(text);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function readCredentials(): Record<string, string> {
  return readYaml(credentialsPath()) as Record<string, string>;
}

/** 读取当前已配置的 provider（不回显 Key，只报 configured 状态）。 */
export function readModelApiState(): ModelApiState {
  const creds = readCredentials();
  const settings = readYaml(settingsPath());
  const pi = (settings['llm-pi-ai'] ?? {}) as Record<string, unknown>;
  const providers = (pi.providers ?? {}) as Record<string, Record<string, unknown>>;
  const rows = Object.entries(providers).map(([id, p]) => ({
    id,
    name: String(p.name ?? id),
    baseURL: String(p.baseURL ?? ''),
    apiKeyRef: String(p.apiKeyEnv ?? ''),
    models: Array.isArray(p.models) ? (p.models as Array<{ id?: string }>).map((m) => m.id ?? '').filter(Boolean) : [],
    input: Array.isArray(p.input) ? (p.input as string[]) : ['text'],
    configured: !!(p.apiKeyEnv && creds[String(p.apiKeyEnv)]),
  }));
  return { providers: rows };
}

/** 写入一个 provider：Key → .credentials.yaml，provider → settings.yaml。 */
export function saveModelProvider(provider: ModelProviderConfig): void {
  const ref = provider.apiKeyRef.trim();
  if (!ref) throw new Error('缺少凭据引用名（apiKeyRef）');

  // 1) 写凭据（热重载）
  if (provider.apiKey && provider.apiKey.trim()) {
    const credDoc = YAML.parseDocument(fs.existsSync(credentialsPath()) ? fs.readFileSync(credentialsPath(), 'utf8') : '');
    credDoc.set(ref, provider.apiKey.trim());
    fs.mkdirSync(path.dirname(credentialsPath()), { recursive: true });
    fs.writeFileSync(credentialsPath(), credDoc.toString(), 'utf8');
  }

  // 2) 写 provider（settings.yaml 的 llm-pi-ai.providers.<id>）
  const settingsText = fs.existsSync(settingsPath()) ? fs.readFileSync(settingsPath(), 'utf8') : '';
  const doc = YAML.parseDocument(settingsText || '{}');
  const root = doc.contents as YAML.YAMLMap | null;
  const pi = (root?.get('llm-pi-ai', true) ?? doc.createNode({})) as YAML.YAMLMap;
  const providers = (pi.get('providers', true) ?? doc.createNode({})) as YAML.YAMLMap;
  const models = provider.models
    .map((m) => m.trim())
    .filter(Boolean)
    .map((m) => ({
      id: m,
      name: `${provider.name}: ${m}`,
      contextWindow: 131072,
      maxTokens: 8192,
      input: provider.input,
    }));
  const node = doc.createNode({
    api: 'openai-completions',
    baseURL: provider.baseURL.trim(),
    apiKeyEnv: ref,
    models,
  });
  providers.set(provider.id, node);
  pi.set('providers', providers);
  root?.set('llm-pi-ai', pi);
  fs.writeFileSync(settingsPath(), doc.toString(), 'utf8');
}
