/**
 * Open questions collected in the background during a session.
 *
 * A separate model call reviews the recent conversation after each agent turn
 * and extracts questions that would be useful for the user to answer, without
 * interrupting the session flow. The user reviews them via /open-questions.
 */

export interface OpenQuestion {
	id: number;
	question: string;
	/** Up to MAX_OPEN_QUESTION_OPTIONS suggested answers; the user can always write a custom response. */
	options: string[];
}

export const MAX_OPEN_QUESTION_OPTIONS = 4;
export const MAX_OPEN_QUESTIONS = 20;

export function buildOpenQuestionsSystemPrompt(existingQuestions: readonly string[]): string {
	return `You observe a coding-agent session in the background and collect "open questions": questions whose answers would help the agent right now but are not worth interrupting the user for.

Return exactly one JSON object with no markdown and no extra fields:
{"questions":[{"question":"...","options":["...","..."]}]}

Rules:
- Collect at most 3 new questions per turn; return {"questions":[]} when nothing qualifies.
- Only include questions that are genuinely useful and cannot be answered from the conversation itself (ambiguous requirements, unstated preferences, upcoming decisions).
- Prefer meta-level questions about how the user generally wants things done — overall approach, which abstraction or pattern to prefer, conventions, priorities, trade-offs (e.g. "How should features like this generally be implemented?", "Which abstraction should be preferred here?"). Avoid hyper-specific questions about the exact change currently in progress.
- Each question gets 2 to ${MAX_OPEN_QUESTION_OPTIONS} short, concrete multiple-choice options. The user can always write a custom answer, so options should cover the likely cases.
- Never repeat or rephrase these already-collected questions:
${existingQuestions.length > 0 ? existingQuestions.map((question) => `  - ${question}`).join("\n") : "  (none)"}`;
}

function extractJsonObject(text: string): string {
	const trimmed = text.trim();
	const fenced = /^```[a-z]*\s*\n?([\s\S]*?)\n?\s*```$/.exec(trimmed);
	const body = (fenced ? fenced[1] : trimmed).trim();
	if (body.startsWith("{")) return body;
	const start = body.indexOf("{");
	const end = body.lastIndexOf("}");
	if (start !== -1 && end > start) return body.slice(start, end + 1);
	return body;
}

export function parseOpenQuestions(text: string): Array<{ question: string; options: string[] }> {
	let value: unknown;
	try {
		value = JSON.parse(extractJsonObject(text));
	} catch {
		throw new Error("Open questions collector returned invalid JSON");
	}
	if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).questions)) {
		throw new Error("Open questions collector returned an invalid response shape");
	}
	const questions: Array<{ question: string; options: string[] }> = [];
	for (const entry of (value as { questions: unknown[] }).questions) {
		if (!entry || typeof entry !== "object") continue;
		const record = entry as Record<string, unknown>;
		if (typeof record.question !== "string" || record.question.trim().length === 0) continue;
		const options = Array.isArray(record.options)
			? record.options
					.filter((option): option is string => typeof option === "string" && option.trim().length > 0)
					.map((option) => option.trim())
					.slice(0, MAX_OPEN_QUESTION_OPTIONS)
			: [];
		questions.push({ question: record.question.trim(), options });
	}
	return questions;
}

export class OpenQuestionStore {
	private questions: OpenQuestion[] = [];
	private nextId = 1;

	list(): readonly OpenQuestion[] {
		return this.questions;
	}

	get size(): number {
		return this.questions.length;
	}

	/** Adds a question unless it duplicates an existing one or the store is full. Returns true when added. */
	add(question: string, options: string[]): boolean {
		const normalized = question.trim().toLowerCase();
		if (!normalized) return false;
		if (this.questions.length >= MAX_OPEN_QUESTIONS) return false;
		if (this.questions.some((existing) => existing.question.trim().toLowerCase() === normalized)) return false;
		this.questions.push({
			id: this.nextId++,
			question: question.trim(),
			options: options.slice(0, MAX_OPEN_QUESTION_OPTIONS),
		});
		return true;
	}

	remove(id: number): void {
		this.questions = this.questions.filter((question) => question.id !== id);
	}
}
