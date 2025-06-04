#!/usr/bin/env node

import * as path from 'path';
import * as fs from 'fs/promises';
import { spawn } from 'child_process';
import * as crypto from 'crypto';
import { Command } from 'commander';
import { ConfigOptions, ComponentMetadata, UserJourney, DocumentGenerator, ComponentAnalyzer } from '../models/interfaces'; // Added ComponentMetadata and UserJourney
import { NLPProcessor } from '../nlp/semantic-processor';
import { PatternMatcher } from '../nlp/pattern-matcher';
import { CacheManager } from '../cache/cache-manager'; // Added CacheManager
import { UserLensCoreApiImplementation } from '../core/core-api';
import { PluginManager } from '../core/plugin-manager';

// Interface for the changeset file
interface Changeset {
  newComponents: string[];
  changedComponents: string[];
  deletedComponents: string[];
  componentsJsonChanged: boolean;
  patternsJsonChanged: boolean;
  workflowsJsonChanged: boolean;
}

// Define the CLI program
const program = new Command();

program
  .name('userlens')
  .description('Semantic User Documentation Generator from Application Code Analysis')
  .version('0.1.0');

// Analyze command
program
  .command('analyze')
  .description('Analyze a frontend application and store the results')
  .option('-e, --entry <path>', 'Entry path to the application code')
  .option('-o, --output <path>', 'Output path for analysis results')
  .option('--framework <framework>', 'Frontend framework (react, vue, angular)')
  .option('--analyzer-id <id>', 'Specify a specific analyzer plugin ID to use')
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      console.log('Starting application analysis...');
      
      const loadedUserConfig = await loadConfig(options.config);
      const coreApi = new UserLensCoreApiImplementation(loadedUserConfig || undefined); // Pass initial config
      
      // If config was loaded, update coreApi with it.
      // The globalConfig in PluginManager will also reference this.
      if (loadedUserConfig) {
        coreApi.setGlobalConfig(loadedUserConfig);
      }
      
      const pluginManager = new PluginManager(coreApi, loadedUserConfig || {} as ConfigOptions);
      await pluginManager.discoverAndLoadPlugins();

      // Resolve effective configuration, CLI options override config file options
      // Prioritize CLI options, then config file, then defaults.
      const framework = options.framework || loadedUserConfig?.framework || 'react';
      const cliEntryPath = options.entry || loadedUserConfig?.entry || './src';
      const outputPath = options.output || loadedUserConfig?.output || './userlens-analysis';
      const configuredAnalyzerPluginId = options.analyzerId; // Directly use CLI option if provided


      const projectRoot = process.cwd(); // Define projectRoot
      const absoluteEntryPath = path.resolve(projectRoot, cliEntryPath);

      await fs.mkdir(outputPath, { recursive: true });

      // Initialize CacheManager
      const cacheManager = await CacheManager.create(projectRoot);
      console.log(`CacheManager initialized at ${path.join(projectRoot, '.userlens_cache')}`);

      const analyzer: ComponentAnalyzer | null = pluginManager.getAnalyzer(framework, configuredAnalyzerPluginId);

      if (!analyzer) {
        console.error(`Failed to get an analyzer for framework '${framework}'${configuredAnalyzerPluginId ? ` with ID '${configuredAnalyzerPluginId}'` : ''}. Exiting.`);
        process.exit(1);
      }
      console.log(`Using analyzer: ${analyzer.constructor.name} for framework ${framework}`);


      const componentFiles = await findComponentFiles(absoluteEntryPath, framework, loadedUserConfig?.excludePatterns);
      console.log(`Found ${componentFiles.length} component files to process.`);

      const components: ComponentMetadata[] = [];
      const processedRelativeFilePaths: string[] = [];
      const changedOrNewRelativeFilePaths: string[] = [];
      
      const initialCachedRelativePaths = await cacheManager.getAllCachedFilePaths();
      console.log(`Found ${initialCachedRelativePaths.length} items in cache initially.`);

      for (const absoluteFilePath of componentFiles) {
        const relativeFilePath = path.relative(projectRoot, absoluteFilePath);
        processedRelativeFilePaths.push(relativeFilePath);

        try {
          const currentContentHash = await cacheManager.calculateFileContentHash(absoluteFilePath);
          const cachedData = await cacheManager.getCachedComponent(relativeFilePath);

          if (cachedData && cachedData.sourceFileHash === currentContentHash) {
            console.log(`[CACHE HIT] Using cached data for ${relativeFilePath}`);
            // Ensure filePath in cached metadata is relative, as per our new convention
            const componentMeta = cachedData.componentMetadata;
            if (path.isAbsolute(componentMeta.filePath)) {
                componentMeta.filePath = path.relative(projectRoot, componentMeta.filePath);
            }
            components.push(componentMeta);
          } else {
            if (cachedData) {
                console.log(`[CACHE STALE] Re-analyzing ${relativeFilePath} (hash mismatch)`);
            } else {
                console.log(`[CACHE MISS] Analyzing new file ${relativeFilePath}`);
            }
            const parsedMetadata = await analyzer.parseComponent(absoluteFilePath);
            
            // Ensure filePath in metadata is relative before caching and adding to components list
            const metadataToCache: ComponentMetadata = {
                ...parsedMetadata,
                filePath: relativeFilePath
            };

            await cacheManager.cacheComponent(relativeFilePath, currentContentHash, metadataToCache);
            components.push(metadataToCache);
            changedOrNewRelativeFilePaths.push(relativeFilePath);
            console.log(`Analyzed and cached component: ${metadataToCache.name} from ${relativeFilePath}`);
          }
        } catch (error) {
          console.error(`Error processing file ${relativeFilePath} (abs: ${absoluteFilePath}):`, error);
        }
      }

      // Handle Deleted Files
      const deletedRelativeFilePaths: string[] = [];
      for (const cachedPath of initialCachedRelativePaths) {
        if (!processedRelativeFilePaths.includes(cachedPath)) {
          console.log(`[CACHE DELETE] Removing deleted file from cache: ${cachedPath}`);
          await cacheManager.removeCachedComponent(cachedPath);
          deletedRelativeFilePaths.push(cachedPath);
        }
      }

      // Determine new and changed components for changeset
      const newComponentsPaths: string[] = [];
      const changedComponentsPaths: string[] = [];
      for (const p of changedOrNewRelativeFilePaths) {
        if (initialCachedRelativePaths.includes(p)) {
          changedComponentsPaths.push(p);
        } else {
          newComponentsPaths.push(p);
        }
      }
      
      // Helper to calculate MD5 hash of JSON stringifiable data
      const calculateJsonHash = (data: any): string => {
        const jsonString = JSON.stringify(data, null, 2);
        return crypto.createHash('md5').update(jsonString).digest('hex');
      };

      // Helper to read file content, returning null if not found
      const readFileContentSafe = async (filePath: string): Promise<string | null> => {
        try {
          return await fs.readFile(filePath, 'utf-8');
        } catch (error: any) {
          if (error.code === 'ENOENT') return null;
          throw error;
        }
      };
      
      // Save analysis results and track changes
      const componentsJsonPath = path.join(outputPath, 'components.json');
      const patternsJsonPath = path.join(outputPath, 'patterns.json');
      const workflowsJsonPath = path.join(outputPath, 'workflows.json');

      const oldComponentsJsonContent = await readFileContentSafe(componentsJsonPath);
      const newComponentsJsonContent = JSON.stringify(components, null, 2);
      const componentsJsonChanged = !oldComponentsJsonContent || calculateJsonHash(JSON.parse(oldComponentsJsonContent)) !== calculateJsonHash(components);
      if (componentsJsonChanged) {
        await fs.writeFile(componentsJsonPath, newComponentsJsonContent);
        console.log(`components.json ${oldComponentsJsonContent ? 'updated' : 'created'}.`);
      } else {
        console.log('components.json unchanged.');
      }

      const patternMatcher = new PatternMatcher();
      const patterns = patternMatcher.detectPatterns(components);
      const workflows = patternMatcher.detectWorkflows(components);

      const oldPatternsJsonContent = await readFileContentSafe(patternsJsonPath);
      const newPatternsJsonContent = JSON.stringify(patterns, null, 2);
      const patternsJsonChanged = !oldPatternsJsonContent || calculateJsonHash(JSON.parse(oldPatternsJsonContent)) !== calculateJsonHash(patterns);
      if (patternsJsonChanged) {
        await fs.writeFile(patternsJsonPath, newPatternsJsonContent);
        console.log(`patterns.json ${oldPatternsJsonContent ? 'updated' : 'created'}.`);
      } else {
        console.log('patterns.json unchanged.');
      }

      const oldWorkflowsJsonContent = await readFileContentSafe(workflowsJsonPath);
      const newWorkflowsJsonContent = JSON.stringify(workflows, null, 2);
      const workflowsJsonChanged = !oldWorkflowsJsonContent || calculateJsonHash(JSON.parse(oldWorkflowsJsonContent)) !== calculateJsonHash(workflows);
      if (workflowsJsonChanged) {
        await fs.writeFile(workflowsJsonPath, newWorkflowsJsonContent);
        console.log(`workflows.json ${oldWorkflowsJsonContent ? 'updated' : 'created'}.`);
      } else {
        console.log('workflows.json unchanged.');
      }

      // Record changeset.json
      const changeset = {
        newComponents: newComponentsPaths,
        changedComponents: changedComponentsPaths,
        deletedComponents: deletedRelativeFilePaths,
        componentsJsonChanged,
        patternsJsonChanged,
        workflowsJsonChanged,
      };
      const changesetPath = path.join(outputPath, 'changeset.json');
      await fs.writeFile(changesetPath, JSON.stringify(changeset, null, 2));
      console.log(`Changeset recorded to ${changesetPath}`);
      
      console.log(`Analysis complete. Results saved to ${outputPath}`);
    } catch (error) {
      console.error('Error during analysis:', error);
      process.exit(1);
    }
  });

