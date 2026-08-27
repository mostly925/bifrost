/**
 * Complexity Router Type Definitions
 * Mirrors the AnalyzerConfig shape exchanged with /governance/complexity-analyzer-config.
 */

export interface TierBoundaries {
	simple_medium: number;
	medium_complex: number;
	complex_reasoning: number;
}

export interface EditableKeywordConfig {
	code_keywords: string[];
	reasoning_keywords: string[];
	technical_keywords: string[];
	simple_keywords: string[];
}

export interface AnalyzerConfig {
	tier_boundaries: TierBoundaries;
	keywords: EditableKeywordConfig;
}

export type KeywordListKey = keyof EditableKeywordConfig;

export const COMPLEXITY_TIER_VALUES = ["SIMPLE", "MEDIUM", "COMPLEX", "REASONING"] as const;

export const KEYWORD_LIST_DEFINITIONS = [
	{
		key: "simple_keywords",
		labelKey: "keywords.lists.simple.label",
		descriptionKey: "keywords.lists.simple.description",
	},
	{
		key: "code_keywords",
		labelKey: "keywords.lists.code.label",
		descriptionKey: "keywords.lists.code.description",
	},
	{
		key: "technical_keywords",
		labelKey: "keywords.lists.technical.label",
		descriptionKey: "keywords.lists.technical.description",
	},
	{
		key: "reasoning_keywords",
		labelKey: "keywords.lists.reasoning.label",
		descriptionKey: "keywords.lists.reasoning.description",
	},
] as const;

export const DEFAULT_TIER_BOUNDARIES: TierBoundaries = {
	simple_medium: 0.15,
	medium_complex: 0.35,
	complex_reasoning: 0.6,
};