# UserLens HTML Generator Plugin: Design Document

## 1. Introduction & Goals

This document outlines the design for an **HTML Generator Plugin** for UserLens. The plugin's primary goal is to take the analysis results produced by UserLens (components, patterns, workflows) and generate a static, navigable HTML documentation site. This will provide an alternative, web-friendly format to the existing Markdown output.

This design adheres to the UserLens plugin architecture defined in [`plugin-architecture-design.md`](./plugin-architecture-design.md) and leverages the interfaces specified in [`src/models/plugin-interfaces.ts`](./src/models/plugin-interfaces.ts:0). The existing [`MarkdownGenerator`](./src/generators/markdown/markdown-generator.ts:6) serves as a reference for the content sections.

## 2. Plugin Structure and Definition

The HTML Generator Plugin will be a Node.js module, packaged for potential distribution via npm.

### 2.1. `package.json`

The plugin's `package.json` will define its identity and UserLens-specific metadata.

```json
// userlens-generator-html/package.json
{
  "name": "userlens-generator-html",
  "version": "0.1.0",
  "description": "Generates static HTML documentation from UserLens analysis results.",
  "main": "dist/index.js", // or "src/index.ts" if UserLens handles TS compilation
  "scripts": {
    "build": "tsc" // Example build script
  },
  "keywords": [
    "userlens",
    "userlens-plugin",
    "documentation-generator",
    "html"
  ],
  "author": "UserLens Core Team <contact@userlens.io>", // Example
  "license": "MIT", // Example
  "userlens": {
    "type": "generator",
    "name": "HTML Documentation Generator", // User-friendly name
    "formats": ["html"] // Specifies the output format
  },
  "devDependencies": {
    "typescript": "^5.0.0" // Example
  },
  "dependencies": {
    // Minimal dependencies for MVP, see section 7
  }
}
```

### 2.2. Main Classes

Two primary classes will form the core of the plugin:

1.  **`HtmlGeneratorPlugin`**:
    *   Implements the [`GeneratorPlugin`](./src/models/plugin-interfaces.ts:46) interface from UserLens.
    *   Responsible for providing metadata about the plugin (ID, name, supported formats) and creating instances of the `HtmlGenerator`.

    ```typescript
    // userlens-generator-html/src/index.ts
    import { GeneratorPlugin, PluginConfig, UserLensCoreApi } from 'userlens-plugin-api'; // Assuming a shared API package
    import { DocumentGenerator } from 'userlens-core-interfaces'; // Core interfaces
    import { HtmlGenerator } from './html-generator';

    export default class HtmlGeneratorPlugin implements GeneratorPlugin {
      getPluginId(): string {
        return "userlens-generator-html";
      }

      getPluginName(): string {
        return "HTML Documentation Generator";
      }

      getSupportedFormats(): string[] {
        return ["html"];
      }

      createGenerator(config?: PluginConfig, coreApi?: UserLensCoreApi): DocumentGenerator {
        return new HtmlGenerator(config, coreApi);
      }

      async onLoad(coreApi: UserLensCoreApi, pluginConfig?: PluginConfig): Promise<void> {
        coreApi.getLogger(this.getPluginId()).info('HTML Generator Plugin loaded.');
        if (pluginConfig) {
          // Process plugin-specific config if any, e.g., theme
        }
      }
    }
    ```

