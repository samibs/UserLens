#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const child_process_1 = require("child_process");
const commander_1 = require("commander");
const react_analyzer_1 = require("../analyzers/react/react-analyzer");
const markdown_generator_1 = require("../generators/markdown/markdown-generator");
const pattern_matcher_1 = require("../nlp/pattern-matcher");
// Define the CLI program
const program = new commander_1.Command();
program
    .name('userlens')
    .description('Semantic User Documentation Generator from Application Code Analysis')
    .version('0.1.0');
// Analyze command
program
    .command('analyze')
    .description('Analyze a frontend application and store the results')
    .option('-e, --entry <path>', 'Entry path to the application code', './src')
    .option('-o, --output <path>', 'Output path for analysis results', './userlens-analysis')
    .option('-f, --framework <framework>', 'Frontend framework (react, vue, angular)', 'react')
    .option('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
    try {
        console.log('Starting application analysis...');
        const config = await loadConfig(options.config);
        const entryPath = options.entry || config?.entry || './src';
        const outputPath = options.output || config?.output || './userlens-analysis';
        const framework = options.framework || config?.framework || 'react';
        await fs.mkdir(outputPath, { recursive: true });
        let analyzer;
        // Select the appropriate analyzer based on the framework
        switch (framework) {
            case 'react':
                analyzer = new react_analyzer_1.ReactAnalyzer(config?.customMappings);
                break;
            case 'vue':
                console.log('Vue analyzer not yet implemented, falling back to React analyzer');
                analyzer = new react_analyzer_1.ReactAnalyzer(config?.customMappings);
                break;
            case 'angular':
                console.log('Angular analyzer not yet implemented, falling back to React analyzer');
                analyzer = new react_analyzer_1.ReactAnalyzer(config?.customMappings);
                break;
            default:
                throw new Error(`Unsupported framework: ${framework}`);
        }
        // Find component files
        const componentFiles = await findComponentFiles(entryPath, framework, config?.excludePatterns);
        console.log(`Found ${componentFiles.length} component files`);
        // Analyze components
        const components = [];
        for (const file of componentFiles) {
            try {
                const component = await analyzer.parseComponent(file);
                components.push(component);
                console.log(`Analyzed component: ${component.name}`);
            }
            catch (error) {
                console.error(`Error analyzing file ${file}:`, error);
            }
        }
        // Save analysis results
        await fs.writeFile(path.join(outputPath, 'components.json'), JSON.stringify(components, null, 2));
        // Generate pattern analysis
        const patternMatcher = new pattern_matcher_1.PatternMatcher();
        const patterns = patternMatcher.detectPatterns(components);
        const workflows = patternMatcher.detectWorkflows(components);
        await fs.writeFile(path.join(outputPath, 'patterns.json'), JSON.stringify(patterns, null, 2));
        await fs.writeFile(path.join(outputPath, 'workflows.json'), JSON.stringify(workflows, null, 2));
        console.log(`Analysis complete. Results saved to ${outputPath}`);
    }
    catch (error) {
        console.error('Error during analysis:', error);
        process.exit(1);
    }
});
// Generate command
program
    .command('generate')
    .description('Generate user documentation from analysis results')
    .option('-i, --input <path>', 'Input path with analysis results', './userlens-analysis')
    .option('-o, --output <path>', 'Output path for documentation', './userlens-docs')
    .option('-f, --format <format>', 'Output format (markdown, html, interactive)', 'markdown')
    .option('-t, --theme <theme>', 'Theme for documentation', 'default')
    .action(async (options) => {
    try {
        console.log('Generating documentation...');
        const inputPath = options.input;
        const outputPath = options.output;
        const format = options.format;
        const theme = options.theme;
        // Load analysis results
        const componentsData = await fs.readFile(path.join(inputPath, 'components.json'), 'utf-8');
        const components = JSON.parse(componentsData);
        let journeys = [];
        try {
            const workflowsData = await fs.readFile(path.join(inputPath, 'workflows.json'), 'utf-8');
            journeys = JSON.parse(workflowsData);
        }
        catch (error) {
            console.log('No workflows found, generating documentation without user journeys');
        }
        // Select generator based on format
        let generator;
        switch (format) {
            case 'markdown':
                generator = new markdown_generator_1.MarkdownGenerator();
                break;
            case 'html':
                console.log('HTML generator not yet implemented, falling back to Markdown generator');
                generator = new markdown_generator_1.MarkdownGenerator();
                break;
            case 'interactive':
                console.log('Interactive generator not yet implemented, falling back to Markdown generator');
                generator = new markdown_generator_1.MarkdownGenerator();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }
        // Generate documentation
        await generator.generateDocumentation(components, journeys, outputPath);
        console.log(`Documentation generated successfully in ${outputPath}`);
    }
    catch (error) {
        console.error('Error generating documentation:', error);
        process.exit(1);
    }
});
// Serve command
program
    .command('serve')
    .description('Serve the generated documentation')
    .option('-d, --docs <path>', 'Path to the documentation', './userlens-docs')
    .option('-p, --port <number>', 'Port to serve on', '3000')
    .action(async (options) => {
    const userDocsPath = options.docs;
    const resolvedDocsPath = path.resolve(userDocsPath);
    const port = options.port;
    try {
        const stats = await fs.stat(resolvedDocsPath);
        if (!stats.isDirectory()) {
            console.error(`Error: Documentation path '${userDocsPath}' (resolved to '${resolvedDocsPath}') is not a directory.`);
            process.exit(1);
        }
    }
    catch (error) {
        if (error.code === 'ENOENT') {
            console.error(`Error: Documentation directory '${userDocsPath}' (resolved to '${resolvedDocsPath}') not found.`);
        }
        else {
            console.error(`Error accessing documentation directory '${userDocsPath}' (resolved to '${resolvedDocsPath}'): ${error.message}`);
        }
        process.exit(1);
    }
    console.log(`Serving documentation from ${userDocsPath} at http://localhost:${port}`);
    const serveProcess = (0, child_process_1.spawn)('npx', ['serve', userDocsPath, '-l', port], { stdio: 'inherit', shell: true });
    serveProcess.on('error', (err) => {
        console.error(`Failed to start server: ${err.message}`);
        console.error('Please ensure "serve" is installed correctly (e.g., via "npm install serve" in your project or "npm install -g serve").');
        process.exit(1);
    });
    serveProcess.on('exit', (code, signal) => {
        // SIGINT is a common way to stop the server (Ctrl+C), so don't log it as an unexpected exit.
        if (code !== 0 && signal !== 'SIGINT') {
            console.log(`Server process exited with code ${code}${signal ? ` and signal ${signal}` : ''}.`);
        }
        else if (signal === 'SIGINT') {
            console.log('Server stopped.');
        }
    });
});
// Helper functions
function validateConfigOptions(config) {
    const errors = [];
    const validFrameworks = ["react", "vue", "angular"];
    // Mandatory fields
    if (!config.framework) {
        errors.push("Missing mandatory field: 'framework'.");
    }
    else if (typeof config.framework !== 'string' || !validFrameworks.includes(config.framework)) {
        errors.push(`Invalid 'framework': "${config.framework}". Must be one of ${validFrameworks.join(', ')}.`);
    }
    if (!config.entry) {
        errors.push("Missing mandatory field: 'entry'.");
    }
    else if (typeof config.entry !== 'string') {
        errors.push(`Invalid 'entry': "${config.entry}". Must be a string (path).`);
    }
    if (!config.output) {
        errors.push("Missing mandatory field: 'output'.");
    }
    else if (typeof config.output !== 'string') {
        errors.push(`Invalid 'output': "${config.output}". Must be a string (path).`);
    }
    if (!config.theme) {
        errors.push("Missing mandatory field: 'theme'.");
    }
    else if (typeof config.theme !== 'string') {
        errors.push(`Invalid 'theme': "${config.theme}". Must be a string.`);
    }
    // Optional fields
    if (config.features !== undefined) {
        if (!Array.isArray(config.features) || !config.features.every((f) => typeof f === 'string')) {
            errors.push("Invalid 'features': Must be an array of strings.");
        }
    }
    if (config.customMappings !== undefined) {
        if (typeof config.customMappings !== 'object' || config.customMappings === null || Array.isArray(config.customMappings)) {
            errors.push("Invalid 'customMappings': Must be an object.");
        }
        else {
            for (const key in config.customMappings) {
                if (typeof config.customMappings[key] !== 'string') {
                    errors.push(`Invalid 'customMappings': Value for key "${key}" must be a string.`);
                    break;
                }
            }
        }
    }
    if (config.excludePatterns !== undefined) {
        if (!Array.isArray(config.excludePatterns) || !config.excludePatterns.every((p) => typeof p === 'string')) {
            errors.push("Invalid 'excludePatterns': Must be an array of strings.");
        }
    }
    return errors;
}
async function loadConfig(configPath) {
    let rawConfigData;
    let sourcePath;
    if (!configPath) {
        const defaultPaths = ['./userlens.config.json', './userlens.json'];
        for (const p of defaultPaths) {
            try {
                rawConfigData = await fs.readFile(p, 'utf-8');
                sourcePath = p;
                break;
            }
            catch (error) {
                // File doesn't exist, continue
            }
        }
        if (!rawConfigData)
            return null;
    }
    else {
        try {
            rawConfigData = await fs.readFile(configPath, 'utf-8');
            sourcePath = configPath;
        }
        catch (error) {
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
        return parsedConfig;
    }
    catch (error) {
        console.error(`Error parsing config file ${sourcePath}: ${error.message}`);
        process.exit(1);
    }
}
async function findComponentFiles(entryPath, framework, excludePatterns = []) {
    const result = [];
    const excludeRegexes = excludePatterns.map(pattern => {
        // Escape special regex characters in the pattern
        const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            // Convert glob * to regex .*
            .replace(/\\\*/g, '.*');
        return new RegExp(escapedPattern);
    });
    async function scanDirectory(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            // Check if path should be excluded
            if (excludeRegexes.some(regex => regex.test(fullPath))) {
                continue;
            }
            if (entry.isDirectory()) {
                // Skip node_modules, build directories, etc.
                if (entry.name !== 'node_modules' &&
                    entry.name !== 'dist' &&
                    entry.name !== 'build' &&
                    !entry.name.startsWith('.')) {
                    await scanDirectory(fullPath);
                }
            }
            else if (entry.isFile()) {
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
function isComponentFile(fileName, framework) {
    const ext = path.extname(fileName).toLowerCase();
    const baseName = path.basename(fileName, ext);
    switch (framework) {
        case 'react':
            // React component files typically have .jsx or .tsx extensions
            // or are in a 'components' directory
            return ((ext === '.jsx' || ext === '.tsx' || ext === '.js' || ext === '.ts') &&
                (/^[A-Z]/.test(baseName) ||
                    baseName.includes('Component') ||
                    fileName.includes('/components/') ||
                    fileName.includes('\\components\\') ||
                    baseName.endsWith('Page') ||
                    baseName.endsWith('View')) &&
                !baseName.endsWith('.test') &&
                !baseName.endsWith('.spec'));
        case 'vue':
            return ext === '.vue';
        case 'angular':
            return ext === '.ts' && (baseName.endsWith('.component') ||
                fileName.includes('.component.'));
        default:
            return false;
    }
}
// Execute the program
if (require.main === module) {
    program.parse(process.argv);
}
//# sourceMappingURL=index.js.map