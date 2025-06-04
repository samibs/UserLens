import { ComponentMetadata, DocumentGenerator, UserJourney } from '../../models/interfaces';
export declare class MarkdownGenerator implements DocumentGenerator {
    private patternMatcher;
    constructor();
    generateDocumentation(components: ComponentMetadata[], journeys: UserJourney[], outputPath: string): Promise<void>;
    private generateOverview;
    private generateGettingStarted;
    private generateAuthenticationGuide;
    private generateNavigationGuide;
    private generateFirstStepsGuide;
    private generateFeatures;
    private generateCategoryOverview;
    private generateComponentDoc;
    private generateWorkflows;
    private generateWorkflowDoc;
    private generateIndex;
    private generateComponentSummary;
    private extractNavigationPurpose;
    private capitalizeFirstLetter;
}
