'use client';

import { useFluxStore } from '@/hooks/use-flux-store';
import { ControlNetPanel } from '@/components/controlnet/ControlNetPanel';
import { parsePrompt } from '@/lib/prompts/parser';
import { generateSeed } from '@/lib/utils';

const SAMPLERS = ['euler', 'euler_a', 'heun', 'dpmpp_2m', 'dpmpp_2m_sde', 'dpmpp_3m_sde', 'ddim', 'uni_pc', 'lcm'];
const SCHEDULERS = ['normal', 'karras', 'exponential', 'sgm_uniform'];
const SIZES = [
  { w: 512, h: 512, label: '512x512' }, { w: 512, h: 768, label: '512x768' },
  { w: 768, h: 512, label: '768x512' }, { w: 768, h: 768, label: '768x768' },
  { w: 1024, h: 1024, label: '1024x1024' }, { w: 768, h: 1344, label: '768x1344' },
];

export function GeneratePanel() {
  const params = useFluxStore((s) => s.params);
  const updateParams = useFluxStore((s) => s.updateParams);
  const randomizeSeed = useFluxStore((s) => s.randomizeSeed);
  const isGenerating = useFluxStore((s) => s.isGenerating);
  const setIsGenerating = useFluxStore((s) => s.setIsGenerating);
  const addJob = useFluxStore((s) => s.addJob);
  const addToGallery = useFluxStore((s) => s.addToGallery);
  const gallery = useFluxStore((s) => s.gallery);

  const parsed = parsePrompt(params.prompt);
  const tokenCount = parsed.tokens.length;

  async function handleGenerate() {
    setIsGenerating(true);
    const jobId = crypto.randomUUID();
    const seed = params.seed === -1 ? generateSeed() : params.seed;
    addJob({
      id: jobId, params: { ...params, seed }, backendId: 'local', status: 'running',
      progress: 0, resultImages: [], createdAt: new Date().toISOString(), priority: 0,
    });

    await new Promise((r) => setTimeout(r, 2000));

    const img = {
      id: crypto.randomUUID(), jobId, url: '', width: params.width, height: params.height,
      params: { ...params, seed }, seed, backendType: 'replicate' as const,
      generationTimeMs: 2000, fileSize: 0, metadata: {}, isFavorite: false, tags: [], createdAt: new Date().toISOString(),
    };
    addToGallery(img);
    useFluxStore.getState().updateJob(jobId, { status: 'completed', progress: 1, resultImages: [img] });
    setIsGenerating(false);
  }

  return (
    <div className="flex h-full">
      {/* Left panel - params */}
      <div className="w-80 border-r border-white/5 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="fx-label">Prompt</label>
          <textarea value={params.prompt} onChange={(e) => updateParams({ prompt: e.target.value })} placeholder="A beautiful landscape..." className="fx-input h-24 resize-none text-xs" />
          <span className="text-[9px] text-white/20">{tokenCount} tokens</span>
        </div>

        <div>
          <label className="fx-label">Negative Prompt</label>
          <textarea value={params.negativePrompt} onChange={(e) => updateParams({ negativePrompt: e.target.value })} placeholder="low quality, blurry..." className="fx-input h-16 resize-none text-xs" />
        </div>

        <div>
          <label className="fx-label">Size</label>
          <div className="grid grid-cols-3 gap-1">
            {SIZES.map((s) => (
              <button key={s.label} onClick={() => updateParams({ width: s.w, height: s.h })} className={`py-1 rounded text-[10px] transition ${params.width === s.w && params.height === s.h ? 'bg-indigo-600 text-white' : 'bg-white/5 text-white/30'}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="fx-label">Steps</label><input type="number" value={params.steps} onChange={(e) => updateParams({ steps: parseInt(e.target.value) || 1 })} className="fx-input" min={1} max={150} /></div>
          <div><label className="fx-label">CFG Scale</label><input type="number" value={params.cfgScale} onChange={(e) => updateParams({ cfgScale: parseFloat(e.target.value) || 1 })} className="fx-input" min={1} max={30} step={0.5} /></div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="fx-label">Sampler</label><select value={params.sampler} onChange={(e) => updateParams({ sampler: e.target.value as any })} className="fx-select">{SAMPLERS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
          <div><label className="fx-label">Scheduler</label><select value={params.scheduler} onChange={(e) => updateParams({ scheduler: e.target.value as any })} className="fx-select">{SCHEDULERS.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
        </div>

        <div>
          <label className="fx-label">Seed</label>
          <div className="flex gap-1">
            <input type="number" value={params.seed} onChange={(e) => updateParams({ seed: parseInt(e.target.value) })} className="fx-input flex-1" />
            <button onClick={randomizeSeed} className="fx-btn-secondary text-[10px] px-2">Dice</button>
            <button onClick={() => updateParams({ seed: -1 })} className="fx-btn-ghost text-[10px] px-2">-1</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div><label className="fx-label">Batch Size</label><input type="number" value={params.batchSize} onChange={(e) => updateParams({ batchSize: parseInt(e.target.value) || 1 })} className="fx-input" min={1} max={8} /></div>
          <div><label className="fx-label">Batch Count</label><input type="number" value={params.batchCount} onChange={(e) => updateParams({ batchCount: parseInt(e.target.value) || 1 })} className="fx-input" min={1} max={16} /></div>
        </div>

        <ControlNetPanel />

        <button onClick={handleGenerate} disabled={isGenerating || !params.prompt.trim()} className="fx-btn-primary w-full">
          {isGenerating ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {/* Right - results */}
      <div className="flex-1 p-4 overflow-y-auto">
        <h2 className="text-sm font-semibold text-white mb-3">Results</h2>
        {gallery.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-16">Generated images will appear here</p>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {gallery.map((img) => (
              <div key={img.id} className="fx-card p-2 group">
                <div className="aspect-square bg-white/5 rounded-lg flex items-center justify-center text-white/10 text-xs mb-2">
                  {img.width}x{img.height}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-white/30 truncate">{img.params.prompt.slice(0, 30)}</span>
                  <button onClick={() => useFluxStore.getState().toggleFavorite(img.id)} className={`text-xs ${img.isFavorite ? 'text-yellow-400' : 'text-white/10'}`}>
                    {img.isFavorite ? '★' : '☆'}
                  </button>
                </div>
                <div className="text-[9px] text-white/15">Seed: {img.seed} | {img.params.sampler}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
