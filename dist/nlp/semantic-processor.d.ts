import { ComponentCategory, PropDefinition, SemanticInfo, UserAction } from '../models/interfaces';
export declare class NLPProcessor {
    private semanticMappings;
    private actionPhrases;
    private customMappings;
    constructor(customMappings?: Record<string, string>);
    generateDescription(componentName: string, context?: any): string;
    inferUserGoal(workflow: UserAction[]): string;
    categorizeComponent(componentName: string, props: PropDefinition[]): ComponentCategory;
    extractSemanticInfo(componentName: string, props: PropDefinition[]): SemanticInfo;
    private inferUserGoalFromComponent;
    private extractKeywords;
    private capitalizeFirstLetter;
}
