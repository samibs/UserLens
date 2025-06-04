import * as fs from 'fs/promises';
import * as path from 'path';
import { parse } from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ComponentAnalyzer, ComponentCategory, ComponentMetadata, PropDefinition, UserAction, NlpComponentContext } from '../../models/interfaces';
import { NLPProcessor } from '../../nlp/semantic-processor';

export class ReactAnalyzer implements ComponentAnalyzer {
  private nlpProcessor: NLPProcessor;

  constructor(customMappings?: Record<string, string>) {
    this.nlpProcessor = new NLPProcessor(customMappings);
  }

  public async parseComponent(filePath: string): Promise<ComponentMetadata> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const ast = this.parseCode(fileContent, filePath);
    
    let componentName = this.extractComponentName(filePath, ast);
    const props = this.extractProps(ast);
    const userActions = this.extractUserActions({ name: componentName, filePath, props, children: [], userActions: [], semanticCategory: ComponentCategory.DISPLAY, description: '' }); // TODO: Review if semanticCategory and description are needed here
    
    // NEW: Extract additional context
    const nlpContext = this.extractNlpContext(filePath, ast, props);

    const semanticCategory = this.nlpProcessor.categorizeComponent(componentName, props, nlpContext);
    // Pass props and nlpContext to identifyComponentPurpose
    const description = this.identifyComponentPurpose({ name: componentName, filePath, props, children: [], userActions, semanticCategory, description: '' }, props, nlpContext);
    
