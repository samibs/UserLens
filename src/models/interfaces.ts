export enum ComponentCategory {
  FORM = 'form',
  NAVIGATION = 'navigation',
  DISPLAY = 'display',
  INTERACTION = 'interaction',
  LAYOUT = 'layout'
}

export interface PropDefinition {
  name: string;
  type: string;
  required: boolean;
  description?: string;
  defaultValue?: any;
}

export interface UserAction {
  type: 'click' | 'input' | 'navigation' | 'submit';
  trigger: string;
  description: string;
  outcome: string;
}

export interface ComponentMetadata {
  name: string;
  filePath: string;
  props: PropDefinition[];
  children: ComponentMetadata[];
  userActions: UserAction[];
  semanticCategory: ComponentCategory;
  description: string;
}

export interface JourneyStep {
  id: string;
  name: string;
  description: string;
  component: ComponentMetadata;
  actions: UserAction[];
  nextSteps: string[];
}

export interface UserJourney {
  name: string;
  steps: JourneyStep[];
  components: ComponentMetadata[];
  description: string;
}

export interface RouteMetadata {
  path: string;
  component: string;
  children?: RouteMetadata[];
  name?: string;
  params?: Record<string, string>;
}

export interface SemanticInfo {
  purpose: string;
  userGoal: string;
  keywords: string[];
}
export interface NlpComponentContext {
  filePath: string; // From ComponentMetadata
  props?: PropDefinition[]; // Existing props, for convenience
  jsxTextContent?: string[]; // Extracted text nodes from JSX
  comments?: {
    leading?: string[]; // Comments directly preceding component/prop/element
    trailing?: string[]; // Comments directly following
    inner?: string[]; // Comments inside a block or JSX element
    jsdoc?: string[]; // JSDoc blocks
  };
  importSources?: string[]; // Names of imported modules/libraries
  htmlTagsUsed?: string[]; // Unique HTML tags found in the component's render output
  // Potentially add parentComponentName or other relational context in the future
}

export interface ComponentAnalyzer {
  parseComponent(filePath: string): Promise<ComponentMetadata>;
  extractUserActions(component: ComponentMetadata): UserAction[];
  identifyComponentPurpose(component: ComponentMetadata, props: PropDefinition[], additionalContext: NlpComponentContext): string;
}

export interface RouteAnalyzer {
  parseRoutes(routeFiles: string[]): Promise<RouteMetadata[]>;
  mapUserJourneys(routes: RouteMetadata[]): UserJourney[];
}

export interface SemanticAnalyzer {
  extractSemanticMeaning(componentName: string, props: PropDefinition[]): SemanticInfo;
  categorizeComponent(component: ComponentMetadata): ComponentCategory;
  generateUserDescription(component: ComponentMetadata): string;
}

import { PluginConfig } from './plugin-interfaces'; // Added import

export interface DocumentGenerator {
  generateDocumentation(components: ComponentMetadata[], journeys: UserJourney[], outputPath: string): Promise<void>;
}

export interface ConfigOptions {
  framework: 'react' | 'vue' | 'angular';
  entry: string;
  output: string;
  theme: string;
  features: string[];
  customMappings?: Record<string, string>;
  excludePatterns?: string[];
  pluginPaths?: string[]; // Added
  localPluginsPath?: string; // Added for local plugin discovery
  plugins?: { // Added
    [pluginId: string]: {
      config?: PluginConfig;
      isDefaultForFramework?: string[];
      isDefaultForFormat?: string[];
      isDefaultForCapability?: string[];
    };
  };
}