// Generate command
program
  .command('generate')
  .description('Generate user documentation from analysis results')
  .option('-i, --input <path>', 'Input path with analysis results')
  .option('-o, --output <path>', 'Output path for documentation')
  .option('--format <format>', 'Output format (markdown, html, interactive)')
  .option('--generator-id <id>', 'Specify a specific generator plugin ID to use')
  .option('-t, --theme <theme>', 'Theme for documentation') // Theme might be handled by generator or global config
  .option('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    const loadedUserConfig = await loadConfig(options.config);
    const coreApi = new UserLensCoreApiImplementation(loadedUserConfig || undefined);
    if (loadedUserConfig) {
        coreApi.setGlobalConfig(loadedUserConfig);
    }
    const pluginManager = new PluginManager(coreApi, loadedUserConfig || {} as ConfigOptions);
    await pluginManager.discoverAndLoadPlugins();
    
    // Resolve effective configuration
    const inputAnalysisPath = options.input || './userlens-analysis';
    const outputDocPath = options.output || loadedUserConfig?.output || './userlens-docs'; // output can be in config
    const format = options.format || 'markdown'; // Default to markdown if not specified
    const configuredGeneratorPluginId = options.generatorId; // Directly use CLI option if provided
    // const theme = options.theme || loadedUserConfig?.theme || 'default'; // Theme handling

    console.log(`Generating documentation from ${inputAnalysisPath} to ${outputDocPath} in ${format} format...`);

    const generator: DocumentGenerator | null = pluginManager.getGenerator(format, configuredGeneratorPluginId);

    if (!generator) {
      console.error(`Failed to get a generator for format '${format}'${configuredGeneratorPluginId ? ` with ID '${configuredGeneratorPluginId}'` : ''}. Exiting.`);
      process.exit(1);
    }
    console.log(`Using generator: ${generator.constructor.name} for format ${format}`);

    const changesetFilePath = path.join(inputAnalysisPath, 'changeset.json');
    let changeset: Changeset | null = null;
    let performFullGeneration = false;

    try {
      const changesetData = await fs.readFile(changesetFilePath, 'utf-8');
      changeset = JSON.parse(changesetData) as Changeset;
      console.log('Changeset file found and loaded.');
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log('Changeset file not found. Performing full documentation generation.');
        performFullGeneration = true;
      } else {
        console.error(`Error reading changeset file ${changesetFilePath}:`, error);
        console.log('Falling back to full documentation generation due to error.');
        performFullGeneration = true;
      }
    }

    // Load full analysis results (needed for both incremental and full generation)
    let allComponents: ComponentMetadata[] = [];
    let allJourneys: UserJourney[] = []; // UserJourney was Workflow in some contexts

    try {
      const componentsData = await fs.readFile(path.join(inputAnalysisPath, 'components.json'), 'utf-8');
      allComponents = JSON.parse(componentsData);
    } catch (error) {
      console.error(`Error reading components.json from ${inputAnalysisPath}:`, error);
      process.exit(1); // Critical file
    }

    try {
      const workflowsData = await fs.readFile(path.join(inputAnalysisPath, 'workflows.json'), 'utf-8');
      allJourneys = JSON.parse(workflowsData);
    } catch (error) {
      console.log(`No workflows.json found in ${inputAnalysisPath}, proceeding without user journeys/workflows.`);
    }
    
    if (performFullGeneration) {
      try {
        console.log('Performing full documentation regeneration...');
        await generator.generateDocumentation(allComponents, allJourneys, outputDocPath);
        console.log(`Full documentation generated successfully in ${outputDocPath}`);
      } catch (genError) {
        console.error('Error during full documentation generation:', genError);
        process.exit(1);
      }
      return; // Exit after full generation
    }

    // Check if the generator supports incremental updates (e.g., by checking for specific methods)
    // For now, we'll assume MarkdownGenerator is the one with these methods.
    // A more robust way would be to define an IncrementalDocumentGenerator interface.
    const canDoIncremental =
        typeof (generator as any).generateComponentDoc === 'function' &&
        typeof (generator as any).generateIndex === 'function' &&
        typeof (generator as any).generateOverview === 'function' &&
        typeof (generator as any).generateCategoryOverview === 'function' &&
        typeof (generator as any).generateWorkflows === 'function';

    if (!canDoIncremental) {
        console.log(`The selected generator (${generator.constructor.name}) does not support fine-grained incremental updates. Performing full regeneration.`);
        try {
            await generator.generateDocumentation(allComponents, allJourneys, outputDocPath);
            console.log(`Full documentation generated successfully in ${outputDocPath}`);
        } catch (genError) {
            console.error('Error during full documentation generation:', genError);
            process.exit(1);
        }
        return;
    }
    
    // Cast to access specific methods if we've passed the check
    const incrementalGenerator = generator as any;


    if (changeset) {
      const noRelevantChanges =
        changeset.newComponents.length === 0 &&
        changeset.changedComponents.length === 0 &&
        changeset.deletedComponents.length === 0 &&
        !changeset.componentsJsonChanged &&
        !changeset.patternsJsonChanged &&
        !changeset.workflowsJsonChanged;

      if (noRelevantChanges) {
        console.log('No changes detected in analysis results. Documentation is up to date.');
        return; // Exit early
      }

      console.log('Processing incremental changes with a capable generator...');

      // 3. Process New/Changed Components
      const newOrChangedPaths = [...changeset.newComponents, ...changeset.changedComponents];
      for (const componentPath of newOrChangedPaths) {
        const component = allComponents.find(c => c.filePath === componentPath);
        if (component) {
          try {
            const category = component.semanticCategory.toLowerCase();
            const categoryPath = path.join(outputDocPath, 'features', category);
            await fs.mkdir(categoryPath, { recursive: true });
            await incrementalGenerator.generateComponentDoc(component, categoryPath);
            console.log(`Regenerated doc for ${component.name} (${componentPath})`);
          } catch (error) {
            console.error(`Error generating doc for component ${componentPath}:`, error);
          }
        } else {
          console.warn(`Component metadata not found for new/changed component: ${componentPath}`);
        }
      }

      // 4. Process Deleted Components
      for (const deletedComponentPath of changeset.deletedComponents) {
        try {
          const baseName = path.basename(deletedComponentPath, path.extname(deletedComponentPath));
          const docFileNameStem = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-');
          const docFileName = `${docFileNameStem}.md`; // Assuming markdown for deletion path
          
          const featuresDir = path.join(outputDocPath, 'features');
          let fileDeleted = false;
          try {
            const categoryDirs = await fs.readdir(featuresDir, { withFileTypes: true });
            for (const categoryDirEntry of categoryDirs) {
              if (categoryDirEntry.isDirectory()) {
                const potentialDocPath = path.join(featuresDir, categoryDirEntry.name, docFileName);
                try {
                  await fs.unlink(potentialDocPath);
                  console.log(`Deleted documentation file: ${potentialDocPath}`);
                  fileDeleted = true;
                  break;
                } catch (unlinkError: any) {
                  if (unlinkError.code !== 'ENOENT') {
                    console.warn(`Could not delete ${potentialDocPath}: ${unlinkError.message}`);
                  }
                }
              }
            }
            if (!fileDeleted) {
              console.log(`No specific doc file found to delete for source: ${deletedComponentPath} (searched for ${docFileName})`);
            }
          } catch (readDirError: any) {
             if (readDirError.code !== 'ENOENT') {
                console.warn(`Could not scan features directory for deleting ${docFileName}: ${readDirError.message}`);
             } else {
                console.log(`Features directory ${featuresDir} does not exist, no files to delete for ${deletedComponentPath}.`);
             }
          }
        } catch (error) {
            console.error(`Error processing deletion for component path ${deletedComponentPath}:`, error);
        }
      }

      // 5. Update Structural/Overview Files
      const needsStructuralUpdate =
        changeset.newComponents.length > 0 ||
        changeset.changedComponents.length > 0 ||
        changeset.deletedComponents.length > 0 ||
        changeset.componentsJsonChanged ||
        changeset.patternsJsonChanged ||
        changeset.workflowsJsonChanged;

      if (needsStructuralUpdate) {
        console.log('Regenerating structural and overview files...');
        try {
          await incrementalGenerator.generateIndex(outputDocPath);
          console.log('Regenerated main index.md');

          await incrementalGenerator.generateOverview(allComponents, allJourneys, outputDocPath);
          console.log('Regenerated overview.md');
          
          const uniqueCategories = [...new Set(allComponents.map(c => c.semanticCategory.toLowerCase()).filter(c => c))];
          for (const category of uniqueCategories) {
            const categoryComponents = allComponents.filter(c => c.semanticCategory.toLowerCase() === category);
            if (categoryComponents.length > 0) {
              const categoryPath = path.join(outputDocPath, 'features', category);
              await fs.mkdir(categoryPath, { recursive: true });
              await incrementalGenerator.generateCategoryOverview(category, categoryComponents, categoryPath);
              console.log(`Regenerated overview for category: ${category}`);
            }
          }
          
          await incrementalGenerator.generateWorkflows(allComponents, outputDocPath);
          console.log('Regenerated workflow documentation.');

        } catch (error) {
          console.error('Error regenerating structural/overview files:', error);
        }
      } else {
        console.log('No structural/overview file updates needed based on changeset.');
      }
      console.log('Incremental documentation generation complete.');
    } else {
      console.error('Changeset was null and full generation was not triggered. This is unexpected.');
      process.exit(1);
    }
  });

