/**
 * Auto Router — Smart LLM model selection based on prompt analysis
 * Inspired by ClawRouter's 14-dimensional classifier
 * Analyzes user prompt and selects the most cost-effective capable model
 */

// ─── Dimension analyzers ──────────────────────────────────────────────────

const CODE_PATTERNS = /```|function\s|class\s|import\s|export\s|const\s|let\s|var\s|=>\s|def\s|async\s|await\s|return\s|if\s*\(|for\s*\(|while\s*\(|try\s*\{|catch\s*\(|<\/?[a-z]+[\s>]|SELECT\s|INSERT\s|CREATE\s|ALTER\s/gi;
const REASONING_MARKERS = /почему|зачем|объясни|проанализируй|сравни|оцени|разбери|рассуди|продумай|why|because|explain|analyze|compare|evaluate|consider|therefore|however|furthermore|reasoning|step.by.step|chain.of.thought|think.through/gi;
const TECHNICAL_TERMS = /алгоритм|архитектур|паттерн|рефакторинг|оптимиз|параллел|асинхрон|рекурси|полиморф|инкапсуляц|абстракц|интерфейс|имплемент|algorithm|architecture|pattern|refactor|optimi[sz]|parallel|async|recursive|polymorphi|encapsulat|abstract|interface|implement|database|API|REST|GraphQL|microservice|kubernetes|docker|terraform|webpack|typescript|react|vue|angular|flutter|swift|kotlin|rust|golang/gi;
const CREATIVE_MARKERS = /напиши стих|придумай|сочини|фантази|креатив|история|сказк|write.*poem|compose|imagine|creative|story|fiction|poem|song|narrative/gi;
const SIMPLE_MARKERS = /привет|здравствуй|как дела|спасибо|пока|hello|hi|thanks|bye|yes|no|ok|ок|да|нет/gi;
const MULTI_STEP = /шаг\s?\d|этап|последовательн|сначала.*потом|во-первых|во-вторых|step\s?\d|first.*then|plan|phase|stage|1\)|2\)|3\)/gi;
const QUESTION_COMPLEX = /как\s+(?:реализовать|имплементировать|оптимизировать|спроектировать|настроить)|how\s+(?:to\s+(?:implement|optimize|design|architect|configure|build|deploy))|what\s+(?:are\s+the\s+(?:best|optimal|recommended)\s+(?:practices|approaches|strategies))/gi;
const IMPERATIVE_VERBS = /реализуй|напиши код|создай|разработай|implement|write code|create|develop|build|deploy|configure|set up|refactor|debug|fix/gi;
const CONSTRAINTS = /не более|максимум|минимум|ограничен|требовани|обязательн|at most|at least|must|shall|constraint|require|limit|within/gi;
const OUTPUT_FORMAT = /таблиц|формат|JSON|XML|CSV|markdown|yaml|в виде|отформатируй|table|format|output as|structured|template|schema/gi;
const REFERENCES = /согласно|по данным|исследовани|статистик|документаци|according|based on|research|study|documentation|reference|source|paper/gi;
const NEGATION = /не делай|избегай|не используй|без|кроме|don't|avoid|without|except|never|do not/gi;
const DOMAIN_SPECIFIC = /медицин|юридическ|финансов|научн|математик|физик|chemical|medical|legal|financial|scientific|mathematical|physics|biology|quantum|neural|machine.learning|deep.learning|NLP|computer.vision/gi;

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

/**
 * Analyze prompt across 14 dimensions and compute complexity score
 */
function analyzePrompt(text) {
  const len = text.length;
  const wordCount = text.split(/\s+/).length;

  // Token-based (weight: 8%)
  const tokenScore = Math.min(wordCount / 500, 1);

  // Code presence (weight: 15%)
  const codeCount = countMatches(text, CODE_PATTERNS);
  const codeScore = Math.min(codeCount / 10, 1);

  // Reasoning markers (weight: 18%)
  const reasonCount = countMatches(text, REASONING_MARKERS);
  const reasonScore = Math.min(reasonCount / 5, 1);

  // Technical terminology (weight: 10%)
  const techCount = countMatches(text, TECHNICAL_TERMS);
  const techScore = Math.min(techCount / 8, 1);

  // Creative elements (weight: 5%)
  const creativeCount = countMatches(text, CREATIVE_MARKERS);
  const creativeScore = Math.min(creativeCount / 3, 1);

  // Simple language (weight: -2%, negative — reduces score)
  const simpleCount = countMatches(text, SIMPLE_MARKERS);
  const simpleScore = Math.min(simpleCount / 3, 1);

  // Multi-step patterns (weight: 12%)
  const multiCount = countMatches(text, MULTI_STEP);
  const multiScore = Math.min(multiCount / 4, 1);

  // Question complexity (weight: 5%)
  const qComplexCount = countMatches(text, QUESTION_COMPLEX);
  const qComplexScore = Math.min(qComplexCount / 2, 1);

  // Imperative verbs (weight: 3%)
  const impCount = countMatches(text, IMPERATIVE_VERBS);
  const impScore = Math.min(impCount / 3, 1);

  // Constraints (weight: 4%)
  const conCount = countMatches(text, CONSTRAINTS);
  const conScore = Math.min(conCount / 3, 1);

  // Output formatting (weight: 3%)
  const outCount = countMatches(text, OUTPUT_FORMAT);
  const outScore = Math.min(outCount / 3, 1);

  // References (weight: 2%)
  const refCount = countMatches(text, REFERENCES);
  const refScore = Math.min(refCount / 3, 1);

  // Negation patterns (weight: 1%)
  const negCount = countMatches(text, NEGATION);
  const negScore = Math.min(negCount / 3, 1);

  // Domain specificity (weight: 4%)
  const domainCount = countMatches(text, DOMAIN_SPECIFIC);
  const domainScore = Math.min(domainCount / 3, 1);

  // Weighted sum
  const score =
    tokenScore * 0.08 +
    codeScore * 0.15 +
    reasonScore * 0.18 +
    techScore * 0.10 +
    creativeScore * 0.05 +
    simpleScore * -0.02 +
    multiScore * 0.12 +
    qComplexScore * 0.05 +
    impScore * 0.03 +
    conScore * 0.04 +
    outScore * 0.03 +
    refScore * 0.02 +
    negScore * 0.01 +
    domainScore * 0.04;

  // Length bonus for very long prompts (likely complex)
  const lengthBonus = len > 2000 ? 0.1 : len > 1000 ? 0.05 : 0;

  const finalScore = Math.max(0, Math.min(1, score + lengthBonus));

  return {
    score: finalScore,
    dimensions: {
      tokens: tokenScore,
      code: codeScore,
      reasoning: reasonScore,
      technical: techScore,
      creative: creativeScore,
      simple: simpleScore,
      multiStep: multiScore,
      questionComplexity: qComplexScore,
      imperative: impScore,
      constraints: conScore,
      outputFormat: outScore,
      references: refScore,
      negation: negScore,
      domain: domainScore,
    }
  };
}

/**
 * Determine tier from score
 */
function getTier(score) {
  if (score >= 0.5) return 'COMPLEX';
  if (score >= 0.3) return 'MEDIUM';
  return 'SIMPLE';
}

// ─── Model tiers mapping ───────────────────────────────────────────────

// Ordered by preference within each tier
// Router will pick first available (has API key)
const TIER_MODELS = {
  SIMPLE: [
    { provider: 'gemini',   model: 'gemini-2.0-flash-lite',           name: 'Gemini 2.0 Flash Lite', costPer1k: 0.2 },
    { provider: 'gemini',   model: 'gemini-2.0-flash',                name: 'Gemini 2.0 Flash',      costPer1k: 0.35 },
    { provider: 'deepseek', model: 'deepseek-chat',                   name: 'DeepSeek V3',           costPer1k: 0.3 },
    { provider: 'openai',   model: 'gpt-4o-mini',                     name: 'GPT-4o Mini',           costPer1k: 0.6 },
    { provider: 'kimi',     model: 'moonshot-v1-8k',                  name: 'Kimi 8K',               costPer1k: 0.5 },
    { provider: 'anthropic',model: 'claude-haiku-4-5-20251001',       name: 'Claude Haiku 4.5',      costPer1k: 0.25 },
  ],
  MEDIUM: [
    { provider: 'openai',   model: 'gpt-4o',                          name: 'GPT-4o',                costPer1k: 5.0 },
    { provider: 'anthropic',model: 'claude-sonnet-4-6',               name: 'Claude Sonnet 4.6',     costPer1k: 3.0 },
    { provider: 'gemini',   model: 'gemini-2.5-flash-preview-05-20',  name: 'Gemini 2.5 Flash',      costPer1k: 0.5 },
    { provider: 'gemini',   model: 'gemini-2.5-pro-preview-05-06',    name: 'Gemini 2.5 Pro',        costPer1k: 3.5 },
    { provider: 'kimi',     model: 'moonshot-v1-32k',                 name: 'Kimi 32K',              costPer1k: 2.0 },
    { provider: 'deepseek', model: 'deepseek-chat',                   name: 'DeepSeek V3',           costPer1k: 0.3 },
  ],
  COMPLEX: [
    { provider: 'anthropic',model: 'claude-opus-4-6',                 name: 'Claude Opus 4.6',       costPer1k: 15.0 },
    { provider: 'anthropic',model: 'claude-sonnet-4-6',               name: 'Claude Sonnet 4.6',     costPer1k: 3.0 },
    { provider: 'openai',   model: 'gpt-4o',                          name: 'GPT-4o',                costPer1k: 5.0 },
    { provider: 'gemini',   model: 'gemini-2.5-pro-preview-05-06',    name: 'Gemini 2.5 Pro',        costPer1k: 3.5 },
    { provider: 'deepseek', model: 'deepseek-reasoner',               name: 'DeepSeek R1',           costPer1k: 2.0 },
  ],
};

// Premium baseline for savings calculation
const PREMIUM_COST_PER_1K = 15.0; // Claude Opus

// ─── Human-readable reasoning ──────────────────────────────────────────

const TIER_DESCRIPTIONS = {
  SIMPLE: 'Простой запрос — фактический вопрос, перевод или короткая задача',
  MEDIUM: 'Средняя сложность — требуется анализ, структурированный ответ или работа с контекстом',
  COMPLEX: 'Сложная задача — код, рассуждения, многошаговый анализ или специализированная тема',
};

function buildReasoning(tier, dimensions) {
  const parts = [];
  if (dimensions.code > 0.3) parts.push('содержит код или технические конструкции');
  if (dimensions.reasoning > 0.3) parts.push('требует рассуждений и анализа');
  if (dimensions.technical > 0.3) parts.push('специализированная терминология');
  if (dimensions.multiStep > 0.3) parts.push('многошаговая задача');
  if (dimensions.creative > 0.3) parts.push('творческая задача');
  if (dimensions.domain > 0.3) parts.push('узкоспециализированная область');
  if (dimensions.simple > 0.5) parts.push('простой разговорный запрос');
  if (dimensions.tokens > 0.5) parts.push('объёмный промпт');

  const desc = TIER_DESCRIPTIONS[tier];
  const detail = parts.length > 0 ? `. Обнаружено: ${parts.join(', ')}` : '';
  return `${desc}${detail}`;
}

// ─── Main routing function ─────────────────────────────────────────────

/**
 * Route a prompt to the best available model
 * @param {string} prompt - User's message text (can include history context)
 * @param {string[]} availableProviders - Providers that have configured API keys
 * @param {object} options - { profile: 'auto'|'eco'|'premium' }
 * @returns {{ provider, model, modelName, routingInfo }}
 */
export function autoRoute(prompt, availableProviders = [], options = {}) {
  const { profile = 'auto' } = options;

  const analysis = analyzePrompt(prompt);
  let tier = getTier(analysis.score);

  // Profile adjustments
  if (profile === 'eco') {
    // Downgrade tier for cost savings
    if (tier === 'COMPLEX') tier = 'MEDIUM';
    else if (tier === 'MEDIUM') tier = 'SIMPLE';
  } else if (profile === 'premium') {
    // Upgrade tier for quality
    if (tier === 'SIMPLE') tier = 'MEDIUM';
    else if (tier === 'MEDIUM') tier = 'COMPLEX';
  }

  // Find first available model in tier
  const tierModels = TIER_MODELS[tier] || TIER_MODELS.MEDIUM;
  let selected = null;

  for (const candidate of tierModels) {
    if (availableProviders.length === 0 || availableProviders.includes(candidate.provider)) {
      selected = candidate;
      break;
    }
  }

  // Fallback: try all tiers
  if (!selected) {
    for (const t of ['SIMPLE', 'MEDIUM', 'COMPLEX']) {
      for (const candidate of TIER_MODELS[t]) {
        if (availableProviders.includes(candidate.provider)) {
          selected = candidate;
          break;
        }
      }
      if (selected) break;
    }
  }

  // Last resort
  if (!selected) {
    selected = { provider: 'openai', model: 'gpt-4o', name: 'GPT-4o', costPer1k: 5.0 };
  }

  const savings = selected.costPer1k < PREMIUM_COST_PER_1K
    ? ((PREMIUM_COST_PER_1K - selected.costPer1k) / PREMIUM_COST_PER_1K)
    : 0;

  const reasoning = buildReasoning(tier, analysis.dimensions);

  return {
    provider: selected.provider,
    model: selected.model,
    modelName: selected.name,
    routingInfo: {
      selectedModel: selected.name,
      selectedModelId: selected.model,
      selectedProvider: selected.provider,
      tier,
      confidence: Math.min(0.5 + analysis.score, 1.0),
      reasoning,
      costPer1k: selected.costPer1k,
      savings: Math.round(savings * 100),
      score: Math.round(analysis.score * 100) / 100,
      dimensions: analysis.dimensions,
    }
  };
}
