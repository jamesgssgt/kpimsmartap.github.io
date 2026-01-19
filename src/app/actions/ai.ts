
"use server";

import { getSystemSettings } from "@/app/actions/system";
import { parseAiConfig, AiConfig } from "@/types/system";

// Common Types
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AiSuggestion {
    value: string;
    label: string;
}

// Local SchemaType definition to replace SDK dependency
const SchemaType = {
    STRING: "STRING",
    NUMBER: "NUMBER",
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
    OBJECT: "OBJECT"
};

// Helper: Get Active Config
async function getActiveAiConfig(): Promise<AiConfig | null> {
    console.log("Resolving AI Config...");
    try {
        const res = await getSystemSettings(1); // 1 = AI Config
        if (res.success && res.data) {
            console.log("Found System Settings:", res.data.length);
            // Find the first enabled config
            const enabledSetting = res.data.find(s => {
                const cfg = parseAiConfig(s.SysValue);
                return cfg && cfg.isEnabled;
            });

            if (enabledSetting) {
                console.log("Using Database AI Config:", enabledSetting.SysName);
                return parseAiConfig(enabledSetting.SysValue);
            }
        }
    } catch (e) {
        console.warn("Failed to fetch system settings, falling back to env:", e);
    }

    // Fallback to Environment Variables (Backward Compatibility)
    const envKey = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY;
    if (envKey) {
        console.log("Using Environment Variable AI Config");
        return {
            name: "Env Var Config",
            provider: "Gemini", // Default to Gemini for env vars as per legacy
            model: "gemini-2.0-flash",
            apiUrl: "https://generativelanguage.googleapis.com/v1beta",
            apiKey: envKey,
            expireDate: "",
            isEnabled: true
        };
    }

    console.log("No AI Config Found (DB or Env)");
    return null;
}

