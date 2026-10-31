/** DeepSeek API 配置视图（API Key 只写不读，仅返回是否已配置） */
export interface DeepSeekConfig {
  hasApiKey: boolean;
  baseUrl: string;
  model: string;
}

export interface SetDeepSeekConfigInput {
  /** null / 空串 = 保持现有 Key 不变 */
  apiKey: string | null;
  baseUrl: string;
  model: string;
}