// Serve command
program
  .command('serve')
  .description('Serve the generated documentation')
  .option('-d, --docs <path>', 'Path to the documentation', './userlens-docs')
  .option('-p, --port <number>', 'Port to serve on', '3000')
  .action(async (options: { docs: string; port: string }) => {
    const userDocsPath = options.docs;
    const resolvedDocsPath = path.resolve(userDocsPath);
    const port = options.port;

    try {
      const stats = await fs.stat(resolvedDocsPath);
      if (!stats.isDirectory()) {
        console.error(`Error: Documentation path '${userDocsPath}' (resolved to '${resolvedDocsPath}') is not a directory.`);
        process.exit(1);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.error(`Error: Documentation directory '${userDocsPath}' (resolved to '${resolvedDocsPath}') not found.`);
      } else {
        console.error(`Error accessing documentation directory '${userDocsPath}' (resolved to '${resolvedDocsPath}'): ${error.message}`);
      }
      process.exit(1);
    }

    console.log(`Serving documentation from ${userDocsPath} at http://localhost:${port}`);

    const serveProcess = spawn('npx', ['serve', userDocsPath, '-l', port], { stdio: 'inherit', shell: true });

    serveProcess.on('error', (err) => {
      console.error(`Failed to start server: ${err.message}`);
      console.error('Please ensure "serve" is installed correctly (e.g., via "npm install serve" in your project or "npm install -g serve").');
      process.exit(1);
    });

    serveProcess.on('exit', (code, signal) => {
      // SIGINT is a common way to stop the server (Ctrl+C), so don't log it as an unexpected exit.
      if (code !== 0 && signal !== 'SIGINT') {
        console.log(`Server process exited with code ${code}${signal ? ` and signal ${signal}` : ''}.`);
      } else if (signal === 'SIGINT') {
        console.log('Server stopped.');
      }
    });
  });

