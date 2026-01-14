
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { ChatMessage, CalculationStep } from "@/components/indicator/types";

// 使用最穩定的模型名稱
const MODEL_NAME = 'gemini-2.0-flash';

export const getGeminiClient = () => {
    const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY;
    if (!apiKey) {
        console.error("Gemini API Key is missing. Please set NEXT_PUBLIC_API_KEY in .env.local");
        // Return a dummy client or handle error gracefully
        throw new Error("API Key missing");
    }
    return new GoogleGenerativeAI(apiKey);
};

const safeParseJson = (text: string | undefined) => {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
            if (match) {
                return JSON.parse(match[0]);
            }
        } catch (e2) {
            console.error("Critical JSON Parsing Error:", text);
        }
    }
    return {};
};

// ... (Rest of the functions adapted for @google/generative-ai)

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

class RateLimiter {
    private timestamps: number[] = [];
    private readonly limit: number;
    private readonly window: number;

    constructor(limit: number, window: number) {
        this.limit = limit;
        this.window = window;
    }

    async checkAndWait() {
        const now = Date.now();
        // Remove timestamps outside the window
        this.timestamps = this.timestamps.filter(t => now - t < this.window);

        if (this.timestamps.length >= this.limit) {
            const oldest = this.timestamps[0];
            const waitTime = oldest + this.window - now + 1000; // Add 1s buffer
            if (waitTime > 0) {
                console.warn(`Local Rate Limit: Waiting ${waitTime}ms to respect ${this.limit} RPM limit.`);
                await delay(waitTime);
            }
        }
        this.timestamps.push(Date.now());
    }
}

// Gemini 2.0 Flash Free Tier: 10 RPM (Requests Per Minute)
const geminiRateLimiter = new RateLimiter(10, 60000);

