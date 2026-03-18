import type { BackendConfig, BackendType } from '@/types';
import { BaseBackend } from './base';
import { ComfyUIBackend } from './comfyui';
import { Automatic1111Backend } from './automatic1111';
import { ReplicateBackend } from './replicate';
import { StabilityBackend } from './stability';

export { BaseBackend } from './base';
export type { ProgressCallback, BackendProgressEvent } from './base';

export function createBackend(config: BackendConfig): BaseBackend {
  switch (config.type) {
    case 'comfyui':
      return new ComfyUIBackend(config);
    case 'automatic1111':
      return new Automatic1111Backend(config);
    case 'replicate':
      return new ReplicateBackend(config);
    case 'stability':
      return new StabilityBackend(config);
    default:
      throw new Error(`Unknown backend type: ${config.type}`);
  }
}

export function getDefaultBackendConfig(type: BackendType): BackendConfig {
  const defaults: Record<BackendType, BackendConfig> = {
    comfyui: {
      id: 'comfyui-local',
      type: 'comfyui',
      name: 'ComfyUI (Local)',
      url: 'http://127.0.0.1:8188',
      isLocal: true,
      isConnected: false,
      capabilities: ['txt2img', 'img2img', 'inpainting', 'controlnet', 'lora', 'vae', 'batch', 'queue'],
      maxBatchSize: 16,
      supportsControlNet: true,
      supportsImg2Img: true,
      supportsInpainting: true,
    },
    automatic1111: {
      id: 'a1111-local',
      type: 'automatic1111',
      name: 'Automatic1111 (Local)',
      url: 'http://127.0.0.1:7860',
      isLocal: true,
      isConnected: false,
      capabilities: ['txt2img', 'img2img', 'inpainting', 'controlnet', 'lora', 'vae', 'batch'],
      maxBatchSize: 8,
      supportsControlNet: true,
      supportsImg2Img: true,
      supportsInpainting: true,
    },
    replicate: {
      id: 'replicate-cloud',
      type: 'replicate',
      name: 'Replicate (Cloud)',
      url: 'https://api.replicate.com',
      isLocal: false,
      isConnected: false,
      capabilities: ['txt2img', 'img2img', 'batch'],
      maxBatchSize: 4,
      supportsControlNet: true,
      supportsImg2Img: true,
      supportsInpainting: false,
    },
    stability: {
      id: 'stability-cloud',
      type: 'stability',
      name: 'Stability AI (Cloud)',
      url: 'https://api.stability.ai',
      isLocal: false,
      isConnected: false,
      capabilities: ['txt2img', 'img2img'],
      maxBatchSize: 10,
      supportsControlNet: false,
      supportsImg2Img: true,
      supportsInpainting: false,
    },
  };
  return defaults[type];
}
