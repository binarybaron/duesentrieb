import { describe, expect, it } from "vitest";
import {
	MAX_OPEN_QUESTION_OPTIONS,
	MAX_OPEN_QUESTIONS,
	OpenQuestionStore,
	parseOpenQuestions,
} from "../src/core/open-questions.ts";

describe("parseOpenQuestions", () => {
	it("parses a plain JSON response", () => {
		expect(
			parseOpenQuestions('{"questions":[{"question":"Deploy target?","options":["Staging","Production"]}]}'),
		).toEqual([{ question: "Deploy target?", options: ["Staging", "Production"] }]);
	});

	it("parses an empty question list", () => {
		expect(parseOpenQuestions('{"questions":[]}')).toEqual([]);
	});

	it("tolerates markdown fences and surrounding prose", () => {
		expect(parseOpenQuestions('```json\n{"questions":[{"question":"Q?","options":["A"]}]}\n```')).toEqual([
			{ question: "Q?", options: ["A"] },
		]);
		expect(parseOpenQuestions('Here you go:\n{"questions":[{"question":"Q?","options":["A"]}]}')).toEqual([
			{ question: "Q?", options: ["A"] },
		]);
	});

	it("drops malformed entries and clamps options", () => {
		const parsed = parseOpenQuestions(
			JSON.stringify({
				questions: [
					{ question: "  ", options: ["A"] },
					{ question: "Valid?", options: ["A", "B", "C", "D", "E", 7, "  "] },
					{ question: "No options?" },
					"garbage",
				],
			}),
		);
		expect(parsed).toEqual([
			{ question: "Valid?", options: ["A", "B", "C", "D"] },
			{ question: "No options?", options: [] },
		]);
		expect(parsed[0]?.options.length).toBeLessThanOrEqual(MAX_OPEN_QUESTION_OPTIONS);
	});

	it("throws on invalid JSON or shape", () => {
		expect(() => parseOpenQuestions("not json")).toThrow();
		expect(() => parseOpenQuestions('{"answers":[]}')).toThrow();
	});
});

describe("OpenQuestionStore", () => {
	it("adds, dedupes, and removes questions", () => {
		const store = new OpenQuestionStore();
		expect(store.add("Deploy target?", ["Staging", "Production"])).toBe(true);
		expect(store.add("deploy target?  ", ["Other"])).toBe(false);
		expect(store.add("   ", [])).toBe(false);
		expect(store.size).toBe(1);

		const [question] = store.list();
		expect(question).toMatchObject({ question: "Deploy target?", options: ["Staging", "Production"] });
		store.remove(question.id);
		expect(store.size).toBe(0);
	});

	it("caps the number of stored questions", () => {
		const store = new OpenQuestionStore();
		for (let i = 0; i < MAX_OPEN_QUESTIONS; i++) {
			expect(store.add(`Question ${i}?`, ["Yes", "No"])).toBe(true);
		}
		expect(store.add("One more?", ["Yes"])).toBe(false);
		expect(store.size).toBe(MAX_OPEN_QUESTIONS);
	});
});
