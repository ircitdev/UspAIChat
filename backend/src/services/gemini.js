import { GoogleGenerativeAI } from '@google/generative-ai';

export async function streamGemini({ apiKey, model, history, message, systemPrompt, files, onChunk, onTokens }) {
  const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1beta' });
  const geminiModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-pro',
    systemInstruction: systemPrompt || undefined
  });

  const chatHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const chat = geminiModel.startChat({ history: chatHistory });

  // Build parts with optional images
  const parts = [];
  for (const f of (files || [])) {
    if (f.mimetype?.startsWith('image/') && f.base64) {
      parts.push({ inlineData: { data: f.base64, mimeType: f.mimetype } });
    }
  }
  parts.push({ text: message });

  const result = await chat.sendMessageStream(parts);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) onChunk(text);
  }

  const response = await result.response;
  if (response.usageMetadata?.candidatesTokenCount) {
    onTokens(response.usageMetadata.candidatesTokenCount);
  }
}