2.  **`HtmlGenerator`**:
    *   Implements the [`DocumentGenerator`](./src/models/interfaces.ts:81) interface from UserLens.
    *   Contains the logic for transforming UserLens analysis data (`ComponentMetadata`, `UserJourney`, etc.) into HTML files and structuring the output site.
    *   This class will mirror the public methods of [`MarkdownGenerator`](./src/generators/markdown/markdown-generator.ts:6) for generating various documentation sections.

    ```typescript
    // userlens-generator-html/src/html-generator.ts
    import * as fs from 'fs/promises';
    import * as path from 'path';
    import { 
        ComponentMetadata, 
        DocumentGenerator, 
        UserJourney,
        // Add other necessary types from 'userlens-core-interfaces'
    } from 'userlens-core-interfaces';
    import { PluginConfig, UserLensCoreApi, LoggerInterface } from 'userlens-plugin-api';
    // Potentially import PatternMatcher or Workflow types if needed directly
    // import { PatternMatcher, Workflow } from '../../nlp/pattern-matcher'; // Adjust path if used

    export class HtmlGenerator implements DocumentGenerator {
      private config?: PluginConfig;
      private coreApi?: UserLensCoreApi;
      private logger: LoggerInterface;
      // private patternMatcher: PatternMatcher; // If workflow/pattern detection is done here

      constructor(config?: PluginConfig, coreApi?: UserLensCoreApi) {
        this.config = config;
        this.coreApi = coreApi;
        this.logger = coreApi?.getLogger('HtmlGenerator') || console; // Fallback logger
        // this.patternMatcher = new PatternMatcher(); // If needed
        this.logger.info('HtmlGenerator instance created.');
        if (this.config?.theme) {
            this.logger.info(`Using theme: ${this.config.theme}`);
        }
      }

      async generateDocumentation(
        components: ComponentMetadata[],
        journeys: UserJourney[], // Assuming journeys are passed for overview/getting started
        outputPath: string
      ): Promise<void> {
        this.logger.info(`Generating HTML documentation at ${outputPath}`);
        await fs.mkdir(outputPath, { recursive: true });
        
        // Create assets directory
        const assetsPath = path.join(outputPath, 'assets');
        await fs.mkdir(assetsPath, { recursive: true });
        await this.copyAssets(assetsPath); // Copy CSS, JS

        // Generate main pages
        await this.generateIndexPage(components, journeys, outputPath); // Main index.html
        await this.generateOverviewPage(components, journeys, outputPath);
        await this.generateGettingStartedPages(components, journeys, outputPath);
        await this.generateFeaturesPages(components, outputPath); // Journeys might not be needed here
        await this.generateWorkflowsPage(components, outputPath); // Assuming workflows are derived from components

        this.logger.info('HTML documentation generation complete.');
      }

      // Placeholder for other generator methods (see section 5. Key DocumentGenerator Methods)
      // e.g., generateIndexPage, generateOverviewPage, generateComponentPage, etc.
      
      private async copyAssets(assetsPath: string): Promise<void> {
        // For MVP, create a default style.css
        const defaultCss = `
