
import React, { useState } from 'react';
import { 
  Globe, Lock, ShieldCheck, Database, Save, RefreshCw, 
  AlertCircle, CheckCircle2, Server, Key, UserCheck, 
  Terminal, Activity, Clock, ChevronDown, ListFilter 
} from 'lucide-react';
import { FhirServerConfig } from '../types';

interface ApiLog {
  id: string;
  timestamp: string;
  method: 'GET' | 'POST';
  endpoint: string;
  status: number;
  statusText: string;
  duration: number;
}

interface Props {
  onSave: (config: FhirServerConfig) => void;
  initialConfig?: FhirServerConfig;
}

export const FhirServerSetting: React.FC<Props> = ({ onSave, initialConfig }) => {
  const [config, setConfig] = useState<FhirServerConfig>(initialConfig || {
    baseUrl: 'https://fhir.hospital-system.local/r4',
    authType: 'apiKey',
    apiKey: '',
    workspaceName: '主要臨床數據中心',
  });

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [logs, setLogs] = useState<ApiLog[]>([
    { id: '1', timestamp: new Date(Date.now() - 3600000).toISOString(), method: 'GET', endpoint: '/metadata', status: 200, statusText: 'OK', duration: 124 },
    { id: '2', timestamp: new Date(Date.now() - 7200000).toISOString(), method: 'GET', endpoint: '/Patient?_count=1', status: 200, statusText: 'OK', duration: 450 },
    { id: '3', timestamp: new Date(Date.now() - 10800000).toISOString(), method: 'POST', endpoint: '/Observation', status: 401, statusText: 'Unauthorized', duration: 89 },
  ]);

  const handleTestConnection = async () => {
    setTestStatus('loading');
    const startTime = Date.now();
    
    // 模擬連線測試
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const isSuccess = Math.random() > 0.1;
    const duration = Date.now() - startTime;
    
    const newLog: ApiLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: 'GET',
      endpoint: '/metadata',
      status: isSuccess ? 200 : 503,
      statusText: isSuccess ? 'OK' : 'Service Unavailable',
      duration
    };

    setLogs(prev => [newLog, ...prev]);
    setTestStatus(isSuccess ? 'success' : 'error');
  };

  const handleSave = () => {
    onSave(config);
    alert("FHIR Server 配置已成功儲存並套用於全院監測引擎。");
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter">HIS 資料介接配置</h2>
          <p className="text-slate-500 mt-3 font-medium text-lg">設定醫院 HIS 系統的 FHIR API 連線節點與驗證機制。</p>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={handleTestConnection}
            disabled={testStatus === 'loading'}
            className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${testStatus === 'loading' ? 'bg-slate-100 text-slate-400' : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-600 hover:text-indigo-600 shadow-sm'}`}
          >
            {testStatus === 'loading' ? <RefreshCw size={18} className="animate-spin" /> : <Server size={18} />}
            測試連線
          </button>
          <button 
            onClick={handleSave}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition active:scale-95"
          >
            <Save size={18} />
            儲存配置
          </button>
        </div>
      </div>

      {testStatus !== 'idle' && (
        <div className={`p-5 rounded-[2.5rem] border flex items-center gap-4 animate-in zoom-in-95 duration-300 ${testStatus === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 shadow-emerald-100/50' : testStatus === 'error' ? 'bg-red-50 border-red-100 text-red-700 shadow-red-100/50' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
          <div className={`p-3 rounded-2xl ${testStatus === 'success' ? 'bg-emerald-100' : testStatus === 'error' ? 'bg-red-100' : 'bg-slate-200'}`}>
            {testStatus === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          </div>
          <div className="flex-1">
            <p className="font-black text-sm">
              {testStatus === 'success' ? '連線測試成功！已成功與目標 FHIR Server 握手同步。' : testStatus === 'error' ? '連線失敗：請檢查網路端點或驗證金鑰是否過期。' : '正在嘗試建立安全加密連線...'}
            </p>
            <div className="flex items-center gap-3 mt-1 text-[10px] font-bold uppercase tracking-widest opacity-70">
              <span className="flex items-center gap-1"><Globe size={10} /> {config.baseUrl}</span>
              <span className="w-1 h-1 bg-current rounded-full"></span>
              <span className="flex items-center gap-1"><Clock size={10} /> 延遲: {logs[0]?.duration}ms</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Connection Settings */}
        <div className="space-y-8">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shadow-sm">
                <Globe size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800">基礎連線設定</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">工作空間名稱</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  value={config.workspaceName}
                  onChange={(e) => setConfig({...config, workspaceName: e.target.value})}
                  placeholder="例如：主要臨床數據中心"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">FHIR Base URL (R4)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition"
                  value={config.baseUrl}
                  onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                  placeholder="https://fhir.example.com/r4"
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                <Lock size={24} />
              </div>
              <h3 className="text-xl font-black text-slate-800">安全性與驗證</h3>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest ml-1">驗證模式</label>
                <select 
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer transition"
                  value={config.authType}
                  onChange={(e) => setConfig({...config, authType: e.target.value as any})}
                >
                  <option value="none">無驗證 (No Auth)</option>
                  <option value="apiKey">API Key / X-API-KEY</option>
                  <option value="basic">Basic Auth (帳號密碼)</option>
                  <option value="oauth2">OAuth 2.0 (Bearer Token)</option>
                </select>
              </div>

              {config.authType === 'apiKey' && (
                <div className="space-y-2 animate-in slide-in-from-top-4 duration-300">
                  <label className="flex items-center gap-2 text-[11px] font-black text-indigo-600 uppercase tracking-widest ml-1">
                    <Key size={12} /> API Key
                  </label>
                  <input 
                    type="password" 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition"
                    value={config.apiKey}
                    onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                    placeholder="輸入授權金鑰..."
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* API Logs Section */}
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col h-full overflow-hidden">
          <div className="flex justify-between items-center mb-8 shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-md">
                <Terminal size={22} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">近期介接紀錄</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">FHIR API Activity Log</p>
              </div>
            </div>
            <button className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all">
              <ListFilter size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
            {logs.map((log) => (
              <div key={log.id} className="group p-5 rounded-[2rem] border border-slate-50 hover:border-indigo-100 hover:bg-slate-50/50 transition-all">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${log.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'}`}>
                      {log.method}
                    </span>
                    <span className={`text-[11px] font-bold ${log.status >= 400 ? 'text-red-500' : 'text-emerald-600'}`}>
                      {log.status} {log.statusText}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-400 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <p className="text-xs font-mono font-bold text-slate-600 truncate bg-white/50 p-2 rounded-xl border border-slate-100 group-hover:border-indigo-50 transition-colors">
                  {log.endpoint}
                </p>
                <div className="flex justify-between items-center mt-3">
                  <div className="flex items-center gap-1.5 text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                    <Activity size={10} /> {log.duration}ms 回應延遲
                  </div>
                  <button className="text-[10px] font-black text-indigo-500 hover:underline opacity-0 group-hover:opacity-100 transition-all">
                    詳細封包
                  </button>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                <Terminal size={48} className="opacity-10 mb-4" />
                <p className="font-bold">尚無活動紀錄</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-indigo-900 rounded-[4rem] p-12 text-white flex flex-col md:flex-row items-center gap-10 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 opacity-10 translate-x-10 translate-y--10">
          <Database size={240} />
        </div>
        <div className="flex-1 relative z-10">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck size={32} className="text-indigo-300" />
            <span className="font-black text-indigo-200 tracking-widest uppercase text-sm">安全合規性保證</span>
          </div>
          <h4 className="text-3xl font-black mb-4 tracking-tight">與醫院 HIS 系統深度集成</h4>
          <p className="text-indigo-200 font-medium leading-relaxed max-w-xl">
            本系統採用 FHIR 標準規範介接，所有的敏感驗證資訊皆經過加密處理，確保臨床指標數據在傳輸過程中的安全性與隱私性。
          </p>
        </div>
        <div className="shrink-0 flex flex-col gap-4 relative z-10">
          <div className="bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <UserCheck size={20} className="text-white" />
              </div>
              <div>
                <p className="text-xs font-bold text-indigo-100">當前存取權限</p>
                <p className="text-lg font-black">管理員授權</p>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest text-center">最後更新：今天 {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>
    </div>
  );
};
