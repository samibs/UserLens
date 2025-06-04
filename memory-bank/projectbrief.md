# UserLens Project Brief

## Project Overview
UserLens is a semantic user documentation generator that analyzes frontend code to automatically generate end-user documentation. Unlike traditional documentation tools that focus on code documentation, UserLens is specifically designed to create documentation for end-users by understanding the purpose and workflows of UI components.

## Core Goals
1. **Automatic Documentation Generation**: Analyze frontend code to create human-readable documentation without requiring screenshots or manual documentation writing.
2. **Semantic Understanding**: Extract the meaning and purpose of UI components based on their code structure, naming, and relationships.
3. **User-Centric Perspective**: Generate documentation from the user's perspective, focusing on tasks and workflows rather than implementation details.
4. **Multi-Framework Support**: Initially support React, with plans to extend to Vue.js and Angular.

## Key Features
1. **Smart Component Recognition**: Automatically detect forms, navigation patterns, and CRUD operations.
2. **Workflow Generation**: Create step-by-step guides based on code analysis.
3. **Semantic Naming**: Convert technical component names to user-friendly terminology.
4. **Pattern Detection**: Identify common UI/UX patterns and generate appropriate documentation.

## Target Audience
1. **End Users**: The generated documentation is primarily for application users.
2. **Developers**: Who need to generate user documentation without writing it manually.
3. **Technical Writers**: Who can use this as a starting point for more detailed documentation.

## Success Criteria
1. **Accuracy**: Generated documentation matches actual user workflows.
2. **Coverage**: Captures all major user-facing features.
3. **Readability**: Documentation is understandable by non-technical users.
4. **Maintainability**: Updates automatically when code changes.

## Timeline
Phase 1: Core Framework (Completed)
- Project setup
- React component analyzer
- Basic documentation generation

Phase 2: Semantic Analysis (In Progress)
- Pattern recognition
- Workflow detection
- Improved NLP processing

Phase 3: Advanced Features (Planned)
- Multi-framework support
- Custom templating
- Integration with existing documentation platforms 