// Helper functions

function validateConfigOptions(config: any): string[] {
  const errors: string[] = [];
  const validFrameworks = ["react", "vue", "angular"];

  // Mandatory fields
  if (!config.framework) {
    errors.push("Missing mandatory field: 'framework'.");
  } else if (typeof config.framework !== 'string' || !validFrameworks.includes(config.framework)) {
    errors.push(`Invalid 'framework': "${config.framework}". Must be one of ${validFrameworks.join(', ')}.`);
  }

  if (!config.entry) {
    errors.push("Missing mandatory field: 'entry'.");
  } else if (typeof config.entry !== 'string') {
    errors.push(`Invalid 'entry': "${config.entry}". Must be a string (path).`);
  }

  if (!config.output) {
    errors.push("Missing mandatory field: 'output'.");
  } else if (typeof config.output !== 'string') {
    errors.push(`Invalid 'output': "${config.output}". Must be a string (path).`);
  }

  if (!config.theme) {
    errors.push("Missing mandatory field: 'theme'.");
  } else if (typeof config.theme !== 'string') {
    errors.push(`Invalid 'theme': "${config.theme}". Must be a string.`);
  }

  // Optional fields
  if (config.features !== undefined) {
    if (!Array.isArray(config.features) || !config.features.every((f: any) => typeof f === 'string')) {
      errors.push("Invalid 'features': Must be an array of strings.");
    }
  }

  if (config.customMappings !== undefined) {
    if (typeof config.customMappings !== 'object' || config.customMappings === null || Array.isArray(config.customMappings)) {
      errors.push("Invalid 'customMappings': Must be an object.");
    } else {
      for (const key in config.customMappings) {
        if (typeof config.customMappings[key] !== 'string') {
          errors.push(`Invalid 'customMappings': Value for key "${key}" must be a string.`);
          break;
        }
      }
    }
  }

  if (config.excludePatterns !== undefined) {
    if (!Array.isArray(config.excludePatterns) || !config.excludePatterns.every((p: any) => typeof p === 'string')) {
      errors.push("Invalid 'excludePatterns': Must be an array of strings.");
    }
  }

  return errors;
}

