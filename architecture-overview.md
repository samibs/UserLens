# UserLens Application Architecture

## Summary

UserLens is a command-line tool designed to analyze frontend application code (initially focusing on React) and generate user-facing documentation in Markdown format.

The process can be broken down into the following main stages:

1.  **Configuration Loading:**
    *   The application starts by loading a configuration file ([`userlens.config.json`](userlens.config.json) by default). This file specifies the target framework (e.g., "react"), entry points for the code, output directories for analysis results and documentation, custom component name mappings, and patterns for excluding files/directories from analysis.

2.  **Code Analysis (via `analyze` command):**
    *   **File Discovery:** UserLens scans the specified entry path (e.g., [`src/`](./src/)) to find component files relevant to the chosen framework. It uses file extensions (e.g., `.jsx`, `.tsx` for React) and naming conventions (e.g., PascalCase, `/components/` directory) to identify these files, while respecting exclusion patterns from the configuration.
    *   **Component Parsing:** For each identified component file, a framework-specific analyzer (e.g., [`ReactAnalyzer`](./src/analyzers/react/react-analyzer.ts:9)) is used.
        *   The `ReactAnalyzer` reads the file content and uses `@babel/parser` to generate an Abstract Syntax Tree (AST).
        *   It traverses the AST to extract:
            *   **Component Name:** Derived from `export default` or named exports, or the filename itself.
            *   **Props:** Extracted from `PropTypes`, TypeScript interfaces/types (looking for "Props" in the name), or function parameters (destructured props).
            *   **User Actions:** Inferred from prop names (e.g., `onClick`, `onSubmit`, `onChange`), or component names/props suggesting navigation (`Link`, `Nav`, `to`, `href`).
        *   An [`NLPProcessor`](./src/nlp/semantic-processor.ts) (from [`src/nlp/semantic-processor.ts`](./src/nlp/semantic-processor.ts)) is used to:
            *   Categorize the component semantically (e.g., FORM, NAVIGATION, DISPLAY).
            *   Generate a human-readable description of the component's purpose.
    *   **Pattern and Workflow Detection:**
        *   A [`PatternMatcher`](./src/nlp/pattern-matcher.ts) (from [`src/nlp/pattern-matcher.ts`](./src/nlp/pattern-matcher.ts)) takes the list of analyzed `ComponentMetadata` objects.
        *   It detects common UI/UX patterns (e.g., "Data Input Form", "Interactive List") and attempts to identify user workflows or journeys by looking at sequences of component interactions.
    *   **Storing Analysis Results:** The extracted `ComponentMetadata`, detected `patterns`, and `workflows` are saved as JSON files (e.g., [`components.json`](./userlens-analysis/components.json), [`patterns.json`](./userlens-analysis/patterns.json), [`workflows.json`](./userlens-analysis/workflows.json)) in a specified output directory (e.g., [`userlens-analysis/`](./userlens-analysis/)).

3.  **Documentation Generation (via `generate` command):**
    *   The `generate` command reads the JSON analysis results.
    *   A [`MarkdownGenerator`](./src/generators/markdown/markdown-generator.ts:6) (from [`src/generators/markdown/markdown-generator.ts`](./src/generators/markdown/markdown-generator.ts)) takes this data.
    *   It creates a structured set of Markdown files, including:
        *   An `overview.md` summarizing key features based on detected patterns.
        *   "Getting Started" guides for `authentication.md`, `navigation.md`, and `first-steps.md`.
        *   "Features" documentation, categorized by semantic component types, with overviews and individual component details.
        *   "Workflows" documentation, detailing common user tasks.
        *   An `index.md` file linking to all generated documents.
    *   The generated Markdown files are saved to a specified output directory (e.g., `examples/docs/markdown/`).

4.  **Serving Documentation (via `serve` command - currently a placeholder):**
    *   This command is intended to serve the generated documentation locally but currently advises using a standard static file server.

## Key Modules:

*   **[`src/cli/index.ts`](./src/cli/index.ts):** The main entry point, handling command-line arguments and orchestrating the analysis and generation processes.
*   **[`src/analyzers/`](./src/analyzers/):** Contains framework-specific code parsers (e.g., [`ReactAnalyzer`](./src/analyzers/react/react-analyzer.ts:9)).
*   **[`src/nlp/`](./src/nlp/):** Includes the [`SemanticProcessor`](./src/nlp/semantic-processor.ts) for understanding component purpose and the [`PatternMatcher`](./src/nlp/pattern-matcher.ts) for identifying UI patterns and workflows.
*   **[`src/generators/`](./src/generators/):** Contains logic for creating documentation in different formats (currently [`MarkdownGenerator`](./src/generators/markdown/markdown-generator.ts:6)).
*   **[`src/models/interfaces.ts`](./src/models/interfaces.ts):** Defines the data structures used throughout the application (e.g., `ComponentMetadata`, `UserAction`).

## Architecture Diagram

```mermaid
graph TD
    subgraph UserInputAndConfig [User Input & Configuration]
        A[Source Code Files .jsx .tsx]
        B[userlens.config.json]
    end

    subgraph CLI [UserLens CLI]
        C{userlens command}
        C -- analyze --> D[Analyze Command]
        C -- generate --> E[Generate Command]
        C -- serve --> F[Serve Command Placeholder]
    end

    subgraph AnalysisProcess [Analysis Phase - analyze command]
        D --> G[1. Load Config]
        B -- Read by --> G
        G --> H[2. Find Component Files]
        A -- Read by --> H
        H --> I[3. For each component file:]
        I -- Reads file content --> J[Parse with @babel/parser to AST]
        J --> K[Extract Component Info via ReactAnalyzer]
        K --> L[Categorize & Describe with NLPProcessor]
        L --> M[Collect ComponentMetadata]
        M --> N[4. Detect Patterns & Workflows with PatternMatcher]
        N --> O[5. Save Analysis Results]
        O -- Writes to --> FS_AnalysisJSON[FS: ./userlens-analysis/*.json]
    end

    subgraph GenerationProcess [Documentation Generation Phase - generate command]
        E --> P[1. Load Analysis Results]
        FS_AnalysisJSON -- Read by --> P
        P --> Q[2. Generate Markdown with MarkdownGenerator]
        Q --> R[Create .md files: Overview, Getting Started, etc.]
        R --> S[3. Save Documentation]
        S -- Writes to --> FS_DocsMD[FS: ./userlens-docs/**/*.md]
    end

    A --> J