# Design: NLPProcessor Enhancements for Deeper Contextual Understanding

**1. Introduction & Goals**

The current `NLPProcessor` ([`src/nlp/semantic-processor.ts`](./src/nlp/semantic-processor.ts:0)) primarily relies on component names and prop names for semantic categorization and description generation. This design proposes enhancements to enable "Deeper Contextual Understanding" by leveraging additional information from the component's source code and its `ComponentMetadata`. The goal is to improve the accuracy and richness of the generated semantic information, making UserLens's output more insightful. This design also aims to be compatible with the plugin architecture, ensuring the `NLPProcessor` can be extended or replaced.

**2. New Data Sources for NLP**

To achieve deeper understanding, the following additional data sources will be extracted and utilized:

*   **From Source Code (via enhanced AST analysis in Analyzers):**
    *   **JSX Text Content:** Literal text found within JSX elements (e.g., `<button>Submit Form</button>`, `<p>Welcome to UserLens</p>`). This provides direct insight into the component's visible content and purpose.
    *   **Source Code Comments:**
        *   **JSDoc Blocks:** Comments associated with component definitions, prop type definitions, or returned JSX.
        *   **Inline Comments:** Comments near prop declarations, within the component's render/return statement, or near significant logic blocks.
    *   **Import Statements:**
        *   Identify imports from common UI libraries (e.g., `material-ui`, `antd`, `chakra-ui`) to infer component types or roles.
        *   Identify imports of other local components, which might give clues about composition.
    *   **HTML Tags Used:** The specific HTML tags rendered by the component (e.g., `<form>`, `<input>`, `<table>`, `<nav>`, `<header>`, `<footer>`, `<h1>-<h6>`, `<a>`). These have strong semantic meaning.
*   **From `ComponentMetadata` ([`src/models/interfaces.ts`](./src/models/interfaces.ts:24)):**
    *   `filePath`: Can be used to re-access source if needed, though ideally, analyzers pre-extract all context.
    *   `props.description`: If analyzers populate this from JSDoc for props, it's a valuable direct input.

**3. Proposed `NlpComponentContext` Interface**

A new interface, `NlpComponentContext`, will be defined to carry this additional information. This interface will be added to [`src/models/interfaces.ts`](./src/models/interfaces.ts:0) (or a more specific NLP-related types file if preferred).

```typescript
// In src/models/interfaces.ts or a new nlp-types.ts

export interface NlpComponentContext {
  filePath: string; // From ComponentMetadata
  props?: PropDefinition[]; // Existing props, for convenience
  jsxTextContent?: string[]; // Extracted text nodes from JSX
  comments?: {
    leading?: string[]; // Comments directly preceding component/prop/element
    trailing?: string[]; // Comments directly following
    inner?: string[]; // Comments inside a block or JSX element
    jsdoc?: string[]; // JSDoc blocks
  };
  importSources?: string[]; // Names of imported modules/libraries
  htmlTagsUsed?: string[]; // Unique HTML tags found in the component's render output
  // Potentially add parentComponentName or other relational context in the future
}
```

**4. Enhancements to `NLPProcessor` Methods**

The core methods of `NLPProcessor` ([`src/nlp/semantic-processor.ts`](./src/nlp/semantic-processor.ts:0)) and its corresponding interface `NlpProcessorInterface` ([`src/models/plugin-interfaces.ts`](./src/models/plugin-interfaces.ts:51)) will be updated:

*   **`categorizeComponent(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): ComponentCategory`**
    *   **Signature Update:** The method will now accept `additionalContext` of type `NlpComponentContext`.
    *   **Logic Enhancement:**
        *   **HTML Tags:** The presence of specific tags in `additionalContext.htmlTagsUsed` will strongly influence categorization.
            *   e.g., `['form', 'input']` -> `ComponentCategory.FORM`
            *   e.g., `['nav', 'a']` -> `ComponentCategory.NAVIGATION`
            *   e.g., `['table', 'thead', 'tbody']` -> `ComponentCategory.DISPLAY`
        *   **Keywords from Text/Comments:** Keywords extracted from `additionalContext.jsxTextContent` and `additionalContext.comments` can refine categorization. For example, text like "Save", "Submit", "Update" in a button's JSX or comments might reinforce `ComponentCategory.INTERACTION` or `ComponentCategory.FORM` if associated with form elements.
        *   **Import Sources:** If `additionalContext.importSources` includes known UI libraries, it can provide hints. (e.g., importing `TextField` from Material-UI).
        *   The existing logic based on `componentName` and `props` will be augmented, not replaced. A weighting system or a set of prioritized rules could be used to combine these signals.

