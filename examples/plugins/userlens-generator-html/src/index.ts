// examples/plugins/userlens-generator-html/src/index.ts
import { GeneratorPlugin, PluginConfig, UserLensCoreApi } from '../../../../src/models/plugin-interfaces'; // Adjust path
import { DocumentGenerator } from '../../../../src/models/interfaces'; // Adjust path
import { HtmlGenerator } from './html-generator'; // This file will be created next

export default class HtmlGeneratorPlugin implements GeneratorPlugin {
  private coreApi?: UserLensCoreApi;

  getPluginId(): string { return "userlens-generator-html"; }
  getPluginName(): string { return "HTML Documentation Generator"; }
  getSupportedFormats(): string[] { return ["html"]; }

  createGenerator(config?: PluginConfig, coreApi?: UserLensCoreApi): DocumentGenerator {
    return new HtmlGenerator(config, coreApi);
  }

  async onLoad(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): Promise<void> {
    this.coreApi = coreApi;
    this.coreApi.getLogger(this.getPluginId()).info('HTML Generator Plugin loaded.');
    if (pluginConfig) {
      this.coreApi.getLogger(this.getPluginId()).info(`Plugin config: ${JSON.stringify(pluginConfig)}`);
    }
  }
}