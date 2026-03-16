/**
 * ASCEND AI PROTOCOL - OpenAI Client Wrapper
 * Server-side only. Reads API key from environment. Safe error handling.
 */

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MODEL = 'gpt-4o-mini';

/**
 * Check if OpenAI is available (key present and package installed).
 * Safe for browser: returns false when process.env is unavailable.
 * @returns {boolean}
 */
export function isOpenAIAvailable() {
    try {
        const key = typeof process !== 'undefined' && process?.env ? process.env.OPENAI_API_KEY : undefined;
        return typeof key === 'string' && key.trim().length > 0;
    } catch {
        return false;
    }
}

/**
 * Create OpenAI client (lazy, only when needed).
 * @returns {Promise<import('openai').OpenAI|null>}
 */
async function getClient() {
    if (!isOpenAIAvailable()) return null;
    try {
        const { default: OpenAI } = await import('openai');
        return new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
            timeout: DEFAULT_TIMEOUT_MS
        });
    } catch {
        return null;
    }
}

/**
 * Call OpenAI chat completion and return raw text response.
 * @param {Object} params
 * @param {Array<{role:string,content:string}>} params.messages
 * @param {string} [params.model]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function createChatCompletion({ messages, model = DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const client = await getClient();
    if (!client) {
        return { success: false, error: 'OpenAI client not available' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await client.chat.completions.create(
            {
                model,
                messages,
                temperature: 0.3,
                max_tokens: 4096
            },
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        const content = response.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
            return { success: false, error: 'Empty or invalid response from OpenAI' };
        }

        return { success: true, text: content.trim() };
    } catch (err) {
        clearTimeout(timeoutId);

        if (err?.name === 'AbortError') {
            return { success: false, error: 'Request timeout' };
        }
        if (err?.status === 401) {
            return { success: false, error: 'Invalid API key' };
        }
        if (err?.status === 429) {
            return { success: false, error: 'Rate limit exceeded' };
        }
        if (err?.message) {
            return { success: false, error: String(err.message) };
        }
        return { success: false, error: 'OpenAI request failed' };
    }
}