*   **`generateDescription(componentName: string, props: PropDefinition[], additionalContext: NlpComponentContext): string`**
    *   **Signature Update:** The method will now accept `props` and `additionalContext` of type `NlpComponentContext`. (The existing `context: any` in `NLPProcessor` will be properly typed and utilized).
    *   **Logic Enhancement:**
        *   **Incorporate JSX Text:** Key phrases or summaries from `additionalContext.jsxTextContent` can be woven into the description. For example, a button with text "Proceed to Checkout" could have a description like "Button to 'Proceed to Checkout'".
        *   **Leverage Comments:** Summaries or key phrases from `additionalContext.comments` (especially JSDoc) can significantly enrich the description. If a JSDoc for a component says "Displays user profile information", this is a prime candidate for the description.
        *   **Purpose from HTML Tags:** The presence of tags like `<form>` or `<table>` can be explicitly mentioned (e.g., "A form for user input" or "Displays data in a tabular format").
        *   The goal is to move beyond generic descriptions like "Perform an action" (for a button) to more specific ones like "Button to submit the login form" or "Input field for the username".

**5. Integration with Analyzers (e.g., `ReactAnalyzer`)**

Analyzers like `ReactAnalyzer` ([`src/analyzers/react/react-analyzer.ts`](./src/analyzers/react/react-analyzer.ts:0)) will be responsible for extracting the data needed for `NlpComponentContext`.

*   **AST Traversal Enhancements:**
    *   `ReactAnalyzer`'s AST traversal logic (currently using `@babel/traverse`) will need to be extended to visit and extract information from:
        *   `JSXText` nodes to get text content.
        *   `CommentBlock`, `CommentLine` nodes (and associate them with nearby elements/props or the component itself). Babel's `leadingComments`, `trailingComments`, `innerComments` properties on AST nodes will be useful.
        *   `ImportDeclaration` nodes to get `source.value`.
        *   `JSXOpeningElement` and `JSXIdentifier` to identify HTML tags used (e.g., `div`, `button`, `form`). Need to collect unique tag names.
*   **Populating `NlpComponentContext`:**
    *   The `parseComponent` method in `ReactAnalyzer` will construct the `NlpComponentContext` object.
    *   This object will then be passed to the `NLPProcessor`'s `categorizeComponent` and `generateDescription` methods.
    *   The `ComponentMetadata` itself might not store the full `NlpComponentContext` to avoid bloating it, or it could store a summarized version if deemed necessary for other purposes. For now, the context is primarily a transient object passed to the NLP processor during the analysis of a single component.

**Example `ReactAnalyzer` Modification (Conceptual):**

```typescript
// In src/analyzers/react/react-analyzer.ts
// ...
import { NlpComponentContext } from '../../models/interfaces'; // Or nlp-types.ts

export class ReactAnalyzer implements ComponentAnalyzer {
  // ... existing code ...

  public async parseComponent(filePath: string): Promise<ComponentMetadata> {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const ast = this.parseCode(fileContent, filePath);
    
    let componentName = this.extractComponentName(filePath, ast);
    const props = this.extractProps(ast);

    // NEW: Extract additional context
    const nlpContext = this.extractNlpContext(filePath, ast, props);
    
    // Pass context to NLPProcessor
    const semanticCategory = this.nlpProcessor.categorizeComponent(componentName, props, nlpContext);
    const description = this.nlpProcessor.generateDescription(componentName, props, nlpContext);
    
    const userActions = this.extractUserActions({ /* ... */ } as ComponentMetadata); // Simplified for brevity

    return {
      name: componentName,
      filePath,
      props,
      children: [], // Assuming children are handled separately or by a different mechanism
      userActions,
      semanticCategory,
      description
    };
  }

  private extractNlpContext(filePath: string, ast: any, props: PropDefinition[]): NlpComponentContext {
    const jsxTextContent: string[] = [];
    const comments: NlpComponentContext['comments'] = { leading: [], trailing: [], inner: [], jsdoc: [] };
    const importSources: string[] = [];
    const htmlTagsUsed: Set<string> = new Set();

    traverse(ast, {
      JSXText(path) {
        const text = path.node.value.trim();
        if (text) jsxTextContent.push(text);
      },
      ImportDeclaration(path) {
        importSources.push(path.node.source.value);
      },
      JSXOpeningElement(path) {
        if (t.isJSXIdentifier(path.node.name)) {
          const tagName = path.node.name.name;
          // Filter out component names (PascalCase) vs HTML tags (lowercase)
          if (tagName === tagName.toLowerCase()) {
            htmlTagsUsed.add(tagName);
          }
        }
        // TODO: Extract comments associated with elements
      },
      // TODO: Add visitors for different comment types (CommentBlock, CommentLine)
      // and associate them correctly (e.g., with component declaration, props, return statement)
    });

    // Placeholder for JSDoc extraction logic for component/props
    // This might involve looking at comments attached to ExportDefaultDeclaration, FunctionDeclaration, etc.
    // and PropType definitions or TS Interface properties.

    return {
      filePath,
      props, // Pass props along if NLP methods still want direct access
      jsxTextContent,
      comments,
      importSources,
      htmlTagsUsed: Array.from(htmlTagsUsed)
    };
  }

  // ... rest of the class ...
}
```

