/** AI 提供商协议：openai_compatible | anthropic（官方 AI 不再是提供商，而是 Pro 的独立开关） */
export type AiProvider = "openai_compatible" | "anthropic";

/** AI 配置视图（API Key 只写不读，仅返回是否已配置） */
export interface DeepSeekConfig {
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
  provider: AiProvider;
}

export interface SetDeepSeekConfigInput {
  /** null / 空串 = 保持现有 Key 不变 */
  apiKey: string | null;
  baseUrl: string;
  model: string;
  provider: AiProvider;
}
