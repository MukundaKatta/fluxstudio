import type {
  BackendConfig,
  GenerationParams,
  GeneratedImage,
  ModelInfo,
  ControlNetConfig,
} from '@/types';

export interface BackendProgressEvent {
  jobId: string;
  progress: number;
  currentStep: number;
  totalSteps: number;
  previewImage?: string;
}

export type ProgressCallback = (event: BackendProgressEvent) => void;

export abstract class BaseBackend {
  protected config: BackendConfig;

  constructor(config: BackendConfig) {
    this.config = config;
  }

  get id() {
    return this.config.id;
  }
  get name() {
    return this.config.name;
  }
  get type() {
    return this.config.type;
  }

  abstract checkConnection(): Promise<boolean>;
  abstract generate(
    params: GenerationParams,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]>;
  abstract img2img(
    params: GenerationParams,
    initImage: string,
    onProgress?: ProgressCallback
  ): Promise<GeneratedImage[]>;
  abstract listModels(): Promise<ModelInfo[]>;
  abstract loadModel(modelName: string): Promise<void>;
  abstract listSamplers(): Promise<string[]>;
  abstract listControlNetModels(): Promise<string[]>;
  abstract preprocessControlNet(
    image: string,
    config: ControlNetConfig
  ): Promise<string>;
  abstract cancelGeneration(jobId: string): Promise<void>;
  abstract getQueueStatus(): Promise<{ pending: number; running: number }>;

  getConfig(): BackendConfig {
    return { ...this.config };
  }

  updateConfig(partial: Partial<BackendConfig>): void {
    Object.assign(this.config, partial);
  }
}