**6. NLP Techniques (High-Level)**

Simple, rule-based NLP techniques will be prioritized for this initial enhancement:

*   **Keyword Extraction:**
    *   From `jsxTextContent` and `comments`: Extract significant nouns, verbs, and adjectives. Remove common stop words.
    *   These keywords can be used to match against predefined lists associated with categories or to enrich descriptions.
*   **Pattern Matching:**
    *   On `htmlTagsUsed`: Simple presence checks (e.g., "if `form` tag exists...").
    *   On `importSources`: Check for known library names.
*   **Heuristics:**
    *   If a component contains `<form>` and a `<button>` with text "Submit", it's highly likely a form submission component.
    *   If JSDoc comments for props mention "handler" or "callback", it indicates interactivity.

Advanced ML models are out of scope.

**7. Impact on `NlpPluginInterface`**

The `NlpProcessorInterface` defined in [`src/models/plugin-interfaces.ts`](./src/models/plugin-interfaces.ts:51) will be updated:

```typescript
// src/models/plugin-interfaces.ts

// Ensure NlpComponentContext and PropDefinition are imported or defined
// import { ComponentCategory, PropDefinition } from './interfaces';
// import { NlpComponentContext } from './interfaces'; // or from nlp-types.ts

export interface NlpProcessorInterface {
  categorizeComponent(
    componentName: string, 
    props: PropDefinition[], 
    additionalContext: NlpComponentContext // Updated
  ): ComponentCategory;

  generateDescription(
    componentName: string, 
    props: PropDefinition[], // Added props for consistency and potential use
    additionalContext: NlpComponentContext // Updated
  ): string;
  
  // Potentially other NLP tasks like extractKeywords(additionalContext: NlpComponentContext): string[];
}
```
The existing `NLPProcessor` class in [`src/nlp/semantic-processor.ts`](./src/nlp/semantic-processor.ts:0) will need to implement this updated interface.

**8. Configuration (Optional)**

Certain aspects of this enhanced NLP processing could be made configurable via `userlens.config.json` under a dedicated `nlpSettings` or plugin-specific configuration block:

*   **Keyword Lists:** Users could define custom keywords that strongly suggest a particular `ComponentCategory` (e.g., "checkout", "payment" -> `FORM` or a custom category).
*   **Context Source Weighting:** Advanced: Allow configuration of how much weight is given to different context sources (e.g., "comments are more important than JSX text for categorization"). This is likely too complex for an initial version.
*   **Enable/Disable Context Extractors:** Allow users to turn off extraction of certain context types (e.g., "ignore comments", "don't process import statements") if it's too noisy or slow for their project.
*   **HTML Tag Mapping:** Custom mappings for non-standard HTML tags if they are used with specific semantic meaning in a project.

**9. Data Flow Diagram**

```mermaid
graph LR
    A[Source File (.jsx, .tsx)] --> B{ReactAnalyzer};
    B -- AST Traversal --> C[Raw AST Data: JSX Text, Comments, Imports, HTML Tags];
    C --> D{extractNlpContext};
    D --> E[NlpComponentContext Object];
    B -- ComponentName, Props --> F{NLPProcessor};
    E --> F;
    F -- categorizeComponent --> G[ComponentCategory];
    F -- generateDescription --> H[Enriched Description];
    G --> I[ComponentMetadata];
    H --> I;

    style B fill:#D6EAF8,stroke:#333,stroke-width:2px
    style F fill:#D1F2EB,stroke:#333,stroke-width:2px
    style E fill:#FCF3CF,stroke:#333,stroke-width:1px
    style I fill:#E8DAEF,stroke:#333,stroke-width:2px