body { font-family: sans-serif; margin: 0; padding: 0; display: flex; }
nav { width: 250px; background: #f4f4f4; padding: 1em; height: 100vh; border-right: 1px solid #ddd; }
nav ul { list-style: none; padding: 0; }
nav ul li a { text-decoration: none; color: #333; display: block; padding: 0.5em 0; }
main { padding: 1em; flex-grow: 1; }
header { background: #333; color: white; padding: 1em; text-align: center; }
.component-card { border: 1px solid #eee; padding: 1em; margin-bottom: 1em; }
        `;
        await fs.writeFile(path.join(assetsPath, 'style.css'), defaultCss);
        // Later, copy user-defined themes or more complex assets
      }

      // ... other methods like generateComponentPage, generateCategoryOverviewPage etc.
    }
    ```

## 3. HTML Output Structure

The generated documentation will be a multi-page static HTML site.

### 3.1. Overall Structure

*   **Layout:** A common layout will be used across pages, featuring:
    *   A persistent **navigation sidebar** for main sections (Overview, Getting Started, Features, Workflows).
    *   A **main content area** where the specific page's content is displayed.
    *   Optionally, a simple header.
*   **File Structure (Conceptual):**
    ```
    output_docs/
    ├── index.html                 // Main landing page / Table of Contents
    ├── overview.html
    ├── getting-started/
    │   ├── index.html             // Overview of getting started
    │   ├── authentication.html
    │   ├── navigation.html
    │   └── first-steps.html
    ├── features/
    │   ├── index.html             // Overview of all feature categories
    │   ├── [category_name]/
    │   │   ├── index.html         // Overview of the specific category
    │   │   └── [component_name].html // Detail page for a component
    │   └── ...
    ├── workflows/
    │   ├── index.html             // List of all workflows
    │   └── [workflow_name].html   // Detail page for a workflow
    └── assets/
        ├── style.css
        └── (images, js if any)
    ```

### 3.2. Main HTML Pages

*   **`index.html`**: The main entry point, acting as a table of contents linking to all major sections.
*   **`overview.html`**: High-level overview of the application, key features/patterns.
*   **`getting-started/index.html` (and sub-pages)**: Guides for new users (e.g., authentication, basic navigation).
*   **`features/index.html` (and sub-pages)**: Documentation for component categories and individual components.
    *   `features/[category_name]/index.html`: Overview of a component category.
    *   `features/[category_name]/[component_name].html`: Detailed page for a specific component.
*   **`workflows/index.html` (and sub-pages)**: Documentation for common user workflows.
    *   `workflows/[workflow_name].html`: Step-by-step guide for a specific workflow.

### 3.3. Navigation

*   **Sidebar Navigation:** The primary navigation method, with links to top-level sections.
*   **In-page Links:** Breadcrumbs (optional) and hyperlinks within the content will facilitate navigation between related pages (e.g., from a category overview to a component detail page).
*   **File Naming:** Page names will be generated to be URL-friendly (e.g., lowercase, hyphenated).

### 3.4. Basic HTML Page Template (Conceptual)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><!-- Page Title --></title>
    <link rel="stylesheet" href="../assets/style.css"> <!-- Adjust path based on depth -->
</head>
<body>
    <nav>
        <!-- Sidebar Navigation Links -->
        <ul>
            <li><a href="../index.html">Home</a></li>
            <li><a href="../overview.html">Overview</a></li>
            <li><a href="../getting-started/index.html">Getting Started</a></li>
            <li><a href="../features/index.html">Features</a></li>
            <li><a href="../workflows/index.html">Workflows</a></li>
        </ul>
    </nav>
    <main>
        <header>
            <h1><!-- Page Main Heading --></h1>
        </header>
        <article>
            <!-- Page Specific Content -->
        </article>
    </main>
</body>
</html>
```

## 4. Content Mapping (`ComponentMetadata` to HTML)

Data from UserLens analysis (primarily `ComponentMetadata`) will be rendered into HTML.

### 4.1. Individual Component Pages (`features/[category]/[component_name].html`)

*   **Name (`ComponentMetadata.name` / `ComponentMetadata.description`):** Rendered as a main heading (`<h1>` or `<h2>`).
    ```html
    <h2>Login Form Component</h2>
    ```
*   **Description (`ComponentMetadata.description` / generated summary):** Rendered as a paragraph (`<p>`).
    ```html
    <p>This component allows users to sign in to the application using their credentials.</p>
    ```
*   **Props (`ComponentMetadata.props`):** Displayed as a list or table.
    ```html
    <h3>Properties / Options</h3>
    <ul>
        <li><strong>Username Field Label (usernameLabel):</strong> Sets the label for the username input. (Default: "Username")</li>
        <li><strong>Password Field Label (passwordLabel):</strong> Sets the label for the password input. (Default: "Password")</li>
        <!-- Filter out internal/dev-only props -->
    </ul>
    ```
*   **User Actions (`ComponentMetadata.userActions`):** Displayed as a list describing how to interact.
    ```html
    <h3>How to Use</h3>
    <ul>
        <li><strong>Enter Username:</strong> Type your registered username into the designated field.</li>
        <li><strong>Enter Password:</strong> Type your password into the designated field.</li>
        <li><strong>Click Submit Button:</strong> Submits the credentials for authentication.</li>
    </ul>
    ```

### 4.2. Lists of Components (e.g., in Category Overviews)

Displayed as a series of "cards" or a summary table. Each item would link to the component's detail page.

```html
<!-- Example: Component Card -->
<div class="component-card">
    <h3><a href="login-form.html">Login Form</a></h3>
    <p>Allows users to sign in.</p>
    <p>Category: Authentication</p>
</div>
```

### 4.3. Patterns and Workflows

*   **Patterns (in Overview or dedicated section):**
    *   Name as heading (`<h3>`).
    *   Description as paragraph (`<p>`).
    *   User goal highlighted.
*   **Workflows (in `workflows/[workflow_name].html`):**
    *   Name as main heading (`<h1>`).
    *   Description as paragraph (`<p>`).
    *   Steps listed sequentially (`<ol>` or `<div>` sections with `<h4>` for step names).

## 5. Styling and Assets

### 5.1. Styling

*   **MVP:** A single, simple default CSS file (`assets/style.css`) will be generated/copied by the plugin. This file will provide basic layout, typography, and readability.
*   **Future:**
    *   Allow users to provide their own CSS file via plugin configuration.
    *   Introduce a basic theming system (e.g., selecting from a few predefined themes, or overriding CSS variables).

### 5.2. Asset Management

*   **Storage:** All static assets (CSS, JS for interactivity if any, images) will be stored in an `assets/` directory within the root of the generated HTML site.
*   **Plugin Responsibility:**
    *   The plugin will create the `assets/` directory.
    *   For MVP, it will generate/write the default `style.css` into this directory.
    *   If images are part of the documentation (e.g., component screenshots - future enhancement), the plugin would need a mechanism to copy them into `assets/images/`.
    *   If client-side JavaScript is introduced (e.g., for search, interactive diagrams - future enhancement), these scripts would also reside in `assets/`.

## 6. Key `DocumentGenerator` Methods Implementation Strategy

The `HtmlGenerator` class will implement the `DocumentGenerator` interface. Its methods will be responsible for creating the HTML files. We will adapt the structure from [`MarkdownGenerator`](./src/generators/markdown/markdown-generator.ts:6).

*   **`generateDocumentation(components, journeys, outputPath)`:**
    *   The main entry point.
    *   Creates the base output directory and `assets/` directory.
    *   Copies/generates static assets (e.g., `style.css`).
    *   Orchestrates calls to other specific page generation methods.

*   **`generateIndexPage(components, journeys, outputPath)`:**
    *   Creates `output_docs/index.html`.
    *   Content: Title, brief introduction, and links to major sections (Overview, Getting Started, Features, Workflows).

*   **`generateOverviewPage(components, journeys, outputPath)`:**
    *   Creates `output_docs/overview.html`.
    *   Content: Application overview, key features/patterns identified (similar to [`MarkdownGenerator.generateOverview`](./src/generators/markdown/markdown-generator.ts:29)).

*   **`generateGettingStartedPages(components, journeys, outputPath)`:**
    *   Creates `output_docs/getting-started/` directory.
    *   Generates `index.html` for this section.
    *   Calls private methods to generate:
        *   `authentication.html` (if auth components detected)
        *   `navigation.html` (if nav components detected)
        *   `first-steps.html` (based on main journeys or key components)

*   **`generateFeaturesPages(components, outputPath)`:**
    *   Creates `output_docs/features/` directory.
    *   Generates `index.html` listing component categories.
    *   For each category:
        *   Creates `output_docs/features/[category_name]/` directory.
        *   Calls `generateCategoryOverviewPage` to create `index.html` for the category.
        *   For each significant component in the category, calls `generateComponentPage`.

*   **`generateCategoryOverviewPage(category, categoryComponents, categoryPath)`:**
    *   Creates `output_docs/features/[category_name]/index.html`.
    *   Content: Title for the category, brief description, list/cards of components in that category linking to their detail pages.

*   **`generateComponentPage(component, categoryPath)`:**
    *   Creates `output_docs/features/[category_name]/[component_name].html`.
    *   Content: Detailed information about the component (name, description, props, user actions) as described in Section 4.1.

*   **`generateWorkflowsPage(components, outputPath)`:**
    *   Creates `output_docs/workflows/` directory.
    *   Generates `index.html` listing detected workflows.
    *   For each workflow:
        *   Calls a private method `generateWorkflowDetailPage` to create `output_docs/workflows/[workflow_name].html` with step-by-step details.

### Templating Approach

*   **MVP:** Direct string concatenation or template literals in TypeScript to generate HTML content. Helper functions will be used for common elements like headers, footers, navigation, and rendering `ComponentMetadata` parts.
    ```typescript
    // Example helper
    private generateHtmlShell(title: string, content: string, navLinks: {href: string, text: string}[]): string {
        const navHtml = navLinks.map(link => `<li><a href="${link.href}">${link.text}</a></li>`).join('');
        return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>${title} - UserLens Docs</title>
        <link rel="stylesheet" href="assets/style.css"> <!-- Path needs to be relative -->
    </head>
    <body>
        <nav><ul>${navHtml}</ul></nav>
        <main>${content}</main>
    </body>
    </html>`;
    }
    ```
*   **Future:** Consider a lightweight templating engine (e.g., EJS, Handlebars) if complexity grows, but this would add a dependency.

## 7. Initial Feature Set & Potential Future Enhancements

### 7.1. Minimum Viable Product (MVP)

*   Generation of all core documentation sections as HTML files:
    *   Main Index (`index.html`)
    *   Overview (`overview.html`)
    *   Getting Started (Authentication, Navigation, First Steps)
    *   Features (Category Overviews, Component Detail Pages)
    *   Workflows (Workflow Index, Workflow Detail Pages)
*   Basic, clean, and readable default CSS styling.
*   Functional navigation (sidebar and internal links) across all generated pages.
*   Output structure as defined in Section 3.
*   No external runtime dependencies for the generated site (pure HTML/CSS).
*   Plugin correctly implements `GeneratorPlugin` and `DocumentGenerator` interfaces.

### 7.2. Potential Future Enhancements

*   **Search Functionality:** Client-side search across the documentation.
*   **Syntax Highlighting:** For code examples within component descriptions or props (if applicable).
*   **Interactive Diagrams:** E.g., for workflows or component relationships (could use Mermaid.js or similar).
*   **Theming:** Allow users to provide custom CSS or select from predefined themes.
*   **Image Support:** Incorporate images (e.g., component screenshots, diagrams) into the documentation.
*   **Markdown in Descriptions:** If `ComponentMetadata.description` or other fields contain Markdown, convert it to HTML (would require a Markdown parser dependency).
*   **Incremental Generation:** Optimize to only regenerate changed files (more complex, requires tracking state).
*   **Accessibility (a11y) Improvements:** Ensure generated HTML meets WCAG standards.
*   **Integration with JS Frameworks:** Option to generate a site that can be easily integrated or consumed by a JS framework like VuePress, Docusaurus (this is a larger undertaking).

## 8. Dependencies

### 8.1. Plugin Dependencies (for the Node.js plugin itself)

*   **MVP:**
    *   None beyond standard Node.js modules (`fs`, `path`) and TypeScript (if source is TS).
*   **Future (if enhancements are added):**
    *   Templating engine (e.g., `ejs`, `handlebars`)
    *   Markdown-to-HTML converter (e.g., `marked`, `showdown`)
    *   File system utilities (e.g., `fs-extra`) for more complex asset copying.

### 8.2. Generated Site Dependencies (for the HTML output)

*   **MVP:**
    *   None (pure HTML and a single `style.css`).
*   **Future (if enhancements are added):**
    *   JavaScript library for search (e.g., `lunr.js`).
    *   JavaScript library for syntax highlighting (e.g., `highlight.js`, `prism.js`).
    *   JavaScript library for diagrams (e.g., `mermaid.js`).