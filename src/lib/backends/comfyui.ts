import type {
  BackendConfig,
  GenerationParams,
  GeneratedImage,
  ModelInfo,
  ControlNetConfig,
} from '@/types';
import { BaseBackend, type ProgressCallback, type BackendProgressEvent } from './base';
import { generateId } from '@/lib/utils';

interface ComfyUIPromptResponse {
  prompt_id: string;
}

interface ComfyUIHistory {
  [promptId: string]: {
    outputs: {
      [nodeId: string]: {
        images?: Array<{ filename: string; subfolder: string; type: string }>;
      };
    };
  };
}

export class ComfyUIBackend extends BaseBackend {
  private wsConnection: WebSocket | null = null;
  private clientId: string;

  constructor(config: BackendConfig) {
    super(config);
    this.clientId = generateId();
  }

  async checkConnection(): Promise<boolean> {
    try {
      const res = await fetch(`${this.config.url}/system_stats`);
      this.config.isConnected = res.ok;
      return res.ok;
    } catch {
      this.config.isConnected = false;
      return false;
    }
  }

  private buildWorkflow(params: GenerationParams): Record<string, unknown> {
    const workflow: Record<string, unknown> = {};

    // KSampler node
    workflow['3'] = {
      class_type: 'KSampler',
      inputs: {
        seed: params.seed,
        steps: params.steps,
        cfg: params.cfgScale,
        sampler_name: params.sampler,
        scheduler: params.scheduler,
        denoise: params.denoisingStrength ?? 1.0,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0],
      },
    };

    // Checkpoint loader
    workflow['4'] = {
      class_type: 'CheckpointLoaderSimple',
      inputs: { ckpt_name: params.model },
    };