// Helper: Safe JSON Parse
const safeParseJson = (text: string | undefined): any => {
    if (!text) return {};
    try {
        return JSON.parse(text);
    } catch (e) {
        try {
            // Try to extract JSON from markdown code blocks or raw text
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

// --- Gemini Implementation ---
async function callGemini(config: AiConfig, prompt: string, schema?: any) {
    const baseUrl = config.apiUrl || "https://generativelanguage.googleapis.com/v1beta";
    let modelName = config.model || 'gemini-2.0-flash';

    // --- Model Name Sanitization & Mapping ---
    // Fix common display name issues if they exist in DB (Legacy)
    if (modelName === "Gemini 2.0 Flash") modelName = "gemini-2.0-flash"; // Latest alias

    // Gemini 2.5 Family Mappings
    if (modelName === "Gemini 2.5 Flash") modelName = "gemini-2.5-flash";
    if (modelName === "Gemini 2.5 Pro") modelName = "gemini-2.5-pro";
    if (modelName === "Gemini 2.5 Flash Lite") modelName = "gemini-2.5-flash-lite";

    // Gemini 3 Family Mappings
    if (modelName === "Gemini 3 Pro" || modelName === "Gemini 3") modelName = "gemini-3-pro-preview";
    if (modelName === "Gemini 3 Flash") modelName = "gemini-3-flash-preview";

    // Handle loose/user-typed inputs
    if (modelName.includes("Gemini ")) {
        // Specific known fixes
        if (modelName.includes("Pro (Legacy)")) modelName = "gemini-1.5-pro";

        // Generic fallback: "Gemini 3.5 Turbo" -> "gemini-3.5-turbo"
        if (modelName.startsWith("Gemini ")) {
            modelName = modelName.toLowerCase().replace(/ /g, "-");
        }
    }
    // ------------------------------------------

    const url = `${baseUrl}/models/${modelName}:generateContent?key=${config.apiKey}`;

    const body: any = {
        contents: [{
            parts: [{ text: prompt }]
        }]
    };

    // Experimental: Add thinking config for Gemini 2.5+ models if detected
    // Based on user provided docs.
    if (modelName.includes("2.5") || modelName.includes("gemini-3")) {
        // Placeholder for thinking config. 
        // Currently assuming defaults (-1 dynamic) work without explicit param.
    }

    if (schema) {
        body.generationConfig = {
            response_mime_type: "application/json",
            response_schema: schema
        };
    }

    // Retry with backoff logic
    const retryCount = 5;
    for (let i = 0; i < retryCount; i++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                if (res.status === 503 || res.status === 429) {
                    // Backoff
                    const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
                    if (i < retryCount - 1) {
                        console.warn(`Gemini API ${res.status}. Retrying in ${waitTime}ms...`);
                        await new Promise(r => setTimeout(r, waitTime));
                        continue;
                    }
                }
                const errText = await res.text();
                console.error(`Gemini API Error details: ${errText}`);
                console.error("Payload:", JSON.stringify(body));
                throw new Error(`Gemini API Error: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            // Safety check for response structure
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Gemini returned no text content: " + JSON.stringify(data));
            }

            return text;
        } catch (e: any) {
            if (i === retryCount - 1) throw e;
            // Retry for network errors as well if needed, but mainly targeting 503/429
            if (e.message.includes("503") || e.message.includes("429")) {
                const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
                console.warn(`Gemini API Error. Retrying in ${waitTime}ms...`, e);
                await new Promise(r => setTimeout(r, waitTime));
            } else {
                throw e;
            }
        }
    }
    throw new Error("Gemini API Retry Failed");
}

// Chat implementation
async function chatGemini(config: AiConfig, messages: ChatMessage[]) {
    const baseUrl = config.apiUrl || "https://generativelanguage.googleapis.com/v1beta";
    let modelName = config.model || 'gemini-2.0-flash';

    // Same Mapping Logic as callGemini
    if (modelName === "Gemini 2.0 Flash") modelName = "gemini-2.0-flash";
    if (modelName === "Gemini 2.5 Flash") modelName = "gemini-2.5-flash";
    if (modelName === "Gemini 2.5 Pro") modelName = "gemini-2.5-pro";
    if (modelName === "Gemini 2.5 Flash Lite") modelName = "gemini-2.5-flash-lite";
    if (modelName === "Gemini 3 Pro" || modelName === "Gemini 3") modelName = "gemini-3-pro-preview";
    if (modelName === "Gemini 3 Flash") modelName = "gemini-3-flash-preview";

    if (modelName.includes("Gemini ")) {
        if (modelName.includes("Pro (Legacy)")) modelName = "gemini-1.5-pro";
        if (modelName.startsWith("Gemini ")) {
            modelName = modelName.toLowerCase().replace(/ /g, "-");
        }
    }

    const url = `${baseUrl}/models/${modelName}:generateContent?key=${config.apiKey}`;

    const contents = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
    }));

    const retryCount = 5;
    for (let i = 0; i < retryCount; i++) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents })
            });

            if (!res.ok) {
                if (res.status === 503 || res.status === 429) {
                    const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
                    if (i < retryCount - 1) {
                        console.warn(`Gemini Chat API ${res.status}. Retrying in ${waitTime}ms...`);
                        await new Promise(r => setTimeout(r, waitTime));
                        continue;
                    }
                }
                const errText = await res.text();
                throw new Error(`Gemini Chat API Error: ${res.status} - ${errText}`);
            }

            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) {
                throw new Error("Gemini returned no chat content: " + JSON.stringify(data));
            }
            return text;
        } catch (e: any) {
            if (i === retryCount - 1) throw e;
            if (e.message.includes("503") || e.message.includes("429")) {
                const waitTime = Math.pow(2, i) * 1000 + Math.random() * 500;
                console.warn(`Gemini Chat Error. Retrying in ${waitTime}ms...`);
                await new Promise(r => setTimeout(r, waitTime));
            } else {
                throw e;
            }
        }
    }
    throw new Error("Gemini Chat Retry Failed");
}


// --- ChatGPT Implementation (Basic Fetch) ---
async function callChatGpt(config: AiConfig, prompt: string, jsonMode: boolean = false) {
    const baseUrl = config.apiUrl || "https://api.openai.com/v1";
    const model = config.model || "gpt-4o";

    const body: any = {
        model: model,
        messages: [{ role: "user", content: prompt }],
    };

    if (jsonMode) {
        body.response_format = { type: "json_object" };
    }

    const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI API Error: ${res.status} - ${err}`);
    }

    const data = await res.json();
    return data.choices[0].message.content;
}

// --- Public Actions ---

export async function analyzeFullIndicator(name: string, desc: string) {
    const config = await getActiveAiConfig();
    if (!config) throw new Error("No active AI configuration found. Please configure AI settings.");

    const prompt = `
    指標名稱: ${name}
    功能描述: ${desc}
    
    請根據上述名稱與描述，為此醫療指標生成完整的 FHIR 運算步驟建議。
    
    【核心規則 - 必須嚴格遵守】
    1. **時間長度 (Duration)**: 當描述包含「住院超過24小時」、「滯留時間」、「長度」時，不可使用單純的 fhir_filter。
       - **必須**設定 valueType="calculated_field"。
       - action 通常為 "AND" (或第一步為 "BASE")。
       - path 寫數學公式： "Encounter.period.end - Encounter.period.start"
       - value 寫判斷式： "> 24 hours"
       - **未出院處理**: 若涉及「未出院」或「住院中」，請將 autoHandleNullEnd 屬性設為 true。
    
    2. **邏輯拆解**: 複雜條件請拆解。例如 "急診留觀 > 24h" = 
       - Step 1: Filter Encounter where class = 'EMER' (valueType='fhir_filter')
       - Step 2: AND Duration > 24h (valueType='calculated_field', autoHandleNullEnd=true)

    3. **回傳格式**:
    請務必回傳 JSON 格式，且包含以下三個屬性：
    1. exclusionSteps (排除邏輯)
    2. denominatorSteps (分母邏輯)
    3. numeratorSteps (分子邏輯)
    
    每個步驟物件的格式必須如下：
    {
      "action": "BASE/AND/OR/NOT/ADD/SUBTRACT/MULTIPLY/DIVIDE",
      "valueType": "fhir_filter/indicator_result/constant/calculated_field",
      "resourceType": "Patient/Observation/Condition/Procedure/Encounter/MedicationRequest",
      "path": "fhir_path 或 公式 (e.g. period.end - period.start)",
      "value": "compare_value (e.g. > 24 hours)",
      "notes": "必要的邏輯說明",
      "autoHandleNullEnd": boolean (true/false)
    }
    `;

    let rawText = "";

    if (config.provider === 'ChatGPT') {
        rawText = await callChatGpt(config, prompt, true);
    } else {
        // Default to Gemini or Custom
        const schema = {
            type: SchemaType.OBJECT,
            properties: {
                exclusionSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING }, autoHandleNullEnd: { type: SchemaType.BOOLEAN } }, required: ["action", "valueType", "path", "value"] } },
                denominatorSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING }, autoHandleNullEnd: { type: SchemaType.BOOLEAN } }, required: ["action", "valueType", "path", "value"] } },
                numeratorSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.OBJECT, properties: { action: { type: SchemaType.STRING }, valueType: { type: SchemaType.STRING }, resourceType: { type: SchemaType.STRING }, path: { type: SchemaType.STRING }, value: { type: SchemaType.STRING }, notes: { type: SchemaType.STRING }, autoHandleNullEnd: { type: SchemaType.BOOLEAN } }, required: ["action", "valueType", "path", "value"] } }
            }
        };
        rawText = await callGemini(config, prompt, schema);
    }

    return safeParseJson(rawText);
}

