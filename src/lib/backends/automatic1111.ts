import type {
  BackendConfig,
  GenerationParams,
  GeneratedImage,
  ModelInfo,
  ControlNetConfig,
} from '@/types';
import { BaseBackend, type ProgressCallback } from './base';
import { generateId } from '@/lib/utils';

interface A1111Txt2ImgResponse {
  images: string[];
  parameters: Record<string, unknown>;
  info: string;
}

interface A1111ProgressResponse {
  progress: number;
  eta_relative: number;
  state: { sampling_step: number; sampling_steps: number };
  current_image?: string;
}

export class Automatic1111Backend extends BaseBackend {
  constructor(config: BackendConfig) {
    super(config);
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.url}/sdapi/v1/options`);
      this.config.isConnected = res.ok;
      return res.ok;
    } catch {
      this.config.isConnected = false;
      return false;
    }
  }

  private buildPayload(params: GenerationParams): Record<string, unknown> {
    const payload: Record<string, unknown> = {
      prompt: params.prompt,
      negative_prompt: params.negativePrompt,
      width: params.width,
      height: params.height,
      steps: params.steps,
      cfg_scale: params.cfgScale,
      sampler_name: this.mapSamplerName(params.sampler),
      seed: params.seed,
      batch_size: params.batchSize,
      n_iter: params.batchCount,
      override_settings: {
        sd_model_checkpoint: params.model,
        CLIP_stop_at_last_layers: params.clipSkip,
      },
    };

    if (params.vae) {
      (payload.override_settings as Record<string, unknown>).sd_vae = params.vae;
    }

    // Hires fix
    if (params.hiresEnabled) {
      payload.enable_hr = true;
      payload.hr_upscaler = params.hiresUpscaler ?? 'Latent';
      payload.hr_second_pass_steps = params.hiresSteps ?? 0;
      payload.hr_scale = params.hiresScale ?? 2;
      payload.denoising_strength = params.hiresDenoisingStrength ?? 0.7;
    }

    // ControlNet
    const activeControlNets = params.controlNets.filter((cn) => cn.enabled && cn.inputImage);
    if (activeControlNets.length > 0) {
      payload.alwayson_scripts = {
        controlnet: {
          args: activeControlNets.map((cn) => ({
            enabled: true,
            module: cn.preprocessor,
            model: cn.model,
            weight: cn.weight,
            resize_mode: cn.resizeMode === 'resize' ? 0 : cn.resizeMode === 'crop' ? 1 : 2,
            control_mode: cn.controlMode === 'balanced' ? 0 : cn.controlMode === 'prompt' ? 1 : 2,
            guidance_start: cn.guidanceStart,
            guidance_end: cn.guidanceEnd,
            pixel_perfect: cn.pixelPerfect,
            input_image: cn.inputImage,
            low_vram: cn.lowVram,
          })),
        },
      };
    }

    return payload;
  }

  private mapSamplerName(sampler: string): string {
    const mapping: Record<string, string> = {
      euler: 'Euler',
      euler_a: 'Euler a',
      heun: 'Heun',
      dpm_2: 'DPM2',
      dpm_2_a: 'DPM2 a',
      dpmpp_2s_a: 'DPM++ 2S a',
      dpmpp_2m: 'DPM++ 2M',
      dpmpp_sde: 'DPM++ SDE',
      dpmpp_2m_sde: 'DPM++ 2M SDE',
      dpmpp_3m_sde: 'DPM++ 3M SDE',
      ddim: 'DDIM',
      plms: 'PLMS',
      uni_pc: 'UniPC',
      lcm: 'LCM',
      ddpm: 'DDPM',
    };
    return mapping[sampler] ?? sampler;
  }

  async generate(
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const payload = this.buildPayload(params);

    const generatePromise = fetch(`${this.config.url}/sdapi/v1/txt2img`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    // Poll progress
    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (onProgress) {
      progressInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`${this.config.url}/sdapi/v1/progress`);
          if (progressRes.ok) {
            const progress = (await progressRes.json()) as A1111ProgressResponse;
            onProgress({
              jobId: 'current',
              progress: progress.progress,
              currentStep: progress.state.sampling_step,
              totalSteps: progress.state.sampling_steps,
              previewImage: progress.current_image
                ? `data:image/png;base64,${progress.current_image}`
                : undefined,
            });
          }
        } catch {
          // Ignore progress errors
        }
      }, 500);
    }

    try {
      const res = await generatePromise;
      if (!res.ok) throw new Error(`A1111 error: ${res.status} ${await res.text()}`);

      const data = (await res.json()) as A1111Txt2ImgResponse;
      const genTime = Date.now() - startTime;

      const infoObj = JSON.parse(data.info);

      return data.images.map((base64, index) => ({
        id: generateId(),
        jobId: generateId(),
        url: `data:image/png;base64,${base64}`,
        width: params.width,
        height: params.height,
        params,
        seed: (infoObj.all_seeds?.[index] ?? params.seed) as number,
        backendType: 'automatic1111' as const,
        generationTimeMs: genTime,
        fileSize: Math.ceil(base64.length * 0.75),
        metadata: { info: infoObj },
        isFavorite: false,
        tags: [],
        createdAt: new Date().toISOString(),
      }));
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
  }

  async img2img(
    params: GenerationParams,
    initImage: string,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const startTime = Date.now();
    const payload = {
      ...this.buildPayload(params),
      init_images: [initImage],
      denoising_strength: params.denoisingStrength ?? 0.75,
      mask: params.maskImage ?? null,
    };

    let progressInterval: ReturnType<typeof setInterval> | null = null;
    if (onProgress) {
      progressInterval = setInterval(async () => {
        try {
          const progressRes = await fetch(`${this.config.url}/sdapi/v1/progress`);
          if (progressRes.ok) {
            const progress = (await progressRes.json()) as A1111ProgressResponse;
            onProgress({
              jobId: 'current',
              progress: progress.progress,
              currentStep: progress.state.sampling_step,
              totalSteps: progress.state.sampling_steps,
            });
          }
        } catch {
          // Ignore
        }
      }, 500);
    }

    try {
      const res = await fetch(`${this.config.url}/sdapi/v1/img2img`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(`A1111 img2img error: ${res.status}`);
      const data = (await res.json()) as A1111Txt2ImgResponse;
      const genTime = Date.now() - startTime;
      const infoObj = JSON.parse(data.info);

      return data.images.map((base64, index) => ({
        id: generateId(),
        jobId: generateId(),
        url: `data:image/png;base64,${base64}`,
        width: params.width,
        height: params.height,
        params,
        seed: (infoObj.all_seeds?.[index] ?? params.seed) as number,
        backendType: 'automatic1111' as const,
        generationTimeMs: genTime,
        fileSize: Math.ceil(base64.length * 0.75),
        metadata: {},
        isFavorite: false,
        tags: [],
        createdAt: new Date().toISOString(),
      }));
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.config.url}/sdapi/v1/sd-models`);
    if (!res.ok) return [];
    const models = await res.json();
    return models.map((m: Record<string, unknown>) => ({
      id: m.hash ?? m.model_name,
      name: m.model_name as string,
      filename: m.filename as string,
      type: 'checkpoint' as const,
      hash: m.hash as string,
      size: 0,
      baseModel: 'Unknown',
      tags: [],
      isDownloaded: true,
      localPath: m.filename as string,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async loadModel(modelName: string): Promise<void> {
    await fetch(`${this.config.url}/sdapi/v1/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sd_model_checkpoint: modelName }),
    });
  }

  async listSamplers(): Promise<string[]> {
    const res = await fetch(`${this.config.url}/sdapi/v1/samplers`);
    if (!res.ok) return [];
    const samplers = await res.json();
    return samplers.map((s: Record<string, unknown>) => s.name as string);
  }

  async listControlNetModels(): Promise<string[]> {
    try {
      const res = await fetch(`${this.config.url}/controlnet/model_list`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.model_list ?? [];
    } catch {
      return [];
    }
  }

  async preprocessControlNet(
    image: string,
    config: ControlNetConfig
  ): Promise<string> {
    const res = await fetch(`${this.config.url}/controlnet/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        controlnet_module: config.preprocessor,
        controlnet_input_images: [image],
        controlnet_processor_res: 512,
        controlnet_threshold_a: 64,
        controlnet_threshold_b: 64,
      }),
    });

    if (!res.ok) throw new Error('ControlNet preprocessing failed');
    const data = await res.json();
    return data.images?.[0] ?? image;
  }

  async cancelGeneration(_jobId: string): Promise<void> {
    await fetch(`${this.config.url}/sdapi/v1/interrupt`, { method: 'POST' });
  }

  async getQueueStatus(): Promise<{ pending: number; running: number }> {
    try {
      const res = await fetch(`${this.config.url}/sdapi/v1/progress`);
      if (!res.ok) return { pending: 0, running: 0 };
      const data = (await res.json()) as A1111ProgressResponse;
      return {
        pending: 0,
        running: data.progress > 0 && data.progress < 1 ? 1 : 0,
      };
    } catch {
      return { pending: 0, running: 0 };
    }
  }
}
