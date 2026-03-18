// ============================================================
// FluxStudio Core Type Definitions
// ============================================================

// --- Backend Types ---
export type BackendType = 'comfyui' | 'automatic1111' | 'replicate' | 'stability';

export interface BackendConfig {
  id: string;
  type: BackendType;
  name: string;
  url: string;
  apiKey?: string;
  isLocal: boolean;
  isConnected: boolean;
  capabilities: BackendCapability[];
  maxBatchSize: number;
  supportsControlNet: boolean;
  supportsImg2Img: boolean;
  supportsInpainting: boolean;
}

export type BackendCapability =
  | 'txt2img'
  | 'img2img'
  | 'inpainting'
  | 'controlnet'
  | 'upscale'
  | 'lora'
  | 'vae'
  | 'batch'
  | 'queue';

// --- Model Types ---
export type ModelType = 'checkpoint' | 'lora' | 'vae' | 'controlnet' | 'embedding' | 'upscaler' | 'hypernetwork';

export interface ModelInfo {
  id: string;
  name: string;
  filename: string;
  type: ModelType;
  hash?: string;
  size: number;
  baseModel: string;
  description?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
  civitaiId?: string;
  tags: string[];
  isDownloaded: boolean;
  downloadProgress?: number;
  localPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ModelDownloadRequest {
  url: string;
  type: ModelType;
  targetDir?: string;
  filename?: string;
}

// --- Generation Types ---
export interface GenerationParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: SamplerName;
  scheduler: SchedulerName;
  seed: number;
  batchSize: number;
  batchCount: number;
  model: string;
  vae?: string;
  clipSkip: number;
  denoisingStrength?: number;
  hiresEnabled: boolean;
  hiresUpscaler?: string;
  hiresSteps?: number;
  hiresScale?: number;
  hiresDenoisingStrength?: number;
  loras: LoraWeight[];
  controlNets: ControlNetConfig[];
  initImage?: string;
  maskImage?: string;
  styleName?: string;
}

export type SamplerName =
  | 'euler'
  | 'euler_a'
  | 'heun'
  | 'dpm_2'
  | 'dpm_2_a'
  | 'dpmpp_2s_a'
  | 'dpmpp_2m'
  | 'dpmpp_sde'
  | 'dpmpp_2m_sde'
  | 'dpmpp_3m_sde'
  | 'ddim'
  | 'plms'
  | 'uni_pc'
  | 'lcm'
  | 'ddpm';

export type SchedulerName =
  | 'normal'
  | 'karras'
  | 'exponential'
  | 'sgm_uniform'
  | 'simple'
  | 'ddim_uniform'
  | 'beta';

export interface LoraWeight {
  name: string;
  weight: number;
  modelId?: string;
}

// --- ControlNet ---
export type ControlNetPreprocessor =
  | 'none'
  | 'canny'
  | 'depth_midas'
  | 'depth_zoe'
  | 'openpose'
  | 'openpose_face'
  | 'openpose_hand'
  | 'openpose_full'
  | 'scribble'
  | 'softedge'
  | 'lineart'
  | 'lineart_anime'
  | 'normal_map'
  | 'segmentation'
  | 'shuffle'
  | 'tile'
  | 'mlsd'
  | 'mediapipe_face';

export interface ControlNetConfig {
  id: string;
  enabled: boolean;
  preprocessor: ControlNetPreprocessor;
  model: string;
  weight: number;
  startStep: number;
  endStep: number;
  controlMode: 'balanced' | 'prompt' | 'controlnet';
  resizeMode: 'resize' | 'crop' | 'fill';
  inputImage?: string;
  preprocessedImage?: string;
  guidanceStart: number;
  guidanceEnd: number;
  pixelPerfect: boolean;
  lowVram: boolean;
}

// --- Queue & Jobs ---
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface GenerationJob {
  id: string;
  params: GenerationParams;
  backendId: string;
  status: JobStatus;
  progress: number;
  currentStep?: number;
  totalSteps?: number;
  previewImage?: string;
  resultImages: GeneratedImage[];
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTimeMs?: number;
  priority: number;
}

export interface GeneratedImage {
  id: string;
  jobId: string;
  url: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  params: GenerationParams;
  seed: number;
  backendType: BackendType;
  generationTimeMs: number;
  fileSize: number;
  metadata: Record<string, unknown>;
  isFavorite: boolean;
  rating?: number;
  tags: string[];
  createdAt: string;
}

