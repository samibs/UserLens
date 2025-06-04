import { ComponentCategory, ComponentMetadata, PropDefinition, SemanticInfo, UserAction, NlpComponentContext } from '../models/interfaces';
import { NlpProcessorInterface } from '../models/plugin-interfaces';

export class NLPProcessor implements NlpProcessorInterface {
  private semanticMappings: Record<string, string> = {
    // Component name patterns → User descriptions
    'Login': 'Sign in to your account',
    'Register': 'Create a new account',
    'SignUp': 'Create a new account',
    'Profile': 'Manage your profile information',
    'Settings': 'Configure your preferences',
    'Dashboard': 'View your overview and statistics',
    'User': 'Your account information',
    'Password': 'Manage password security',
    'Notification': 'Manage your alerts and messages',
    'Search': 'Find what you need',
    'Filter': 'Narrow down your results',
    'Cart': 'Your shopping cart',
    'Checkout': 'Complete your purchase',
    'Product': 'View product details',
    'Admin': 'Administrative controls',
    'Navigation': 'Navigate through the application',
    'Menu': 'Access different sections',
    'Form': 'Enter your information',
    'List': 'Browse through items',
    'Table': 'View structured data',
    'Modal': 'View additional information',
    'Popup': 'Quick information or action',
    'Button': 'Perform an action',
    'Input': 'Enter information',
    'Select': 'Choose from options',
    'Dropdown': 'Select from a list',
    'Checkbox': 'Toggle an option',
    'Radio': 'Choose one option',
    'Sidebar': 'Access additional navigation',
    'Header': 'Main navigation area',
    'Footer': 'Additional information',
  };

  private actionPhrases: Record<string, string[]> = {
    'click': ['click', 'tap', 'press', 'select'],
    'input': ['enter', 'type', 'fill', 'write'],
    'navigation': ['navigate', 'go to', 'visit', 'open'],
    'submit': ['submit', 'send', 'save', 'confirm']
  };

  private customMappings: Record<string, string> = {};

  constructor(customMappings?: Record<string, string>) {
    if (customMappings) {
      this.customMappings = customMappings;
    }
  }

  public generateDescription(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): string {
    // TODO: Utilize props and additionalContext (jsxTextContent, comments, importSources, htmlTagsUsed) to generate a more accurate description.
    // For example, incorporate key text content or purpose inferred from comments or HTML tags.

    // First check custom mappings
    if (this.customMappings[componentName]) {
      return this.customMappings[componentName];
    }

    // Check for exact match in semantic mappings
    if (this.semanticMappings[componentName]) {
      return this.semanticMappings[componentName];
    }

    // Check for partial matches
    for (const [pattern, description] of Object.entries(this.semanticMappings)) {
      if (componentName.includes(pattern)) {
        return description;
      }
    }

    // Convert camelCase/PascalCase to spaces
    const humanReadable = componentName
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // Convert camelCase to spaces
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')  // Convert PascalCase to spaces
      .replace(/^./, (str) => str.toUpperCase());  // Capitalize first letter

    return humanReadable;
  }

  public inferUserGoal(workflow: UserAction[]): string {
    if (workflow.length === 0) {
      return "Using the application";
    }

    // Look for common patterns in the workflow
    const actionTypes = workflow.map(action => action.type);
    const actionTriggers = workflow.map(action => action.trigger.toLowerCase());
    
    // Form submission pattern
    if (actionTypes.includes('submit') && 
        (actionTypes.includes('input') || actionTriggers.some(t => t.includes('form')))) {
      return "Submitting information";
    }
    
    // Navigation pattern
    if (actionTypes.includes('navigation') || 
        actionTriggers.some(t => t.includes('link') || t.includes('menu'))) {
      return "Navigating through the application";
    }
    
    // Search pattern
    if (actionTriggers.some(t => t.includes('search'))) {
      return "Searching for information";
    }
    
    // Selection pattern
    if (actionTypes.includes('click') && 
        actionTriggers.some(t => t.includes('select') || t.includes('option'))) {
      return "Making a selection";
    }

    // Default based on the first and last action
    const firstAction = workflow[0];
    const lastAction = workflow[workflow.length - 1];
    
    return `${this.capitalizeFirstLetter(firstAction.type)}ing to ${lastAction.outcome}`;
  }

