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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReactAnalyzer = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const interfaces_1 = require("../../models/interfaces");
const semantic_processor_1 = require("../../nlp/semantic-processor");
class ReactAnalyzer {
    constructor(customMappings) {
        this.nlpProcessor = new semantic_processor_1.NLPProcessor(customMappings);
    }
    async parseComponent(filePath) {
        const fileContent = await fs.readFile(filePath, 'utf-8');
        const ast = this.parseCode(fileContent, filePath);
        let componentName = this.extractComponentName(filePath, ast);
        const props = this.extractProps(ast);
        const userActions = this.extractUserActions({ name: componentName, filePath, props, children: [], userActions: [], semanticCategory: interfaces_1.ComponentCategory.DISPLAY, description: '' });
        const semanticCategory = this.nlpProcessor.categorizeComponent(componentName, props);
        const description = this.identifyComponentPurpose({ name: componentName, filePath, props, children: [], userActions, semanticCategory, description: '' });
        const component = {
            name: componentName,
            filePath,
            props,
            children: [],
            userActions,
            semanticCategory,
            description
        };
        return component;
    }
    extractUserActions(component) {
        const actions = [];
        // Look for common event handlers in props
        for (const prop of component.props) {
            if (prop.name.startsWith('on') && prop.name.length > 2) {
                const eventType = prop.name.substring(2).toLowerCase();
                if (eventType === 'click') {
                    actions.push(this.createClickAction(prop.name, component.name));
                }
                else if (eventType === 'submit') {
                    actions.push(this.createSubmitAction(prop.name, component.name));
                }
                else if (eventType === 'change' || eventType === 'input') {
                    actions.push(this.createInputAction(prop.name, component.name));
                }
            }
        }
        // Add navigation actions based on component type
        if (component.name.toLowerCase().includes('link') ||
            component.name.toLowerCase().includes('nav') ||
            component.props.some(p => p.name === 'to' || p.name === 'href')) {
            actions.push(this.createNavigationAction(component.name));
        }
        return actions;
    }
    identifyComponentPurpose(component) {
        return this.nlpProcessor.generateDescription(component.name);
    }
    parseCode(code, filePath) {
        const fileExtension = path.extname(filePath);
        const plugins = ['jsx'];
        if (fileExtension === '.tsx' || fileExtension === '.ts') {
            plugins.push('typescript');
        }
        return (0, parser_1.parse)(code, {
            sourceType: 'module',
            plugins
        });
    }
    extractComponentName(filePath, ast) {
        // First try to find export default [ComponentName]
        let componentName = '';
        (0, traverse_1.default)(ast, {
            ExportDefaultDeclaration(path) {
                const declaration = path.node.declaration;
                if (t.isIdentifier(declaration)) {
                    componentName = declaration.name;
                }
                else if (t.isFunctionDeclaration(declaration) && declaration.id) {
                    componentName = declaration.id.name;
                }
                else if (t.isClassDeclaration(declaration) && declaration.id) {
                    componentName = declaration.id.name;
                }
            },
            // Handle named exports too
            ExportNamedDeclaration(path) {
                const declaration = path.node.declaration;
                if (declaration && (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) && declaration.id) {
                    componentName = declaration.id.name;
                }
            }
        });
        // If we couldn't find a name in the AST, use the filename
        if (!componentName) {
            componentName = path.basename(filePath, path.extname(filePath));
            // Convert kebab-case or snake_case to PascalCase
            componentName = componentName
                .split(/[-_]/)
                .map(part => part.charAt(0).toUpperCase() + part.slice(1))
                .join('');
        }
        return componentName;
    }
    extractProps(ast) {
        const props = [];
        const propTypes = {};
        // Look for PropTypes definitions
        (0, traverse_1.default)(ast, {
            AssignmentExpression(path) {
                const left = path.node.left;
                const right = path.node.right;
                if (t.isMemberExpression(left) &&
                    t.isIdentifier(left.property) &&
                    left.property.name === 'propTypes') {
                    if (t.isObjectExpression(right)) {
                        right.properties.forEach(prop => {
                            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
                                const propName = prop.key.name;
                                let propType = 'any';
                                let required = false;
                                if (t.isMemberExpression(prop.value)) {
                                    if (t.isIdentifier(prop.value.object) && t.isIdentifier(prop.value.property)) {
                                        propType = prop.value.object.name;
                                        required = prop.value.property.name === 'isRequired';
                                    }
                                }
                                propTypes[propName] = { type: propType, required };
                            }
                        });
                    }
                }
            }
        });
        // Look for TypeScript interface or type definitions
        (0, traverse_1.default)(ast, {
            TSInterfaceDeclaration(path) {
                if (path.node.id.name.includes('Props')) {
                    path.node.body.body.forEach((prop) => {
                        if (t.isTSPropertySignature(prop) && t.isIdentifier(prop.key)) {
                            const propName = prop.key.name;
                            const required = !prop.optional;
                            let propType = 'any';
                            if (prop.typeAnnotation && t.isTSTypeAnnotation(prop.typeAnnotation)) {
                                if (t.isTSStringKeyword(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'string';
                                }
                                else if (t.isTSNumberKeyword(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'number';
                                }
                                else if (t.isTSBooleanKeyword(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'boolean';
                                }
                                else if (t.isTSFunctionType(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'function';
                                }
                                else if (t.isTSTypeLiteral(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'object';
                                }
                                else if (t.isTSArrayType(prop.typeAnnotation.typeAnnotation)) {
                                    propType = 'array';
                                }
                            }
                            props.push({
                                name: propName,
                                type: propType,
                                required
                            });
                        }
                    });
                }
            }
        });
        // If we found PropTypes, convert them to our internal format
        Object.entries(propTypes).forEach(([name, { type, required }]) => {
            props.push({
                name,
                type,
                required
            });
        });
        // Look for function parameters in functional components
        const self = this;
        (0, traverse_1.default)(ast, {
            FunctionDeclaration(path) {
                if (path.node.params.length > 0) {
                    self.extractFunctionComponentProps(path.node.params, props);
                }
            },
            ArrowFunctionExpression(path) {
                if (path.node.params.length > 0) {
                    self.extractFunctionComponentProps(path.node.params, props);
                }
            },
        });
        return props;
    }
    extractFunctionComponentProps(params, props) {
        // Handle object pattern (destructuring) in the first parameter
        const firstParam = params[0];
        if (t.isObjectPattern(firstParam)) {
            firstParam.properties.forEach(property => {
                if (t.isObjectProperty(property) && t.isIdentifier(property.key)) {
                    const propName = property.key.name;
                    // Check if this prop is already in our list
                    if (!props.some(p => p.name === propName)) {
                        props.push({
                            name: propName,
                            type: 'any', // We don't know the type from destructuring alone
                            required: false // We assume not required by default
                        });
                    }
                }
            });
        }
    }
    createClickAction(propName, componentName) {
        const triggerPart = propName.replace('onClick', '');
        const trigger = triggerPart || componentName;
        return {
            type: 'click',
            trigger,
            description: `Click the ${this.formatTriggerName(trigger)}`,
            outcome: `Performs the ${this.formatTriggerName(trigger)} action`
        };
    }
    createSubmitAction(propName, componentName) {
        return {
            type: 'submit',
            trigger: componentName,
            description: `Submit the ${this.formatTriggerName(componentName)}`,
            outcome: 'Sends the form data'
        };
    }
    createInputAction(propName, componentName) {
        const triggerPart = propName.replace('onChange', '').replace('onInput', '');
        const trigger = triggerPart || componentName;
        return {
            type: 'input',
            trigger,
            description: `Enter information in the ${this.formatTriggerName(trigger)}`,
            outcome: 'Updates the input value'
        };
    }
    createNavigationAction(componentName) {
        return {
            type: 'navigation',
            trigger: componentName,
            description: `Click the ${this.formatTriggerName(componentName)}`,
            outcome: 'Navigates to another page'
        };
    }
    formatTriggerName(name) {
        // Convert camelCase or PascalCase to space-separated words
        return name
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
            .toLowerCase();
    }
}
exports.ReactAnalyzer = ReactAnalyzer;
//# sourceMappingURL=react-analyzer.js.map