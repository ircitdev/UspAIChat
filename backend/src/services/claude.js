import Anthropic from '@anthropic-ai/sdk';

export async function streamClaude({ apiKey, model, history, message, systemPrompt, files, onChunk, onTokens }) {
  const client = new Anthropic({ apiKey });

  const messages = history.map(m => ({
    role: m.role,
    content: m.content
  }));

  // Build user message with optional images
  const userContent = [];
  for (const f of (files || [])) {
    if (f.mimetype?.startsWith('image/') && f.base64) {
      userContent.push({
        type: 'image',
        source: { type: 'base64', media_type: f.mimetype, data: f.base64 }
      });
    }
  }
  userContent.push({ type: 'text', text: message });

  messages.push({ role: 'user', content: userContent });

  const params = {
    model: model || 'claude-3-5-sonnet-20241022',
    max_tokens: 8192,
    messages,
    stream: true,
  };

  if (systemPrompt) params.system = systemPrompt;

  const stream = await client.messages.stream(params);

  for await (const chunk of stream) {
    if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
      onChunk(chunk.delta.text);
    }
    if (chunk.type === 'message_delta' && chunk.usage) {
      onTokens(chunk.usage.output_tokens);
    }
  }
}
