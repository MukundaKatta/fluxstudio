import type { FluxNode, NodeCategory, NodePort } from '@/types';
import { generateId } from '@/lib/utils';

interface NodeDefinition {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  inputs: Omit<NodePort, 'id' | 'connectedTo'>[];
  outputs: Omit<NodePort, 'id' | 'connectedTo'>[];
  defaults: Record<string, unknown>;
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // --- Input Nodes ---
  {
    type: 'load_checkpoint',
    category: 'model',
    label: 'Load Checkpoint',
    description: 'Load a Stable Diffusion model checkpoint',
    inputs: [],
    outputs: [
      { name: 'MODEL', type: 'model', required: false },
      { name: 'CLIP', type: 'clip', required: false },
      { name: 'VAE', type: 'vae', required: false },
    ],
    defaults: { checkpoint: '' },
  },
  {
    type: 'load_vae',
    category: 'model',
    label: 'Load VAE',
    description: 'Load a VAE model',
    inputs: [],
    outputs: [{ name: 'VAE', type: 'vae', required: false }],
    defaults: { vae: '' },
  },
  {
    type: 'load_lora',
    category: 'model',
    label: 'Load LoRA',
    description: 'Load and apply a LoRA model',
    inputs: [
      { name: 'MODEL', type: 'model', required: true },
      { name: 'CLIP', type: 'clip', required: true },
    ],
    outputs: [
      { name: 'MODEL', type: 'model', required: false },
      { name: 'CLIP', type: 'clip', required: false },
    ],
    defaults: { lora: '', strength_model: 1.0, strength_clip: 1.0 },
  },
  {
    type: 'load_controlnet',
    category: 'controlnet',
    label: 'Load ControlNet',
    description: 'Load a ControlNet model',
    inputs: [],
    outputs: [{ name: 'CONTROLNET', type: 'controlnet', required: false }],
    defaults: { controlnet: '' },
  },
  {
    type: 'load_image',
    category: 'input',
    label: 'Load Image',
    description: 'Load an image from file or URL',
    inputs: [],
    outputs: [
      { name: 'IMAGE', type: 'image', required: false },
      { name: 'MASK', type: 'mask', required: false },
    ],
    defaults: { image: '' },
  },

  // --- Conditioning ---
  {
    type: 'clip_text_encode',
    category: 'conditioning',
    label: 'CLIP Text Encode',
    description: 'Encode text prompt with CLIP',
    inputs: [{ name: 'CLIP', type: 'clip', required: true }],
    outputs: [{ name: 'CONDITIONING', type: 'conditioning', required: false }],
    defaults: { text: '' },
  },
  {
    type: 'conditioning_combine',
    category: 'conditioning',
    label: 'Conditioning Combine',
    description: 'Combine two conditioning inputs',
    inputs: [
      { name: 'COND_A', type: 'conditioning', required: true },
      { name: 'COND_B', type: 'conditioning', required: true },
    ],
    outputs: [{ name: 'CONDITIONING', type: 'conditioning', required: false }],
    defaults: {},
  },
  {
    type: 'apply_controlnet',
    category: 'controlnet',
    label: 'Apply ControlNet',
    description: 'Apply ControlNet to conditioning',
    inputs: [
      { name: 'CONDITIONING', type: 'conditioning', required: true },
      { name: 'CONTROLNET', type: 'controlnet', required: true },
      { name: 'IMAGE', type: 'image', required: true },
    ],
    outputs: [{ name: 'CONDITIONING', type: 'conditioning', required: false }],
    defaults: { strength: 1.0, start_percent: 0.0, end_percent: 1.0 },
  },

  // --- Latent ---
  {
    type: 'empty_latent',
    category: 'latent',
    label: 'Empty Latent Image',
    description: 'Create an empty latent image',
    inputs: [],
    outputs: [{ name: 'LATENT', type: 'latent', required: false }],
    defaults: { width: 512, height: 512, batch_size: 1 },
  },
  {
    type: 'vae_encode',
    category: 'latent',
    label: 'VAE Encode',
    description: 'Encode an image to latent space',
    inputs: [
      { name: 'IMAGE', type: 'image', required: true },
      { name: 'VAE', type: 'vae', required: true },
    ],
    outputs: [{ name: 'LATENT', type: 'latent', required: false }],
    defaults: {},
  },
  {
    type: 'vae_decode',
    category: 'latent',
    label: 'VAE Decode',
    description: 'Decode latent to image',
    inputs: [
      { name: 'LATENT', type: 'latent', required: true },
      { name: 'VAE', type: 'vae', required: true },
    ],
    outputs: [{ name: 'IMAGE', type: 'image', required: false }],
    defaults: {},
  },
  {
    type: 'latent_upscale',
    category: 'latent',
    label: 'Latent Upscale',
    description: 'Upscale latent image',
    inputs: [{ name: 'LATENT', type: 'latent', required: true }],
    outputs: [{ name: 'LATENT', type: 'latent', required: false }],
    defaults: { method: 'nearest-exact', width: 1024, height: 1024 },
  },

