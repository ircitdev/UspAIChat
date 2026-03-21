import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

export async function streamChat(params: {
  conversation_id: string;
  message: string;
  provider: string;
  model: string;
  system_prompt?: string;
  files?: unknown[];
  onChunk: (chunk: string) => void;
  onTokens: (count: number) => void;
  onDone: (messageId: string, fullContent: string, balanceAfter?: number | null) => void;
  onError: (error: string) => void;
}) {
  const token = api.defaults.headers.common['Authorization'] as string | undefined;
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': token } : {})
    },
    body: JSON.stringify({
      conversation_id: params.conversation_id,
      message: params.message,
      provider: params.provider,
      model: params.model,
      system_prompt: params.system_prompt,
      files: params.files || []
    })
  });

  if (!response.ok) {
    params.onError(`HTTP ${response.status}: ${response.statusText}`);
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === 'chunk') params.onChunk(data.content);
          else if (data.type === 'tokens') params.onTokens(data.count);
          else if (data.type === 'done') params.onDone(data.message_id, data.full_content, data.balance_after);
          else if (data.type === 'error') params.onError(data.error);
        } catch {}
      }
    }
  }
}

export default api;