export async function analyzeSectionDefinition(
    indicatorName: string,
    indicatorDesc: string,
    sectionDraft: string,
    targetType: 'numerator' | 'denominator' | 'exclusion'
) {
    const config = await getActiveAiConfig();
    if (!config) throw new Error("No active AI configuration found.");

    const prompt = `
    指標名稱: ${indicatorName}
    目前描述: ${sectionDraft}
    目標區塊: ${targetType === 'numerator' ? '分子' : targetType === 'denominator' ? '分母' : '排除'}
    
    請將用戶的自然語言描述拆解為一系列的「運算步驟(CalculationStep)」。
    特別注意：
    1. 處理時間區間 (Duration/Period)：若描述包含「超過 X 小時」、「X 天內」，請設定 valueType="calculated_field"。
    2. 未出院邏輯：若語意包含「未出院」或「住院中」，請設定 autoHandleNullEnd = true。
    3. 邏輯運算 (Logic)：若有 "OR" 或 "AND" 組合，請透過多個步驟或 notes 表現。
    4. **Path 必填**：若 valueType 為 fhir_filter，請務必填寫 FHIR 路徑 (例如 class, status, code.coding.code)。不可留空。
    
    回傳 JSON 格式，包含 "steps" 陣列，每個元素包含：
    action (e.g. BASE, AND, OR), 
    valueType (e.g. fhir_filter, constant, calculated_field), 
    resourceType, 
    path, 
    operator, 
    value, 
    notes,
    autoHandleNullEnd (boolean)
    `;

    let rawText = "";
    if (config.provider === 'ChatGPT') {
        rawText = await callChatGpt(config, prompt, true);
    } else {
        const schema = {
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
                            notes: { type: SchemaType.STRING },
                            autoHandleNullEnd: { type: SchemaType.BOOLEAN }
                        },
                        required: ["action", "valueType", "path", "value", "notes"]
                    }
                }
            },
            required: ["steps"]
        };
        rawText = await callGemini(config, prompt, schema);
    }

    return safeParseJson(rawText);
}

