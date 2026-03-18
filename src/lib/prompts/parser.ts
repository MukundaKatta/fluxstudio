import type { ParsedPrompt, PromptToken } from '@/types';

/**
 * Parses A1111/ComfyUI-style prompt syntax:
 * - (word:1.5) — weighted token
 * - ((word)) — emphasis shorthand (1.1^n)
 * - [word] — de-emphasis (0.9^n)
 * - <lora:name:weight> — LoRA reference
 * - embedding:name — embedding/textual inversion
 * - [from:to:step] — scheduled prompt
 * - BREAK — attention break
 */
export function parsePrompt(raw: string): ParsedPrompt {
  const tokens: PromptToken[] = [];
  let remaining = raw.trim();

  while (remaining.length > 0) {
    // LoRA syntax: <lora:name:weight>
    const loraMatch = remaining.match(/^<lora:([^:>]+)(?::([^>]*))?>/);
    if (loraMatch) {
      tokens.push({
        text: loraMatch[1],
        weight: loraMatch[2] ? parseFloat(loraMatch[2]) || 1.0 : 1.0,
        type: 'lora',
      });
      remaining = remaining.slice(loraMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Embedding syntax
    const embeddingMatch = remaining.match(/^embedding:(\S+)/);
    if (embeddingMatch) {
      tokens.push({
        text: embeddingMatch[1],
        weight: 1.0,
        type: 'embedding',
      });
      remaining = remaining.slice(embeddingMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // BREAK
    if (remaining.startsWith('BREAK')) {
      tokens.push({ text: 'BREAK', weight: 1.0, type: 'break' });
      remaining = remaining.slice(5).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Scheduled prompt: [from:to:step]
    const scheduledMatch = remaining.match(/^\[([^:\]]+):([^:\]]+):([0-9.]+)\]/);
    if (scheduledMatch) {
      tokens.push({
        text: `${scheduledMatch[1]} -> ${scheduledMatch[2]}`,
        weight: 1.0,
        type: 'scheduled',
        scheduledFrom: 0,
        scheduledTo: parseFloat(scheduledMatch[3]),
      });
      remaining = remaining.slice(scheduledMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Weighted: (text:weight)
    const weightedMatch = remaining.match(/^\(([^)]+):([0-9.]+)\)/);
    if (weightedMatch) {
      tokens.push({
        text: weightedMatch[1].trim(),
        weight: parseFloat(weightedMatch[2]) || 1.0,
        type: 'text',
      });
      remaining = remaining.slice(weightedMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Emphasis ((text)) — each pair of parens = 1.1x
    const emphasisMatch = remaining.match(/^(\(+)([^()]+)(\)+)/);
    if (emphasisMatch) {
      const depth = Math.min(emphasisMatch[1].length, emphasisMatch[3].length);
      tokens.push({
        text: emphasisMatch[2].trim(),
        weight: parseFloat(Math.pow(1.1, depth).toFixed(3)),
        type: 'text',
      });
      remaining = remaining.slice(emphasisMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // De-emphasis [text] — each pair = 0.9x
    const deEmphasisMatch = remaining.match(/^(\[+)([^\[\]]+)(\]+)/);
    if (deEmphasisMatch) {
      const depth = Math.min(deEmphasisMatch[1].length, deEmphasisMatch[3].length);
      tokens.push({
        text: deEmphasisMatch[2].trim(),
        weight: parseFloat(Math.pow(0.9, depth).toFixed(3)),
        type: 'text',
      });
      remaining = remaining.slice(deEmphasisMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Plain text until next special char or comma
    const plainMatch = remaining.match(/^([^,<(\[]+)/);
    if (plainMatch) {
      const text = plainMatch[1].trim();
      if (text.length > 0) {
        tokens.push({ text, weight: 1.0, type: 'text' });
      }
      remaining = remaining.slice(plainMatch[0].length).trimStart();
      if (remaining.startsWith(',')) remaining = remaining.slice(1).trimStart();
      continue;
    }

    // Skip unrecognized chars
    remaining = remaining.slice(1);
  }

  return { tokens, raw };
}

export function serializePrompt(tokens: PromptToken[]): string {
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'lora':
          return `<lora:${t.text}:${t.weight}>`;
        case 'embedding':
          return `embedding:${t.text}`;
        case 'break':
          return 'BREAK';
        case 'scheduled':
          return `[${t.text}:${t.scheduledTo}]`;
        case 'text':
          if (t.weight === 1.0) return t.text;
          return `(${t.text}:${t.weight})`;
        default:
          return t.text;
      }
    })
    .join(', ');
}

export function getPromptTokenCount(prompt: string): number {
  // Rough CLIP tokenizer estimation: ~0.75 tokens per word
  const words = prompt.split(/\s+/).filter(Boolean);
  return Math.ceil(words.length * 1.3);
}

export function highlightPromptSyntax(prompt: string): string {
  let result = prompt;
  // LoRA
  result = result.replace(/<lora:([^:>]+)(?::([^>]*))?>/g, '<span class="text-accent-purple">&lt;lora:$1:$2&gt;</span>');
  // Weights
  result = result.replace(/\(([^)]+):([0-9.]+)\)/g, '<span class="text-accent-cyan">($1:<span class="text-accent-yellow">$2</span>)</span>');
  // Emphasis
  result = result.replace(/(\({2,})([^()]+)(\){2,})/g, '<span class="text-accent-green">$1$2$3</span>');
  // BREAK
  result = result.replace(/\bBREAK\b/g, '<span class="text-accent-red font-bold">BREAK</span>');
  return result;
}
