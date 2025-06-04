import * as fs from 'fs/promises';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  AnalyzerPlugin,
  BasePlugin,
  GeneratorPlugin,
  NlpPlugin,
  PatternMatcherPlugin,
  PluginConfig,
  UserLensCoreApi,
  NlpProcessorInterface,
  PatternMatcherInterface,
} from '../models/plugin-interfaces';
import {
  ComponentAnalyzer,
  DocumentGenerator,
  ConfigOptions as UserLensConfig,
} from '../models/interfaces';
// import { UserLensCoreApiImplementation } from './core-api'; // UserLensCoreApi is an interface, coreApi is passed in constructor
import { ReactAnalyzer } from '../analyzers/react/react-analyzer'; // For fallback
import { MarkdownGenerator as BuiltinMarkdownGenerator } from '../generators/markdown/markdown-generator'; // For fallback

const NPM_PLUGIN_PREFIX_REGEX = /^userlens-(analyzer|generator|nlp|patternmatcher)-/i;
const GENERIC_NPM_PLUGIN_PREFIX_REGEX = /^userlens-/i;


class PluginManager {
  private analyzers: AnalyzerPlugin[] = [];
  private generators: GeneratorPlugin[] = [];
  private nlpPlugins: NlpPlugin[] = [];
  private patternMatcherPlugins: PatternMatcherPlugin[] = [];
  private coreApi: UserLensCoreApi;
  private globalConfig: UserLensConfig;
  private loadedPluginIds: Set<string> = new Set();


  constructor(coreApi: UserLensCoreApi, globalConfig: UserLensConfig) {
    this.coreApi = coreApi;
    this.globalConfig = globalConfig;
  }

  private async _instantiatePluginFromModule(pluginModule: any, identifier: string): Promise<any> {
    let instance: any;
    if (typeof pluginModule.create === 'function') {
      instance = pluginModule.create(this.coreApi);
      this.coreApi.log('info', `Instantiated plugin from ${identifier} using create() factory.`);
    } else if (pluginModule.default) {
      if (typeof pluginModule.default === 'function' && pluginModule.default.prototype) {
        instance = new pluginModule.default(this.coreApi);
        this.coreApi.log('info', `Instantiated plugin from ${identifier} using default export class constructor.`);
      } else if (typeof pluginModule.default === 'function') {
        instance = pluginModule.default(this.coreApi); // Default export is a factory function
        this.coreApi.log('info', `Instantiated plugin from ${identifier} using default export factory function.`);
      } else {
        instance = pluginModule.default; // Default export is an instance
        this.coreApi.log('info', `Using default export instance from ${identifier}.`);
      }
    } else if (Object.keys(pluginModule).length === 1) {
      const singleExport = pluginModule[Object.keys(pluginModule)[0]];
      if (typeof singleExport === 'function' && singleExport.prototype) {
        instance = new singleExport(this.coreApi);
        this.coreApi.log('info', `Instantiated plugin from ${identifier} using single export class constructor.`);
      } else if (typeof singleExport === 'function') {
        instance = singleExport(this.coreApi); // Single export is a factory function
        this.coreApi.log('info', `Instantiated plugin from ${identifier} using single export factory function.`);
      } else {
        instance = singleExport; // Single export is an instance
        this.coreApi.log('info', `Using single export instance from ${identifier}.`);
      }
    }
    return instance;
  }

