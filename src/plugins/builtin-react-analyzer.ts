import { ComponentAnalyzer, ConfigOptions } from '../models/interfaces';
import { AnalyzerPlugin, UserLensCoreApi, PluginConfig } from '../models/plugin-interfaces';
import { ReactAnalyzer } from '../analyzers/react/react-analyzer';

export class BuiltinReactAnalyzerPlugin implements AnalyzerPlugin {
  private coreApi: UserLensCoreApi;
  private pluginConfig?: PluginConfig;

  constructor(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig) {
    this.coreApi = coreApi;
    this.pluginConfig = pluginConfig;
  }

  getPluginId(): string {
    return 'builtin-react-analyzer';
  }

  getPluginName(): string {
    return 'Built-in React Analyzer';
  }

  getSupportedFrameworks(): string[] {
    return ['react'];
  }

  createAnalyzer(pluginConfigOverride?: PluginConfig, coreApiOverride?: UserLensCoreApi): ComponentAnalyzer {
    const activeCoreApi = coreApiOverride || this.coreApi;
    // const activePluginConfig = pluginConfigOverride || this.pluginConfig; // Use if plugin-specific config is needed for ReactAnalyzer
    
    const globalConfig = activeCoreApi.getGlobalConfig() as ConfigOptions; // Cast to known global config type
    
    // Pass customMappings from the global config if available
    return new ReactAnalyzer(globalConfig?.customMappings);
  }
}

// Factory function to be used by PluginManager
export function create(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): AnalyzerPlugin {
  return new BuiltinReactAnalyzerPlugin(coreApi, pluginConfig);
}