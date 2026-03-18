import type {
  BackendConfig,
  GenerationParams,
  GeneratedImage,
  ModelInfo,
  ControlNetConfig,
} from '@/types';
import { BaseBackend, type ProgressCallback } from './base';
import { generateId } from '@/lib/utils';

interface ReplicatePrediction {
  id: string;
  status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  output?: string[];
  error?: string;
  logs?: string;
  metrics?: { predict_time?: number };
}

const MODEL_VERSIONS: Record<string, string> = {
  'sdxl': 'stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc',
  'flux-schnell': 'black-forest-labs/flux-schnell',
  'flux-dev': 'black-forest-labs/flux-dev',
  'flux-pro': 'black-forest-labs/flux-1.1-pro',
  'sd-1.5': 'stability-ai/stable-diffusion:ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
};

export class ReplicateBackend extends BaseBackend {
  constructor(config: BackendConfig) {
    super(config);
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      this.config.isConnected = res.ok;
      return res.ok;
    } catch {
      this.config.isConnected = false;
      return false;
    }
  }

  private getModelVersion(model: string): string {
    return MODEL_VERSIONS[model] ?? model;
  }

  async generate(
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const modelVersion = this.getModelVersion(params.model);

    const input: Record<string, unknown> = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      width: params.width,
      height: params.height,
      num_inference_steps: params.steps,
      guidance_scale: params.cfgScale,
      seed: params.seed,
      num_outputs: params.batchSize,
    };

    // Create prediction
    const isOfficialModel = modelVersion.includes('/') && !modelVersion.includes(':');
    const url = isOfficialModel
      ? `https://api.replicate.com/v1/models/${modelVersion}/predictions`
      : 'https://api.replicate.com/v1/predictions';

    const body: Record<string, unknown> = { input };
    if (!isOfficialModel) {
      body.version = modelVersion.split(':')[1] ?? modelVersion;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) throw new Error(`Replicate error: ${res.status} ${await res.text()}`);

    let prediction = (await res.json()) as ReplicatePrediction;

    // Poll for completion
    while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
      await new Promise((r) => setTimeout(r, 1000));

      const pollRes = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: this.headers,
      });
      prediction = (await pollRes.json()) as ReplicatePrediction;

      if (onProgress && prediction.status === 'processing') {
        const logLines = prediction.logs?.split('\n') ?? [];
        const progressLine = logLines.findLast((l) => l.includes('%'));
        let progress = 0.5;
        if (progressLine) {
          const match = progressLine.match(/(\d+)%/);
          if (match) progress = parseInt(match[1]) / 100;
        }
        onProgress({
          jobId: prediction.id,
          progress,
          currentStep: Math.floor(progress * params.steps),
          totalSteps: params.steps,
        });
      }
    }

    if (prediction.status === 'failed') {
      throw new Error(prediction.error ?? 'Generation failed');
    }

    const genTime = Date.now() - startTime;
    const outputs = prediction.output ?? [];

    return outputs.map((url, index) => ({
      id: generateId(),
      jobId: prediction.id,
      url,
      width: params.width,
      height: params.height,
      params,
      seed: params.seed + index,
      backendType: 'replicate' as const,
      generationTimeMs: genTime,
      fileSize: 0,
      metadata: {
        replicate_id: prediction.id,
        predict_time: prediction.metrics?.predict_time,
      },
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
    return this.generate(
      {
        ...params,
        prompt: params.prompt,
      },
      onProgress
    );
  }

  async listModels(): Promise<ModelInfo[]> {
    return Object.entries(MODEL_VERSIONS).map(([name, version]) => ({
      id: version,
      name,
      filename: version,
      type: 'checkpoint' as const,
      size: 0,
      baseModel: name.includes('flux') ? 'FLUX' : name.includes('xl') ? 'SDXL' : 'SD 1.5',
      tags: ['cloud', 'replicate'],
      isDownloaded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async loadModel(_modelName: string): Promise<void> {
    // No-op for cloud backends
  }

  async listSamplers(): Promise<string[]> {
    return ['euler', 'euler_a', 'dpmpp_2m', 'dpmpp_2m_sde', 'ddim'];
  }

  async listControlNetModels(): Promise<string[]> {
    return ['canny', 'depth', 'openpose'];
  }

  async preprocessControlNet(
    image: string,
    _config: ControlNetConfig
  ): Promise<string> {
    return image;
  }

  async cancelGeneration(jobId: string): Promise<void> {
    await fetch(`https://api.replicate.com/v1/predictions/${jobId}/cancel`, {
      method: 'POST',
      headers: this.headers,
    });
  }

  async getQueueStatus(): Promise<{ pending: number; running: number }> {
    return { pending: 0, running: 0 };
  }
}
