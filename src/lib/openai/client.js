/**
 * ASCEND AI PROTOCOL - OpenAI Client Wrapper
 * Uses Responses API (client.responses.create). Server-side only.
 */

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MODEL = 'gpt-4.1-mini';

/**
 * Get API key, stripping erroneously duplicated "OPENAI_API_KEY=" prefix.
 * Never exposes the key. Returns undefined if missing.
 * @returns {string|undefined}
 */
function getApiKey() {
    try {
        const raw = typeof process !== 'undefined' && process?.env ? process.env.OPENAI_API_KEY : undefined;
        if (typeof raw !== 'string' || !raw.trim()) return undefined;
        const key = raw.startsWith('OPENAI_API_KEY=') ? raw.slice(16).trim() : raw.trim();
        return key.length > 0 ? key : undefined;
    } catch {
        return undefined;
    }
}

/**
 * Check if OpenAI is available (key present and package installed).
 * @returns {boolean}
 */
export function isOpenAIAvailable() {
    return !!getApiKey();
}

/**
 * Create OpenAI client. Uses modern SDK: import OpenAI from "openai"
 * @returns {Promise<import('openai').OpenAI|null>}
 */
async function getClient() {
    const key = getApiKey();
    if (!key) return null;
    try {
        const { default: OpenAI } = await import('openai');
        return new OpenAI({
            apiKey: key,
            timeout: DEFAULT_TIMEOUT_MS
        });
    } catch {
        return null;
    }
}

/**
 * Call OpenAI Responses API and return raw text.
 * Uses client.responses.create() with model gpt-4.1-mini.
 * @param {Object} params
 * @param {string} params.prompt - Combined or user prompt
 * @param {string} [params.instructions] - System/developer instructions (optional)
 * @param {string} [params.model]
 * @param {number} [params.timeoutMs]
 * @returns {Promise<{ success: boolean, text?: string, error?: string }>}
 */
export async function createResponse({ prompt, instructions, model = DEFAULT_MODEL, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    const client = await getClient();
    if (!client) {
        return { success: false, error: 'OpenAI client not available' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await client.responses.create(
            {
                model,
                input: prompt,
                instructions: instructions || null,
                max_output_tokens: 4096
            },
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        const text = response.output_text;
        if (typeof text !== 'string' || text.trim().length === 0) {
            return { success: false, error: 'Empty or invalid response from OpenAI' };
        }

        return { success: true, text: text.trim() };
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
