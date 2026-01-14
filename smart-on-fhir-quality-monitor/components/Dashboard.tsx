
import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { QualityIndicator, IndicatorResult } from '../types';
import { fetchIndicatorResults } from '../services/fhir';
import { Activity, Users, CheckCircle, TrendingUp, ChevronRight, Edit3 } from 'lucide-react';

interface Props {
  indicators: QualityIndicator[];
  onSelectIndicator: (indicator: QualityIndicator) => void;
  onEditIndicator: (indicator: QualityIndicator) => void;
}

export const Dashboard: React.FC<Props> = ({ indicators, onSelectIndicator, onEditIndicator }) => {
  const [selectedResults, setSelectedResults] = useState<IndicatorResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    if (indicators.length > 0) {
      loadResults(indicators[activeIdx]);
    }
  }, [indicators, activeIdx]);

  const loadResults = async (indicator: QualityIndicator) => {
    setLoading(true);
    try {
      const results = await fetchIndicatorResults(indicator);
      setSelectedResults(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (indicators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-32 bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400">
        <Activity size={64} className="mb-6 opacity-10" />
        <p className="text-xl font-bold">目前尚無已設定的監控指標</p>
        <p className="text-sm mt-2">請點擊「建立新指標」開始您的第一個品質監測。</p>
      </div>
    );
  }

  const currentIndicator = indicators[activeIdx];
  const lastResult = selectedResults[selectedResults.length - 1];

  return (
    <div className="space-y-8">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Activity size={22} /></div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full">+2.5%</span>
          </div>
          <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wider">指標達成率</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{lastResult?.rate ?? '--'}%</p>
        </div>
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl"><Users size={22} /></div>
            <span className="px-2 py-0.5 bg-slate-50 text-slate-400 text-[10px] font-black rounded-full">持平</span>
          </div>
          <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wider">母體病人數 (分母)</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{lastResult?.denominatorCount ?? '--'}</p>
        </div>
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl"><CheckCircle size={22} /></div>
            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded-full">目標達成</span>
          </div>
          <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wider">合格病患數 (分子)</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{lastResult?.numeratorCount ?? '--'}</p>
        </div>
        <div className="bg-white p-7 rounded-2xl border border-slate-100 shadow-sm transition hover:shadow-md">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl"><TrendingUp size={22} /></div>
            <span className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-black rounded-full">上升趨勢</span>
          </div>
          <h4 className="text-slate-500 text-xs font-bold uppercase tracking-wider">活動指標總數</h4>
          <p className="text-3xl font-black text-slate-900 mt-1">{indicators.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-start mb-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 bg-indigo-600 rounded-full"></span>
                <h3 className="text-xl font-bold text-slate-900">{currentIndicator.name}</h3>
              </div>
              <p className="text-sm text-slate-500 font-medium">{currentIndicator.description}</p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => onEditIndicator(currentIndicator)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-[12px] font-bold rounded-xl hover:bg-slate-50 transition"
              >
                <Edit3 size={14} /> 編輯設定
              </button>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg border border-indigo-100">{currentIndicator.frequency}更新</span>
            </div>
          </div>
          
          <div className="h-[360px] w-full">
            {loading ? (
              <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50/50 animate-pulse rounded-2xl">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-bold">正在從 HIS 獲取 FHIR 資料...</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={selectedResults}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="timestamp" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 11, fontWeight: 600}} unit="%" domain={[0, 100]} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}
                  />
                  <Line 
                    name="達成率"
                    type="monotone" 
                    dataKey="rate" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    dot={{ r: 6, strokeWidth: 3, fill: '#fff' }} 
                    activeDot={{ r: 8, strokeWidth: 0, fill: '#4f46e5' }} 
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            監控清單
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] rounded-full">{indicators.length}</span>
          </h3>
          <div className="space-y-3">
            {indicators.map((ind, idx) => (
              <button 
                key={ind.id}
                onClick={() => setActiveIdx(idx)}
                className={`w-full text-left p-5 rounded-2xl border transition-all duration-200 flex justify-between items-center group ${activeIdx === idx ? 'border-indigo-600 bg-indigo-50/30 ring-1 ring-indigo-600/10 shadow-sm' : 'border-slate-50 hover:border-slate-200 hover:bg-slate-50/50'}`}
              >
                <div className="overflow-hidden">
                  <h4 className={`font-bold text-sm truncate ${activeIdx === idx ? 'text-indigo-700' : 'text-slate-700'}`}>{ind.name}</h4>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{ind.frequency}</span>
                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                    {/* Fixed Error: Changed ind.numerator to ind.numeratorSteps and ind.denominator to ind.denominatorSteps */}
                    <p className="text-[10px] text-slate-400 font-medium">條件數: {ind.numeratorSteps.length + ind.denominatorSteps.length}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditIndicator(ind);
                    }}
                    className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Edit3 size={16} />
                  </button>
                  <ChevronRight size={18} className={`transition-transform duration-200 ${activeIdx === idx ? 'text-indigo-600 translate-x-1' : 'text-slate-300 group-hover:translate-x-0.5'}`} />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
