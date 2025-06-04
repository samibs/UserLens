import * as fs from 'fs/promises';
import * as path from 'path';
import { ComponentMetadata, DocumentGenerator, UserJourney } from '../../models/interfaces';
import { PatternMatcher, Workflow } from '../../nlp/pattern-matcher';

export class MarkdownGenerator implements DocumentGenerator {
  private patternMatcher: PatternMatcher;
  
  constructor() {
    this.patternMatcher = new PatternMatcher();
  }
  
  public async generateDocumentation(
    components: ComponentMetadata[], 
    journeys: UserJourney[], 
    outputPath: string
  ): Promise<void> {
    // Create output directory if it doesn't exist
    await fs.mkdir(outputPath, { recursive: true });
    
    // Generate files
    await this.generateOverview(components, journeys, outputPath);
    await this.generateGettingStarted(components, journeys, outputPath);
    await this.generateFeatures(components, journeys, outputPath);
    await this.generateWorkflows(components, outputPath);
    await this.generateIndex(outputPath);
  }
  
  public async generateOverview(
    components: ComponentMetadata[],
    journeys: UserJourney[],
    outputPath: string
  ): Promise<void> {
    const patterns = this.patternMatcher.detectPatterns(components);
    const mainPatterns = patterns.slice(0, 5); // Top 5 patterns
    
    let content = `# Application Overview\n\n`;
    content += `This documentation helps you understand how to use the application.\n\n`;
    
    // Key features section
    content += `## Key Features\n\n`;
    
    mainPatterns.forEach(pattern => {
      content += `### ${this.capitalizeFirstLetter(pattern.name)}\n\n`;
      content += `${pattern.description}\n\n`;
      content += `**User Goal:** ${pattern.userGoal}\n\n`;
    });
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'overview.md'), content);
  }
  
  private async generateGettingStarted(
    components: ComponentMetadata[], 
    journeys: UserJourney[], 
    outputPath: string
  ): Promise<void> {
    // Create getting-started directory
    const gettingStartedPath = path.join(outputPath, 'getting-started');
    await fs.mkdir(gettingStartedPath, { recursive: true });
    
    // Generate authentication guide if authentication components exist
    const authComponents = components.filter(c => 
      c.name.toLowerCase().includes('login') || 
      c.name.toLowerCase().includes('register') || 
      c.name.toLowerCase().includes('signin') ||
      c.name.toLowerCase().includes('signup')
    );
    
    if (authComponents.length > 0) {
      await this.generateAuthenticationGuide(authComponents, gettingStartedPath);
    }
    
    // Generate navigation guide
    const navComponents = components.filter(c => 
      c.name.toLowerCase().includes('nav') || 
      c.name.toLowerCase().includes('menu') || 
      c.name.toLowerCase().includes('sidebar') ||
      c.name.toLowerCase().includes('header')
    );
    
    if (navComponents.length > 0) {
      await this.generateNavigationGuide(navComponents, gettingStartedPath);
    }
    
    // Generate first steps guide
    await this.generateFirstStepsGuide(components, journeys, gettingStartedPath);
  }
  
  private async generateAuthenticationGuide(
    authComponents: ComponentMetadata[], 
    outputPath: string
  ): Promise<void> {
    const loginComponent = authComponents.find(c => 
      c.name.toLowerCase().includes('login') || 
      c.name.toLowerCase().includes('signin')
    );
    
    const registerComponent = authComponents.find(c => 
      c.name.toLowerCase().includes('register') || 
      c.name.toLowerCase().includes('signup')
    );
    
    let content = `# Authentication\n\n`;
    
    if (registerComponent) {
      content += `## Creating an Account\n\n`;
      content += `To create a new account:\n\n`;
      content += `1. Navigate to the ${registerComponent.description.toLowerCase()}\n`;
      
      const registerActions = registerComponent.userActions.filter(a => a.type === 'input');
      if (registerActions.length > 0) {
        content += `2. Fill in the following information:\n\n`;
        registerActions.forEach(action => {
          content += `   - ${action.description}\n`;
        });
        content += `\n`;
      }
      
      const submitAction = registerComponent.userActions.find(a => a.type === 'submit');
      if (submitAction) {
        content += `3. ${submitAction.description}\n\n`;
      } else {
        content += `3. Submit the form to create your account\n\n`;
      }
    }
    
    if (loginComponent) {
      content += `## Signing In\n\n`;
      content += `To sign in to your account:\n\n`;
      content += `1. Navigate to the ${loginComponent.description.toLowerCase()}\n`;
      
      const loginActions = loginComponent.userActions.filter(a => a.type === 'input');
      if (loginActions.length > 0) {
        content += `2. Enter your credentials:\n\n`;
        loginActions.forEach(action => {
          content += `   - ${action.description}\n`;
        });
        content += `\n`;
      }
      
      const submitAction = loginComponent.userActions.find(a => a.type === 'submit');
      if (submitAction) {
        content += `3. ${submitAction.description}\n\n`;
      } else {
        content += `3. Click the sign in button to access your account\n\n`;
      }
    }
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'authentication.md'), content);
  }
  
  private async generateNavigationGuide(
    navComponents: ComponentMetadata[], 
    outputPath: string
  ): Promise<void> {
    let content = `# Navigating the Application\n\n`;
    content += `This guide helps you understand how to navigate through the application.\n\n`;
    
    content += `## Main Navigation\n\n`;
    
    // Group by component type
    const headers = navComponents.filter(c => c.name.toLowerCase().includes('header'));
    const sidebars = navComponents.filter(c => c.name.toLowerCase().includes('sidebar'));
    const menus = navComponents.filter(c => 
      c.name.toLowerCase().includes('menu') || 
      c.name.toLowerCase().includes('nav')
    );
    
    if (headers.length > 0) {
      content += `### Header Navigation\n\n`;
      content += `The main header contains these navigation options:\n\n`;
      
      headers.forEach(header => {
        content += `- **${header.description}**: ${this.extractNavigationPurpose(header)}\n`;
      });
      content += `\n`;
    }
    
    if (sidebars.length > 0) {
      content += `### Sidebar Navigation\n\n`;
      content += `The sidebar provides access to these sections:\n\n`;
      
      sidebars.forEach(sidebar => {
        content += `- **${sidebar.description}**: ${this.extractNavigationPurpose(sidebar)}\n`;
      });
      content += `\n`;
    }
    
    if (menus.length > 0) {
      content += `### Menus\n\n`;
      
      menus.forEach(menu => {
        content += `- **${menu.description}**: ${this.extractNavigationPurpose(menu)}\n`;
      });
      content += `\n`;
    }
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'navigation.md'), content);
  }
  
  private async generateFirstStepsGuide(
    components: ComponentMetadata[], 
    journeys: UserJourney[], 
    outputPath: string
  ): Promise<void> {
    let content = `# Getting Started\n\n`;
    content += `This guide will walk you through your first steps using the application.\n\n`;
    
    // Add journey information if available
    if (journeys.length > 0) {
      const mainJourney = journeys[0];
      
      content += `## ${mainJourney.name}\n\n`;
      content += `${mainJourney.description}\n\n`;
      
      if (mainJourney.steps.length > 0) {
        content += `### Steps\n\n`;
        
        mainJourney.steps.forEach((step, index) => {
          content += `${index + 1}. **${step.name}**: ${step.description}\n`;
        });
        content += `\n`;
      }
    } else {
      // If no journeys are available, create a general guide
      content += `## Key Areas\n\n`;
      
      const keyComponents = components.slice(0, 5); // First 5 components
      
      keyComponents.forEach(component => {
        content += `### ${component.description}\n\n`;
        
        if (component.userActions.length > 0) {
          content += `Common actions:\n\n`;
          
          component.userActions.forEach(action => {
            content += `- ${action.description}\n`;
          });
          content += `\n`;
        }
      });
    }
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'first-steps.md'), content);
  }
  
  private async generateFeatures(
    components: ComponentMetadata[], 
    journeys: UserJourney[], 
    outputPath: string
  ): Promise<void> {
    // Create features directory
    const featuresPath = path.join(outputPath, 'features');
    await fs.mkdir(featuresPath, { recursive: true });
    
    // Group components by category
    const componentsByCategory: Record<string, ComponentMetadata[]> = {};
    
    components.forEach(component => {
      const category = component.semanticCategory.toLowerCase();
      
      if (!componentsByCategory[category]) {
        componentsByCategory[category] = [];
      }
      
      componentsByCategory[category].push(component);
    });
    
    // Generate feature documentation for each category
    for (const [category, categoryComponents] of Object.entries(componentsByCategory)) {
      if (categoryComponents.length > 0) {
        const categoryPath = path.join(featuresPath, category);
        await fs.mkdir(categoryPath, { recursive: true });
        
        await this.generateCategoryOverview(category, categoryComponents, categoryPath);
        
        // Generate documentation for individual significant components
        const significantComponents = categoryComponents.filter(c => 
          c.userActions.length > 0 || 
          c.props.length > 3 ||
          c.name.toLowerCase().includes('main') ||
          c.name.toLowerCase().includes('primary')
        );
        
        for (const component of significantComponents) {
          await this.generateComponentDoc(component, categoryPath);
        }
      }
    }
  }
  
  public async generateCategoryOverview(
    category: string,
    components: ComponentMetadata[],
    outputPath: string
  ): Promise<void> {
    let content = `# ${this.capitalizeFirstLetter(category)} Features\n\n`;
    content += `This section covers the ${category} features of the application.\n\n`;
    
    content += `## Available ${this.capitalizeFirstLetter(category)} Features\n\n`;
    
    components.forEach(component => {
      content += `### ${component.description}\n\n`;
      content += `${this.generateComponentSummary(component)}\n\n`;
    });
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'overview.md'), content);
  }
  
  public async generateComponentDoc(
    component: ComponentMetadata,
    outputPath: string
  ): Promise<void> {
    const fileName = component.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    let content = `# ${component.description}\n\n`;
    
    // Add component description
    content += `${this.generateComponentSummary(component)}\n\n`;
    
    // Add user actions section if available
    if (component.userActions.length > 0) {
      content += `## How to Use\n\n`;
      
      component.userActions.forEach(action => {
        content += `- **${action.description}**: ${action.outcome}\n`;
      });
      content += `\n`;
    }
    
    // Add props section if available
    if (component.props.length > 0) {
      content += `## Options and Settings\n\n`;
      
      const userVisibleProps = component.props.filter(p => 
        !p.name.startsWith('on') && 
        !p.name.includes('ref') &&
        !p.name.includes('key') &&
        !p.name.includes('style')
      );
      
      if (userVisibleProps.length > 0) {
        userVisibleProps.forEach(prop => {
          const readableName = prop.name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .toLowerCase();
          
          content += `- **${this.capitalizeFirstLetter(readableName)}**: `;
          
          if (prop.description) {
            content += prop.description;
          } else {
            content += `Controls the ${readableName} of the ${component.name.toLowerCase()}`;
          }
          
          if (prop.defaultValue !== undefined) {
            content += ` (Default: ${prop.defaultValue})`;
          }
          
          content += `\n`;
        });
      }
    }
    
    // Write to file
    await fs.writeFile(path.join(outputPath, `${fileName}.md`), content);
  }
  
  public async generateWorkflows(
    components: ComponentMetadata[],
    outputPath: string
  ): Promise<void> {
    // Create workflows directory
    const workflowsPath = path.join(outputPath, 'workflows');
    await fs.mkdir(workflowsPath, { recursive: true });
    
    // Detect workflows
    const workflows = this.patternMatcher.detectWorkflows(components);
    
    // Generate index
    let indexContent = `# Common Workflows\n\n`;
    indexContent += `This section covers common tasks and workflows in the application.\n\n`;
    
    workflows.forEach(workflow => {
      indexContent += `- [${workflow.name}](${workflow.name.toLowerCase().replace(/\s+/g, '-')}.md): ${workflow.description}\n`;
    });
    
    await fs.writeFile(path.join(workflowsPath, 'index.md'), indexContent);
    
    // Generate individual workflow docs
    for (const workflow of workflows) {
      await this.generateWorkflowDoc(workflow, workflowsPath);
    }
  }
  
  private async generateWorkflowDoc(
    workflow: Workflow, 
    outputPath: string
  ): Promise<void> {
    const fileName = workflow.name.toLowerCase().replace(/\s+/g, '-');
    
    let content = `# ${workflow.name}\n\n`;
    content += `${workflow.description}\n\n`;
    
    if (workflow.steps.length > 0) {
      content += `## Step-by-Step Guide\n\n`;
      
      workflow.steps.forEach((step, index) => {
        content += `### Step ${index + 1}: ${step.name}\n\n`;
        content += `${step.description}\n\n`;
        
        if (step.actions.length > 0) {
          step.actions.forEach(action => {
            content += `- ${action.description}\n`;
          });
          content += `\n`;
        }
      });
    }
    
    // Write to file
    await fs.writeFile(path.join(outputPath, `${fileName}.md`), content);
  }
  
  public async generateIndex(outputPath: string): Promise<void> {
    let content = `# User Documentation\n\n`;
    content += `Welcome to the user documentation. This guide will help you understand how to use the application effectively.\n\n`;
    
    content += `## Contents\n\n`;
    content += `- [Overview](overview.md)\n`;
    content += `- [Getting Started](getting-started/first-steps.md)\n`;
    content += `  - [Authentication](getting-started/authentication.md)\n`;
    content += `  - [Navigation](getting-started/navigation.md)\n`;
    content += `- [Features](features/)\n`;
    content += `- [Workflows](workflows/)\n`;
    
    // Write to file
    await fs.writeFile(path.join(outputPath, 'index.md'), content);
  }
  
  private generateComponentSummary(component: ComponentMetadata): string {
    let summary = '';
    
    if (component.semanticCategory) {
      summary += `This is a ${component.semanticCategory.toLowerCase()} component. `;
    }
    
    if (component.userActions.length > 0) {
      summary += `You can ${component.userActions.map(a => a.description.toLowerCase()).join(' or ')}.`;
    } else {
      summary += `This component displays information to the user.`;
    }
    
    return summary;
  }
  
  private extractNavigationPurpose(component: ComponentMetadata): string {
    const navActions = component.userActions.filter(a => a.type === 'navigation');
    
    if (navActions.length > 0) {
      return navActions.map(a => a.outcome).join(', ');
    } else {
      return `Provides access to different sections of the application`;
    }
  }
  
  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
} 