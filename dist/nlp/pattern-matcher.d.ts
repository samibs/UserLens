import { ComponentMetadata, UserAction } from '../models/interfaces';
export declare class PatternMatcher {
    private patterns;
    detectPatterns(components: ComponentMetadata[]): DetectedPattern[];
    detectWorkflows(components: ComponentMetadata[]): Workflow[];
    private matchesPattern;
    private findMatchingActions;
    private calculateConfidence;
    private hasAuthenticationFlow;
    private hasSearchFlow;
    private hasFormSubmissionFlow;
    private hasCRUDFlow;
    private hasCheckoutFlow;
    private createAuthenticationWorkflow;
    private createSearchWorkflow;
    private createFormWorkflow;
    private createCRUDWorkflow;
    private createCheckoutWorkflow;
}
export interface DetectedPattern {
    name: string;
    description: string;
    userGoal: string;
    components: ComponentMetadata[];
    actions: UserAction[];
    confidence: number;
}
export interface WorkflowStep {
    name: string;
    description: string;
    actions: UserAction[];
}
export interface Workflow {
    name: string;
    description: string;
    steps: WorkflowStep[];
    components: ComponentMetadata[];
}
