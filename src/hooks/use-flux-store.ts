import { create } from 'zustand';
import { generateId, generateSeed } from '@/lib/utils';
import type {
  GenerationParams, GenerationJob, GeneratedImage, NodeGraph, FluxNode,
  NodeConnection, ModelInfo, TrainingConfig, BackendConfig, ControlNetConfig,
  LoraWeight, BatchConfig, GalleryFilter,
} from '@/types';

interface FluxStore {
  activeTab: 'generate' | 'graph' | 'gallery' | 'models' | 'training';
  params: GenerationParams;
  jobs: GenerationJob[];
  gallery: GeneratedImage[];
  models: ModelInfo[];
  currentGraph: NodeGraph | null;
  backends: BackendConfig[];
  activeBackendId: string | null;
  trainingConfigs: TrainingConfig[];
  isGenerating: boolean;

  setActiveTab: (tab: FluxStore['activeTab']) => void;
  updateParams: (updates: Partial<GenerationParams>) => void;
  randomizeSeed: () => void;
  addLora: (lora: LoraWeight) => void;
  removeLora: (name: string) => void;
  updateLora: (name: string, weight: number) => void;
  addControlNet: (cn: ControlNetConfig) => void;
  removeControlNet: (id: string) => void;
  updateControlNet: (id: string, updates: Partial<ControlNetConfig>) => void;

  addJob: (job: GenerationJob) => void;
  updateJob: (id: string, updates: Partial<GenerationJob>) => void;
  removeJob: (id: string) => void;

  addToGallery: (img: GeneratedImage) => void;
  removeFromGallery: (id: string) => void;
  toggleFavorite: (id: string) => void;

  setModels: (models: ModelInfo[]) => void;
  addModel: (model: ModelInfo) => void;
  updateModel: (id: string, updates: Partial<ModelInfo>) => void;
  removeModel: (id: string) => void;

  setCurrentGraph: (graph: NodeGraph | null) => void;
  addNodeToGraph: (node: FluxNode) => void;
  removeNodeFromGraph: (id: string) => void;
  updateNodeInGraph: (id: string, updates: Partial<FluxNode>) => void;
  addConnectionToGraph: (conn: NodeConnection) => void;
  removeConnectionFromGraph: (id: string) => void;

  addTrainingConfig: (config: TrainingConfig) => void;
  updateTrainingConfig: (id: string, updates: Partial<TrainingConfig>) => void;

  setIsGenerating: (v: boolean) => void;
}

const DEFAULT_PARAMS: GenerationParams = {
  prompt: '', negativePrompt: '', width: 512, height: 512, steps: 20, cfgScale: 7,
  sampler: 'euler_a', scheduler: 'normal', seed: -1, batchSize: 1, batchCount: 1,
  model: '', clipSkip: 1, hiresEnabled: false, loras: [], controlNets: [],
};

export const useFluxStore = create<FluxStore>((set, get) => ({
  activeTab: 'generate',
  params: { ...DEFAULT_PARAMS },
  jobs: [],
  gallery: [],
  models: [],
  currentGraph: null,
  backends: [],
  activeBackendId: null,
  trainingConfigs: [],
  isGenerating: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  updateParams: (updates) => set((s) => ({ params: { ...s.params, ...updates } })),
  randomizeSeed: () => set((s) => ({ params: { ...s.params, seed: generateSeed() } })),
  addLora: (lora) => set((s) => ({ params: { ...s.params, loras: [...s.params.loras, lora] } })),
  removeLora: (name) => set((s) => ({ params: { ...s.params, loras: s.params.loras.filter((l) => l.name !== name) } })),
  updateLora: (name, weight) => set((s) => ({ params: { ...s.params, loras: s.params.loras.map((l) => l.name === name ? { ...l, weight } : l) } })),
  addControlNet: (cn) => set((s) => ({ params: { ...s.params, controlNets: [...s.params.controlNets, cn] } })),
  removeControlNet: (id) => set((s) => ({ params: { ...s.params, controlNets: s.params.controlNets.filter((c) => c.id !== id) } })),
  updateControlNet: (id, updates) => set((s) => ({ params: { ...s.params, controlNets: s.params.controlNets.map((c) => c.id === id ? { ...c, ...updates } : c) } })),

  addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),
  updateJob: (id, updates) => set((s) => ({ jobs: s.jobs.map((j) => j.id === id ? { ...j, ...updates } : j) })),
  removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

  addToGallery: (img) => set((s) => ({ gallery: [img, ...s.gallery] })),
  removeFromGallery: (id) => set((s) => ({ gallery: s.gallery.filter((i) => i.id !== id) })),
  toggleFavorite: (id) => set((s) => ({ gallery: s.gallery.map((i) => i.id === id ? { ...i, isFavorite: !i.isFavorite } : i) })),

  setModels: (models) => set({ models }),
  addModel: (model) => set((s) => ({ models: [...s.models, model] })),
  updateModel: (id, updates) => set((s) => ({ models: s.models.map((m) => m.id === id ? { ...m, ...updates } : m) })),
  removeModel: (id) => set((s) => ({ models: s.models.filter((m) => m.id !== id) })),

  setCurrentGraph: (graph) => set({ currentGraph: graph }),
  addNodeToGraph: (node) => set((s) => {
    if (!s.currentGraph) return s;
    return { currentGraph: { ...s.currentGraph, nodes: [...s.currentGraph.nodes, node], updatedAt: new Date().toISOString() } };
  }),
  removeNodeFromGraph: (id) => set((s) => {
    if (!s.currentGraph) return s;
    return {
      currentGraph: {
        ...s.currentGraph,
        nodes: s.currentGraph.nodes.filter((n) => n.id !== id),
        connections: s.currentGraph.connections.filter((c) => c.sourceNodeId !== id && c.targetNodeId !== id),
        updatedAt: new Date().toISOString(),
      },
    };
  }),
  updateNodeInGraph: (id, updates) => set((s) => {
    if (!s.currentGraph) return s;
    return { currentGraph: { ...s.currentGraph, nodes: s.currentGraph.nodes.map((n) => n.id === id ? { ...n, ...updates } : n), updatedAt: new Date().toISOString() } };
  }),
  addConnectionToGraph: (conn) => set((s) => {
    if (!s.currentGraph) return s;
    return { currentGraph: { ...s.currentGraph, connections: [...s.currentGraph.connections, conn], updatedAt: new Date().toISOString() } };
  }),
  removeConnectionFromGraph: (id) => set((s) => {
    if (!s.currentGraph) return s;
    return { currentGraph: { ...s.currentGraph, connections: s.currentGraph.connections.filter((c) => c.id !== id), updatedAt: new Date().toISOString() } };
  }),

  addTrainingConfig: (config) => set((s) => ({ trainingConfigs: [...s.trainingConfigs, config] })),
  updateTrainingConfig: (id, updates) => set((s) => ({ trainingConfigs: s.trainingConfigs.map((c) => c.id === id ? { ...c, ...updates } : c) })),

  setIsGenerating: (v) => set({ isGenerating: v }),
}));