    // Empty latent image
    workflow['5'] = {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: params.width,
        height: params.height,
        batch_size: params.batchSize,
      },
    };

    // CLIP text encode positive
    workflow['6'] = {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: params.prompt,
        clip: ['4', 1],
      },
    };

    // CLIP text encode negative
    workflow['7'] = {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: params.negativePrompt,
        clip: ['4', 1],
      },
    };

    // VAE decode
    workflow['8'] = {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: params.vae ? ['10', 0] : ['4', 2],
      },
    };

    // Save image
    workflow['9'] = {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'FluxStudio',
        images: ['8', 0],
      },
    };

    // Optional VAE loader
    if (params.vae) {
      workflow['10'] = {
        class_type: 'VAELoader',
        inputs: { vae_name: params.vae },
      };
    }

    // LoRA loaders (chained)
    let lastModelOutput: [string, number] = ['4', 0];
    let lastClipOutput: [string, number] = ['4', 1];

    params.loras.forEach((lora, index) => {
      const nodeId = `${20 + index}`;
      workflow[nodeId] = {
        class_type: 'LoraLoader',
        inputs: {
          lora_name: lora.name,
          strength_model: lora.weight,
          strength_clip: lora.weight,
          model: lastModelOutput,
          clip: lastClipOutput,
        },
      };
      lastModelOutput = [nodeId, 0];
      lastClipOutput = [nodeId, 1];
    });

    // Update KSampler to use last LoRA output
    if (params.loras.length > 0) {
      (workflow['3'] as Record<string, unknown>).inputs = {
        ...((workflow['3'] as Record<string, unknown>).inputs as Record<string, unknown>),
        model: lastModelOutput,
      };
      (workflow['6'] as Record<string, unknown>).inputs = {
        ...((workflow['6'] as Record<string, unknown>).inputs as Record<string, unknown>),
        clip: lastClipOutput,
      };
      (workflow['7'] as Record<string, unknown>).inputs = {
        ...((workflow['7'] as Record<string, unknown>).inputs as Record<string, unknown>),
        clip: lastClipOutput,
      };
    }

    // ControlNet
    params.controlNets
      .filter((cn) => cn.enabled && cn.inputImage)
      .forEach((cn, index) => {
        const loaderId = `${40 + index * 2}`;
        const applyId = `${41 + index * 2}`;

        workflow[loaderId] = {
          class_type: 'ControlNetLoader',
          inputs: { control_net_name: cn.model },
        };

        workflow[applyId] = {
          class_type: 'ControlNetApplyAdvanced',
          inputs: {
            strength: cn.weight,
            start_percent: cn.guidanceStart,
            end_percent: cn.guidanceEnd,
            positive: index === 0 ? ['6', 0] : [`${39 + index * 2}`, 0],
            negative: index === 0 ? ['7', 0] : [`${39 + index * 2}`, 1],
            control_net: [loaderId, 0],
            image: ['__controlnet_image__', 0],
          },
        };
      });

    return workflow;
  }

  async generate(
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const workflow = this.buildWorkflow(params);
    const promptPayload = {
      prompt: workflow,
      client_id: this.clientId,
    };

    // Queue the prompt
    const res = await fetch(`${this.config.url}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(promptPayload),
    });

    if (!res.ok) {
      throw new Error(`ComfyUI error: ${res.status} ${await res.text()}`);
    }

    const { prompt_id } = (await res.json()) as ComfyUIPromptResponse;

    // Monitor progress via WebSocket
    if (onProgress) {
      await this.monitorProgress(prompt_id, params.steps, onProgress);
    } else {
      await this.waitForCompletion(prompt_id);
    }

    // Fetch results
    const historyRes = await fetch(`${this.config.url}/history/${prompt_id}`);
    const history = (await historyRes.json()) as ComfyUIHistory;
    const outputs = history[prompt_id]?.outputs ?? {};

    const images: GeneratedImage[] = [];
    for (const nodeId of Object.keys(outputs)) {
      const nodeOutputs = outputs[nodeId];
      if (nodeOutputs.images) {
        for (const img of nodeOutputs.images) {
          const imageUrl = `${this.config.url}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`;
          images.push({
            id: generateId(),
            jobId: prompt_id,
            url: imageUrl,
            width: params.width,
            height: params.height,
            params,
            seed: params.seed,
            backendType: 'comfyui',
            generationTimeMs: 0,
            fileSize: 0,
            metadata: { comfyui_prompt_id: prompt_id, node_id: nodeId },
            isFavorite: false,
            tags: [],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    return images;
  }

  async img2img(
    params: GenerationParams,
    initImage: string,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]> {
    const workflow = this.buildWorkflow({
      ...params,
      denoisingStrength: params.denoisingStrength ?? 0.75,
    });

    // Replace empty latent with LoadImage + VAEEncode
    delete workflow['5'];
    workflow['5a'] = {
      class_type: 'LoadImage',
      inputs: { image: initImage },
    };
    workflow['5'] = {
      class_type: 'VAEEncode',
      inputs: {
        pixels: ['5a', 0],
        vae: params.vae ? ['10', 0] : ['4', 2],
      },
    };

    const res = await fetch(`${this.config.url}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: workflow, client_id: this.clientId }),
    });

    if (!res.ok) throw new Error(`ComfyUI img2img error: ${res.status}`);
    const { prompt_id } = (await res.json()) as ComfyUIPromptResponse;

    if (onProgress) {
      await this.monitorProgress(prompt_id, params.steps, onProgress);
    } else {
      await this.waitForCompletion(prompt_id);
    }

    const historyRes = await fetch(`${this.config.url}/history/${prompt_id}`);
    const history = (await historyRes.json()) as ComfyUIHistory;
    const outputs = history[prompt_id]?.outputs ?? {};
    const images: GeneratedImage[] = [];

    for (const nodeId of Object.keys(outputs)) {
      if (outputs[nodeId].images) {
        for (const img of outputs[nodeId].images!) {
          images.push({
            id: generateId(),
            jobId: prompt_id,
            url: `${this.config.url}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder)}&type=${img.type}`,
            width: params.width,
            height: params.height,
            params,
            seed: params.seed,
            backendType: 'comfyui',
            generationTimeMs: 0,
            fileSize: 0,
            metadata: { comfyui_prompt_id: prompt_id },
            isFavorite: false,
            tags: [],
            createdAt: new Date().toISOString(),
          });
        }
      }
    }
    return images;
  }

  private monitorProgress(
    promptId: string,
    totalSteps: number,
    onProgress: ProgressCallback
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = this.config.url.replace('http', 'ws');
      const ws = new WebSocket(`${wsUrl}/ws?clientId=${this.clientId}`);
      this.wsConnection = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          if (data.type === 'progress') {
            const progressEvent: BackendProgressEvent = {
              jobId: promptId,
              progress: data.data.value / data.data.max,
              currentStep: data.data.value,
              totalSteps: data.data.max,
            };
            onProgress(progressEvent);
          }
          if (data.type === 'executing' && data.data.node === null) {
            ws.close();
            resolve();
          }
          if (data.type === 'execution_error') {
            ws.close();
            reject(new Error(data.data.exception_message ?? 'Execution error'));
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        reject(new Error('WebSocket connection failed'));
      };

      ws.onclose = () => {
        this.wsConnection = null;
      };
    });
  }

  private async waitForCompletion(promptId: string): Promise<void> {
    const maxWait = 600000; // 10 minutes
    const pollInterval = 1000;
    const start = Date.now();

    while (Date.now() - start < maxWait) {
      const res = await fetch(`${this.config.url}/history/${promptId}`);
      const history = (await res.json()) as ComfyUIHistory;
      if (history[promptId]) return;
      await new Promise((r) => setTimeout(r, pollInterval));
    }

    throw new Error('Generation timed out');
  }

  async listModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.config.url}/object_info/CheckpointLoaderSimple`);
    if (!res.ok) return [];
    const data = await res.json();
    const modelNames: string[] =
      data.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0] ?? [];

    return modelNames.map((name) => ({
      id: name,
      name: name.replace(/\.[^.]+$/, ''),
      filename: name,
      type: 'checkpoint' as const,
      size: 0,
      baseModel: 'Unknown',
      tags: [],
      isDownloaded: true,
      localPath: name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
  }

  async loadModel(_modelName: string): Promise<void> {
    // ComfyUI loads models on-demand when generating
  }

  async listSamplers(): Promise<string[]> {
    const res = await fetch(`${this.config.url}/object_info/KSampler`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.KSampler?.input?.required?.sampler_name?.[0] ?? [];
  }

  async listControlNetModels(): Promise<string[]> {
    const res = await fetch(`${this.config.url}/object_info/ControlNetLoader`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.ControlNetLoader?.input?.required?.control_net_name?.[0] ?? [];
  }

  async preprocessControlNet(
    _image: string,
    _config: ControlNetConfig
  ): Promise<string> {
    // ComfyUI handles preprocessing in the workflow
    return _image;
  }

  async cancelGeneration(_jobId: string): Promise<void> {
    await fetch(`${this.config.url}/interrupt`, { method: 'POST' });
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
  }

  async getQueueStatus(): Promise<{ pending: number; running: number }> {
    const res = await fetch(`${this.config.url}/queue`);
    if (!res.ok) return { pending: 0, running: 0 };
    const data = await res.json();
    return {
      pending: data.queue_pending?.length ?? 0,
      running: data.queue_running?.length ?? 0,
    };
  }
}
