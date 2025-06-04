# UserLens Active Context

## Current Focus
The project is currently in the early development phase, focusing on core functionality for React component analysis and markdown documentation generation. The main areas of active development are:

1. React component analysis using AST parsing
2. Semantic understanding of component purpose and user actions
3. Pattern and workflow detection
4. Basic markdown documentation generation

## Recent Changes
- Implemented the core project structure and configuration
- Created the React analyzer for parsing component files
- Developed NLP processing for semantic meaning extraction
- Implemented pattern matching for UI/UX patterns
- Built a markdown generator for documentation output
- Added a CLI interface for user interaction
- Created example React components for testing
- Successfully generated documentation from example components

## Current Challenges
1. **Component Detection**: Improving the accuracy of component detection in diverse codebases
2. **Semantic Understanding**: Enhancing the NLP capabilities to better understand component purposes
3. **TypeScript Integration**: Resolving TypeScript typing issues with Babel parser
4. **Testing Methodology**: Developing a comprehensive testing approach for the analysis and generation pipeline

## Next Steps
1. **Enhance React Analyzer**
   - Improve props extraction from TypeScript interfaces
   - Add support for React hooks analysis
   - Better detection of event handlers and user actions

2. **Extend Semantic Processing**
   - Add more patterns to the pattern matcher
   - Improve workflow detection algorithms
   - Enhance component categorization

3. **Improve Documentation Generation**
   - Add more detailed workflow documentation
   - Create better component relationship visualization
   - Implement HTML documentation generator

4. **CLI Enhancements**
   - Improve error handling and user feedback
   - Add progress indicators for long-running operations
   - Implement documentation serving capability

## Active Decisions

### 1. Framework Support Priority
**Decision**: Focus on React support first, then Vue.js, and finally Angular
**Rationale**: React has the largest market share and simpler component model
**Status**: React support is in active development

### 2. Documentation Format
**Decision**: Use Markdown as the primary output format initially
**Rationale**: Universal compatibility and easy transformation to other formats
**Status**: Markdown generator implemented

### 3. Analysis Approach
**Decision**: Use static code analysis rather than runtime evaluation
**Rationale**: Static analysis is more reliable and doesn't require running the application
**Status**: Static analysis with Babel parser implemented

### 4. Component Detection Strategy
**Decision**: Use a combination of file naming conventions, directory structure, and code patterns
**Rationale**: Provides flexibility across different project structures
**Status**: Basic implementation complete, needs refinement

## Current Implementation Status

| Feature | Status | Notes |
|---------|--------|-------|
| Project Structure | ✅ Complete | Core directories and configuration |
| React Analyzer | 🔄 In Progress | Basic functionality working |
| NLP Processor | 🔄 In Progress | Core functionality implemented |
| Pattern Matcher | 🔄 In Progress | Basic patterns implemented |
| Markdown Generator | ✅ Complete | Generates basic documentation |
| CLI Interface | ✅ Complete | Core commands implemented |
| Configuration System | ✅ Complete | JSON-based configuration |
| Example Components | ✅ Complete | Login, Navigation, Search examples |
| Documentation Output | ✅ Complete | Generates markdown documentation |
| HTML Generator | 📅 Planned | Not yet started |
| Vue.js Support | 📅 Planned | Not yet started |
| Angular Support | 📅 Planned | Not yet started |

## Current Testing Approach
- Manual testing with example React components
- Generated documentation review for accuracy
- CLI command testing for expected behavior

## Resource Allocation
- Primary focus on React analyzer improvements
- Secondary focus on documentation quality
- Exploring options for better NLP processing 