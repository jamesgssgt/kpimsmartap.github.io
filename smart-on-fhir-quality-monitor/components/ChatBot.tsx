
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, BrainCircuit, Image as ImageIcon, X } from 'lucide-react';
import { ChatMessage } from '../types';
import { chatWithGemini, analyzeMedicalImage } from '../services/gemini';

export const ChatBot: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: "您好！我是您的 Smart-on-FHIR 數據專家。我可以協助您定義品質指標、解釋 FHIR 路徑規範，或是分析醫療報告圖片來建議資料對應方案。有什麼我可以幫您的嗎？" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && !attachedImage) || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setInput('');
    setIsLoading(true);

    try {
      let responseText = "";
      if (attachedImage) {
        responseText = await analyzeMedicalImage(attachedImage, input || "請分析此醫療文件，並建議如何將其資料對應到 FHIR 資源。");
        setAttachedImage(null);
      } else {
        const res = await chatWithGemini(currentMessages, useThinking);
        responseText = res.text;
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: "抱歉，處理您的請求時發生錯誤，請稍後再試。" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        setAttachedImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="flex flex-col h-[640px] bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden ring-1 ring-slate-200/50">
      <div className="p-6 bg-indigo-600 text-white flex justify-between items-center shrink-0 shadow-lg relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
            <Bot size={24} />
          </div>
          <div>
            <h3 className="font-bold text-sm tracking-tight">FHIR AI 專家</h3>
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-indigo-100">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"></span>
              Gemini 3 Pro 在線
            </div>
          </div>
        </div>
        <button 
          onClick={() => setUseThinking(!useThinking)}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-black transition-all duration-300 ${useThinking ? 'bg-white text-indigo-600 shadow-md scale-105' : 'bg-indigo-500/40 text-white hover:bg-indigo-500'}`}
        >
          <BrainCircuit size={14} />
          {useThinking ? '深度思考模式 ON' : '深度思考'}
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/80">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 rounded-tl-none border border-slate-100'}`}>
              <div className="flex items-center gap-2 mb-2 opacity-60 text-[10px] font-black uppercase tracking-widest">
                {m.role === 'user' ? <User size={12} /> : <Bot size={12} />}
                {m.role === 'user' ? '您' : 'AI 專家'}
              </div>
              <div className="whitespace-pre-wrap text-sm leading-relaxed font-medium">
                {m.content}
              </div>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm flex items-center gap-3">
              <Loader2 className="animate-spin text-indigo-600" size={18} />
              <span className="text-sm text-slate-500 font-bold italic tracking-wide">正在深度思考 FHIR 邏輯...</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border-t border-slate-100 shrink-0">
        {attachedImage && (
          <div className="mb-3 relative inline-block group">
            <img src={`data:image/jpeg;base64,${attachedImage}`} alt="preview" className="h-20 w-20 object-cover rounded-2xl border-2 border-indigo-100 shadow-sm transition group-hover:opacity-75" />
            <button onClick={() => setAttachedImage(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition">
              <X size={12} />
            </button>
          </div>
        )}
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-[1.5rem] border border-slate-100 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-2xl transition-all"
            title="上傳圖片或報告"
          >
            <ImageIcon size={22} />
          </button>
          <input 
            type="text" 
            placeholder="詢問 FHIR 路徑或指標定義..." 
            className="flex-1 bg-transparent border-none px-2 py-2 text-sm focus:outline-none placeholder:text-slate-400 font-medium"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button 
            onClick={handleSend}
            disabled={isLoading}
            className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50 active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
