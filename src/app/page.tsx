'use client';

import { useFluxStore } from '@/hooks/use-flux-store';
import { NodeGraphEditor } from '@/components/graph/NodeGraphEditor';
import { ControlNetPanel } from '@/components/controlnet/ControlNetPanel';
import { ModelManager } from '@/components/models/ModelManager';
import { LoRATraining } from '@/components/training/LoRATraining';
import { GeneratePanel } from '@/components/generate/GeneratePanel';
import { GalleryPanel } from '@/components/gallery/GalleryPanel';

export default function FluxStudioPage() {
  const activeTab = useFluxStore((s) => s.activeTab);
  const setActiveTab = useFluxStore((s) => s.setActiveTab);
  const isGenerating = useFluxStore((s) => s.isGenerating);
  const jobs = useFluxStore((s) => s.jobs);

  const tabs = [
    { key: 'generate' as const, label: 'Generate' },
    { key: 'graph' as const, label: 'Node Graph' },
    { key: 'gallery' as const, label: 'Gallery' },
    { key: 'models' as const, label: 'Models' },
    { key: 'training' as const, label: 'Training' },
  ];

  return (
    <div className="h-screen flex flex-col bg-[#0c0c0f] overflow-hidden">
      <header className="h-11 flex items-center justify-between px-4 bg-[#111115] border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-sm font-bold text-white">FluxStudio</span>
        </div>

        <div className="flex items-center gap-1 bg-white/5 rounded-md p-0.5">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1 rounded text-xs font-medium transition-all ${activeTab === t.key ? 'bg-indigo-600 text-white' : 'text-white/30 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {isGenerating && <div className="flex items-center gap-2"><div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /><span className="text-xs text-indigo-300">Generating...</span></div>}
          <span className="text-xs text-white/20">{jobs.filter(j => j.status === 'running').length} active</span>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'generate' && <GeneratePanel />}
        {activeTab === 'graph' && <NodeGraphEditor />}
        {activeTab === 'gallery' && <GalleryPanel />}
        {activeTab === 'models' && <ModelManager />}
        {activeTab === 'training' && <LoRATraining />}
      </div>
    </div>
  );
}