  // --- Sampler ---
  {
    type: 'ksampler',
    category: 'sampler',
    label: 'KSampler',
    description: 'Sample latent image with various methods',
    inputs: [
      { name: 'MODEL', type: 'model', required: true },
      { name: 'POSITIVE', type: 'conditioning', required: true },
      { name: 'NEGATIVE', type: 'conditioning', required: true },
      { name: 'LATENT', type: 'latent', required: true },
    ],
    outputs: [{ name: 'LATENT', type: 'latent', required: false }],
    defaults: {
      seed: 0,
      steps: 20,
      cfg: 7.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      denoise: 1.0,
    },
  },
  {
    type: 'ksampler_advanced',
    category: 'sampler',
    label: 'KSampler (Advanced)',
    description: 'Advanced sampler with start/end step control',
    inputs: [
      { name: 'MODEL', type: 'model', required: true },
      { name: 'POSITIVE', type: 'conditioning', required: true },
      { name: 'NEGATIVE', type: 'conditioning', required: true },
      { name: 'LATENT', type: 'latent', required: true },
    ],
    outputs: [{ name: 'LATENT', type: 'latent', required: false }],
    defaults: {
      seed: 0,
      steps: 20,
      cfg: 7.0,
      sampler_name: 'euler',
      scheduler: 'normal',
      start_at_step: 0,
      end_at_step: 20,
      add_noise: true,
      return_with_leftover_noise: false,
    },
  },

  // --- Image Processing ---
  {
    type: 'image_scale',
    category: 'image',
    label: 'Image Scale',
    description: 'Scale an image',
    inputs: [{ name: 'IMAGE', type: 'image', required: true }],
    outputs: [{ name: 'IMAGE', type: 'image', required: false }],
    defaults: { method: 'lanczos', width: 1024, height: 1024, crop: 'disabled' },
  },
  {
    type: 'image_sharpen',
    category: 'image',
    label: 'Image Sharpen',
    description: 'Sharpen an image',
    inputs: [{ name: 'IMAGE', type: 'image', required: true }],
    outputs: [{ name: 'IMAGE', type: 'image', required: false }],
    defaults: { amount: 1.0, radius: 1 },
  },
  {
    type: 'image_blend',
    category: 'image',
    label: 'Image Blend',
    description: 'Blend two images together',
    inputs: [
      { name: 'IMAGE_A', type: 'image', required: true },
      { name: 'IMAGE_B', type: 'image', required: true },
    ],
    outputs: [{ name: 'IMAGE', type: 'image', required: false }],
    defaults: { blend_factor: 0.5, blend_mode: 'normal' },
  },

  // --- Mask ---
  {
    type: 'mask_from_image',
    category: 'mask',
    label: 'Mask from Image',
    description: 'Extract mask from image alpha channel',
    inputs: [{ name: 'IMAGE', type: 'image', required: true }],
    outputs: [{ name: 'MASK', type: 'mask', required: false }],
    defaults: { channel: 'alpha' },
  },
  {
    type: 'mask_composite',
    category: 'mask',
    label: 'Mask Composite',
    description: 'Combine masks with operations',
    inputs: [
      { name: 'MASK_A', type: 'mask', required: true },
      { name: 'MASK_B', type: 'mask', required: true },
    ],
    outputs: [{ name: 'MASK', type: 'mask', required: false }],
    defaults: { operation: 'add' },
  },

  // --- Output ---
  {
    type: 'save_image',
    category: 'output',
    label: 'Save Image',
    description: 'Save generated image to gallery',
    inputs: [{ name: 'IMAGE', type: 'image', required: true }],
    outputs: [],
    defaults: { filename_prefix: 'FluxStudio' },
  },
  {
    type: 'preview_image',
    category: 'output',
    label: 'Preview Image',
    description: 'Preview image without saving',
    inputs: [{ name: 'IMAGE', type: 'image', required: true }],
    outputs: [],
    defaults: {},
  },

  // --- Utility ---
  {
    type: 'note',
    category: 'utility',
    label: 'Note',
    description: 'Add a text note to the graph',
    inputs: [],
    outputs: [],
    defaults: { text: '' },
  },
  {
    type: 'reroute',
    category: 'utility',
    label: 'Reroute',
    description: 'Reroute a connection',
    inputs: [{ name: 'INPUT', type: 'latent', required: true }],
    outputs: [{ name: 'OUTPUT', type: 'latent', required: false }],
    defaults: {},
  },
];

export function createNodeFromDefinition(
  type: string,
  position: { x: number; y: number }
): FluxNode | null {
  const def = NODE_DEFINITIONS.find((d) => d.type === type);
  if (!def) return null;

  return {
    id: generateId(),
    type: def.type,
    category: def.category,
    label: def.label,
    inputs: def.inputs.map((input) => ({
      ...input,
      id: generateId(),
    })),
    outputs: def.outputs.map((output) => ({
      ...output,
      id: generateId(),
    })),
    params: { ...def.defaults } as Record<string, string | number | boolean | null>,
    position,
  };
}

export function getNodeDefinitionsByCategory(): Record<NodeCategory, NodeDefinition[]> {
  const categories: Record<NodeCategory, NodeDefinition[]> = {
    input: [],
    sampler: [],
    conditioning: [],
    latent: [],
    image: [],
    mask: [],
    controlnet: [],
    model: [],
    output: [],
    utility: [],
  };

  for (const def of NODE_DEFINITIONS) {
    categories[def.category].push(def);
  }

  return categories;
}

export const NODE_TYPE_COLORS: Record<NodeCategory, string> = {
  input: '#4263eb',
  sampler: '#cc5de8',
  conditioning: '#ff922b',
  latent: '#51cf66',
  image: '#3bc9db',
  mask: '#ffd43b',
  controlnet: '#ff6b6b',
  model: '#748ffc',
  output: '#868e96',
  utility: '#495057',
};

export const DATA_TYPE_COLORS: Record<string, string> = {
  image: '#3bc9db',
  latent: '#51cf66',
  model: '#748ffc',
  clip: '#ffd43b',
  vae: '#ff922b',
  conditioning: '#ff922b',
  mask: '#ffd43b',
  controlnet: '#ff6b6b',
  number: '#868e96',
  string: '#868e96',
  boolean: '#868e96',
  enum: '#868e96',
};
