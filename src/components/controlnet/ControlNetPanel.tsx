'use client';

import { useFluxStore } from '@/hooks/use-flux-store';
import { generateId } from '@/lib/utils';
import type { ControlNetConfig, ControlNetPreprocessor } from '@/types';

const PREPROCESSORS: { value: ControlNetPreprocessor; label: string }[] = [
  { value: 'canny', label: 'Canny Edge' }, { value: 'depth_midas', label: 'Depth (MiDaS)' },
  { value: 'depth_zoe', label: 'Depth (ZoeDepth)' }, { value: 'openpose', label: 'OpenPose' },
  { value: 'openpose_full', label: 'OpenPose Full' }, { value: 'scribble', label: 'Scribble' },
  { value: 'softedge', label: 'Soft Edge' }, { value: 'lineart', label: 'Line Art' },
  { value: 'lineart_anime', label: 'Line Art (Anime)' }, { value: 'normal_map', label: 'Normal Map' },
  { value: 'segmentation', label: 'Segmentation' }, { value: 'tile', label: 'Tile' },
  { value: 'mlsd', label: 'MLSD Lines' }, { value: 'mediapipe_face', label: 'Face Mesh' },
];

export function ControlNetPanel() {
  const controlNets = useFluxStore((s) => s.params.controlNets);
  const addControlNet = useFluxStore((s) => s.addControlNet);
  const removeControlNet = useFluxStore((s) => s.removeControlNet);
  const updateControlNet = useFluxStore((s) => s.updateControlNet);

  function handleAdd() {
    const cn: ControlNetConfig = {
      id: generateId(), enabled: true, preprocessor: 'canny', model: 'control_v11p_sd15_canny',
      weight: 1, startStep: 0, endStep: 1, controlMode: 'balanced', resizeMode: 'resize',
      guidanceStart: 0, guidanceEnd: 1, pixelPerfect: false, lowVram: false,
    };
    addControlNet(cn);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="fx-label mb-0">ControlNet ({controlNets.length})</label>
        <button onClick={handleAdd} className="fx-btn-ghost text-[10px] px-1 py-0.5">+ Add</button>
      </div>

      {controlNets.map((cn) => (
        <div key={cn.id} className={`p-2 rounded-md border transition-all ${cn.enabled ? 'border-indigo-500/20 bg-indigo-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => updateControlNet(cn.id, { enabled: !cn.enabled })} className={`w-6 h-3 rounded-full transition ${cn.enabled ? 'bg-indigo-600' : 'bg-white/10'}`}>
              <div className={`w-2.5 h-2.5 rounded-full bg-white transition-transform ${cn.enabled ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </button>
            <button onClick={() => removeControlNet(cn.id)} className="text-white/15 hover:text-red-400 transition">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <div>
              <label className="fx-label">Preprocessor</label>
              <select value={cn.preprocessor} onChange={(e) => updateControlNet(cn.id, { preprocessor: e.target.value as ControlNetPreprocessor })} className="fx-select text-[10px] py-0.5">
                {PREPROCESSORS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="fx-label">Weight</label>
              <input type="number" value={cn.weight} onChange={(e) => updateControlNet(cn.id, { weight: parseFloat(e.target.value) || 0 })} className="fx-input text-[10px] py-0.5" min={0} max={2} step={0.05} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 mt-1">
            <div>
              <label className="fx-label">Start</label>
              <input type="number" value={cn.guidanceStart} onChange={(e) => updateControlNet(cn.id, { guidanceStart: parseFloat(e.target.value) || 0 })} className="fx-input text-[10px] py-0.5" min={0} max={1} step={0.05} />
            </div>
            <div>
              <label className="fx-label">End</label>
              <input type="number" value={cn.guidanceEnd} onChange={(e) => updateControlNet(cn.id, { guidanceEnd: parseFloat(e.target.value) || 0 })} className="fx-input text-[10px] py-0.5" min={0} max={1} step={0.05} />
            </div>
            <div>
              <label className="fx-label">Mode</label>
              <select value={cn.controlMode} onChange={(e) => updateControlNet(cn.id, { controlMode: e.target.value as any })} className="fx-select text-[10px] py-0.5">
                <option value="balanced">Balanced</option>
                <option value="prompt">Prompt</option>
                <option value="controlnet">ControlNet</option>
              </select>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