  private async _validateAndRegisterPlugin(pluginInstance: any, pluginIdentifier: string, sourceDescription: string): Promise<void> {
    if (!pluginInstance || typeof pluginInstance.getPluginId !== 'function') {
      this.coreApi.getLogger('PluginManager').warn(`Plugin from ${pluginIdentifier} (${sourceDescription}) is invalid or does not have a getPluginId method.`);
      return;
    }

    const pluginId = pluginInstance.getPluginId();
    if (this.loadedPluginIds.has(pluginId)) {
        this.coreApi.getLogger(pluginId).warn(`Plugin with ID '${pluginId}' from ${pluginIdentifier} (${sourceDescription}) has already been loaded. Skipping.`);
        return;
    }

    const pluginName = typeof pluginInstance.getPluginName === 'function' ? pluginInstance.getPluginName() : pluginId;
    this.coreApi.log('info', `Processing plugin: ${pluginName} (ID: ${pluginId}) from ${sourceDescription} - ${pluginIdentifier}`);

    let registered = false;
    if (this.isValidAnalyzerPlugin(pluginInstance)) {
      this.registerAnalyzerPlugin(pluginInstance as AnalyzerPlugin);
      registered = true;
    } else if (this.isValidGeneratorPlugin(pluginInstance)) {
      this.registerGeneratorPlugin(pluginInstance as GeneratorPlugin);
      registered = true;
    } else if (this.isValidNlpPlugin(pluginInstance)) {
      this.registerNlpPlugin(pluginInstance as NlpPlugin);
      registered = true;
    } else if (this.isValidPatternMatcherPlugin(pluginInstance)) {
      this.registerPatternMatcherPlugin(pluginInstance as PatternMatcherPlugin);
      registered = true;
    }

    if (registered) {
      this.loadedPluginIds.add(pluginId);
      if (typeof (pluginInstance as BasePlugin).onLoad === 'function') {
        const pluginConfig = this.getPluginConfig(pluginId);
        try {
          this.coreApi.log('info', `Calling onLoad for plugin: ${pluginName} (ID: ${pluginId})`);
          await (pluginInstance as BasePlugin).onLoad!(this.coreApi, pluginConfig);
          this.coreApi.log('info', `Successfully called onLoad for plugin: ${pluginName} (ID: ${pluginId})`);
        } catch (onLoadError: any) {
          this.coreApi.getLogger(pluginId).error(`Error during onLoad for plugin ${pluginName}: ${onLoadError.message}${onLoadError.stack ? `\nStack: ${onLoadError.stack}` : ''}`);
          // As per requirements, do not prevent UserLens from starting.
        }
      }
    } else {
      this.coreApi.getLogger('PluginManager').warn(`Plugin ${pluginName} (ID: ${pluginId}) from ${pluginIdentifier} (${sourceDescription}) did not conform to any known plugin interface.`);
    }
  }