async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    retries: number = 5,
    initialDelay: number = 2000,
    backoffFactor: number = 2
): Promise<T> {
    let currentDelay = initialDelay;

    for (let i = 0; i < retries; i++) {
        // Enforce local rate limit before making a request
        await geminiRateLimiter.checkAndWait();

        try {
            return await fn();
        } catch (error: any) {
            // Check for 429 (Too Many Requests) or 503 (Service Unavailable)
            const message = error?.message || '';
            const isRateLimit = error?.status === 429 ||
                message.includes('429') ||
                message.includes('Too Many Requests') ||
                message.includes('quota') ||
                error?.status === 503;

            if (i === retries - 1 || !isRateLimit) {
                throw error;
            }

            // Extract wait time from error message if present (e.g. "Please retry in 37.742189824s")
            let waitTime = currentDelay;
            const match = message.match(/retry in ([0-9.]+)s/);
            if (match && match[1]) {
                waitTime = Math.ceil(parseFloat(match[1]) * 1000) + 1000; // Add 1s buffer
                console.warn(`Server requested wait time: ${waitTime}ms`);
            }

            console.warn(`API Rate Limit hit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
            await delay(waitTime);

            // Only increase backoff if we didn't use a specific server wait time
            if (!match) {
                currentDelay *= backoffFactor;
            }
        }
    }
    throw new Error("Max retries exceeded");
}

export const chatWithGemini = async (
    messages: ChatMessage[],
    isThinking: boolean = false
): Promise<{ text: string; thinking?: string }> => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            systemInstruction: `你是一位卓越的醫療品質指標分析師與 FHIR 專家。
你的任務是協助醫護人員定義醫療品質指標。
1. 請務必使用「繁體中文」回答。
2. 支持「運算步驟鏈」(Calculation Chain)：用戶可以組合 FHIR 過濾器、其它指標的結果與常數。
3. 運算動作包含：BASE(起始), AND(集合交集), OR(集合聯集), NOT(集合排除), ADD(加), SUBTRACT(減), MULTIPLY(乘), DIVIDE(除)。
4. FHIR 資源對應需精確。`
        });

        // Convert history to format expected by GoogleGenerativeAI
        const chat = model.startChat({
            history: messages.slice(0, -1).map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }))
        });

        const lastMessage = messages[messages.length - 1];
        const result = await retryWithBackoff(() => chat.sendMessage(lastMessage.content));
        const response = await result.response;

        return { text: response.text() };
    } catch (error: any) {
        console.error("Chat Error:", error);

        const message = error?.message || '';
        const isRateLimit = error?.status === 429 ||
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            error?.status === 503;

        if (isRateLimit) {
            return { text: "免費資源已用完，請等待資源提供完成時間。" };
        }

        return { text: "抱歉，AI 服務暫時無法使用，請檢查 API Key 或稍後再試。" };
    }
};

export const getAiFieldSuggestions = async (
    type: 'path' | 'value',
    context: {
        indicatorName: string;
        indicatorDesc: string;
        resourceType: string;
        path?: string;
    }
): Promise<{ value: string; label: string }[]> => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        suggestions: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    value: { type: SchemaType.STRING },
                                    label: { type: SchemaType.STRING }
                                },
                                required: ["value", "label"]
                            }
                        }
                    },
                    required: ["suggestions"]
                }
            }
        });

        const prompt = type === 'path'
            ? `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 資源中，請建議 5 個最相關的 JSON Paths。請提供 FHIR 規格路徑與對應的中文標籤。`
            : `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 的路徑 "${context.path}" 下，請建議 5 個臨床常用的代碼 or 數值比對值。請提供代碼與中文說明標籤。`;

        const result = await retryWithBackoff(() => model.generateContent(prompt));
        const data = safeParseJson(result.response.text());
        return data.suggestions || [];
    } catch (error: any) {
        console.error("AI Suggestion Error:", error);

        const message = error?.message || '';
        const isRateLimit = error?.status === 429 ||
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            error?.status === 503;

        if (isRateLimit) {
            throw error; // Re-throw to let UI handle it
        }

        return [];
    }
};

export const analyzeFullIndicator = async (
    name: string,
    desc: string
): Promise<any> => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        exclusionSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING } } } },
                        denominatorSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING } } } },
                        numeratorSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING } } } }
                    }
                }
            }
        });

        const prompt = `
  指標名稱: ${name}
  功能描述: ${desc}
  
  請根據上述名稱與描述，為此醫療指標生成完整的 FHIR 運算步驟建議。
  請分別提供：
  1. exclusionSteps(排除邏輯)
  2. denominatorSteps(分母邏輯)
  3. numeratorSteps(分子邏輯)
  
  運算步驟必須符合此格式：
  {
    "action": "BASE/AND/OR/NOT/ADD/SUBTRACT/MULTIPLY/DIVIDE",
    "valueType": "fhir_filter/indicator_result/constant",
    "resourceType": "Patient/Observation/Condition/Procedure/Encounter/MedicationRequest",
    "path": "fhir_path",
    "value": "compare_value",
    "notes": "中文備註"
  }
  `;
        const result = await retryWithBackoff(() => model.generateContent(prompt));
        return safeParseJson(result.response.text());
    } catch (e: any) {
        console.error("Smart Analyze Error:", e);

        const message = e?.message || '';
        const isRateLimit = e?.status === 429 ||
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            e?.status === 503;

        if (isRateLimit) {
            throw e;
        }

        return { exclusionSteps: [], denominatorSteps: [], numeratorSteps: [] };
    }
};

export const analyzeSectionDefinition = async (
    indicatorName: string,
    indicatorDesc: string,
    sectionDraft: string,
    targetType: 'numerator' | 'denominator' | 'exclusion'
): Promise<any> => {
    try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
            model: MODEL_NAME,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: SchemaType.OBJECT,
                    properties: {
                        steps: {
                            type: SchemaType.ARRAY,
                            items: {
                                type: SchemaType.OBJECT,
                                properties: {
                                    action: { type: SchemaType.STRING },
                                    valueType: { type: SchemaType.STRING },
                                    resourceType: { type: SchemaType.STRING },
                                    path: { type: SchemaType.STRING },
                                    operator: { type: SchemaType.STRING },
                                    value: { type: SchemaType.STRING },
                                    notes: { type: SchemaType.STRING }
                                },
                                required: ["action", "valueType", "value", "notes"]
                            }
                        }
                    },
                    required: ["steps"]
                }
            }
        });

        const prompt = `
  指標名稱: ${indicatorName}
  目前描述: ${sectionDraft}
  目標區塊: ${targetType === 'numerator' ? '分子' : targetType === 'denominator' ? '分母' : '排除'}
  
  請將用戶的自然語言描述拆解為一系列的「運算步驟(CalculationStep)」。
  `;
        const result = await retryWithBackoff(() => model.generateContent(prompt));
        return safeParseJson(result.response.text());
    } catch (error: any) {
        console.error("Section Analyze Error:", error);

        const message = error?.message || '';
        const isRateLimit = error?.status === 429 ||
            message.includes('429') ||
            message.includes('Too Many Requests') ||
            message.includes('quota') ||
            error?.status === 503;

        if (isRateLimit) {
            throw error;
        }

        return { steps: [] };
    }
};
