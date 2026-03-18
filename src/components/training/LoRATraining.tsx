'use client';

import { useState } from 'react';
import { useFluxStore } from '@/hooks/use-flux-store';
import { generateId } from '@/lib/utils';
import type { TrainingConfig, TrainingImage } from '@/types';

export function LoRATraining() {
  const trainingConfigs = useFluxStore((s) => s.trainingConfigs);
  const addTrainingConfig = useFluxStore((s) => s.addTrainingConfig);
  const updateTrainingConfig = useFluxStore((s) => s.updateTrainingConfig);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [images, setImages] = useState<TrainingImage[]>([]);

  function createTraining() {
    const config: TrainingConfig = {
      id: generateId(), name: name || 'LoRA Training', baseModel: 'sdxl-base-1.0',
      trainingImages: images, epochs: 10, learningRate: 0.0001, networkRank: 32,
      networkAlpha: 16, batchSize: 1, resolution: 512, optimizer: 'AdamW8bit',
      scheduler: 'cosine', warmupSteps: 100, captionExtension: '.txt', shuffleCaption: true,
      keepTokens: 1, clipSkip: 1, mixedPrecision: 'bf16', gradientAccumulationSteps: 1,
      maxGradNorm: 1.0, noiseOffset: 0.0, status: 'idle', createdAt: new Date().toISOString(),
    };
    addTrainingConfig(config);
    setShowNew(false);
    setName('');
    setImages([]);
  }

  function handleAddImage() {
    setImages((prev) => [...prev, { id: generateId(), url: '', caption: '', repeats: 10 }]);
  }

  async function startTraining(configId: string) {
    updateTrainingConfig(configId, { status: 'preparing', currentEpoch: 0, currentStep: 0 });
    await new Promise((r) => setTimeout(r, 1000));
    updateTrainingConfig(configId, { status: 'training' });
    const config = useFluxStore.getState().trainingConfigs.find((c) => c.id === configId);
    if (!config) return;
    const totalSteps = config.epochs * Math.max(config.trainingImages.length, 1) * 10;
    updateTrainingConfig(configId, { totalSteps });

    for (let step = 0; step <= totalSteps; step += Math.ceil(totalSteps / 20)) {
      await new Promise((r) => setTimeout(r, 500));
      updateTrainingConfig(configId, {
        currentStep: step,
        currentEpoch: Math.floor((step / totalSteps) * config.epochs),
        loss: 0.1 + Math.random() * 0.05 - step / totalSteps * 0.03,
      });
    }

    updateTrainingConfig(configId, { status: 'completed', currentStep: totalSteps, currentEpoch: config.epochs });
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-white">LoRA Training</h2>
        <button onClick={() => setShowNew(!showNew)} className="fx-btn-primary text-xs">New Training</button>
      </div>

      {showNew && (
        <div className="fx-panel p-4 mb-4 space-y-3">
          <div><label className="fx-label">Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My LoRA" className="fx-input" /></div>

          <div>
            <div className="flex items-center justify-between">
              <label className="fx-label mb-0">Training Images ({images.length})</label>
              <button onClick={handleAddImage} className="fx-btn-ghost text-[10px] px-1">+ Add</button>
            </div>
            {images.map((img, i) => (
              <div key={img.id} className="flex gap-2 mt-1">
                <input type="text" value={img.caption} onChange={(e) => setImages((prev) => prev.map((im, j) => j === i ? { ...im, caption: e.target.value } : im))} placeholder="Caption..." className="fx-input flex-1 text-[10px]" />
                <input type="number" value={img.repeats} onChange={(e) => setImages((prev) => prev.map((im, j) => j === i ? { ...im, repeats: parseInt(e.target.value) || 1 } : im))} className="fx-input w-14 text-[10px]" min={1} />
                <button onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))} className="text-white/20 hover:text-red-400">x</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div><label className="fx-label">Epochs</label><input type="number" defaultValue={10} className="fx-input" /></div>
            <div><label className="fx-label">LR</label><input type="text" defaultValue="1e-4" className="fx-input" /></div>
            <div><label className="fx-label">Rank</label><input type="number" defaultValue={32} className="fx-input" /></div>
            <div><label className="fx-label">Alpha</label><input type="number" defaultValue={16} className="fx-input" /></div>
            <div><label className="fx-label">Resolution</label><input type="number" defaultValue={512} className="fx-input" /></div>
            <div><label className="fx-label">Optimizer</label>
              <select defaultValue="AdamW8bit" className="fx-select">
                <option>AdamW</option><option>AdamW8bit</option><option>Lion</option><option>Prodigy</option>
              </select>
            </div>
          </div>

          <button onClick={createTraining} className="fx-btn-primary w-full text-xs">Create Training Job</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-2">
        {trainingConfigs.length === 0 ? (
          <p className="text-xs text-white/20 text-center py-16">No training jobs. Create one to get started.</p>
        ) : (
          trainingConfigs.map((config) => (
            <div key={config.id} className="fx-card p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-white">{config.name}</span>
                <span className={`text-[10px] ${
                  config.status === 'completed' ? 'text-green-400' : config.status === 'training' ? 'text-indigo-400' : config.status === 'failed' ? 'text-red-400' : 'text-white/30'
                }`}>{config.status}</span>
              </div>

              <div className="text-[10px] text-white/30 space-y-0.5">
                <div>Base: {config.baseModel} | Rank: {config.networkRank} | Alpha: {config.networkAlpha}</div>
                <div>Images: {config.trainingImages.length} | Epochs: {config.epochs} | LR: {config.learningRate}</div>
                {config.currentStep !== undefined && (
                  <div>Step: {config.currentStep}/{config.totalSteps || '?'} | Epoch: {config.currentEpoch}/{config.epochs}</div>
                )}
                {config.loss !== undefined && <div>Loss: {config.loss.toFixed(4)}</div>}
              </div>

              {config.status === 'training' && config.totalSteps && (
                <div className="w-full bg-white/5 rounded-full h-1.5 mt-2">
                  <div className="bg-indigo-500 h-1.5 rounded-full transition-all" style={{ width: `${((config.currentStep || 0) / config.totalSteps) * 100}%` }} />
                </div>
              )}

              {config.status === 'idle' && (
                <button onClick={() => startTraining(config.id)} className="fx-btn-primary w-full text-[10px] mt-2">Start Training</button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
