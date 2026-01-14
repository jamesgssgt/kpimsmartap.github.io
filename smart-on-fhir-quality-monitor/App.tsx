
import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { IndicatorForm } from './components/IndicatorForm';
import { IndicatorList } from './components/IndicatorList';
import { ChatBot } from './components/ChatBot';
import { FhirServerSetting } from './components/FhirServerSetting';
import { QualityIndicator, FhirServerConfig } from './types';
import { 
  Plus, PieChart, MessageSquare, ShieldCheck, 
  Database, Settings, LogOut, Search, Bell, List 
} from 'lucide-react';

const INITIAL_INDICATORS: QualityIndicator[] = [
  {
    id: '1',
    name: '糖尿病 HbA1c 控制率',
    description: '測量期間內 HbA1c < 7.0% 的糖尿病患者百分比。',
    exclusionSteps: [{ id: 'ex1', action: 'BASE', valueType: 'fhir_filter', resourceType: 'Encounter', path: 'class.code', operator: 'equals', value: 'EMER', notes: '排除急診' }],
    denominatorSteps: [{ id: 'den1', action: 'BASE', valueType: 'fhir_filter', resourceType: 'Condition', path: 'code.coding.code', operator: 'equals', value: 'E11.9', notes: '診斷為糖尿病' }],
    numeratorSteps: [{ id: 'num1', action: 'BASE', valueType: 'fhir_filter', resourceType: 'Observation', path: 'valueQuantity.value', operator: 'lessThan', value: '7', notes: 'HbA1c < 7' }],
    frequency: '每月'
  },
  {
    id: '2',
    name: '高血壓 management 達成率',
    description: '血壓維持在 140/90 mmHg 以下的患者比例。',
    exclusionSteps: [],
    denominatorSteps: [{ id: 'den2', action: 'BASE', valueType: 'fhir_filter', resourceType: 'Condition', path: 'code.coding.code', operator: 'equals', value: 'I10', notes: '診斷為高血壓' }],
    numeratorSteps: [{ id: 'num2', action: 'BASE', valueType: 'fhir_filter', resourceType: 'Observation', path: 'component.valueQuantity.value', operator: 'lessThan', value: '140', notes: '收縮壓正常' }],
    frequency: '每月'
  }
];

const App: React.FC = () => {
  const [indicators, setIndicators] = useState<QualityIndicator[]>(INITIAL_INDICATORS);
  const [view, setView] = useState<'dashboard' | 'builder' | 'indicator-list' | 'fhir-settings'>('dashboard');
  const [editingIndicator, setEditingIndicator] = useState<QualityIndicator | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [fhirConfig, setFhirConfig] = useState<FhirServerConfig | undefined>();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSaveIndicator = (updatedIndicator: QualityIndicator) => {
    const exists = indicators.some(ind => ind.id === updatedIndicator.id);
    if (exists) {
      setIndicators(indicators.map(ind => ind.id === updatedIndicator.id ? updatedIndicator : ind));
    } else {
      setIndicators([...indicators, updatedIndicator]);
    }
    setView('indicator-list');
    setEditingIndicator(null);
  };

  const handleEditIndicator = (indicator: QualityIndicator) => {
    setEditingIndicator(indicator);
    setView('builder');
  };

  const handleDeleteIndicator = (id: string) => {
    setIndicators(indicators.filter(ind => ind.id !== id));
  };

  const handleCloneIndicator = (indicator: QualityIndicator) => {
    const cloned = {
      ...indicator,
      id: Math.random().toString(36).substr(2, 9),
      name: `${indicator.name} (複製)`
    };
    setIndicators([...indicators, cloned]);
  };

  const handleCreateNew = () => {
    setEditingIndicator(null);
    setView('builder');
  };

  const getHeaderTitle = () => {
    switch (view) {
      case 'dashboard': return '監控儀表板';
      case 'indicator-list': return '指標中心';
      case 'builder': return '指標運算定義';
      case 'fhir-settings': return 'FHIR 介接設定';
      default: return '系統管理';
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      <aside className="w-72 bg-slate-900 text-slate-400 flex flex-col shrink-0 transition-all">
        <div className="p-8 flex items-center gap-3 text-white border-b border-slate-800/50">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
            <ShieldCheck size={24} className="text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">SmartFHIR</h1>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">指標運算引擎</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition ${view === 'dashboard' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50'}`}>
            <PieChart size={20} /> 監控儀表板
          </button>
          
          <div className="pt-6 pb-2 text-[11px] font-bold text-slate-600 uppercase px-6 tracking-widest">指標管理</div>
          <button onClick={() => setView('indicator-list')} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition ${view === 'indicator-list' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50'}`}>
            <List size={20} /> 指標中心
          </button>
          <button onClick={handleCreateNew} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition ${view === 'builder' && !editingIndicator ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50'}`}>
            <Plus size={20} /> 建立指標運算
          </button>

          <div className="pt-10 pb-4 text-[11px] font-bold text-slate-600 uppercase px-6 tracking-widest">系統管理</div>
          <button onClick={() => setView('fhir-settings')} className={`w-full flex items-center gap-3 px-5 py-3.5 rounded-xl transition ${view === 'fhir-settings' ? 'bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20' : 'hover:bg-slate-800/50'}`}>
            <Database size={20} /> FHIR 介接
          </button>
        </nav>

        <div className="p-6 border-t border-slate-800/50">
          <button className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-red-400 transition text-sm font-medium">
            <LogOut size={16} /> 登出系統
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 border-b bg-white flex items-center justify-between px-10 shrink-0 gap-6">
          <div className="flex items-center gap-8 flex-1 min-w-0">
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter whitespace-nowrap shrink-0">{getHeaderTitle()}</h2>
            <div className="flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100 max-w-lg w-full">
              <Search size={18} className="text-slate-400" />
              <input 
                type="text" 
                placeholder="搜尋指標、運算邏輯..." 
                className="bg-transparent border-none outline-none text-sm w-full" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl transition font-bold text-sm ${isChatOpen ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'bg-white border border-slate-200 text-slate-700'}`}>
              <MessageSquare size={18} /> AI 助理
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-2 md:p-6 bg-slate-50/50">
          <div className="max-w-[1600px] mx-auto">
            {view === 'dashboard' ? (
              <Dashboard indicators={indicators} onSelectIndicator={() => {}} onEditIndicator={handleEditIndicator} />
            ) : view === 'indicator-list' ? (
              <IndicatorList 
                indicators={indicators} 
                onEdit={handleEditIndicator} 
                onDelete={handleDeleteIndicator}
                onClone={handleCloneIndicator}
                onCreate={handleCreateNew}
                searchTerm={searchTerm}
              />
            ) : view === 'builder' ? (
              <IndicatorForm 
                initialData={editingIndicator} 
                onSave={handleSaveIndicator} 
                onCancel={() => setView('indicator-list')} 
                availableIndicators={indicators}
              />
            ) : (
              <FhirServerSetting initialConfig={fhirConfig} onSave={(config) => { setFhirConfig(config); setView('indicator-list'); }} />
            )}
          </div>
        </div>
        {isChatOpen && <div className="fixed bottom-10 right-10 w-[420px] z-50 animate-in slide-in-from-right-10 fade-in duration-300"><ChatBot /></div>}
      </main>
    </div>
  );
};

export default App;
