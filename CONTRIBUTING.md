# Contributing to Professional Quantitative Trading Platform

Thank you for your interest in contributing to the Professional Quantitative Trading Platform! This document provides guidelines and instructions for contributors.

## 🎯 Code of Conduct

Please be respectful and considerate of others when contributing to this project. We aim to foster an inclusive and welcoming community.

## 📋 How to Contribute

### Reporting Bugs
1. **Check existing issues** to avoid duplicates
2. **Use the bug report template** when creating a new issue
3. **Provide detailed information**:
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, browser, Python/Node versions)

### Requesting Features
1. **Check existing feature requests**
2. **Explain the problem** the feature would solve
3. **Describe your proposed solution**
4. **Provide examples or mockups** if possible

### Submitting Code Changes
1. **Fork the repository**
2. **Create a feature branch** (`git checkout -b feature/your-feature`)
3. **Make your changes**
4. **Add or update tests** if applicable
5. **Ensure code quality** (linting, formatting)
6. **Commit your changes** using conventional commits
7. **Push to your branch** (`git push origin feature/your-feature`)
8. **Open a Pull Request**

## 🔧 Development Setup

### Prerequisites
- Node.js 16+ and npm
- Python 3.8+ and pip
- Git

### Local Development
```bash
# 1. Clone your fork
git clone https://github.com/yourusername/quant-trading-platform.git
cd quant-trading-platform

# 2. Add upstream remote
git remote add upstream https://github.com/originalowner/quant-trading-platform.git

# 3. Install backend dependencies
cd backend
pip install -r requirements.txt  # If requirements.txt exists
# Or install manually:
pip install flask flask-cors requests pandas numpy yfinance pytz

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. Start development servers
# Terminal 1: Backend
cd backend
python start_quant_backend.py

# Terminal 2: Frontend
cd frontend
npm start
```

## 📝 Code Style Guidelines

### Frontend (TypeScript/React)
- Use TypeScript strict mode
- Follow React hooks rules
- Use functional components with hooks
- Use meaningful variable and function names
- Add PropTypes or TypeScript interfaces
- Use destructuring for props

### Backend (Python)
- Follow PEP 8 style guide
- Use meaningful variable and function names
- Add docstrings for functions and classes
- Use type hints (Python 3.8+)
- Handle exceptions appropriately
- Use logging instead of print statements for production code

### Git Commit Messages
We follow [Conventional Commits](https://www.conventionalcommits.org/):

**Format**: `type(scope?): subject`

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, missing semi-colons, etc.)
- `refactor`: Code refactoring (no functional changes)
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependencies, tooling

**Examples**:
- `feat: add AI trading signals module`
- `fix(market): resolve 1D chart data issue on non-trading days`
- `docs: update API documentation`
- `style: format Python code with black`
- `refactor: optimize batch request logic`
- `test: add unit tests for backtest engine`
- `chore: update dependencies`

**Subject Guidelines**:
- Use imperative mood ("add" not "added" or "adds")
- First letter lowercase
- No period at the end
- Maximum 72 characters

### Pull Request Guidelines
1. **Title**: Clear and descriptive
2. **Description**: 
   - What changes were made
   - Why they were made
   - How they were tested
   - Screenshots for UI changes
3. **Linked Issues**: Reference related issues
4. **Review Requests**: Tag relevant reviewers

## 🧪 Testing

### Frontend Testing
```bash
cd frontend
npm test
```

### Backend Testing
```bash
cd backend
# Create test files with pytest
python -m pytest
```

### Manual Testing Checklist
- [ ] Test all major user flows
- [ ] Verify API endpoints work correctly
- [ ] Check error handling
- [ ] Test on different browsers (Chrome, Firefox, Safari)
- [ ] Verify responsive design on mobile/tablet

## 📁 Project Structure

```
professional_quant_platform/
├── frontend/                 # React TypeScript Frontend
│   ├── src/pages/           # Page components
│   ├── src/services/        # API services
│   ├── src/components/      # Reusable components
│   └── src/utils/           # Utility functions
├── backend/                 # Python Flask Backend
│   ├── start_quant_backend.py # Main application
│   ├── config.py           # Configuration
│   ├── api/               # API modules
│   │   ├── market/        # Market data endpoints
│   │   ├── backtest/      # Backtest endpoints
│   │   └── ai/           # AI trading endpoints
│   └── utils/             # Utility functions
├── docs/                   # Documentation
├── scripts/               # Startup scripts
└── tests/                 # Test files
```

## 🔍 Code Review Process

1. **Automated Checks**: CI runs tests and linting
2. **Maintainer Review**: At least one maintainer reviews
3. **Feedback**: Reviewers provide feedback
4. **Revisions**: Contributor addresses feedback
5. **Approval**: Reviewer approves changes
6. **Merge**: PR is merged to main branch

### Review Checklist
- [ ] Code follows project standards
- [ ] Tests are included and pass
- [ ] Documentation is updated
- [ ] No breaking changes (or documented if necessary)
- [ ] Performance considerations addressed
- [ ] Security considerations addressed

## 📊 Performance Guidelines

### Frontend Performance
- Use React.memo() for expensive components
- Implement virtual scrolling for large lists
- Optimize re-renders with useMemo/useCallback
- Lazy load components with React.lazy()
- Compress images and assets

### Backend Performance
- Implement caching for expensive operations
- Use database indexes appropriately
- Optimize database queries
- Implement pagination for large datasets
- Use connection pooling

### API Design
- Use RESTful principles
- Version APIs (e.g., /api/v1/)
- Implement rate limiting
- Use proper HTTP status codes
- Provide meaningful error messages

## 🔐 Security Guidelines

### Frontend Security
- Sanitize user inputs
- Implement CSRF protection
- Use HTTPS in production
- Secure authentication tokens
- Implement content security policy

### Backend Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication/authorization
- Encrypt sensitive data
- Keep dependencies updated
- Implement security headers

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for TypeScript/JavaScript
- Add docstrings for Python functions/classes
- Document complex algorithms
- Update README for significant changes

### API Documentation
- Document all endpoints
- Include request/response examples
- Document error responses
- Keep documentation up to date

## 🚀 Release Process

1. **Version Bump**: Update version in package.json
2. **Changelog**: Update CHANGELOG.md
3. **Testing**: Run full test suite
4. **Documentation**: Update documentation
5. **Tag Release**: Create git tag
6. **Build**: Create production builds
7. **Deploy**: Deploy to production

## ❓ Getting Help

- **Documentation**: Check the docs/ directory
- **Issues**: Search existing issues
- **Discussions**: Use GitHub discussions if enabled
- **Contact**: Reach out to maintainers

## 📄 License

By contributing, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to make this project better! 🙏