async function loadConfig(configPath?: string): Promise<ConfigOptions | null> {
  let rawConfigData: string | undefined;
  let sourcePath: string | undefined;

  if (!configPath) {
    const defaultPaths = ['./userlens.config.json', './userlens.json'];
    for (const p of defaultPaths) {
      try {
        rawConfigData = await fs.readFile(p, 'utf-8');
        sourcePath = p;
        break;
      } catch (error) {
        // File doesn't exist, continue
      }
    }
    if (!rawConfigData) return null;
  } else {
    try {
      rawConfigData = await fs.readFile(configPath, 'utf-8');
      sourcePath = configPath;
    } catch (error) {
      console.error(`Error loading config from ${configPath}:`, error);
      process.exit(1); // Exit if specified config file not found or unreadable
    }
  }

  if (!rawConfigData || !sourcePath) { // Should not happen if logic above is correct
    return null;
  }

  try {
    const parsedConfig = JSON.parse(rawConfigData);
    const validationErrors = validateConfigOptions(parsedConfig);

    if (validationErrors.length > 0) {
      console.error(`\nConfiguration errors in ${sourcePath}:`);
      validationErrors.forEach(err => console.error(`- ${err}`));
      console.error("\nPlease fix the configuration and try again.");
      process.exit(1);
    }
    return parsedConfig as ConfigOptions;
  } catch (error: any) {
    console.error(`Error parsing config file ${sourcePath}: ${error.message}`);
    process.exit(1);
  }
}

