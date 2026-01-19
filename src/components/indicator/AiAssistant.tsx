
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader2, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { chatWithAi } from '@/app/actions/ai';
import { ChatMessage } from './types';

export const AiAssistant: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'assistant', content: '你好！我是你的醫療品質指標 AI 助手。我可以協助你：\n1. 解釋 FHIR 資源定義\n2. 建議指標運算邏輯\n3. 協助編寫臨床代碼\n\n請問有什麼我可以幫你的嗎？' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        if (isOpen) scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // Build conversation history for context
            const history = messages.slice(-10); // Keep last 10 messages for context

            // Convert to simple format for server action if needed, or cast types
            // The server action expects basic ChatMessage. 
            // We strip 'thinking' or other extra fields if they exist to be safe, though TS overlap handles most.
            const apiMessages = [...history, userMsg].map(m => ({ role: m.role, content: m.content }));

            const response = await chatWithAi(apiMessages);

            const aiMsg: ChatMessage = {
                role: 'assistant',
                content: response.text,
                // thinking: response.thinking // Server action doesn't return thinking yet
            };
            setMessages(prev => [...prev, aiMsg]);
        } catch (error) {
            setMessages(prev => [...prev, { role: 'assistant', content: '抱歉，我現在無法回答，請稍後再試。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-8 right-8 w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-50 group border-4 border-white"
            >
                <Bot size={32} className="group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 rounded-full border-2 border-white animate-pulse"></span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-8 right-8 bg-white rounded-3xl shadow-2xl z-50 flex flex-col transition-all duration-300 border-2 border-slate-100 overflow-hidden ${isExpanded ? 'w-[800px] h-[80vh]' : 'w-[400px] h-[600px]'}`}>
            {/* Header */}
            <div className="bg-slate-900 p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-inner">
                        <Bot size={24} />
                    </div>
                    <div>
                        <h3 className="font-black text-white text-lg leading-tight">AI 智慧助手</h3>
                        <p className="text-indigo-300 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                            <Sparkles size={10} /> Powered by Gemini
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                        {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button onClick={() => setIsOpen(false)} className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-white/10">
                        <X size={18} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-2 ${msg.role === 'user' ? 'bg-slate-200 border-slate-300 text-slate-600' : 'bg-indigo-100 border-indigo-200 text-indigo-600'}`}>
                            {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>
                        <div className={`max-w-[80%] space-y-1`}>
                            {msg.thinking && (
                                <div className="text-[10px] bg-slate-100 text-slate-500 p-2 rounded-lg italic border border-slate-200 mb-1">
                                    <span className="font-bold block not-italic mb-1">Thinking Process:</span>
                                    {msg.thinking}
                                </div>
                            )}
                            <div className={`p-4 rounded-2xl text-sm font-medium leading-relaxed whitespace-pre-wrap shadow-sm ${msg.role === 'user'
                                ? 'bg-slate-900 text-white rounded-tr-none'
                                : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none'
                                }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 border-2 border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
                            <Bot size={16} />
                        </div>
                        <div className="bg-white p-4 rounded-2xl rounded-tl-none border border-slate-200 shadow-sm flex items-center gap-2">
                            <Loader2 size={16} className="animate-spin text-indigo-600" />
                            <span className="text-xs font-bold text-slate-400">正在思考中...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="輸入訊息..."
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl pl-4 pr-12 py-3 text-sm font-bold text-slate-700 focus:border-indigo-500 focus:bg-white outline-none resize-none h-[52px] custom-scrollbar"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 top-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-all shadow-sm"
                    >
                        <Send size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};
