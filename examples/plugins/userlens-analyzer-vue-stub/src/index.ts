// examples/plugins/userlens-analyzer-vue-stub/src/index.ts
import { 
    AnalyzerPlugin, 
    PluginConfig, 
    UserLensCoreApi 
} from '../../../../src/models/plugin-interfaces'; // Adjust path to UserLens core interfaces
import { 
    ComponentAnalyzer, 
    ComponentMetadata, 
    UserAction, 
    ComponentCategory, 
    PropDefinition 
} from '../../../../src/models/interfaces'; // Adjust path

class VueStubAnalyzer implements ComponentAnalyzer {
  private coreApi?: UserLensCoreApi;

  constructor(config?: PluginConfig, coreApi?: UserLensCoreApi) {
    this.coreApi = coreApi;
    this.coreApi?.getLogger('VueAnalyzerStub').info('VueStubAnalyzer instance created.');
    if (config) {
      this.coreApi?.getLogger('VueAnalyzerStub').info(`Received config: ${JSON.stringify(config)}`);
    }
  }

  async parseComponent(filePath: string): Promise<ComponentMetadata> {
    this.coreApi?.getLogger('VueAnalyzerStub').info(`Stub parsing component: ${filePath}`);
    // Simulate parsing a .vue file
    const componentName = filePath.split('/').pop()?.split('.')[0] || 'UnknownVueComponent';
    return {
      name: componentName,
      filePath: filePath,
      props: [{ name: 'message', type: 'string', required: false }],
      children: [],
      userActions: [{ type: 'click', trigger: 'button', description: 'Clicks a stub button', outcome: 'Something happens' }],
      semanticCategory: ComponentCategory.DISPLAY, // Or any other appropriate category
      description: `This is a stub analysis for the Vue component ${componentName}.`
    };
  }

  extractUserActions(component: ComponentMetadata): UserAction[] {
    // For this stub, parseComponent can return everything.
    return component.userActions || [];
  }

  identifyComponentPurpose(component: ComponentMetadata): string {
    // For this stub, parseComponent can return everything.
    return component.description || 'Stub Vue component purpose.';
  }
}

export default class VueAnalyzerStubPlugin implements AnalyzerPlugin {
  private coreApi?: UserLensCoreApi;

  async onLoad(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): Promise<void> {
      this.coreApi = coreApi;
      this.coreApi.getLogger(this.getPluginId()).info(`VueAnalyzerStubPlugin loaded successfully.`);
      if (pluginConfig) {
          this.coreApi.getLogger(this.getPluginId()).info(`Plugin config: ${JSON.stringify(pluginConfig)}`);
      }
  }

  getPluginId(): string { return "userlens-analyzer-vue-stub"; }
  getPluginName(): string { return "Vue.js Analyzer Stub"; }
  getSupportedFrameworks(): string[] { return ["vue", "vue3"]; }

  createAnalyzer(config?: PluginConfig, coreApi?: UserLensCoreApi): ComponentAnalyzer {
    return new VueStubAnalyzer(config, coreApi);
  }
}