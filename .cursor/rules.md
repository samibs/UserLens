# UserLens Project Intelligence

## Project Structure Patterns

1. **Module Organization**: The project follows a clear module separation with analyzers, generators, and NLP components in separate directories.
   - All React-specific code is in `src/analyzers/react/`
   - All markdown generation is in `src/generators/markdown/`
   - All NLP-related code is in `src/nlp/`

2. **Interface Implementations**: Core functionality is defined through interfaces in `src/models/interfaces.ts` and implemented by concrete classes.
   - `ComponentAnalyzer` is implemented by `ReactAnalyzer`
   - `DocumentGenerator` is implemented by `MarkdownGenerator`

3. **Pipeline Architecture**: The application follows a pipeline pattern where:
   - Components are analyzed
   - Semantic meaning is extracted
   - Patterns are detected
   - Documentation is generated

## Code Style Patterns

1. **TypeScript Typing**: The codebase uses strong typing with interfaces to define data structures.
   - Use interfaces for API contracts
   - Use enums for fixed sets of values
   - Use type annotations for function parameters and return values

2. **Async/Await Pattern**: File operations and processing use async/await pattern throughout.
   - File reading operations should be async
   - Component analysis functions should be async
   - CLI commands should handle promises properly

3. **Error Handling**: Error handling is primarily done at the CLI level.
   - Internal functions can throw errors
   - CLI commands should catch and handle errors appropriately
   - User-friendly error messages should be displayed

## User Preferences

1. **Documentation Style**: Documentation should be concise, clear, and focused on user tasks.
   - Focus on what users can do
   - Use active voice
   - Avoid technical jargon

2. **Implementation Approach**: Prefer incremental improvements to large refactors.
   - Implement basic functionality first
   - Add refinements iteratively
   - Maintain backward compatibility

## Critical Implementation Paths

1. **Component Analysis Flow**:
   ```
   findComponentFiles → parseComponent → extractProps → extractUserActions → identifyComponentPurpose
   ```

2. **Documentation Generation Flow**:
   ```
   generateDocumentation → generateOverview → generateGettingStarted → generateFeatures → generateWorkflows
   ```

3. **CLI Command Flow**:
   ```
   parse options → load config → initialize analyzer → analyze components → save results
   ```

## Known Challenges

1. **Babel Parser TypeScript Integration**: The Babel parser requires specific handling for TypeScript types.
   - Use proper type assertions when working with Babel AST
   - Handle potential undefined values carefully

2. **Component Detection**: Component detection logic needs careful handling.
   - Check both file extensions and naming patterns
   - Consider directory structure for component identification
   - Handle edge cases for non-standard naming

3. **Semantic Processing Accuracy**: The semantic processing needs continuous refinement.
   - Add more pattern matching rules over time
   - Improve the mapping of technical terms to user-friendly descriptions
   - Consider machine learning approaches for better semantic understanding

## Tool Usage Patterns

1. **CLI Command Structure**: Commands follow the pattern of:
   ```
   userlens <command> [options]
   ```

2. **Configuration File**: Uses a JSON configuration file with specific structure:
   ```json
   {
     "framework": "react",
     "entry": "./src",
     "output": "./docs",
     "features": ["forms", "navigation"],
     "customMappings": { "ComponentName": "User Description" }
   }
   ```

3. **Output Directory Structure**: Documentation is organized as:
   ```
   docs/
   ├── overview.md
   ├── getting-started/
   ├── features/
   └── workflows/
   ```

## Evolution of Project Decisions

1. **Framework Priority**: Started with React due to its popularity and will expand to Vue and Angular.

2. **Documentation Format**: Started with Markdown for simplicity and universality, with plans to add HTML and interactive formats.

3. **Analysis Approach**: Chose static analysis over runtime evaluation for reliability and simplicity. 