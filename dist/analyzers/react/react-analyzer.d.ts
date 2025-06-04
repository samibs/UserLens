import { ComponentAnalyzer, ComponentMetadata, UserAction } from '../../models/interfaces';
export declare class ReactAnalyzer implements ComponentAnalyzer {
    private nlpProcessor;
    constructor(customMappings?: Record<string, string>);
    parseComponent(filePath: string): Promise<ComponentMetadata>;
    extractUserActions(component: ComponentMetadata): UserAction[];
    identifyComponentPurpose(component: ComponentMetadata): string;
    private parseCode;
    private extractComponentName;
    private extractProps;
    private extractFunctionComponentProps;
    private createClickAction;
    private createSubmitAction;
    private createInputAction;
    private createNavigationAction;
    private formatTriggerName;
}
