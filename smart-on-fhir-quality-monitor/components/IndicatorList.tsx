
import React, { useState, useMemo } from 'react';
import { QualityIndicator, CalculationStep } from '../types';
import { 
  Search, Plus, Edit2, Trash2, Copy, 
  ChevronDown, Calculator, Activity, 
  Database, AlertCircle, Layers, Filter, SortAsc, SortDesc, Clock, Zap,
  Maximize2, Minimize2, LayoutGrid, Grid3X3, StretchHorizontal,
  ChevronRight, List, Eye, X, ArrowRight, Info, Settings2, FileSearch
} from 'lucide-react';

interface Props {
  indicators: QualityIndicator[];
  onEdit: (indicator: QualityIndicator) => void;
  onDelete: (id: string) => void;
  onClone: (indicator: QualityIndicator) => void;
  onCreate: () => void;
  searchTerm?: string;
}

type SortOption = 'name_asc' | 'name_desc' | 'steps_desc' | 'freq';
type ZoomLevel = 'compact' | 'standard' | 'large';

// 內建步驟顯示組件
const StepBadge: React.FC<{ step: CalculationStep; index: number }> = ({ step, index }) => {
  const isBase = step.action === 'BASE';
  return (
    <div className="group relative flex flex-col gap-2 p-4 bg-white border border-slate-100 rounded-2xl hover:border-indigo-200 hover:shadow-md transition-all">
      <div className="flex justify-between items-center mb-1">
        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${isBase ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white'}`}>
          {step.action}
        </span>
        <span className="text-[10px] font-mono text-slate-300">STEP #{index + 1}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-slate-50 text-slate-400 rounded-lg">
          <Database size={14} />
        </div>
        <div className="flex flex-col overflow-hidden">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">RESOURCE</span>
          <span className="text-xs font-bold text-slate-700 truncate">{step.resourceType || 'N/A'}</span>
        </div>
      </div>
      <div className="space-y-1 mt-1">
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">PATH</span>
          <span className="text-[11px] font-mono font-medium text-indigo-600 break-all">{step.path || '-'}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">VALUE(S)</span>
          <span className="text-[11px] font-bold text-slate-800 line-clamp-1">{step.value}</span>
        </div>
      </div>
      {step.notes && (
        <div className="mt-2 pt-2 border-t border-slate-50 text-[10px] font-bold text-slate-400 italic">
          "{step.notes}"
        </div>
      )}
    </div>
  );
};

export const IndicatorList: React.FC<Props> = ({ 
  indicators, onEdit, onDelete, onClone, onCreate, searchTerm = ''
}) => {
  const [sortBy, setSortBy] = useState<SortOption>('name_asc');
  const [filterFreq, setFilterFreq] = useState<string>('all');
  const [zoom, setZoom] = useState<ZoomLevel>('standard');
  const [viewingIndicator, setViewingIndicator] = useState<QualityIndicator | null>(null);

  // 排序與篩選邏輯
  const processedIndicators = useMemo(() => {
    let result = [...indicators];

    if (searchTerm) {
      result = result.filter(ind => 
        ind.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ind.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterFreq !== 'all') {
      result = result.filter(ind => ind.frequency === filterFreq);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc': return a.name.localeCompare(b.name, 'zh-Hant');
        case 'name_desc': return b.name.localeCompare(a.name, 'zh-Hant');
        case 'steps_desc': 
          const totalStepsA = a.numeratorSteps.length + a.denominatorSteps.length + a.exclusionSteps.length;
          const totalStepsB = b.numeratorSteps.length + b.denominatorSteps.length + b.exclusionSteps.length;
          return totalStepsB - totalStepsA;
        case 'freq': return a.frequency.localeCompare(b.frequency, 'zh-Hant');
        default: return 0;
      }
    });

    return result;
  }, [indicators, searchTerm, sortBy, filterFreq]);

  const getGridClasses = () => {
    switch (zoom) {
      case 'compact': return 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8';
      case 'large': return 'grid-cols-1 xl:grid-cols-2';
      default: return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-20 relative">
      {/* 指標詳情彈窗 */}
      {viewingIndicator && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setViewingIndicator(null)}></div>
          <div className="bg-white w-full max-w-6xl max-h-full rounded-[3rem] shadow-2xl relative z-10 flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white">
            {/* Modal Header */}
            <div className="p-8 border-b flex justify-between items-start bg-slate-50/50 shrink-0">
              <div className="flex gap-6 items-center">
                <div className="w-16 h-16 bg-indigo-600 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-indigo-200">
                  <Calculator size={32} />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{viewingIndicator.name}</h3>
                  <p className="text-slate-500 font-medium mt-1 text-lg">{viewingIndicator.description}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingIndicator(null)}
                className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-rose-500 transition-all shadow-sm hover:shadow-md"
              >
                <X size={24} />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-10 space-y-12 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 排除條件 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center"><X size={18} /></div>
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">排除條件 (Exclusions)</h4>
                  </div>
                  <div className="space-y-4">
                    {viewingIndicator.exclusionSteps.length > 0 ? viewingIndicator.exclusionSteps.map((s, i) => (
                      <StepBadge key={s.id} step={s} index={i} />
                    )) : (
                      <div className="p-10 text-center border-2 border-dashed border-slate-100 rounded-3xl text-slate-300 font-bold italic text-sm">無設定排除條件</div>
                    )}
                  </div>
                </div>

                {/* 分母條件 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-slate-900 text-white rounded-xl flex items-center justify-center"><Layers size={18} /></div>
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">分母母體 (Denominator)</h4>
                  </div>
                  <div className="space-y-4">
                    {viewingIndicator.denominatorSteps.map((s, i) => (
                      <StepBadge key={s.id} step={s} index={i} />
                    ))}
                  </div>
                </div>

                {/* 分子條件 */}
                <div className="space-y-6">
                  <div className="flex items-center gap-3 px-2">
                    <div className="w-8 h-8 bg-indigo-600 text-white rounded-xl flex items-center justify-center"><Zap size={18} /></div>
                    <h4 className="font-black text-slate-800 uppercase tracking-widest text-sm">分子合格 (Numerator)</h4>
                  </div>
                  <div className="space-y-4">
                    {viewingIndicator.numeratorSteps.map((s, i) => (
                      <StepBadge key={s.id} step={s} index={i} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 border-t bg-slate-50/50 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4 text-slate-400">
                <Info size={18} />
                <span className="text-xs font-bold uppercase tracking-widest">指標頻率：{viewingIndicator.frequency} 更新一次</span>
              </div>
              <button 
                onClick={() => { setViewingIndicator(null); onEdit(viewingIndicator); }}
                className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black hover:bg-indigo-600 transition active:scale-95 shadow-xl"
              >
                <Edit2 size={18} /> 進入編輯模式
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 頂部操作與篩選列 */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">指標定義中心</h2>
            <p className="text-slate-500 font-medium mt-1">管理並追蹤全院臨床品質指標之聯合運算邏輯。</p>
          </div>
          <button 
            onClick={onCreate}
            className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-[1.5rem] font-black shadow-lg hover:bg-indigo-700 transition active:scale-95 shrink-0"
          >
            <Plus size={20} /> 新增指標
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-slate-50">
          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <SortAsc size={16} className="text-slate-400" />
            <select 
              className="bg-transparent border-none outline-none font-black text-xs text-slate-600 cursor-pointer"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="name_asc">名稱 (A-Z)</option>
              <option value="name_desc">名稱 (Z-A)</option>
              <option value="steps_desc">複雜度</option>
              <option value="freq">更新頻率</option>
            </select>
          </div>

          <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
            <Filter size={16} className="text-slate-400" />
            <select 
              className="bg-transparent border-none outline-none font-black text-xs text-slate-600 cursor-pointer"
              value={filterFreq}
              onChange={(e) => setFilterFreq(e.target.value)}
            >
              <option value="all">所有頻率</option>
              <option value="每日">每日</option>
              <option value="每週">每週</option>
              <option value="每月">每月</option>
              <option value="每季">每季</option>
            </select>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 ml-auto">
            <button 
              onClick={() => setZoom('compact')}
              className={`p-2 rounded-xl transition-all ${zoom === 'compact' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="極致緊湊 (一列8個)"
            >
              <Grid3X3 size={16} />
            </button>
            <button 
              onClick={() => setZoom('standard')}
              className={`p-2 rounded-xl transition-all ${zoom === 'standard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="標準 (一列4個)"
            >
              <LayoutGrid size={16} />
            </button>
            <button 
              onClick={() => setZoom('large')}
              className={`p-2 rounded-xl transition-all ${zoom === 'large' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              title="詳細 (一列2個)"
            >
              <StretchHorizontal size={16} />
            </button>
          </div>

          {searchTerm && (
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 animate-in fade-in zoom-in-95">
              <Search size={14} className="opacity-70" />
              <span className="text-[11px] font-black uppercase tracking-tight">搜尋：{searchTerm}</span>
            </div>
          )}
        </div>
      </div>

      {/* 指標網格佈局 */}
      {processedIndicators.length > 0 ? (
        <div className={`grid gap-5 transition-all duration-500 ease-in-out ${getGridClasses()}`}>
          {processedIndicators.map((indicator) => {
            const stepCount = indicator.numeratorSteps.length + indicator.denominatorSteps.length + indicator.exclusionSteps.length;
            
            return (
              <div 
                key={indicator.id}
                className={`group bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 flex flex-col relative overflow-hidden ${zoom === 'compact' ? 'h-[220px]' : zoom === 'large' ? 'h-auto min-h-[460px]' : 'h-[340px]'}`}
              >
                <div className={`w-full bg-slate-100 group-hover:bg-indigo-500 transition-colors ${zoom === 'compact' ? 'h-1' : 'h-2'}`}></div>
                
                <div className={`flex flex-col flex-1 ${zoom === 'compact' ? 'p-4' : zoom === 'large' ? 'p-8' : 'p-6'}`}>
                  <div className={`flex justify-between items-start ${zoom === 'compact' ? 'mb-2' : 'mb-4'}`}>
                    <div className={`bg-indigo-50 text-indigo-600 rounded-xl ${zoom === 'compact' ? 'p-1.5' : 'p-2.5'}`}>
                      <Calculator size={zoom === 'compact' ? 14 : 20} />
                    </div>
                    <span className={`px-2 py-0.5 bg-slate-50 text-slate-400 font-black rounded-lg border border-slate-100 uppercase tracking-tighter ${zoom === 'compact' ? 'text-[7px]' : 'text-[9px]'}`}>
                      {indicator.frequency}
                    </span>
                  </div>

                  <h3 className={`font-black text-slate-900 leading-tight group-hover:text-indigo-600 transition-colors line-clamp-2 ${zoom === 'compact' ? 'text-xs min-h-[2rem] mb-1' : zoom === 'large' ? 'text-2xl min-h-[3rem] mb-2' : 'text-lg min-h-[3.5rem] mb-2'}`}>
                    {indicator.name}
                  </h3>
                  
                  {zoom !== 'compact' && (
                    <p className={`text-slate-400 font-medium line-clamp-2 mb-6 ${zoom === 'large' ? 'text-base mb-8' : 'text-xs'}`}>
                      {indicator.description || "尚無詳細描述..."}
                    </p>
                  )}

                  {/* 寬敞模式特有的細節顯示 */}
                  {zoom === 'large' && (
                    <div className="flex-1 space-y-6 mb-8">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <List size={14} className="text-slate-300" /> 運算邏輯定義詳情
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* 分母定義 */}
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2 block">分母 (Denominator)</span>
                            <div className="space-y-1.5">
                              {indicator.denominatorSteps.map((s, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-slate-600">
                                  <div className="w-1 h-1 bg-slate-300 rounded-full mt-1.5 shrink-0"></div>
                                  <span className="line-clamp-2">{s.notes || `${s.resourceType}.${s.path}`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 分子定義 */}
                          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-2 block">分子 (Numerator)</span>
                            <div className="space-y-1.5">
                              {indicator.numeratorSteps.map((s, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-indigo-700">
                                  <div className="w-1 h-1 bg-indigo-300 rounded-full mt-1.5 shrink-0"></div>
                                  <span className="line-clamp-2">{s.notes || `${s.resourceType}.${s.path}`}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* 排除定義 */}
                          <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100">
                            <span className="text-[9px] font-black text-rose-400 uppercase tracking-widest mb-2 block">排除 (Exclusion)</span>
                            <div className="space-y-1.5">
                              {indicator.exclusionSteps.length > 0 ? indicator.exclusionSteps.map((s, i) => (
                                <div key={i} className="flex items-start gap-2 text-[11px] font-bold text-rose-700">
                                  <div className="w-1 h-1 bg-rose-300 rounded-full mt-1.5 shrink-0"></div>
                                  <span className="line-clamp-2">{s.notes || `${s.resourceType}.${s.path}`}</span>
                                </div>
                              )) : <span className="text-[10px] italic text-rose-300">無排除條件</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className={`flex items-center gap-4 ${zoom === 'compact' ? 'mb-4 mt-auto' : zoom === 'large' ? 'mb-8' : 'mb-6'}`}>
                    <div className="flex flex-col">
                      <span className={`font-black text-slate-300 uppercase tracking-widest ${zoom === 'compact' ? 'text-[7px]' : 'text-[10px]'}`}>邏輯步驟</span>
                      <span className={`font-black text-slate-700 ${zoom === 'compact' ? 'text-[10px]' : 'text-sm'}`}>{stepCount} 階</span>
                    </div>
                    <div className="h-6 w-px bg-slate-100"></div>
                    <div className="flex flex-col overflow-hidden">
                      <span className={`font-black text-slate-300 uppercase tracking-widest ${zoom === 'compact' ? 'text-[7px]' : 'text-[10px]'}`}>核心資源</span>
                      <span className={`font-black text-slate-700 truncate ${zoom === 'compact' ? 'text-[10px] max-w-[50px]' : 'text-sm max-w-[80px]'}`}>
                        {indicator.denominatorSteps[0]?.resourceType || "FHIR"}
                      </span>
                    </div>
                  </div>

                  {/* 懸浮動作按鈕列 */}
                  <div className={`flex items-center justify-between border-t border-slate-50 mt-auto ${zoom === 'compact' ? 'pt-2' : zoom === 'large' ? 'pt-6' : 'pt-4'}`}>
                    <div className="flex gap-0.5">
                      <button 
                        onClick={() => setViewingIndicator(indicator)} 
                        className={`text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all ${zoom === 'compact' ? 'p-1' : 'p-2'}`}
                        title="查看完整定義"
                      >
                        <Eye size={zoom === 'compact' ? 12 : 16} />
                      </button>
                      <button 
                        onClick={() => onClone(indicator)} 
                        className={`text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all ${zoom === 'compact' ? 'p-1' : 'p-2'}`}
                        title="複製"
                      >
                        <Copy size={zoom === 'compact' ? 12 : 16} />
                      </button>
                      <button 
                        onClick={() => onDelete(indicator.id)} 
                        className={`text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all ${zoom === 'compact' ? 'p-1' : 'p-2'}`}
                        title="刪除"
                      >
                        <Trash2 size={zoom === 'compact' ? 12 : 16} />
                      </button>
                    </div>
                    <button 
                      onClick={() => onEdit(indicator)}
                      className={`flex items-center gap-1 bg-slate-900 text-white font-black rounded-xl hover:bg-indigo-600 transition active:scale-95 ${zoom === 'compact' ? 'px-2 py-1 text-[9px]' : zoom === 'large' ? 'px-6 py-3 text-sm' : 'px-4 py-2 text-[11px]'}`}
                    >
                      <Edit2 size={zoom === 'compact' ? 10 : 14} /> 編輯
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 text-slate-300">
          <Zap size={64} className="mb-6 opacity-10" />
          <p className="text-xl font-black">找不到符合條件的指標</p>
          <button 
            onClick={() => { }}
            className="mt-6 px-6 py-2 text-indigo-600 font-black hover:underline"
          >
            重置篩選條件
          </button>
        </div>
      )}
    </div>
  );
};
