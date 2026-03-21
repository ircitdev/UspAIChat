import OpenAI from 'openai';

export async function streamOpenAI({ apiKey, baseURL, model, history, message, systemPrompt, files, onChunk, onTokens }) {
  const client = new OpenAI({ apiKey, baseURL: baseURL || undefined });

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  for (const m of history) {
    messages.push({ role: m.role, content: m.content });
  }

  // Build user message with optional images
  const imageFiles = (files || []).filter(f => f.mimetype?.startsWith('image/') && f.base64);
  if (imageFiles.length > 0) {
    const userContent = [];
    for (const f of imageFiles) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${f.mimetype};base64,${f.base64}`, detail: 'auto' }
      });
    }
    userContent.push({ type: 'text', text: message });
    messages.push({ role: 'user', content: userContent });
  } else {
    messages.push({ role: 'user', content: message });
  }

  const stream = await client.chat.completions.create({
    model: model || 'gpt-4o',
    messages,
    stream: true,
    stream_options: { include_usage: true }
  });

  let tokens = 0;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) onChunk(delta);
    if (chunk.usage?.completion_tokens) {
      tokens = chunk.usage.completion_tokens;
      onTokens(tokens);
    }
  }
}