async function findComponentFiles(
  entryPath: string, 
  framework: string,
  excludePatterns: string[] = []
): Promise<string[]> {
  const result: string[] = [];
  const excludeRegexes = excludePatterns.map(pattern => {
    // Escape special regex characters in the pattern
    const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Convert glob * to regex .*
      .replace(/\\\*/g, '.*');
    return new RegExp(escapedPattern);
  });
  
  async function scanDirectory(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // Check if path should be excluded
      if (excludeRegexes.some(regex => regex.test(fullPath))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Skip node_modules, build directories, etc.
        if (
          entry.name !== 'node_modules' && 
          entry.name !== 'dist' && 
          entry.name !== 'build' && 
          !entry.name.startsWith('.')
        ) {
          await scanDirectory(fullPath);
        }
      } else if (entry.isFile()) {
        // Check if file is a component based on framework
        const isComponent = isComponentFile(fullPath, framework);
        console.log(`Checking file: ${fullPath}, isComponent: ${isComponent}`);
        
        if (isComponent) {
          result.push(fullPath);
        }
      }
    }
  }
  
  await scanDirectory(entryPath);
  return result;
}

function isComponentFile(fileName: string, framework: string): boolean {
  const ext = path.extname(fileName).toLowerCase();
  const baseName = path.basename(fileName, ext);
  
  switch (framework) {
    case 'react':
      // React component files typically have .jsx or .tsx extensions
      // or are in a 'components' directory
      return (
        (ext === '.jsx' || ext === '.tsx' || ext === '.js' || ext === '.ts') &&
        (
          /^[A-Z]/.test(baseName) || 
          baseName.includes('Component') || 
          fileName.includes('/components/') ||
          fileName.includes('\\components\\') ||
          baseName.endsWith('Page') ||
          baseName.endsWith('View')
        ) &&
        !baseName.endsWith('.test') && 
        !baseName.endsWith('.spec')
      );
    
    case 'vue':
      return ext === '.vue';
    
    case 'angular':
      return ext === '.ts' && (
        baseName.endsWith('.component') || 
        fileName.includes('.component.')
      );
    
    default:
      return false;
  }
}

// Execute the program
if (require.main === module) {
  program.parse(process.argv);
} 