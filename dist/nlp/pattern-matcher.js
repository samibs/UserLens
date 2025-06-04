"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PatternMatcher = void 0;
const interfaces_1 = require("../models/interfaces");
class PatternMatcher {
    constructor() {
        // Common UI/UX patterns and their descriptions
        this.patterns = {
            'authentication': {
                components: ['login', 'signin', 'register', 'signup', 'password', 'auth'],
                actions: ['submit credentials', 'create account', 'reset password'],
                description: 'User authentication flow',
                userGoal: 'Access your account securely'
            },
            'search': {
                components: ['search', 'filter', 'results', 'query'],
                actions: ['enter search term', 'apply filter', 'view results'],
                description: 'Search and filtering functionality',
                userGoal: 'Find specific information'
            },
            'form-submission': {
                components: ['form', 'input', 'submit', 'field', 'validation'],
                actions: ['fill form', 'validate input', 'submit data'],
                description: 'Data entry and submission',
                userGoal: 'Submit information'
            },
            'crud': {
                components: ['create', 'add', 'edit', 'update', 'delete', 'remove', 'list'],
                actions: ['create new', 'update existing', 'delete item', 'view items'],
                description: 'Create, Read, Update, Delete operations',
                userGoal: 'Manage your data'
            },
            'navigation': {
                components: ['nav', 'menu', 'sidebar', 'header', 'footer', 'link', 'route'],
                actions: ['navigate to', 'open page', 'go to section'],
                description: 'Navigation through the application',
                userGoal: 'Move between different sections'
            },
            'dashboard': {
                components: ['dashboard', 'overview', 'stats', 'analytics', 'widgets'],
                actions: ['view statistics', 'monitor data', 'check status'],
                description: 'Overview and analytics display',
                userGoal: 'Get a comprehensive view of your data'
            },
            'settings': {
                components: ['settings', 'preferences', 'config', 'options', 'profile'],
                actions: ['change settings', 'update preferences', 'configure options'],
                description: 'User preferences and configuration',
                userGoal: 'Customize your experience'
            },
            'notification': {
                components: ['notification', 'alert', 'message', 'toast'],
                actions: ['view notifications', 'mark as read', 'dismiss alert'],
                description: 'User notification system',
                userGoal: 'Stay informed about important updates'
            },
            'cart-checkout': {
                components: ['cart', 'basket', 'checkout', 'payment', 'order'],
                actions: ['add to cart', 'remove item', 'complete purchase'],
                description: 'Shopping cart and checkout process',
                userGoal: 'Complete your purchase'
            },
            'wizard': {
                components: ['wizard', 'step', 'progress', 'multi-step', 'flow'],
                actions: ['proceed to next step', 'go back', 'complete process'],
                description: 'Step-by-step guided process',
                userGoal: 'Complete a multi-step process'
            }
        };
    }
    // Detect UI/UX patterns from component names and actions
    detectPatterns(components) {
        const detectedPatterns = [];
        for (const [patternName, pattern] of Object.entries(this.patterns)) {
            const matchingComponents = components.filter(component => this.matchesPattern(component.name.toLowerCase(), pattern.components));
            if (matchingComponents.length > 0) {
                const matchingActions = this.findMatchingActions(matchingComponents.flatMap(c => c.userActions), pattern.actions);
                detectedPatterns.push({
                    name: patternName,
                    description: pattern.description,
                    userGoal: pattern.userGoal,
                    components: matchingComponents,
                    actions: matchingActions,
                    confidence: this.calculateConfidence(matchingComponents, matchingActions, pattern)
                });
            }
        }
        return detectedPatterns.sort((a, b) => b.confidence - a.confidence);
    }
    // Detect workflow patterns by analyzing sequences of actions
    detectWorkflows(components) {
        const workflows = [];
        const allActions = components.flatMap(c => c.userActions);
        // Authentication workflow
        if (this.hasAuthenticationFlow(components, allActions)) {
            workflows.push(this.createAuthenticationWorkflow(components, allActions));
        }
        // Search workflow
        if (this.hasSearchFlow(components, allActions)) {
            workflows.push(this.createSearchWorkflow(components, allActions));
        }
        // Form submission workflow
        if (this.hasFormSubmissionFlow(components, allActions)) {
            workflows.push(this.createFormWorkflow(components, allActions));
        }
        // CRUD workflow
        if (this.hasCRUDFlow(components, allActions)) {
            workflows.push(this.createCRUDWorkflow(components, allActions));
        }
        // Checkout workflow
        if (this.hasCheckoutFlow(components, allActions)) {
            workflows.push(this.createCheckoutWorkflow(components, allActions));
        }
        return workflows;
    }
    // Helper methods
    matchesPattern(name, patternKeywords) {
        return patternKeywords.some(keyword => name.includes(keyword));
    }
    findMatchingActions(actions, patternActions) {
        return actions.filter(action => patternActions.some(pattern => action.description.toLowerCase().includes(pattern.toLowerCase()) ||
            action.outcome.toLowerCase().includes(pattern.toLowerCase())));
    }
    calculateConfidence(matchingComponents, matchingActions, pattern) {
        // Calculate confidence based on the number of matching components and actions
        const componentScore = matchingComponents.length / pattern.components.length;
        const actionScore = matchingActions.length > 0 ?
            matchingActions.length / pattern.actions.length : 0;
        // Weighted average favoring component matches
        return (componentScore * 0.7) + (actionScore * 0.3);
    }
    // Workflow detection methods
    hasAuthenticationFlow(components, actions) {
        const hasAuthComponents = components.some(c => c.name.toLowerCase().includes('login') ||
            c.name.toLowerCase().includes('signin') ||
            c.name.toLowerCase().includes('register'));
        const hasAuthActions = actions.some(a => a.description.toLowerCase().includes('sign in') ||
            a.description.toLowerCase().includes('log in') ||
            a.description.toLowerCase().includes('create account'));
        return hasAuthComponents && hasAuthActions;
    }
    hasSearchFlow(components, actions) {
        const hasSearchComponents = components.some(c => c.name.toLowerCase().includes('search') ||
            c.name.toLowerCase().includes('filter') ||
            c.name.toLowerCase().includes('results'));
        const hasSearchActions = actions.some(a => a.description.toLowerCase().includes('search') ||
            a.description.toLowerCase().includes('filter') ||
            a.description.toLowerCase().includes('find'));
        return hasSearchComponents && hasSearchActions;
    }
    hasFormSubmissionFlow(components, actions) {
        const hasFormComponents = components.some(c => c.name.toLowerCase().includes('form') ||
            c.semanticCategory === interfaces_1.ComponentCategory.FORM);
        const hasFormActions = actions.some(a => a.type === 'submit' ||
            a.description.toLowerCase().includes('submit') ||
            a.description.toLowerCase().includes('save'));
        return hasFormComponents && hasFormActions;
    }
    hasCRUDFlow(components, actions) {
        const hasCRUDComponents = components.some(c => c.name.toLowerCase().includes('create') ||
            c.name.toLowerCase().includes('edit') ||
            c.name.toLowerCase().includes('delete') ||
            c.name.toLowerCase().includes('list'));
        const hasCRUDActions = actions.some(a => a.description.toLowerCase().includes('create') ||
            a.description.toLowerCase().includes('add') ||
            a.description.toLowerCase().includes('edit') ||
            a.description.toLowerCase().includes('update') ||
            a.description.toLowerCase().includes('delete') ||
            a.description.toLowerCase().includes('remove'));
        return hasCRUDComponents && hasCRUDActions;
    }
    hasCheckoutFlow(components, actions) {
        const hasCheckoutComponents = components.some(c => c.name.toLowerCase().includes('cart') ||
            c.name.toLowerCase().includes('checkout') ||
            c.name.toLowerCase().includes('payment'));
        const hasCheckoutActions = actions.some(a => a.description.toLowerCase().includes('add to cart') ||
            a.description.toLowerCase().includes('checkout') ||
            a.description.toLowerCase().includes('payment') ||
            a.description.toLowerCase().includes('purchase'));
        return hasCheckoutComponents && hasCheckoutActions;
    }
    // Workflow creation methods
    createAuthenticationWorkflow(components, actions) {
        return {
            name: 'Authentication',
            description: 'Sign in or create a new account',
            steps: [
                {
                    name: 'Enter credentials',
                    description: 'Enter your username/email and password',
                    actions: actions.filter(a => a.type === 'input' &&
                        (a.trigger.toLowerCase().includes('username') ||
                            a.trigger.toLowerCase().includes('email') ||
                            a.trigger.toLowerCase().includes('password')))
                },
                {
                    name: 'Submit credentials',
                    description: 'Click the sign in button to access your account',
                    actions: actions.filter(a => a.type === 'submit' ||
                        (a.type === 'click' &&
                            (a.trigger.toLowerCase().includes('login') ||
                                a.trigger.toLowerCase().includes('signin'))))
                }
            ],
            components: components.filter(c => c.name.toLowerCase().includes('login') ||
                c.name.toLowerCase().includes('signin') ||
                c.name.toLowerCase().includes('auth'))
        };
    }
    createSearchWorkflow(components, actions) {
        return {
            name: 'Search and Filter',
            description: 'Find and narrow down results',
            steps: [
                {
                    name: 'Enter search term',
                    description: 'Type what you want to find in the search box',
                    actions: actions.filter(a => a.type === 'input' &&
                        a.trigger.toLowerCase().includes('search'))
                },
                {
                    name: 'Apply filters',
                    description: 'Narrow down results by selecting specific criteria',
                    actions: actions.filter(a => a.description.toLowerCase().includes('filter') ||
                        a.trigger.toLowerCase().includes('filter'))
                },
                {
                    name: 'View results',
                    description: 'Browse through the matching items',
                    actions: actions.filter(a => a.outcome.toLowerCase().includes('results') ||
                        a.outcome.toLowerCase().includes('found'))
                }
            ],
            components: components.filter(c => c.name.toLowerCase().includes('search') ||
                c.name.toLowerCase().includes('filter') ||
                c.name.toLowerCase().includes('results'))
        };
    }
    createFormWorkflow(components, actions) {
        return {
            name: 'Form Submission',
            description: 'Enter and submit information',
            steps: [
                {
                    name: 'Fill in the form',
                    description: 'Enter the required information in the form fields',
                    actions: actions.filter(a => a.type === 'input')
                },
                {
                    name: 'Validate information',
                    description: 'Ensure all information is correct and complete',
                    actions: actions.filter(a => a.description.toLowerCase().includes('validate') ||
                        a.description.toLowerCase().includes('check'))
                },
                {
                    name: 'Submit the form',
                    description: 'Send the information by clicking the submit button',
                    actions: actions.filter(a => a.type === 'submit' ||
                        (a.type === 'click' &&
                            (a.trigger.toLowerCase().includes('submit') ||
                                a.trigger.toLowerCase().includes('save'))))
                }
            ],
            components: components.filter(c => c.semanticCategory === interfaces_1.ComponentCategory.FORM ||
                c.name.toLowerCase().includes('form'))
        };
    }
    createCRUDWorkflow(components, actions) {
        return {
            name: 'Manage Items',
            description: 'Create, view, edit and delete items',
            steps: [
                {
                    name: 'View items',
                    description: 'Browse through the available items',
                    actions: actions.filter(a => a.outcome.toLowerCase().includes('view') ||
                        a.outcome.toLowerCase().includes('list') ||
                        a.outcome.toLowerCase().includes('display'))
                },
                {
                    name: 'Create new item',
                    description: 'Add a new item by filling in the required information',
                    actions: actions.filter(a => a.description.toLowerCase().includes('create') ||
                        a.description.toLowerCase().includes('add') ||
                        a.description.toLowerCase().includes('new'))
                },
                {
                    name: 'Edit item',
                    description: 'Modify an existing item',
                    actions: actions.filter(a => a.description.toLowerCase().includes('edit') ||
                        a.description.toLowerCase().includes('update') ||
                        a.description.toLowerCase().includes('modify'))
                },
                {
                    name: 'Delete item',
                    description: 'Remove an item that is no longer needed',
                    actions: actions.filter(a => a.description.toLowerCase().includes('delete') ||
                        a.description.toLowerCase().includes('remove'))
                }
            ],
            components: components.filter(c => c.name.toLowerCase().includes('create') ||
                c.name.toLowerCase().includes('edit') ||
                c.name.toLowerCase().includes('delete') ||
                c.name.toLowerCase().includes('list'))
        };
    }
    createCheckoutWorkflow(components, actions) {
        return {
            name: 'Shopping Checkout',
            description: 'Complete a purchase',
            steps: [
                {
                    name: 'Add items to cart',
                    description: 'Select items and add them to your shopping cart',
                    actions: actions.filter(a => a.description.toLowerCase().includes('add to cart') ||
                        a.outcome.toLowerCase().includes('added to cart'))
                },
                {
                    name: 'Review cart',
                    description: 'Check the items in your cart and make any adjustments',
                    actions: actions.filter(a => a.outcome.toLowerCase().includes('view cart') ||
                        a.trigger.toLowerCase().includes('cart'))
                },
                {
                    name: 'Proceed to checkout',
                    description: 'Begin the checkout process',
                    actions: actions.filter(a => a.description.toLowerCase().includes('checkout') ||
                        a.outcome.toLowerCase().includes('checkout'))
                },
                {
                    name: 'Enter shipping information',
                    description: 'Provide your shipping details',
                    actions: actions.filter(a => a.description.toLowerCase().includes('shipping') ||
                        a.trigger.toLowerCase().includes('address'))
                },
                {
                    name: 'Enter payment information',
                    description: 'Provide your payment details',
                    actions: actions.filter(a => a.description.toLowerCase().includes('payment') ||
                        a.trigger.toLowerCase().includes('payment') ||
                        a.trigger.toLowerCase().includes('credit card'))
                },
                {
                    name: 'Complete purchase',
                    description: 'Finalize your order',
                    actions: actions.filter(a => a.description.toLowerCase().includes('complete') ||
                        a.description.toLowerCase().includes('purchase') ||
                        a.description.toLowerCase().includes('order'))
                }
            ],
            components: components.filter(c => c.name.toLowerCase().includes('cart') ||
                c.name.toLowerCase().includes('checkout') ||
                c.name.toLowerCase().includes('payment') ||
                c.name.toLowerCase().includes('order'))
        };
    }
}
exports.PatternMatcher = PatternMatcher;
//# sourceMappingURL=pattern-matcher.js.map