// --- Batch Processing ---
export interface BatchConfig {
  id: string;
  name: string;
  baseParams: GenerationParams;
  sweeps: ParameterSweep[];
  totalCombinations: number;
  status: JobStatus;
  completedCount: number;
  createdAt: string;
}

export interface ParameterSweep {
  parameter: keyof GenerationParams;
  values: (string | number)[];
  label?: string;
}

// --- Node Graph ---
export type NodeCategory =
  | 'input'
  | 'sampler'
  | 'conditioning'
  | 'latent'
  | 'image'
  | 'mask'
  | 'controlnet'
  | 'model'
  | 'output'
  | 'utility';

export interface FluxNode {
  id: string;
  type: string;
  category: NodeCategory;
  label: string;
  inputs: NodePort[];
  outputs: NodePort[];
  params: Record<string, NodeParamValue>;
  position: { x: number; y: number };
}

export interface NodePort {
  id: string;
  name: string;
  type: NodeDataType;
  required: boolean;
  defaultValue?: NodeParamValue;
  connectedTo?: string;
}

export type NodeDataType =
  | 'image'
  | 'latent'
  | 'model'
  | 'clip'
  | 'vae'
  | 'conditioning'
  | 'mask'
  | 'controlnet'
  | 'number'
  | 'string'
  | 'boolean'
  | 'enum';

export type NodeParamValue = string | number | boolean | null;

export interface NodeConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
}

export interface NodeGraph {
  id: string;
  name: string;
  description?: string;
  nodes: FluxNode[];
  connections: NodeConnection[];
  createdAt: string;
  updatedAt: string;
}

// --- Gallery ---
export interface GalleryFilter {
  search?: string;
  tags?: string[];
  models?: string[];
  dateRange?: { start: string; end: string };
  rating?: number;
  favoritesOnly?: boolean;
  sortBy: 'date' | 'rating' | 'name' | 'size';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

// --- LoRA Training ---
export interface TrainingConfig {
  id: string;
  name: string;
  baseModel: string;
  trainingImages: TrainingImage[];
  epochs: number;
  learningRate: number;
  networkRank: number;
  networkAlpha: number;
  batchSize: number;
  resolution: number;
  optimizer: 'AdamW' | 'AdamW8bit' | 'Lion' | 'Prodigy' | 'DAdaptation';
  scheduler: 'cosine' | 'cosine_with_restarts' | 'constant' | 'constant_with_warmup' | 'polynomial';
  warmupSteps: number;
  captionExtension: string;
  shuffleCaption: boolean;
  keepTokens: number;
  clipSkip: number;
  mixedPrecision: 'fp16' | 'bf16' | 'fp32';
  gradientAccumulationSteps: number;
  maxGradNorm: number;
  noiseOffset: number;
  status: 'idle' | 'preparing' | 'training' | 'completed' | 'failed';
  currentEpoch?: number;
  currentStep?: number;
  totalSteps?: number;
  loss?: number;
  outputPath?: string;
  createdAt: string;
}

export interface TrainingImage {
  id: string;
  url: string;
  caption: string;
  repeats: number;
}

// --- Extensions ---
export interface Extension {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  homepage?: string;
  isEnabled: boolean;
  isInstalled: boolean;
  hooks: ExtensionHook[];
  settings: Record<string, ExtensionSetting>;
}

export interface ExtensionHook {
  event: ExtensionEvent;
  priority: number;
}

export type ExtensionEvent =
  | 'beforeGenerate'
  | 'afterGenerate'
  | 'onPromptParse'
  | 'onImageProcess'
  | 'onNodeRegister'
  | 'onUIRender'
  | 'onModelLoad'
  | 'onQueueUpdate';

export interface ExtensionSetting {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select';
  value: NodeParamValue;
  options?: { label: string; value: NodeParamValue }[];
}

// --- Prompt Types ---
export interface ParsedPrompt {
  tokens: PromptToken[];
  raw: string;
}

export interface PromptToken {
  text: string;
  weight: number;
  type: 'text' | 'lora' | 'embedding' | 'break' | 'scheduled';
  scheduledFrom?: number;
  scheduledTo?: number;
}
