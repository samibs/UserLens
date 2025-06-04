# UserLens: Semantic User Documentation Generator

UserLens is a tool for automatically generating end-user documentation from application code analysis. It analyzes frontend code semantically to understand user workflows and generates human-readable documentation without requiring screenshots.

## Features

- **Smart Component Recognition**: Automatically detects forms, navigation, and CRUD operations
- **Workflow Generation**: Creates step-by-step guides based on code analysis
- **Semantic Naming**: Converts technical component names to user-friendly terminology
- **Pattern Detection**: Identifies common UI/UX patterns and generates appropriate documentation

## Installation

```bash
# Install globally
npm install -g userlens

# Or use npx
npx userlens <command>
```

## Usage

### Basic Commands

```bash
# Analyze a React application
userlens analyze --entry ./src --framework react

# Generate documentation from analysis
userlens generate --format markdown --output ./docs

# View the documentation (not yet implemented)
userlens serve --docs ./docs
```

### Configuration File

Create a `userlens.config.json` file in your project root:

```json
{
  "framework": "react",
  "entry": "./src",
  "output": "./userlens-docs",
  "theme": "default",
  "features": [
    "forms",
    "navigation",
    "authentication"
  ],
  "customMappings": {
    "UserDashboard": "Your Personal Dashboard",
    "AdminPanel": "Administrative Controls"
  },
  "excludePatterns": [
    "*.test.*",
    "**/internal/**"
  ]
}
```

## Supported Frameworks

- **React**: Fully supported (JSX, TSX)
- **Vue**: Coming soon
- **Angular**: Coming soon

## How It Works

1. **Code Analysis**: Parses components to extract props, event handlers, and semantic meaning
2. **Pattern Recognition**: Identifies common UI/UX patterns like authentication flows, search interfaces, etc.
3. **Workflow Detection**: Analyzes component relationships to create user workflows
4. **Documentation Generation**: Creates user-friendly documentation in markdown or HTML

## Output Structure

```
Generated Documentation/
├── overview.md                 # App overview and main features
├── getting-started/
│   ├── authentication.md       # How to create an account and sign in
│   └── navigation.md           # How to navigate the app
├── features/
│   ├── form/                   # Form components
│   ├── navigation/             # Navigation components
│   └── display/                # Display components
└── workflows/
    ├── authentication.md       # Authentication workflow
    ├── search.md               # Search workflow
    └── form-submission.md      # Form submission workflow
```

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/userlens.git
cd userlens

# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm start
```

## License

MIT 