  public categorizeComponent(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): ComponentCategory {
    // TODO: Utilize additionalContext (jsxTextContent, comments, importSources, htmlTagsUsed) to influence categorization.
    // For example, presence of <form> tag in htmlTagsUsed strongly suggests ComponentCategory.FORM.
    // Keywords from jsxTextContent or comments can also provide hints.

    const name = componentName.toLowerCase();
    const propNames = props.map(p => p.name.toLowerCase());
    
    // TODO: Refine existing detection logic with additionalContext
    // Example: if (additionalContext.htmlTagsUsed?.includes('form')) return ComponentCategory.FORM;

    // Form detection
    if (
      name.includes('form') || 
      name.includes('input') || 
      name.includes('login') || 
      name.includes('register') ||
      propNames.some(p => p.includes('onsubmit') || p.includes('form'))
    ) {
      return ComponentCategory.FORM;
    }
    
    // Navigation detection
    if (
      name.includes('nav') || 
      name.includes('menu') || 
      name.includes('link') || 
      name.includes('route') ||
      propNames.some(p => p.includes('href') || p.includes('to') || p.includes('path'))
    ) {
      return ComponentCategory.NAVIGATION;
    }
    
    // Interaction detection
    if (
      name.includes('button') || 
      name.includes('click') || 
      name.includes('action') ||
      propNames.some(p => p.includes('onclick') || p.includes('onpress'))
    ) {
      return ComponentCategory.INTERACTION;
    }
    
    // Display detection
    if (
      name.includes('view') || 
      name.includes('display') || 
      name.includes('show') || 
      name.includes('card') ||
      name.includes('list') ||
      name.includes('table')
    ) {
      return ComponentCategory.DISPLAY;
    }
    
    // Default to layout
    return ComponentCategory.LAYOUT;
  }

  public extractSemanticInfo(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): SemanticInfo {
    const purpose = this.generateDescription(componentName, props, additionalContext);
    const keywords = this.extractKeywords(componentName, props, additionalContext); // Assuming extractKeywords might also use context
    
    return {
      purpose,
      userGoal: this.inferUserGoalFromComponent(componentName, props, additionalContext),
      keywords
    };
  }

  private inferUserGoalFromComponent(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): string {
    // TODO: Utilize additionalContext if it can help infer a more specific user goal.
    const name = componentName.toLowerCase();
    
    if (name.includes('login') || name.includes('signin')) {
      return "Signing in to access your account";
    }
    
    if (name.includes('register') || name.includes('signup')) {
      return "Creating a new account";
    }
    
    if (name.includes('search')) {
      return "Finding specific information";
    }
    
    if (name.includes('form')) {
      return "Submitting information";
    }
    
    if (name.includes('dashboard')) {
      return "Viewing an overview of your information";
    }
    
    if (name.includes('settings')) {
      return "Configuring your preferences";
    }
    
    // Default
    return `Interacting with the ${this.generateDescription(componentName, props, additionalContext).toLowerCase()}`;
  }

  private extractKeywords(componentName: string, props: PropDefinition[], additionalContext?: NlpComponentContext): string[] {
    // TODO: Optionally use additionalContext (e.g., jsxTextContent, comments) to extract more relevant keywords.
    const keywords = new Set<string>();
    
    // Add words from component name
    const nameWords = componentName
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .toLowerCase()
      .split(' ');
    
    nameWords.forEach(word => {
      if (word.length > 2) {  // Ignore very short words
        keywords.add(word);
      }
    });
    
    // Add words from prop names
    props.forEach(prop => {
      const propWords = prop.name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .split(' ');
      
      propWords.forEach(word => {
        if (word.length > 2 && !['the', 'and', 'for', 'with'].includes(word)) {
          keywords.add(word);
        }
      });
    });
    
    return Array.from(keywords);
  }

  private capitalizeFirstLetter(string: string): string {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
} 