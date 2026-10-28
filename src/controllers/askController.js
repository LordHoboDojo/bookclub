import { LLMRefusalError, llmLabel } from '../services/ai/llm.js';
import { answerQuestion } from '../services/rag.js';
import { countForClub } from '../services/vectorStore.js';

const EXAMPLES = [
  'Which book did we disagree about the most?',
  'What did people think of the ending of our last book?',
  'Summarize our discussions so far.',
  'Who liked the slower, more literary picks?',
];

async function render(res, req, extra = {}) {
  res.render('ask/show', {
    title: `Ask ${req.club.name}`,
    examples: EXAMPLES,
    knowledgeChunks: await countForClub(req.club._id),
    llmLabel: llmLabel(),
    question: '',
    result: null,
    ...extra,
  });
}

export function form(req, res) {
  return render(res, req);
}

export async function ask(req, res) {
  const question = String(req.body.question || '').trim().slice(0, 500);
  if (!question) return render(res, req, { error: 'Type a question first.' });
  try {
    const result = await answerQuestion({ club: req.club, question });
    return render(res, req, { question, result });
  } catch (err) {
    if (err instanceof LLMRefusalError) {
      return render(res, req, { question, error: "Claude couldn't help with that question. Try rephrasing it." });
    }
    console.error('[ask] failed', err);
    return render(res, req, { question, error: 'Something went wrong while answering. Please try again.' });
  }
}
