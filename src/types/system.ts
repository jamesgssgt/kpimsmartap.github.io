
export interface SystemSetting {
    SysCode: string;
    SysName: string;
    SysType: number; // e.g., 1 for AI Config
    SysValue: string; // JSON string or raw value
    Createddate?: string;
    Modifieddate?: string;
}

export interface AiConfig {
    name: string;
    apiUrl: string;
    apiKey: string;
    expireDate: string;
    isEnabled: boolean;
    provider?: 'Gemini' | 'ChatGPT' | 'Custom';
    model?: string;
}

// Helper to parse/stringify AI Config
export const parseAiConfig = (sysValue: string): AiConfig | null => {
    try {
        return JSON.parse(sysValue);
    } catch (e) {
        return null;
    }
};

export const stringifyAiConfig = (config: AiConfig): string => {
    return JSON.stringify(config);
};
