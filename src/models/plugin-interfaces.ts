import { ComponentAnalyzer, ComponentMetadata, UserAction, ComponentCategory, PropDefinition, DocumentGenerator, UserJourney, NlpComponentContext } from './interfaces'; // Assuming these are in src/models/interfaces.ts

export interface PluginConfig {
  [key: string]: any;
}

// Forward declare or import necessary types like LoggerInterface, UserLensConfig if they exist
// For now, use placeholders if not yet defined.
export interface LoggerInterface { // Placeholder
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
}
export interface UserLensConfig { // Placeholder for global config type
  [key: string]: any;
}

export interface UserLensCoreApi {
  log: (level: 'info' | 'warn' | 'error', message: string) => void; // General logger
  getLogger: (pluginId: string) => LoggerInterface; // Plugin-specific logger
  getGlobalConfig: () => Readonly<UserLensConfig>; // Access to global config
}

export interface BasePlugin {
  getPluginId(): string;
  getPluginName(): string;
  /**
   * Optional asynchronous lifecycle hook called after the plugin is loaded and validated.
   * @param coreApi Provides access to core UserLens functionalities.
   * @param pluginConfig The specific configuration for this plugin instance.
   */
  onLoad?(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): Promise<void>;
  /**
   * Optional asynchronous lifecycle hook that would be called before a plugin is unloaded.
   * @param coreApi Provides access to core UserLens functionalities.
   */
  onUnload?(coreApi: UserLensCoreApi): Promise<void>;
}

export interface AnalyzerPlugin extends BasePlugin {
  getSupportedFrameworks(): string[];
  createAnalyzer(config?: PluginConfig, coreApi?: UserLensCoreApi): ComponentAnalyzer;
}

// Use alias if ComponentMetadata is redefined or too generic
export interface GeneratorPlugin extends BasePlugin {
  getSupportedFormats(): string[];
  createGenerator(config?: PluginConfig, coreApi?: UserLensCoreApi): DocumentGenerator;
}

export interface NlpProcessorInterface {
  categorizeComponent(
    componentName: string,
    props: PropDefinition[],
    additionalContext: NlpComponentContext
  ): ComponentCategory;

  generateDescription(
    componentName: string,
    props: PropDefinition[],
    additionalContext: NlpComponentContext
  ): string;
  // Potentially other NLP tasks
}

export interface NlpPlugin extends BasePlugin {
  getNlpCapabilities(): string[];
  createNlpProcessor(config?: PluginConfig, coreApi?: UserLensCoreApi): NlpProcessorInterface;
}

export interface WorkflowPattern {
  name: string;
  description: string;
  steps: Array<{ name: string; description: string; actions: UserAction[] }>; // Changed PmUserAction to UserAction based on import
}

export interface DesignPattern {
    name: string;
    description: string;
    userGoal: string;
    components: ComponentMetadata[]; // Changed PmComponentMetadata to ComponentMetadata
}

export interface PatternMatcherInterface {
  detectPatterns(components: ComponentMetadata[]): DesignPattern[]; // Changed PmComponentMetadata to ComponentMetadata
  detectWorkflows(components: ComponentMetadata[]): WorkflowPattern[]; // Changed PmComponentMetadata to ComponentMetadata
}

export interface PatternMatcherPlugin extends BasePlugin {
  getPatternMatcherCapabilities(): string[];
  createPatternMatcher(config?: PluginConfig, coreApi?: UserLensCoreApi): PatternMatcherInterface;
}