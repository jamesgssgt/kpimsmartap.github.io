
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ChatMessage, CalculationStep } from "../types";

const MODEL_NAME = 'gemini-3-pro-preview';

export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
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

export const chatWithGemini = async (
  messages: ChatMessage[],
  isThinking: boolean = false
): Promise<{ text: string; thinking?: string }> => {
  const ai = getGeminiClient();
  const contents = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'model',
    parts: [{ text: m.content }]
  }));

  const config: any = {
    systemInstruction: `你是一位卓越的醫療品質指標分析師與 FHIR 專家。
你的任務是協助醫護人員定義醫療品質指標。
1. 請務必使用「繁體中文」回答。
2. 支持「運算步驟鏈」(Calculation Chain)：用戶可以組合 FHIR 過濾器、其它指標的結果與常數。
3. 運算動作包含：BASE (起始), AND (集合交集), OR (集合聯集), NOT (集合排除), ADD (加), SUBTRACT (減), MULTIPLY (乘), DIVIDE (除)。
4. FHIR 資源對應需精確。`,
  };

  if (isThinking) {
    config.thinkingConfig = { thinkingBudget: 32768 };
  }

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents,
    config,
  });

  return { text: response.text || "抱歉，無法產生回應。" };
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
  const ai = getGeminiClient();
  const prompt = type === 'path' 
    ? `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 資源中，請建議 5 個最相關的 JSON Paths。請提供 FHIR 規格路徑與對應的中文標籤。`
    : `指標名稱: ${context.indicatorName} (${context.indicatorDesc})。在 FHIR ${context.resourceType} 的路徑 "${context.path}" 下，請建議 5 個臨床常用的代碼 or 數值比對值。請提供代碼與中文說明標籤。`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  value: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ["value", "label"]
              }
            }
          },
          required: ["suggestions"]
        }
      }
    });
    const data = safeParseJson(response.text);
    return data.suggestions || [];
  } catch (error) {
    console.error("AI Suggestion Error:", error);
    return [];
  }
};

export const analyzeFullIndicator = async (
  name: string,
  desc: string
): Promise<any> => {
  const ai = getGeminiClient();
  const prompt = `
  指標名稱: ${name}
  功能描述: ${desc}
  
  請根據上述名稱與描述，為此醫療指標生成完整的 FHIR 運算步驟建議。
  請分別提供：
  1. exclusionSteps (排除邏輯)
  2. denominatorSteps (分母邏輯)
  3. numeratorSteps (分子邏輯)
  
  運算步驟必須符合此格式：
  {
    "action": "BASE/AND/OR/NOT/ADD/SUBTRACT/MULTIPLY/DIVIDE",
    "valueType": "fhir_filter/indicator_result/constant",
    "resourceType": "Patient/Observation/Condition/Procedure/Encounter/MedicationRequest",
    "path": "fhir_path",
    "value": "compare_value",
    "notes": "中文備註"
  }
  
  請輸出 JSON。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            exclusionSteps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { action: {type:Type.STRING}, valueType:{type:Type.STRING}, resourceType:{type:Type.STRING}, path:{type:Type.STRING}, value:{type:Type.STRING}, notes:{type:Type.STRING} } } },
            denominatorSteps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { action: {type:Type.STRING}, valueType:{type:Type.STRING}, resourceType:{type:Type.STRING}, path:{type:Type.STRING}, value:{type:Type.STRING}, notes:{type:Type.STRING} } } },
            numeratorSteps: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { action: {type:Type.STRING}, valueType:{type:Type.STRING}, resourceType:{type:Type.STRING}, path:{type:Type.STRING}, value:{type:Type.STRING}, notes:{type:Type.STRING} } } }
          }
        }
      }
    });
    return safeParseJson(response.text);
  } catch (e) {
    return { exclusionSteps: [], denominatorSteps: [], numeratorSteps: [] };
  }
};

export const analyzeSectionDefinition = async (
  indicatorName: string,
  indicatorDesc: string,
  sectionDraft: string,
  targetType: 'numerator' | 'denominator' | 'exclusion'
): Promise<any> => {
  const ai = getGeminiClient();
  const prompt = `
  指標名稱: ${indicatorName}
  目前描述: ${sectionDraft}
  目標區塊: ${targetType === 'numerator' ? '分子' : targetType === 'denominator' ? '分母' : '排除'}
  
  請將用戶的自然語言描述拆解為一系列的「運算步驟 (CalculationStep)」。
  請輸出 JSON 格式。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  action: { type: Type.STRING },
                  valueType: { type: Type.STRING },
                  resourceType: { type: Type.STRING },
                  path: { type: Type.STRING },
                  operator: { type: Type.STRING },
                  value: { type: Type.STRING },
                  notes: { type: Type.STRING }
                },
                required: ["action", "valueType", "value", "notes"]
              }
            }
          },
          required: ["steps"]
        }
      }
    });

    return safeParseJson(response.text);
  } catch (error) {
    console.error(error);
    return { steps: [] };
  }
};

export const suggestFhirMappings = async (
  indicatorName: string, 
  description: string
): Promise<any> => {
  const ai = getGeminiClient();
  const prompt = `分析指標：${indicatorName} (${description}) 並給予完整的運算鏈建議。`;
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { responseMimeType: "application/json" }
  });
  return safeParseJson(response.text);
};

export const analyzeMedicalImage = async (
  base64Image: string,
  prompt: string
): Promise<string> => {
  const ai = getGeminiClient();
  const imagePart = { inlineData: { mimeType: 'image/jpeg', data: base64Image } };
  const textPart = { text: `請分析此醫療圖片並建議 FHIR 映射方案：${prompt}` };
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: [imagePart, textPart] },
  });
  return response.text || "無法分析。";
};