  public async discoverAndLoadPlugins(): Promise<void> {
    this.coreApi.log('info', 'Starting plugin discovery and loading...');
    this.loadedPluginIds.clear();

    // 1. Load from pluginPaths in globalConfig
    if (this.globalConfig.pluginPaths && this.globalConfig.pluginPaths.length > 0) {
      this.coreApi.log('info', `Found ${this.globalConfig.pluginPaths.length} plugin paths in configuration.`);
      for (const pluginPathString of this.globalConfig.pluginPaths) {
        try {
          let resolvedPluginPathForImport: string;
          let resolvedAbsolutePluginPathForLogging: string;

          this.coreApi.log('info', `[PluginManager] Processing configured plugin path: "${pluginPathString}"`);

          if (pluginPathString.startsWith('./') || pluginPathString.startsWith('../')) {
            // Relative paths are assumed to be relative to process.cwd(),
            // which is typically the project root / location of userlens.config.json.
            const baseDir = process.cwd();
            resolvedAbsolutePluginPathForLogging = path.resolve(baseDir, pluginPathString);
            this.coreApi.log('info', `[PluginManager] Path "${pluginPathString}" is relative. Resolved to absolute path: "${resolvedAbsolutePluginPathForLogging}" (using base: "${baseDir}").`);
            if (resolvedAbsolutePluginPathForLogging.endsWith('.ts')) {
              resolvedPluginPathForImport = resolvedAbsolutePluginPathForLogging;
              this.coreApi.log('info', `[PluginManager] Path is a .ts file. Using absolute path for import with ts-node: "${resolvedPluginPathForImport}"`);
            } else {
              resolvedPluginPathForImport = pathToFileURL(resolvedAbsolutePluginPathForLogging).href;
              this.coreApi.log('info', `[PluginManager] Path is not a .ts file. Using file URL for import: "${resolvedPluginPathForImport}"`);
            }
          } else if (path.isAbsolute(pluginPathString)) {
            resolvedAbsolutePluginPathForLogging = pluginPathString;
            this.coreApi.log('info', `[PluginManager] Path "${pluginPathString}" is absolute. No base directory needed for resolution.`);
            if (resolvedAbsolutePluginPathForLogging.endsWith('.ts')) {
              resolvedPluginPathForImport = resolvedAbsolutePluginPathForLogging;
              this.coreApi.log('info', `[PluginManager] Path is an absolute .ts file. Using absolute path for import with ts-node: "${resolvedPluginPathForImport}"`);
            } else {
              resolvedPluginPathForImport = pathToFileURL(resolvedAbsolutePluginPathForLogging).href;
              this.coreApi.log('info', `[PluginManager] Path is an absolute non-.ts file. Using file URL for import: "${resolvedPluginPathForImport}"`);
            }
          } else {
            // Assumed to be a bare module specifier (e.g., an NPM package name)
            resolvedAbsolutePluginPathForLogging = pluginPathString; // Use original string for logging
            resolvedPluginPathForImport = pluginPathString;
            this.coreApi.log('info', `[PluginManager] Path "${pluginPathString}" is treated as a bare module specifier.`);
          }

          this.coreApi.log('info', `[PluginManager] Attempting to import plugin module "${resolvedAbsolutePluginPathForLogging}" using import specifier: "${resolvedPluginPathForImport}"`);
          const pluginModule = await import(resolvedPluginPathForImport);
          const pluginInstance = await this._instantiatePluginFromModule(pluginModule, pluginPathString);

          if (pluginInstance) {
            await this._validateAndRegisterPlugin(pluginInstance, pluginPathString, "configured path");
          } else {
            this.coreApi.getLogger('PluginManager').warn(`Could not instantiate plugin from configured path: ${pluginPathString}`);
          }
        } catch (error: any) {
          this.coreApi.getLogger('PluginManager').error(`Failed to load plugin from configured path ${pluginPathString}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
        }
      }
    } else {
      this.coreApi.log('info', 'No pluginPaths defined in global configuration.');
    }

    // 2. Discover and load from NPM packages
    this.coreApi.log('info', 'Scanning node_modules for UserLens plugins...');
    const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
    try {
      const entries = await fs.readdir(nodeModulesPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() || entry.isSymbolicLink()) {
          const packageName = entry.name;
          const packagePath = path.join(nodeModulesPath, packageName);
          let isPotentialPlugin = false;

          if (NPM_PLUGIN_PREFIX_REGEX.test(packageName) || GENERIC_NPM_PLUGIN_PREFIX_REGEX.test(packageName)) {
            isPotentialPlugin = true;
          }

          try {
            const packageJsonPath = path.join(packagePath, 'package.json');
            const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(packageJsonContent);

            if (packageJson.userlens) {
              isPotentialPlugin = true; // Confirmed by userlens field
              this.coreApi.log('info', `Package ${packageName} has 'userlens' field in package.json.`);
            }

            if (isPotentialPlugin) {
              this.coreApi.log('info', `Found potential NPM plugin: ${packageName}. Attempting to load.`);
              // Entry point is typically the package name itself for import()
              // or packageJson.main if we were constructing a full path.
              // `import(packageName)` should work if it's a valid package.
              const pluginModule = await import(packageName);
              const pluginInstance = await this._instantiatePluginFromModule(pluginModule, packageName);
              if (pluginInstance) {
                await this._validateAndRegisterPlugin(pluginInstance, packageName, `NPM package`);
              } else {
                 this.coreApi.getLogger('PluginManager').warn(`Could not instantiate plugin from NPM package: ${packageName}`);
              }
            }
          } catch (pkgError: any) {
            // Ignore errors like missing package.json or if it's not a plugin
            if (isPotentialPlugin) { // Only log if we thought it was a plugin
                 this.coreApi.getLogger('PluginManager').warn(`Could not load or validate NPM package ${packageName} as a plugin: ${pkgError.message}`);
            }
          }
        }
      }
    } catch (error: any) {
      this.coreApi.getLogger('PluginManager').warn(`Failed to scan node_modules directory at ${nodeModulesPath}: ${error.message}. NPM plugin discovery might be incomplete.`);
    }

    // 3. Discover and load from local plugins directory
    if (this.globalConfig.localPluginsPath) {
      const localPluginsBasePath = path.resolve(process.cwd(), this.globalConfig.localPluginsPath);
      this.coreApi.log('info', `Scanning local plugins directory: ${localPluginsBasePath}`);
      try {
        const pluginDirs = await fs.readdir(localPluginsBasePath, { withFileTypes: true });
        for (const pluginDirEntry of pluginDirs) {
          if (pluginDirEntry.isDirectory()) {
            const pluginDirName = pluginDirEntry.name;
            const pluginDirPath = path.join(localPluginsBasePath, pluginDirName);
            let entryPoint: string | undefined;
            let pluginIdentifier = pluginDirName;

            try {
              // Try package.json first
              const packageJsonPath = path.join(pluginDirPath, 'package.json');
              try {
                  const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
                  const packageJson = JSON.parse(packageJsonContent);
                  if (packageJson.userlens && packageJson.main) {
                      entryPoint = packageJson.main;
                      pluginIdentifier = packageJson.name || pluginDirName;
                      this.coreApi.log('info', `Local plugin ${pluginIdentifier} uses package.json with entry: ${entryPoint}`);
                  }
              } catch (e) { /* ignore if package.json not found or invalid */ }

              // If not found via package.json, try userlens-plugin.json
              if (!entryPoint) {
                  const userlensJsonPath = path.join(pluginDirPath, 'userlens-plugin.json');
                  try {
                      const userlensJsonContent = await fs.readFile(userlensJsonPath, 'utf-8');
                      const userlensJson = JSON.parse(userlensJsonContent);
                      if (userlensJson.entryPoint) {
                          entryPoint = userlensJson.entryPoint;
                          pluginIdentifier = userlensJson.id || userlensJson.name || pluginDirName;
                          this.coreApi.log('info', `Local plugin ${pluginIdentifier} uses userlens-plugin.json with entry: ${entryPoint}`);
                      }
                  } catch (e) { /* ignore if userlens-plugin.json not found or invalid */ }
              }

              if (entryPoint) {
                const resolvedEntryPoint = path.resolve(pluginDirPath, entryPoint);
                const entryPointUrl = pathToFileURL(resolvedEntryPoint).href;
                this.coreApi.log('info', `Attempting to import local plugin: ${pluginIdentifier} from ${entryPointUrl}`);
                const pluginModule = await import(entryPointUrl);
                const pluginInstance = await this._instantiatePluginFromModule(pluginModule, pluginIdentifier);
                if (pluginInstance) {
                  await this._validateAndRegisterPlugin(pluginInstance, pluginIdentifier, `local plugin directory '${pluginDirName}'`);
                } else {
                    this.coreApi.getLogger('PluginManager').warn(`Could not instantiate local plugin: ${pluginIdentifier}`);
                }
              } else {
                this.coreApi.getLogger('PluginManager').warn(`No valid manifest (package.json with userlens field and main, or userlens-plugin.json with entryPoint) found for local plugin in directory: ${pluginDirName}`);
              }
            } catch (error: any) {
              this.coreApi.getLogger('PluginManager').error(`Failed to load local plugin from ${pluginDirName}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
            }
          }
        }
      } catch (error: any) {
        this.coreApi.getLogger('PluginManager').warn(`Failed to scan local plugins directory at ${localPluginsBasePath}: ${error.message}. Local plugin discovery might be incomplete.`);
      }
    } else {
      this.coreApi.log('info', 'No localPluginsPath defined in global configuration.');
    }

