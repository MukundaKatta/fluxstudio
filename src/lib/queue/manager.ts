import type { GenerationJob, GenerationParams, GeneratedImage, JobStatus } from '@/types';
import { createBackend, type BaseBackend, type ProgressCallback } from '@/lib/backends';
import { generateId } from '@/lib/utils';

type QueueEventType = 'jobAdded' | 'jobStarted' | 'jobProgress' | 'jobCompleted' | 'jobFailed' | 'jobCancelled';
type QueueListener = (event: QueueEventType, job: GenerationJob) => void;

export class QueueManager {
  private jobs: Map<string, GenerationJob> = new Map();
  private backends: Map<string, BaseBackend> = new Map();
  private listeners: QueueListener[] = [];
  private isProcessing = false;
  private maxConcurrent: number;
  private runningCount = 0;

  constructor(maxConcurrent = 2) {
    this.maxConcurrent = maxConcurrent;
  }

  registerBackend(backend: BaseBackend): void {
    this.backends.set(backend.id, backend);
  }

  removeBackend(backendId: string): void {
    this.backends.delete(backendId);
  }

  addListener(listener: QueueListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(event: QueueEventType, job: GenerationJob): void {
    for (const listener of this.listeners) {
      listener(event, { ...job });
    }
  }

  enqueue(params: GenerationParams, backendId: string, priority = 0): string {
    const job: GenerationJob = {
      id: generateId(),
      params,
      backendId,
      status: 'pending',
      progress: 0,
      resultImages: [],
      createdAt: new Date().toISOString(),
      priority,
    };

    this.jobs.set(job.id, job);
    this.emit('jobAdded', job);
    this.processQueue();
    return job.id;
  }

  enqueueBatch(paramsList: GenerationParams[], backendId: string, priority = 0): string[] {
    const ids: string[] = [];
    for (const params of paramsList) {
      ids.push(this.enqueue(params, backendId, priority));
    }
    return ids;
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;

    if (job.status === 'pending') {
      job.status = 'cancelled';
      this.emit('jobCancelled', job);
    } else if (job.status === 'running') {
      const backend = this.backends.get(job.backendId);
      if (backend) {
        backend.cancelGeneration(jobId).catch(() => {});
      }
      job.status = 'cancelled';
      this.runningCount--;
      this.emit('jobCancelled', job);
      this.processQueue();
    }
  }

  cancelAll(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'pending' || job.status === 'running') {
        this.cancel(id);
      }
    }
  }

  getJob(jobId: string): GenerationJob | undefined {
    const job = this.jobs.get(jobId);
    return job ? { ...job } : undefined;
  }

  getAllJobs(): GenerationJob[] {
    return Array.from(this.jobs.values())
      .sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (a.status !== 'running' && b.status === 'running') return 1;
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return b.priority - a.priority;
      })
      .map((j) => ({ ...j }));
  }

  getStats(): { pending: number; running: number; completed: number; failed: number } {
    let pending = 0, running = 0, completed = 0, failed = 0;
    for (const job of this.jobs.values()) {
      switch (job.status) {
        case 'pending': pending++; break;
        case 'running': running++; break;
        case 'completed': completed++; break;
        case 'failed': failed++; break;
      }
    }
    return { pending, running, completed, failed };
  }

  clearCompleted(): void {
    for (const [id, job] of this.jobs) {
      if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
        this.jobs.delete(id);
      }
    }
  }

  requeue(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || (job.status !== 'failed' && job.status !== 'cancelled')) return;
    job.status = 'pending';
    job.progress = 0;
    job.error = undefined;
    job.resultImages = [];
    this.emit('jobAdded', job);
    this.processQueue();
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.runningCount < this.maxConcurrent) {
        const nextJob = this.getNextPendingJob();
        if (!nextJob) break;

        this.runningCount++;
        this.executeJob(nextJob).finally(() => {
          this.runningCount--;
          this.processQueue();
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private getNextPendingJob(): GenerationJob | undefined {
    let best: GenerationJob | undefined;
    for (const job of this.jobs.values()) {
      if (job.status !== 'pending') continue;
      if (!best || job.priority > best.priority) {
        best = job;
      }
    }
    return best;
  }

  private async executeJob(job: GenerationJob): Promise<void> {
    const backend = this.backends.get(job.backendId);
    if (!backend) {
      job.status = 'failed';
      job.error = `Backend ${job.backendId} not found`;
      this.emit('jobFailed', job);
      return;
    }

    job.status = 'running';
    job.startedAt = new Date().toISOString();
    this.emit('jobStarted', job);

    const onProgress: ProgressCallback = (event) => {
      job.progress = event.progress;
      job.currentStep = event.currentStep;
      job.totalSteps = event.totalSteps;
      job.previewImage = event.previewImage;
      this.emit('jobProgress', job);
    };

    try {
      let images: GeneratedImage[];
      if (job.params.initImage) {
        images = await backend.img2img(job.params, job.params.initImage, onProgress);
      } else {
        images = await backend.generate(job.params, onProgress);
      }

      job.status = 'completed';
      job.progress = 1;
      job.resultImages = images;
      job.completedAt = new Date().toISOString();
      this.emit('jobCompleted', job);
    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.completedAt = new Date().toISOString();
      this.emit('jobFailed', job);
    }
  }
}

// Singleton instance
let queueInstance: QueueManager | null = null;

export function getQueueManager(): QueueManager {
  if (!queueInstance) {
    queueInstance = new QueueManager(2);
  }
  return queueInstance;
}
