'use client';

import { useState } from 'react';
import { useFluxStore } from '@/hooks/use-flux-store';
import { generateId, formatBytes } from '@/lib/utils';
import type { ModelInfo, ModelType } from '@/types';

const MODEL_TYPES: { value: ModelType; label: string }[] = [
  { value: 'checkpoint', label: 'Checkpoint' }, { value: 'lora', label: 'LoRA' },
  { value: 'vae', label: 'VAE' }, { value: 'controlnet', label: 'ControlNet' },
  { value: 'embedding', label: 'Embedding' }, { value: 'upscaler', label: 'Upscaler' },
];

const SAMPLE_MODELS: Partial<ModelInfo>[] = [
  { name: 'SDXL Base 1.0', type: 'checkpoint', baseModel: 'sdxl', size: 6940000000, tags: ['sdxl', 'base'], isDownloaded: true },
  { name: 'DreamShaper SDXL', type: 'checkpoint', baseModel: 'sdxl', size: 6400000000, tags: ['sdxl', 'creative'], isDownloaded: true },
  { name: 'SDXL VAE', type: 'vae', baseModel: 'sdxl', size: 335000000, tags: ['sdxl', 'vae'], isDownloaded: true },
  { name: 'ControlNet Canny SDXL', type: 'controlnet', baseModel: 'sdxl', size: 2500000000, tags: ['controlnet', 'canny'], isDownloaded: true },
  { name: 'Detail Enhancer LoRA', type: 'lora', baseModel: 'sdxl', size: 180000000, tags: ['lora', 'detail'], isDownloaded: true },
  { name: '4x UltraSharp', type: 'upscaler', baseModel: 'any', size: 67000000, tags: ['upscaler', '4x'], isDownloaded: true },
];

export function ModelManager() {
  const models = useFluxStore((s) => s.models);
  const addModel = useFluxStore((s) => s.addModel);
  const removeModel = useFluxStore((s) => s.removeModel);
  const updateModel = useFluxStore((s) => s.updateModel);
  const [filterType, setFilterType] = useState<ModelType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDownload, setShowDownload] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const allModels = [...SAMPLE_MODELS.map((m) => ({ ...m, id: m.name || generateId(), filename: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as ModelInfo)), ...models];

  const filtered = allModels.filter((m) => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (searchQuery) return m.name.toLowerCase().includes(searchQuery.toLowerCase());
    return true;
  });

  function handleDownload() {
    if (!downloadUrl.trim()) return;
    const model: ModelInfo = {
      id: generateId(), name: downloadUrl.split('/').pop() || 'Downloaded Model', filename: '',
      type: 'checkpoint', size: 0, baseModel: 'unknown', tags: [], isDownloaded: false,
      downloadProgress: 0, downloadUrl, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    addModel(model);
    setShowDownload(false);
    setDownloadUrl('');

    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      updateModel(model.id, { downloadProgress: Math.min(progress, 100), isDownloaded: progress >= 100 });
      if (progress >= 100) clearInterval(interval);
    }, 500);
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">Model Manager</h2>
        <button onClick={() => setShowDownload(!showDownload)} className="fx-btn-primary text-xs">Download Model</button>
      </div>

      {showDownload && (
        <div className="fx-panel p-3 mb-4">
          <label className="fx-label">Download URL (CivitAI, HuggingFace)</label>
          <div className="flex gap-2">
            <input type="text" value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://civitai.com/models/..." className="fx-input flex-1" />
            <button onClick={handleDownload} className="fx-btn-primary text-xs">Download</button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-3">
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search models..." className="fx-input flex-1" />
        <div className="flex gap-0.5">
          <button onClick={() => setFilterType('all')} className={`px-2 py-1 rounded text-[10px] ${filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/30'}`}>All</button>
          {MODEL_TYPES.map((t) => (
            <button key={t.value} onClick={() => setFilterType(t.value)} className={`px-2 py-1 rounded text-[10px] ${filterType === t.value ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/30'}`}>{t.label}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.map((model) => (
          <div key={model.id} className="fx-card p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-[10px] text-white/20">{model.type.slice(0, 3).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">{model.name}</div>
              <div className="text-[10px] text-white/30">{model.baseModel} | {formatBytes(model.size)}</div>
              {model.downloadProgress !== undefined && model.downloadProgress < 100 && (
                <div className="w-full bg-white/5 rounded-full h-1 mt-1">
                  <div className="bg-indigo-500 h-1 rounded-full transition-all" style={{ width: `${model.downloadProgress}%` }} />
                </div>
              )}
              <div className="flex gap-1 mt-1">
                {model.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[9px] bg-white/5 text-white/20 rounded px-1 py-0.5">{tag}</span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${model.isDownloaded ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
