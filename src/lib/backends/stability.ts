import type {
  BackendConfig,
  GenerationParams,
  GeneratedImage,
  ModelInfo,
  ControlNetConfig,
} from '@/types';
import { BaseBackend, type ProgressCallback } from './base';
import { generateId } from '@/lib/utils';

interface StabilityImage {
  base64: string;
  seed: number;
  finish_reason: string;
}

const STABILITY_ENGINES = [
  { id: 'stable-diffusion-xl-1024-v1-0', name: 'SDXL 1.0', baseModel: 'SDXL' },
  { id: 'stable-diffusion-v1-6', name: 'SD 1.6', baseModel: 'SD 1.5' },
  { id: 'stable-diffusion-xl-beta-v2-2-2', name: 'SDXL Beta', baseModel: 'SDXL' },
  { id: 'stable-diffusion-512-v2-1', name: 'SD 2.1', baseModel: 'SD 2.1' },
  { id: 'stable-diffusion-xl-1024-v0-9', name: 'SDXL 0.9', baseModel: 'SDXL' },
];

export class StabilityBackend extends BaseBackend {
  private baseUrl = 'https://api.stability.ai';

  constructor(config: BackendConfig) {
    super(config);
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/user/account`, {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      this.config.isConnected = res.ok;
      return res.ok;
    } catch {
      this.config.isConnected = false;
      return false;
    }
  }

  async generate(
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const engineId = params.model || 'stable-diffusion-xl-1024-v1-0';

    const body = {
      text_prompts: [
        { text: params.prompt, weight: 1 },
        ...(params.negativePrompt
          ? [{ text: params.negativePrompt, weight: -1 }]
          : []),
      ],
      cfg_scale: params.cfgScale,
      width: params.width,
      height: params.height,
      steps: params.steps,
      seed: params.seed,
      samples: params.batchSize,
      sampler: this.mapSampler(params.sampler),
    };

    if (onProgress) {
      onProgress({
        jobId: 'stability',
        progress: 0.1,
        currentStep: 0,
        totalSteps: params.steps,
      });
    }

    const res = await fetch(
      `${this.baseUrl}/v1/generation/${engineId}/text-to-image`,
      {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Stability API error: ${res.status} ${errText}`);
    }

    const data = await res.json();
    const genTime = Date.now() - startTime;

    return (data.artifacts as StabilityImage[]).map((img, index) => ({
      id: generateId(),
      jobId: generateId(),
      url: `data:image/png;base64,${img.base64}`,
      width: params.width,
      height: params.height,
      params,
      seed: img.seed,
      backendType: 'stability' as const,
      generationTimeMs: genTime,
      fileSize: Math.ceil(img.base64.length * 0.75),
      metadata: { finish_reason: img.finish_reason, engine: engineId },
      isFavorite: false,
      tags: [],
      createdAt: new Date().toISOString(),
    }));
  }

  async img2img(
    params: GenerationParams,
    initImage: string,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const engineId = params.model || 'stable-diffusion-xl-1024-v1-0';

    const formData = new FormData();
    formData.append('text_prompts[0][text]', params.prompt);
    formData.append('text_prompts[0][weight]', '1');
    if (params.negativePrompt) {
      formData.append('text_prompts[1][text]', params.negativePrompt);
      formData.append('text_prompts[1][weight]', '-1');
    }
    formData.append('init_image_mode', 'IMAGE_STRENGTH');
    formData.append('image_strength', String(1 - (params.denoisingStrength ?? 0.75)));
    formData.append('cfg_scale', String(params.cfgScale));
    formData.append('steps', String(params.steps));
    formData.append('seed', String(params.seed));
    formData.append('samples', String(params.batchSize));

    // Convert base64 to blob if needed
    if (initImage.startsWith('data:')) {
      const base64Data = initImage.split(',')[1];
      const byteArray = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
      const blob = new Blob([byteArray], { type: 'image/png' });
      formData.append('init_image', blob);
    }

    if (onProgress) {
      onProgress({ jobId: 'stability', progress: 0.1, currentStep: 0, totalSteps: params.steps });
    }

    const res = await fetch(
      `${this.baseUrl}/v1/generation/${engineId}/image-to-image`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          Accept: 'application/json',
        },
        body: formData,
      }
    );

    if (!res.ok) throw new Error(`Stability img2img error: ${res.status}`);
    const data = await res.json();
    const genTime = Date.now() - startTime;

    return (data.artifacts as StabilityImage[]).map((img) => ({
      id: generateId(),
      jobId: generateId(),
      url: `data:image/png;base64,${img.base64}`,
      width: params.width,
      height: params.height,
      params,
      seed: img.seed,
      backendType: 'stability' as const,
      generationTimeMs: genTime,
      fileSize: Math.ceil(img.base64.length * 0.75),
      metadata: {},
      isFavorite: false,
      tags: [],
      createdAt: new Date().toISOString(),
    }));
  }

  private mapSampler(sampler: string): string {
    const mapping: Record<string, string> = {
      ddim: 'DDIM',
      ddpm: 'DDPM',
      dpmpp_2s_a: 'K_DPM_2_ANCESTRAL',
      dpmpp_2m: 'K_DPM_2',
      euler: 'K_EULER',
      euler_a: 'K_EULER_ANCESTRAL',
      heun: 'K_HEUN',
      plms: 'K_LMS',
    };
    return mapping[sampler] ?? 'K_DPM_2';
  }

  async listModels(): Promise<ModelInfo[]> {
    return STABILITY_ENGINES.map((e) => ({
      id: e.id,
      name: e.name,
      filename: e.id,
      type: 'checkpoint' as const,
      size: 0,
      baseModel: e.baseModel,
      tags: ['cloud', 'stability'],
      isDownloaded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async loadModel(_modelName: string): Promise<void> {}
  async listSamplers(): Promise<string[]> {
    return ['DDIM', 'DDPM', 'K_DPM_2', 'K_DPM_2_ANCESTRAL', 'K_EULER', 'K_EULER_ANCESTRAL', 'K_HEUN', 'K_LMS'];
  }
  async listControlNetModels(): Promise<string[]> { return []; }
  async preprocessControlNet(image: string, _config: ControlNetConfig): Promise<string> { return image; }
  async cancelGeneration(_jobId: string): Promise<void> {}
  async getQueueStatus(): Promise<{ pending: number; running: number }> {
    return { pending: 0, running: 0 };
  }
}
