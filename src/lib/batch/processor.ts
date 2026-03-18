import type { BatchConfig, GenerationParams, ParameterSweep } from '@/types';
import { cartesianProduct, generateId, generateSeed } from '@/lib/utils';

export function generateSweepCombinations(
  baseParams: GenerationParams,
  sweeps: ParameterSweep[]
): GenerationParams[] {
  if (sweeps.length === 0) return [baseParams];

  const sweepArrays = sweeps.map((s) => s.values);
  const combinations = cartesianProduct(...sweepArrays);

  return combinations.map((combo) => {
    const params = { ...baseParams };
    sweeps.forEach((sweep, index) => {
      const value = combo[index];
      const key = sweep.parameter;
      if (key === 'seed') {
        (params as Record<string, unknown>)[key] = Number(value) === -1 ? generateSeed() : Number(value);
      } else if (typeof params[key] === 'number') {
        (params as Record<string, unknown>)[key] = Number(value);
      } else {
        (params as Record<string, unknown>)[key] = value;
      }
    });
    return params;
  });
}

export function createBatchConfig(
  name: string,
  baseParams: GenerationParams,
  sweeps: ParameterSweep[]
): BatchConfig {
  const combinations = generateSweepCombinations(baseParams, sweeps);
  return {
    id: generateId(),
    name,
    baseParams,
    sweeps,
    totalCombinations: combinations.length,
    status: 'pending',
    completedCount: 0,
    createdAt: new Date().toISOString(),
  };
}

export function estimateBatchTime(
  totalCombinations: number,
  avgTimePerImage: number,
  concurrency: number
): number {
  return Math.ceil((totalCombinations * avgTimePerImage) / concurrency);
}

export const COMMON_SWEEPS: Record<string, ParameterSweep> = {
  cfgScale: {
    parameter: 'cfgScale',
    values: [3, 5, 7, 9, 12, 15],
    label: 'CFG Scale Range',
  },
  steps: {
    parameter: 'steps',
    values: [10, 20, 30, 50],
    label: 'Step Count',
  },
  samplers: {
    parameter: 'sampler',
    values: ['euler', 'euler_a', 'dpmpp_2m', 'dpmpp_2m_sde', 'ddim'],
    label: 'Sampler Comparison',
  },
  seeds: {
    parameter: 'seed',
    values: Array.from({ length: 4 }, () => generateSeed()),
    label: 'Random Seeds',
  },
  dimensions: {
    parameter: 'width',
    values: [512, 768, 1024],
    label: 'Image Width',
  },
  denoise: {
    parameter: 'denoisingStrength',
    values: [0.3, 0.5, 0.7, 0.9],
    label: 'Denoising Strength',
  },
};
