/** Scout's model order per step. The final score (judge) only ever uses the strongest models — never a smaller one. */
export const PLAN_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "mistral/mistral-medium-latest"];
export const FIND_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]; // finding places by web search
export const WEB_MODELS = ["openai/gpt-oss-20b", "openai/gpt-oss-120b"]; // web search: Groq GPT-OSS only
export const RELEVANCE_MODELS = ["openai/gpt-oss-20b", "qwen/qwen3.8-27b", "openai/gpt-oss-120b", "mistral/mistral-small-latest"];
export const JUDGE_MODELS = ["openai/gpt-oss-120b", "mistral/mistral-medium-latest"];