    this.coreApi.log('info', 'Plugin discovery and loading finished.');
  }

  // Helper to get specific plugin config from global config by path (if needed during load)
  // This might be less relevant now as config is primarily fetched by ID in _validateAndRegisterPlugin
  private getPluginConfigFromGlobal(pluginPathOrId: string): PluginConfig | undefined {
    if (this.globalConfig.plugins) {
        if (this.globalConfig.plugins[pluginPathOrId]) { // If pluginPathOrId happens to be an ID
            return this.globalConfig.plugins[pluginPathOrId].config;
        }
        // This function is less reliable for paths; getPluginConfig(id) is preferred.
    }
    return undefined;
  }

  public registerAnalyzerPlugin(plugin: AnalyzerPlugin): void {
    // Validation is now part of _validateAndRegisterPlugin's initial checks
    // and the type guard isValidAnalyzerPlugin. Redundant check here removed.
    // Duplication check is handled by this.loadedPluginIds in _validateAndRegisterPlugin.
    this.analyzers.push(plugin);
    this.coreApi.log('info', `Registered Analyzer Plugin: ${plugin.getPluginName()} (ID: ${plugin.getPluginId()})`);
  }

  public registerGeneratorPlugin(plugin: GeneratorPlugin): void {
    this.generators.push(plugin);
    this.coreApi.log('info', `Registered Generator Plugin: ${plugin.getPluginName()} (ID: ${plugin.getPluginId()})`);
  }

  public registerNlpPlugin(plugin: NlpPlugin): void {
    this.nlpPlugins.push(plugin);
    this.coreApi.log('info', `Registered NLP Plugin: ${plugin.getPluginName()} (ID: ${plugin.getPluginId()})`);
  }

  public registerPatternMatcherPlugin(plugin: PatternMatcherPlugin): void {
    this.patternMatcherPlugins.push(plugin);
    this.coreApi.log('info', `Registered Pattern Matcher Plugin: ${plugin.getPluginName()} (ID: ${plugin.getPluginId()})`);
  }

  private isValidAnalyzerPlugin(plugin: any): plugin is AnalyzerPlugin {
    return plugin &&
           typeof plugin.getPluginId === 'function' &&
           typeof plugin.getPluginName === 'function' &&
           typeof plugin.getSupportedFrameworks === 'function' &&
           typeof plugin.createAnalyzer === 'function';
  }

  private isValidGeneratorPlugin(plugin: any): plugin is GeneratorPlugin {
    return plugin &&
           typeof plugin.getPluginId === 'function' &&
           typeof plugin.getPluginName === 'function' &&
           typeof plugin.getSupportedFormats === 'function' &&
           typeof plugin.createGenerator === 'function';
  }

  private isValidNlpPlugin(plugin: any): plugin is NlpPlugin {
    return plugin &&
           typeof plugin.getPluginId === 'function' &&
           typeof plugin.getPluginName === 'function' &&
           typeof plugin.getNlpCapabilities === 'function' && // Corrected method name
           typeof plugin.createNlpProcessor === 'function'; // Corrected method name
  }

  private isValidPatternMatcherPlugin(plugin: any): plugin is PatternMatcherPlugin {
    return plugin &&
           typeof plugin.getPluginId === 'function' &&
           typeof plugin.getPluginName === 'function' &&
           typeof plugin.getPatternMatcherCapabilities === 'function' && // Corrected method name
           typeof plugin.createPatternMatcher === 'function'; // Corrected method name
  }

  public getAnalyzer(framework: string, pluginId?: string): ComponentAnalyzer | null {
    let candidates = this.analyzers.filter(p =>
      p.getSupportedFrameworks().includes(framework)
    );

    if (pluginId) {
      candidates = candidates.filter(p => p.getPluginId() === pluginId);
    }

    if (candidates.length === 0) {
      // Fallback for ReactAnalyzer
      if (framework === 'react' && !pluginId) { // Only fallback if no specific pluginId was requested
        this.coreApi.getLogger('PluginManager').warn(`No external Analyzer plugin found for framework 'react'. Falling back to built-in ReactAnalyzer.`);
        // The ReactAnalyzer constructor expects customMappings from ConfigOptions.
        // The ConfigOptions should be available via this.coreApi.getGlobalConfig().
        const globalCfg = this.coreApi.getGlobalConfig() as UserLensConfig;
        return new ReactAnalyzer(globalCfg?.customMappings);
      }
      this.coreApi.getLogger('PluginManager').warn(`No Analyzer plugin found for framework '${framework}'${pluginId ? ` and ID '${pluginId}'` : ''}.`);
      return null;
    }

    // TODO: Add prioritization logic (e.g., from globalConfig.plugins.<pluginId>.isDefaultForFramework)
    // For now, if multiple candidates, prefer non-built-in or use config hints.
    // If a specific pluginId is given, it should have been filtered already.
    const pluginToUse = candidates[0]; // Simplistic: take the first one
    const pluginSpecificConfig = this.getPluginConfig(pluginToUse.getPluginId());

    this.coreApi.log('info', `Using Analyzer plugin: ${pluginToUse.getPluginName()} for framework '${framework}'.`);
    try {
      return pluginToUse.createAnalyzer(pluginSpecificConfig, this.coreApi);
    } catch (error: any) {
        this.coreApi.getLogger(pluginToUse.getPluginId()).error(`Error creating analyzer instance from plugin ${pluginToUse.getPluginId()}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
        return null;
    }
  }

  public getGenerator(format: string, pluginId?: string): DocumentGenerator | null {
    let candidates = this.generators.filter(p =>
      p.getSupportedFormats().includes(format)
    );

    if (pluginId) {
      candidates = candidates.filter(p => p.getPluginId() === pluginId);
    }

    if (candidates.length === 0) {
      // Fallback for MarkdownGenerator
      if (format === 'markdown' && !pluginId) { // Only fallback if no specific pluginId was requested
        this.coreApi.getLogger('PluginManager').warn(`No external Generator plugin found for format 'markdown'. Falling back to built-in MarkdownGenerator.`);
        return new BuiltinMarkdownGenerator(); // BuiltinMarkdownGenerator has no constructor args
      }
      this.coreApi.getLogger('PluginManager').warn(`No Generator plugin found for format '${format}'${pluginId ? ` and ID '${pluginId}'` : ''}.`);
      return null;
    }

    // TODO: Add prioritization logic
    const pluginToUse = candidates[0];
    const pluginSpecificConfig = this.getPluginConfig(pluginToUse.getPluginId());

    this.coreApi.log('info', `Using Generator plugin: ${pluginToUse.getPluginName()} for format '${format}'.`);
     try {
      return pluginToUse.createGenerator(pluginSpecificConfig, this.coreApi);
    } catch (error: any) {
        this.coreApi.getLogger(pluginToUse.getPluginId()).error(`Error creating generator instance from plugin ${pluginToUse.getPluginId()}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
        return null;
    }
  }

  public getNlpProcessor(capability?: string, pluginId?: string): NlpProcessorInterface | null {
    let candidates = this.nlpPlugins;

    if (capability) {
        candidates = candidates.filter(p => p.getNlpCapabilities().includes(capability)); // Corrected method name
    }
    if (pluginId) {
      candidates = candidates.filter(p => p.getPluginId() === pluginId);
    }

    if (candidates.length === 0) {
      this.coreApi.getLogger('PluginManager').warn(`No NLP plugin found${capability ? ` for capability '${capability}'` : ''}${pluginId ? ` and ID '${pluginId}'` : ''}.`);
      return null;
    }

    // TODO: Add prioritization logic
    const pluginToUse = candidates[0];
    const pluginSpecificConfig = this.getPluginConfig(pluginToUse.getPluginId());

    this.coreApi.log('info', `Using NLP plugin: ${pluginToUse.getPluginName()}${capability ? ` for capability '${capability}'` : ''}.`);
    try {
      return pluginToUse.createNlpProcessor(pluginSpecificConfig, this.coreApi); // Corrected method name
    } catch (error: any) {
        this.coreApi.getLogger(pluginToUse.getPluginId()).error(`Error creating NLP processor instance from plugin ${pluginToUse.getPluginId()}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
        return null;
    }
  }

  public getPatternMatcher(capability?: string, pluginId?: string): PatternMatcherInterface | null {
    let candidates = this.patternMatcherPlugins;

     if (capability) {
        candidates = candidates.filter(p => p.getPatternMatcherCapabilities().includes(capability)); // Corrected method name
    }
    if (pluginId) {
      candidates = candidates.filter(p => p.getPluginId() === pluginId);
    }

    if (candidates.length === 0) {
      this.coreApi.getLogger('PluginManager').warn(`No Pattern Matcher plugin found${capability ? ` for capability '${capability}'` : ''}${pluginId ? ` and ID '${pluginId}'` : ''}.`);
      return null;
    }

    // TODO: Add prioritization logic
    const pluginToUse = candidates[0];
    const pluginSpecificConfig = this.getPluginConfig(pluginToUse.getPluginId());

    this.coreApi.log('info', `Using Pattern Matcher plugin: ${pluginToUse.getPluginName()}${capability ? ` for capability '${capability}'` : ''}.`);
    try {
      return pluginToUse.createPatternMatcher(pluginSpecificConfig, this.coreApi); // Corrected method name
    } catch (error: any) {
        this.coreApi.getLogger(pluginToUse.getPluginId()).error(`Error creating Pattern Matcher instance from plugin ${pluginToUse.getPluginId()}: ${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`);
        return null;
    }
  }

  private getPluginConfig(pluginId: string): PluginConfig | undefined {
    if (this.globalConfig.plugins && this.globalConfig.plugins[pluginId]) {
      return this.globalConfig.plugins[pluginId].config;
    }
    return undefined;
  }
  public async unloadPlugin(pluginId: string): Promise<void> {
    this.coreApi.log('info', `Attempting to unload plugin with ID: ${pluginId}`);
    let foundPlugin: BasePlugin | undefined;
    let pluginType: 'analyzer' | 'generator' | 'nlp' | 'patternMatcher' | 'unknown' = 'unknown';

    const findAndRemove = <T extends BasePlugin>(plugins: T[], id: string): T | undefined => {
      const index = plugins.findIndex(p => p.getPluginId() === id);
      if (index !== -1) {
        const [pluginInstance] = plugins.splice(index, 1);
        this.loadedPluginIds.delete(id); // Also remove from the set of loaded IDs
        return pluginInstance;
      }
      return undefined;
    };

    foundPlugin = findAndRemove(this.analyzers, pluginId);
    if (foundPlugin) {
        pluginType = 'analyzer';
    } else {
      foundPlugin = findAndRemove(this.generators, pluginId);
      if (foundPlugin) pluginType = 'generator';
    }
    
    if (!foundPlugin) {
        const nlpPluginInstance = findAndRemove(this.nlpPlugins, pluginId);
        if (nlpPluginInstance) {
            foundPlugin = nlpPluginInstance;
            pluginType = 'nlp';
        }
    }

    if (!foundPlugin) {
        const patternMatcherPluginInstance = findAndRemove(this.patternMatcherPlugins, pluginId);
        if (patternMatcherPluginInstance) {
            foundPlugin = patternMatcherPluginInstance;
            pluginType = 'patternMatcher';
        }
    }

    if (foundPlugin) {
      const pluginName = foundPlugin.getPluginName(); // getPluginName should exist on BasePlugin types
      this.coreApi.log('info', `Found ${pluginType} plugin '${pluginName}' to unload.`);
      if (typeof foundPlugin.onUnload === 'function') {
        try {
          this.coreApi.log('info', `Calling onUnload for plugin: ${pluginName}`);
          await foundPlugin.onUnload(this.coreApi);
          this.coreApi.log('info', `Successfully called onUnload for plugin: ${pluginName}`);
        } catch (onUnloadError: any) {
          this.coreApi.getLogger(pluginId).error(`Error during onUnload for plugin ${pluginName}: ${onUnloadError.message}${onUnloadError.stack ? `\nStack: ${onUnloadError.stack}` : ''}`);
          // Plugin is already removed from lists. Decide if re-adding is needed on critical onUnload failure.
          // For now, it remains unloaded.
        }
      } else {
        this.coreApi.log('info', `Plugin ${pluginName} does not have an onUnload hook.`);
      }
      this.coreApi.log('info', `Plugin ${pluginId} (${pluginName}) conceptually unloaded and removed from active lists.`);
    } else {
      this.coreApi.getLogger('PluginManager').warn(`Plugin with ID '${pluginId}' not found for unloading.`);
    }
  }
}


// Export the class for use in other parts of the application
export { PluginManager };