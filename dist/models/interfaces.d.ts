export declare enum ComponentCategory {
    FORM = "form",
    NAVIGATION = "navigation",
    DISPLAY = "display",
    INTERACTION = "interaction",
    LAYOUT = "layout"
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
export interface ComponentAnalyzer {
    parseComponent(filePath: string): Promise<ComponentMetadata>;
    extractUserActions(component: ComponentMetadata): UserAction[];
    identifyComponentPurpose(component: ComponentMetadata): string;
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
}
