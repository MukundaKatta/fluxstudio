import type { Extension, ExtensionEvent, ExtensionSetting, NodeParamValue } from '@/types';

type ExtensionHandler = (...args: unknown[]) => unknown | Promise<unknown>;

interface RegisteredHook {
  extensionId: string;
  priority: number;
  handler: ExtensionHandler;
}

export class ExtensionRegistry {
  private extensions: Map<string, Extension> = new Map();
  private hooks: Map<ExtensionEvent, RegisteredHook[]> = new Map();
  private handlers: Map<string, Map<ExtensionEvent, ExtensionHandler>> = new Map();

  register(extension: Extension, eventHandlers: Partial<Record<ExtensionEvent, ExtensionHandler>>): void {
    this.extensions.set(extension.id, extension);
    const handlerMap = new Map<ExtensionEvent, ExtensionHandler>();

    for (const hook of extension.hooks) {
      const handler = eventHandlers[hook.event];
      if (!handler) continue;

      handlerMap.set(hook.event, handler);

      if (!this.hooks.has(hook.event)) {
        this.hooks.set(hook.event, []);
      }

      this.hooks.get(hook.event)!.push({
        extensionId: extension.id,
        priority: hook.priority,
        handler,
      });

      // Sort by priority (lower = first)
      this.hooks.get(hook.event)!.sort((a, b) => a.priority - b.priority);
    }

    this.handlers.set(extension.id, handlerMap);
  }

  unregister(extensionId: string): void {
    this.extensions.delete(extensionId);
    this.handlers.delete(extensionId);

    for (const [event, hooks] of this.hooks) {
      this.hooks.set(
        event,
        hooks.filter((h) => h.extensionId !== extensionId)
      );
    }
  }

  async emit(event: ExtensionEvent, ...args: unknown[]): Promise<unknown[]> {
    const hooks = this.hooks.get(event) ?? [];
    const results: unknown[] = [];

    for (const hook of hooks) {
      const ext = this.extensions.get(hook.extensionId);
      if (!ext?.isEnabled) continue;

      try {
        const result = await hook.handler(...args);
        results.push(result);
      } catch (error) {
        console.error(`Extension ${hook.extensionId} error on ${event}:`, error);
      }
    }

    return results;
  }

  async pipeline<T>(event: ExtensionEvent, initialValue: T): Promise<T> {
    const hooks = this.hooks.get(event) ?? [];
    let value = initialValue;

    for (const hook of hooks) {
      const ext = this.extensions.get(hook.extensionId);
      if (!ext?.isEnabled) continue;

      try {
        const result = await hook.handler(value);
        if (result !== undefined) {
          value = result as T;
        }
      } catch (error) {
        console.error(`Extension ${hook.extensionId} pipeline error:`, error);
      }
    }

    return value;
  }

  getExtension(id: string): Extension | undefined {
    return this.extensions.get(id);
  }

  getAllExtensions(): Extension[] {
    return Array.from(this.extensions.values());
  }

  setEnabled(extensionId: string, enabled: boolean): void {
    const ext = this.extensions.get(extensionId);
    if (ext) ext.isEnabled = enabled;
  }

  updateSetting(extensionId: string, key: string, value: NodeParamValue): void {
    const ext = this.extensions.get(extensionId);
    if (ext && ext.settings[key]) {
      ext.settings[key].value = value;
    }
  }
}

let registryInstance: ExtensionRegistry | null = null;

export function getExtensionRegistry(): ExtensionRegistry {
  if (!registryInstance) {
    registryInstance = new ExtensionRegistry();
  }
  return registryInstance;
}

// Built-in extensions
export function registerBuiltinExtensions(registry: ExtensionRegistry): void {
  // Prompt enhancer extension
  registry.register(
    {
      id: 'builtin-prompt-enhancer',
      name: 'Prompt Quality Enhancer',
      version: '1.0.0',
      description: 'Automatically adds quality tags to prompts',
      author: 'FluxStudio',
      isEnabled: true,
      isInstalled: true,
      hooks: [{ event: 'onPromptParse', priority: 100 }],
      settings: {
        qualityTags: {
          key: 'qualityTags',
          label: 'Quality Tags',
          type: 'string',
          value: 'masterpiece, best quality, highly detailed',
        },
        autoApply: {
          key: 'autoApply',
          label: 'Auto-apply',
          type: 'boolean',
          value: false,
        },
      },
    },
    {
      onPromptParse: (prompt: unknown) => {
        const ext = registry.getExtension('builtin-prompt-enhancer');
        if (!ext?.settings.autoApply?.value) return prompt;
        const tags = ext.settings.qualityTags?.value as string;
        return `${tags}, ${prompt}`;
      },
    }
  );

  // Auto-negative extension
  registry.register(
    {
      id: 'builtin-auto-negative',
      name: 'Auto Negative Prompt',
      version: '1.0.0',
      description: 'Adds default negative prompt if empty',
      author: 'FluxStudio',
      isEnabled: true,
      isInstalled: true,
      hooks: [{ event: 'beforeGenerate', priority: 50 }],
      settings: {
        defaultNegative: {
          key: 'defaultNegative',
          label: 'Default Negative',
          type: 'string',
          value: 'lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, jpeg artifacts',
        },
      },
    },
    {
      beforeGenerate: (params: unknown) => {
        const p = params as Record<string, unknown>;
        const ext = registry.getExtension('builtin-auto-negative');
        if (!p.negativePrompt && ext?.settings.defaultNegative?.value) {
          return { ...p, negativePrompt: ext.settings.defaultNegative.value };
        }
        return params;
      },
    }
  );

  // Image watermark extension
  registry.register(
    {
      id: 'builtin-metadata',
      name: 'Generation Metadata',
      version: '1.0.0',
      description: 'Embeds generation parameters in image metadata',
      author: 'FluxStudio',
      isEnabled: true,
      isInstalled: true,
      hooks: [{ event: 'afterGenerate', priority: 200 }],
      settings: {
        embedParams: {
          key: 'embedParams',
          label: 'Embed Parameters',
          type: 'boolean',
          value: true,
        },
      },
    },
    {
      afterGenerate: (result: unknown) => {
        return result; // Metadata embedding handled at save time
      },
    }
  );
}
