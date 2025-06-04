import { DocumentGenerator, ConfigOptions } from '../models/interfaces';
import { GeneratorPlugin, UserLensCoreApi, PluginConfig } from '../models/plugin-interfaces';
import { MarkdownGenerator } from '../generators/markdown/markdown-generator';

export class BuiltinMarkdownGeneratorPlugin implements GeneratorPlugin {
  private coreApi: UserLensCoreApi;
  private pluginConfig?: PluginConfig;

  constructor(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig) {
    this.coreApi = coreApi;
    this.pluginConfig = pluginConfig;
  }

  getPluginId(): string {
    return 'builtin-markdown-generator';
  }

  getPluginName(): string {
    return 'Built-in Markdown Generator';
  }

  getSupportedFormats(): string[] {
    return ['markdown'];
  }

  createGenerator(pluginConfigOverride?: PluginConfig, coreApiOverride?: UserLensCoreApi): DocumentGenerator {
    // const activeCoreApi = coreApiOverride || this.coreApi;
    // const activePluginConfig = pluginConfigOverride || this.pluginConfig;
    // const globalConfig = activeCoreApi.getGlobalConfig() as ConfigOptions;

    // MarkdownGenerator currently doesn't take any constructor arguments.
    // If it did, they could be sourced from globalConfig or pluginConfig.
    return new MarkdownGenerator();
  }
}

// Factory function to be used by PluginManager
export function create(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): GeneratorPlugin {
  return new BuiltinMarkdownGeneratorPlugin(coreApi, pluginConfig);
}