    const component: ComponentMetadata = {
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

  public extractUserActions(component: ComponentMetadata): UserAction[] {
    const actions: UserAction[] = [];
    
    // Look for common event handlers in props
    for (const prop of component.props) {
      if (prop.name.startsWith('on') && prop.name.length > 2) {
        const eventType = prop.name.substring(2).toLowerCase();
        
        if (eventType === 'click') {
          actions.push(this.createClickAction(prop.name, component.name));
        } else if (eventType === 'submit') {
          actions.push(this.createSubmitAction(prop.name, component.name));
        } else if (eventType === 'change' || eventType === 'input') {
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

  public identifyComponentPurpose(component: ComponentMetadata, props: PropDefinition[], additionalContext: NlpComponentContext): string {
    return this.nlpProcessor.generateDescription(component.name, props, additionalContext);
  }

  private extractNlpContext(filePath: string, ast: t.File, props: PropDefinition[]): NlpComponentContext {
    const jsxTextContent: string[] = []; // Corrected: jsxTextContent (singular)
    // Explicitly type collectedComments to ensure sub-arrays are not seen as optional within this function's scope
    const collectedComments: { leading: string[]; trailing: string[]; inner: string[]; jsdoc: string[] } = {
        leading: [],
        trailing: [],
        inner: [], // Though 'inner' is not heavily populated yet, keep for consistency
        jsdoc: []
    };
    const importSources: string[] = []; // Corrected: importSources
    const htmlTagsUsed: Set<string> = new Set();
    const significantJsxTextTags = new Set(['button', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'span', 'div', 'td', 'th', 'li', 'label', 'a']); // Added div, label, a

    const componentDeclarationNodes: t.Node[] = [];

    // First pass to identify main component declarations
    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.parentPath.isExportDefaultDeclaration() || path.parentPath.isExportNamedDeclaration() || /^[A-Z]/.test(path.node.id?.name || '')) {
          componentDeclarationNodes.push(path.node);
        }
      },
      ClassDeclaration(path) {
        if (path.parentPath.isExportDefaultDeclaration() || path.parentPath.isExportNamedDeclaration() || /^[A-Z]/.test(path.node.id?.name || '')) {
          componentDeclarationNodes.push(path.node);
        }
      },
      VariableDeclaration(path) {
        path.node.declarations.forEach(declaration => {
          if (t.isVariableDeclarator(declaration) && declaration.id && t.isIdentifier(declaration.id) && /^[A-Z]/.test(declaration.id.name)) {
            if (declaration.init && (t.isArrowFunctionExpression(declaration.init) || t.isFunctionExpression(declaration.init))) {
              componentDeclarationNodes.push(declaration);
            }
          }
        });
      }
    });
    
    const extractComments = (node: t.Node | null | undefined) => {
      if (!node) return;
      node.leadingComments?.forEach(comment => {
        if (comment.type === 'CommentBlock' && comment.value.startsWith('*')) {
          collectedComments.jsdoc.push(comment.value.replace(/^\*/, '').trim());
        } else {
          collectedComments.leading.push(comment.value.trim());
        }
      });
      node.trailingComments?.forEach(comment => collectedComments.trailing.push(comment.value.trim()));
      // 'innerComments' are typically for blocks like IfStatement, not directly for declarations
      // For more granular inner comments, specific node types would need handling.
    };

    componentDeclarationNodes.forEach(node => extractComments(node));

    traverse(ast, {
      enter(path) { // General comment collector
        if (path.node.leadingComments && !componentDeclarationNodes.includes(path.node)) {
           path.node.leadingComments.forEach(comment => {
            if (comment.type === 'CommentBlock' && comment.value.startsWith('*') && !collectedComments.jsdoc.includes(comment.value.replace(/^\*/, '').trim())) {
              // Avoid double-adding JSDoc if already captured from component node
            } else if (!collectedComments.leading.includes(comment.value.trim())) {
              // collectedComments.leading.push(comment.value.trim());
            }
          });
        }
        if (path.node.trailingComments && !componentDeclarationNodes.includes(path.node)) {
          path.node.trailingComments.forEach(comment => {
            if (!collectedComments.trailing.includes(comment.value.trim())) {
              // collectedComments.trailing.push(comment.value.trim());
            }
          });
        }
        // Inner comments are harder to generalize, often specific to block statements.
        // For now, focusing on leading/trailing and JSDoc for components.
      },
      JSXElement(path) {
        // Extract comments associated with JSX elements
        extractComments(path.node);

        // Extract text from significant tags
        if (t.isJSXOpeningElement(path.node.openingElement) && t.isJSXIdentifier(path.node.openingElement.name)) {
          const tagName = path.node.openingElement.name.name;
          if (significantJsxTextTags.has(tagName.toLowerCase())) {
            path.node.children.forEach(child => {
              if (t.isJSXText(child)) {
                const text = child.value.trim();
                if (text) {
                  jsxTextContent.push(text); // Corrected: jsxTextContent
                }
              } else if (t.isJSXExpressionContainer(child) && t.isStringLiteral(child.expression)) {
                // Handle text within {} like <p>{'Hello'}</p>
                const text = child.expression.value.trim();
                if (text) {
                  jsxTextContent.push(text); // Corrected: jsxTextContent
                }
              }
            });
          }
        }
      },
      JSXText(path) {
        // This captures text not directly inside a targeted significant tag, but could be a direct child of a component
        // or a fragment. We might want to be more selective or rely on the JSXElement visitor.
        // For now, let's keep it to see its effect.
        const parentElement = path.findParent(p => p.isJSXElement());
        if (parentElement && t.isJSXElement(parentElement.node) && t.isJSXOpeningElement(parentElement.node.openingElement) && t.isJSXIdentifier(parentElement.node.openingElement.name)) {
            const parentTagName = parentElement.node.openingElement.name.name;
            if (significantJsxTextTags.has(parentTagName.toLowerCase())) {
                 // Already handled by JSXElement visitor to avoid duplication
            } else {
                 const text = path.node.value.trim();
                 if (text && !jsxTextContent.includes(text)) { // Corrected: jsxTextContent // Add if not already added by JSXElement
                    // jsxTextContent.push(text); // Decided to only take from significant tags for now
                 }
            }
        } else {
            const text = path.node.value.trim();
            if (text && !jsxTextContent.includes(text)) { // Corrected: jsxTextContent
                // jsxTextContent.push(text); // Decided to only take from significant tags for now
            }
        }
      },
      ImportDeclaration(path) {
        importSources.push(path.node.source.value); // Corrected: importSources
      },
      JSXOpeningElement(path) {
        if (t.isJSXIdentifier(path.node.name)) {
          const tagName = path.node.name.name;
          if (tagName === tagName.toLowerCase() && /^[a-z]/.test(tagName)) { // Ensure it's a standard HTML tag
            htmlTagsUsed.add(tagName);
          }
        }
        // Comments for JSXOpeningElement itself (e.g. /* comment */ <div ...>)
        extractComments(path.node);
      },
      // Collect comments from prop types if using TypeScript
      TSPropertySignature(path) {
        extractComments(path.node);
      },
      // Collect comments from PropTypes if used
      ObjectProperty(path) { // For propTypes
        const parentObject = path.findParent(p => p.isObjectExpression());
        const assignment = parentObject?.findParent(p => p.isAssignmentExpression());
        if (assignment && t.isAssignmentExpression(assignment.node) && t.isMemberExpression(assignment.node.left)) {
          if (t.isIdentifier(assignment.node.left.property) && assignment.node.left.property.name === 'propTypes') {
            extractComments(path.node);
          }
        }
      },
      ReturnStatement(path) { // Comments around return statements
        extractComments(path.node);
      }
    });
    
    // Deduplicate comments (simple approach)
    collectedComments.leading = [...new Set(collectedComments.leading)];
    collectedComments.trailing = [...new Set(collectedComments.trailing)];
    collectedComments.jsdoc = [...new Set(collectedComments.jsdoc)];


    return {
      filePath,
      props,
      jsxTextContent: [...new Set(jsxTextContent)], // Corrected: jsxTextContent and ensure unique
      comments: collectedComments,
      importSources: [...new Set(importSources)], // Corrected: importSources and ensure unique
      htmlTagsUsed: Array.from(htmlTagsUsed)
    };
  }

  private parseCode(code: string, filePath: string) {
    const fileExtension = path.extname(filePath);
    const plugins: any[] = ['jsx'];
    
    if (fileExtension === '.tsx' || fileExtension === '.ts') {
      plugins.push('typescript');
    }
    
    return parse(code, {
      sourceType: 'module',
      plugins
    });
  }

  private extractComponentName(filePath: string, ast: any): string {
    // First try to find export default [ComponentName]
    let componentName = '';
    
    traverse(ast, {
      ExportDefaultDeclaration(path: NodePath<t.ExportDefaultDeclaration>) {
        const declaration = path.node.declaration;
        
        if (t.isIdentifier(declaration)) {
          componentName = declaration.name;
        } else if (t.isFunctionDeclaration(declaration) && declaration.id) {
          componentName = declaration.id.name;
        } else if (t.isClassDeclaration(declaration) && declaration.id) {
          componentName = declaration.id.name;
        }
      },
      
      // Handle named exports too
      ExportNamedDeclaration(path: NodePath<t.ExportNamedDeclaration>) {
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

  private extractProps(ast: any): PropDefinition[] {
    const props: PropDefinition[] = [];
    const propTypes: Record<string, { type: string, required: boolean }> = {};
    
    // Look for PropTypes definitions
    traverse(ast, {
      AssignmentExpression(path: NodePath<t.AssignmentExpression>) {
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
    traverse(ast, {
      TSInterfaceDeclaration(path: NodePath<t.TSInterfaceDeclaration>) {
        if (path.node.id.name.includes('Props')) {
          path.node.body.body.forEach((prop) => {
            if (t.isTSPropertySignature(prop) && t.isIdentifier(prop.key)) {
              const propName = prop.key.name;
              const required = !prop.optional;
              let propType = 'any';
              
              if (prop.typeAnnotation && t.isTSTypeAnnotation(prop.typeAnnotation)) {
                if (t.isTSStringKeyword(prop.typeAnnotation.typeAnnotation)) {
                  propType = 'string';
                } else if (t.isTSNumberKeyword(prop.typeAnnotation.typeAnnotation)) {
                  propType = 'number';
                } else if (t.isTSBooleanKeyword(prop.typeAnnotation.typeAnnotation)) {
                  propType = 'boolean';
                } else if (t.isTSFunctionType(prop.typeAnnotation.typeAnnotation)) {
                  propType = 'function';
                } else if (t.isTSTypeLiteral(prop.typeAnnotation.typeAnnotation)) {
                  propType = 'object';
                } else if (t.isTSArrayType(prop.typeAnnotation.typeAnnotation)) {
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
    traverse(ast, {
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        if (path.node.params.length > 0) {
          self.extractFunctionComponentProps(path.node.params as any, props);
        }
      },
      ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
        if (path.node.params.length > 0) {
          self.extractFunctionComponentProps(path.node.params as any, props);
        }
      },
    });
    
    return props;
  }

  private extractFunctionComponentProps(params: any[], props: PropDefinition[]): void {
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

  private createClickAction(propName: string, componentName: string): UserAction {
    const triggerPart = propName.replace('onClick', '');
    const trigger = triggerPart || componentName;
    
    return {
      type: 'click',
      trigger,
      description: `Click the ${this.formatTriggerName(trigger)}`,
      outcome: `Performs the ${this.formatTriggerName(trigger)} action`
    };
  }

  private createSubmitAction(propName: string, componentName: string): UserAction {
    return {
      type: 'submit',
      trigger: componentName,
      description: `Submit the ${this.formatTriggerName(componentName)}`,
      outcome: 'Sends the form data'
    };
  }

  private createInputAction(propName: string, componentName: string): UserAction {
    const triggerPart = propName.replace('onChange', '').replace('onInput', '');
    const trigger = triggerPart || componentName;
    
    return {
      type: 'input',
      trigger,
      description: `Enter information in the ${this.formatTriggerName(trigger)}`,
      outcome: 'Updates the input value'
    };
  }

  private createNavigationAction(componentName: string): UserAction {
    return {
      type: 'navigation',
      trigger: componentName,
      description: `Click the ${this.formatTriggerName(componentName)}`,
      outcome: 'Navigates to another page'
    };
  }

  private formatTriggerName(name: string): string {
    // Convert camelCase or PascalCase to space-separated words
    return name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
      .toLowerCase();
  }
} 