export async function getAiFieldSuggestions(
    type: 'path' | 'value',
    context: {
        indicatorName: string;
        indicatorDesc: string;
        resourceType: string;
        path?: string;
    }
) {
    const config = await getActiveAiConfig();
    if (!config) return [];

    const prompt = type === 'path'
        ? `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 資源中，請建議 5 個最相關的 JSON Paths。請提供 FHIR 規格路徑（value）與對應的中文標籤（label）。回傳 JSON { "suggestions": [{value, label}] }`
        : `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 的路徑 "${context.path}" 下，請建議 5 個臨床常用的代碼 or 數值比對值。請提供代碼（value）與中文說明標籤（label）。回傳 JSON { "suggestions": [{value, label}] }`;

    let rawText = "";
    if (config.provider === 'ChatGPT') {
        rawText = await callChatGpt(config, prompt, true);
    } else {
        const schema = {
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
        };
        rawText = await callGemini(config, prompt, schema);
    }

    const data = safeParseJson(rawText);
    return data.suggestions || [];
}

export async function chatWithAi(messages: ChatMessage[]) {
    const config = await getActiveAiConfig();
    if (!config) return { text: "AI 未設定或未啟用。" };

    try {
        let text = "";
        if (config.provider === 'ChatGPT') {
            // Convert messages for ChatGPT
            // System prompt injection if needed
            const msgs = [
                { role: "system", content: "你是一位卓越的醫療品質指標分析師與 FHIR 專家。請務必使用「繁體中文」回答。" },
                ...messages
            ];
            // callChatGpt expects prompt string, need to refactor helper to accept messages array or just use raw fetch here
            const baseUrl = config.apiUrl || "https://api.openai.com/v1";
            const model = config.model || "gpt-4o";

            const res = await fetch(`${baseUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    model: model,
                    messages: msgs
                })
            });
            const data = await res.json();
            text = data.choices?.[0]?.message?.content || "Error";

        } else {
            text = await chatGemini(config, messages);
        }
        return { text };
    } catch (e: any) {
        console.error("Chat Error:", e);
        return { text: "AI 服務暫時無法使用: " + e.message };
    }
}
