// ============================================================================
// Claude API Service
// ============================================================================
// Uses Anthropic's Messages API via the backend proxy to avoid CORS.
// Supports Sonnet for creative tasks and Haiku for structured tasks.
// ============================================================================

const MODELS = {
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5-20251001',
} as const;

export type ClaudeModel = keyof typeof MODELS;

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{ type: 'text'; text: string }>;
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}

/**
 * Call Claude API through the backend proxy.
 * The proxy adds the API key from user settings so we don't expose it client-side.
 */
export async function callClaude({
  model = 'sonnet',
  system,
  messages,
  maxTokens = 4096,
  temperature = 0.7,
}: {
  model?: ClaudeModel;
  system?: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const response = await fetch('/api/claude/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELS[model],
      system,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error (${response.status}): ${error}`);
  }

  const data: ClaudeResponse = await response.json();
  return data.content[0]?.text ?? '';
}

/**
 * Call Claude and parse the response as JSON.
 * Strips markdown code fences if present.
 */
export async function callClaudeJSON<T = unknown>({
  model = 'sonnet',
  system,
  prompt,
  maxTokens = 4096,
}: {
  model?: ClaudeModel;
  system?: string;
  prompt: string;
  maxTokens?: number;
}): Promise<T> {
  const text = await callClaude({
    model,
    system: system ? `${system}\n\nIMPORTANT: Respond with valid JSON only. No markdown, no explanation.` : 'Respond with valid JSON only. No markdown, no explanation.',
    messages: [{ role: 'user', content: prompt }],
    maxTokens,
    temperature: 0.5,
  });

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  return JSON.parse(cleaned);
}

/**
 * Fill a prompt template with variables.
 * Replaces {{variable.path}} with values from the context object.
 */
export function fillTemplate(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const keys = path.trim().split('.');
    let value: unknown = context;
    for (const key of keys) {
      if (value == null || typeof value !== 'object') return match;
      value = (value as Record<string, unknown>)[key];
    }
    if (value == null) return match;
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}
