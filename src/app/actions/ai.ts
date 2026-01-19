"use server";

import { getSystemSettings } from "@/app/actions/system";
import { parseAiConfig, AiConfig } from "@/types/system";
import { generateText, generateObject } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// export const maxDuration = 60; // Moved to page config

// Common Types
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface AiSuggestion {
    value: string;
    label: string;
}

// Helper: Get Active Config
async function getActiveAiConfig(): Promise<AiConfig | null> {
    // console.log("Resolving AI Config...");
    try {
        const res = await getSystemSettings(1); // 1 = AI Config
        if (res.success && res.data) {
            // Find the first enabled config
            const enabledSetting = res.data.find(s => {
                const cfg = parseAiConfig(s.SysValue);
                return cfg && cfg.isEnabled;
            });

            if (enabledSetting) {
                // console.log("Using Database AI Config:", enabledSetting.SysName);
                return parseAiConfig(enabledSetting.SysValue);
            }
        }
    } catch (e) {
        console.warn("Failed to fetch system settings, falling back to env:", e);
    }

    // Fallback to Environment Variables
    const envKey = process.env.API_KEY || process.env.NEXT_PUBLIC_API_KEY;
    if (envKey) {
        // console.log("Using Environment Variable AI Config");
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

    // console.log("No AI Config Found (DB or Env)");
    return null;
}

// Helper: Create Data Model Instance from Config
const createModel = (config: AiConfig) => {
    if (config.provider === 'ChatGPT') {
        const openai = createOpenAI({
            apiKey: config.apiKey,
            baseURL: config.apiUrl || "https://api.openai.com/v1",
        });
        return openai(config.model || 'gpt-4o');
    } else {
        // Default to Gemini
        const google = createGoogleGenerativeAI({
            apiKey: config.apiKey,
            baseURL: config.apiUrl || "https://generativelanguage.googleapis.com/v1beta",
        });

        let modelName = config.model || 'gemini-2.0-flash';

        // Model Name Sanitization
        if (modelName === "Gemini 2.0 Flash") modelName = "gemini-2.0-flash";
        if (modelName === "Gemini 2.5 Flash") modelName = "gemini-2.5-flash";
        if (modelName === "Gemini 2.5 Pro") modelName = "gemini-2.5-pro";
        if (modelName === "Gemini 2.5 Flash Lite") modelName = "gemini-2.5-flash-lite";
        if (modelName === "Gemini 3 Pro" || modelName === "Gemini 3") modelName = "gemini-3-pro-preview";
        if (modelName === "Gemini 3 Flash") modelName = "gemini-3-flash-preview";

        if (modelName.includes("Pro (Legacy)")) modelName = "gemini-1.5-pro";

        if (modelName.startsWith("Gemini ")) {
            modelName = modelName.toLowerCase().replace(/ /g, "-");
        }

        return google(modelName);
    }
};


// --- Public Actions ---

export async function analyzeFullIndicator(name: string, desc: string) {
    const config = await getActiveAiConfig();
    if (!config) throw new Error("No active AI configuration found. Please configure AI settings.");

    // Safety check for API Key before calling SDK to give clear error
    if (!config.apiKey) {
        throw new Error(`Missing API Key for provider ${config.provider}`);
    }

    try {
        const model = createModel(config);

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
        `;

        const stepSchema = z.object({
            action: z.string(),
            valueType: z.string(),
            resourceType: z.string().optional(),
            path: z.string().optional(),
            value: z.string().optional(),
            notes: z.string().optional(),
            autoHandleNullEnd: z.boolean().optional()
        });

        const result = await generateObject({
            model: model,
            prompt: prompt,
            schema: z.object({
                exclusionSteps: z.array(stepSchema),
                denominatorSteps: z.array(stepSchema),
                numeratorSteps: z.array(stepSchema)
            })
        });

        return result.object;

    } catch (error: any) {
        console.error("AI Analysis Failed:", error);
        if (error.cause) console.error("Error Cause:", error.cause);
        // SDK errors usually are quite descriptive
        throw new Error(`AI Service Error: ${error.message || String(error)}`);
    }
}

export async function analyzeSectionDefinition(
    indicatorName: string,
    indicatorDesc: string,
    sectionDraft: string,
    targetType: 'numerator' | 'denominator' | 'exclusion'
) {
    const config = await getActiveAiConfig();
    if (!config) throw new Error("No active AI configuration found.");

    // Safety check for API Key
    if (!config.apiKey) {
        console.warn("AI Config found but missing API Key", config);
        throw new Error(`Missing API Key for provider ${config.provider}. Please check settings.`);
    }

    try {
        const model = createModel(config);

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
        `;

        const stepSchema = z.object({
            action: z.string(),
            valueType: z.string(),
            resourceType: z.string().optional(),
            path: z.string().optional(),
            operator: z.string().optional(),
            value: z.string().optional(),
            notes: z.string().optional(),
            autoHandleNullEnd: z.boolean().optional()
        });

        const result = await generateObject({
            model: model,
            prompt: prompt,
            schema: z.object({
                steps: z.array(stepSchema)
            })
        });

        return result.object;

    } catch (error: any) {
        console.error("AI Analysis Failed:", error);

        // Detailed Logging for Debugging
        console.log("Config Debug:", {
            provider: config.provider,
            model: config.model,
            hasKey: !!config.apiKey,
            apiUrl: config.apiUrl
        });

        if (error.cause) console.error("Error Cause:", error.cause);

        throw new Error(`AI Service Error: ${error.message || String(error)}`);
    }
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

    try {
        const model = createModel(config);

        const prompt = type === 'path'
            ? `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 資源中，請建議 5 個最相關的 JSON Paths。請提供 FHIR 規格路徑（value）與對應的中文標籤（label）。`
            : `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 的路徑 "${context.path}" 下，請建議 5 個臨床常用的代碼 or 數值比對值。請提供代碼（value）與中文說明標籤（label）。`;

        const result = await generateObject({
            model: model,
            prompt: prompt,
            schema: z.object({
                suggestions: z.array(z.object({
                    value: z.string(),
                    label: z.string()
                }))
            })
        });

        return result.object.suggestions;

    } catch (error) {
        console.error("AI Suggestion Failed:", error);
        return [];
    }
}

export async function chatWithAi(messages: ChatMessage[]) {
    const config = await getActiveAiConfig();
    if (!config) return { text: "AI 未設定或未啟用。" };

    try {
        const model = createModel(config);

        // Filter out system messages if any, and convert strictly to CoreMessage format if needed, 
        // but SDK generateText handles standard message arrays well.
        // We'll add a SYSTEM prompt via the 'system' parameter of generateText

        const systemMessage = "你是一位卓越的醫療品質指標分析師與 FHIR 專家。請務必使用「繁體中文」回答。";

        const result = await generateText({
            model: model,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
            system: systemMessage
        });

        return { text: result.text };

    } catch (error: any) {
        console.error("Chat Error:", error);
        return { text: "AI 服務暫時無法使用: " + error.message };
    }
}
