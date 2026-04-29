# Commit Message Convention

This project follows the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages. This creates a more readable commit history and enables automatic CHANGELOG generation.

## Commit Message Format

```
type(scope?): subject

body?

footer?
```

### Type
Must be one of:

- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation only changes
- **style**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.)
- **refactor**: A code change that neither fixes a bug nor adds a feature
- **test**: Adding missing tests or correcting existing tests
- **chore**: Changes to the build process or auxiliary tools and libraries such as documentation generation
- **perf**: A code change that improves performance
- **ci**: Changes to CI configuration files and scripts
- **build**: Changes that affect the build system or external dependencies

### Scope (Optional)
The scope should be the name of the module or component affected (as perceived by the person reading the changelog).

Examples:
- `feat(market)`: Market data module
- `fix(backtest)`: Backtest engine
- `docs(api)`: API documentation
- `refactor(portfolio)`: Portfolio management

### Subject
The subject contains a succinct description of the change:
- Use the imperative, present tense: "change" not "changed" nor "changes"
- Don't capitalize the first letter
- No period (.) at the end
- Maximum 72 characters

### Body (Optional)
The body should include the motivation for the change and contrast this with previous behavior. Wrap at 72 characters.

### Footer (Optional)
The footer should contain any information about **Breaking Changes** and is also the place to reference GitHub issues that this commit closes.

## Examples

### Simple feature
```
feat: add AI trading signals module
```

### Bug fix with scope
```
fix(market): resolve 1D chart data issue on non-trading days
```

### Documentation update
```
docs: update API documentation with new endpoints
```

### Refactoring with scope
```
refactor(portfolio): optimize position calculation logic
```

### Feature with body and footer
```
feat(backtest): add parameter optimization using genetic algorithms

- Implement genetic algorithm for strategy parameter optimization
- Add optimization configuration interface
- Include performance metrics comparison

Closes #123
```

### Breaking change
```
feat(api): migrate to REST API v2

BREAKING CHANGE: API endpoints now use /api/v2/ prefix
```

## Bad Examples

❌ `update` - Too vague  
❌ `fixed bug` - No type prefix, vague description  
❌ `feat: added new feature to the system` - Too generic  
❌ `fix: issue with chart` - Not descriptive enough  

## Good Examples

✅ `feat(market): add real-time market scanner`  
✅ `fix(charts): correct X-axis labeling on weekly charts`  
✅ `docs: add contribution guidelines`  
✅ `refactor: optimize batch request logic`  
✅ `test(backtest): add unit tests for Sharpe ratio calculation`

## Commit Template

You can set up a commit template in Git to help follow this convention:

```bash
# Save this as ~/.gitmessage
# Subject line (try to keep under 50 characters)

# Body (wrap at 72 characters)

# Footer (references, breaking changes, etc.)

# --- COMMIT END ---
# Type: feat|fix|docs|style|refactor|test|chore|perf|ci|build
# Scope: market|backtest|portfolio|api|ui|auth|etc.
# Subject: imperative, present tense, no period
```

Then configure Git to use it:
```bash
git config --global commit.template ~/.gitmessage
```

## Benefits

1. **Automated CHANGELOG generation**
2. **Better readability of commit history**
3. **Clear communication of changes**
4. **Easier identification of breaking changes**
5. **Simplified contribution process**

## Tools

- **commitlint**: Lint commit messages
- **standard-version**: Automated versioning and CHANGELOG generation
- **semantic-release**: Fully automated version management

## References

- [Conventional Commits](https://www.conventionalcommits.org/)
- [Angular Commit Guidelines](https://github.com/angular/angular/blob/main/CONTRIBUTING.md#commit)
- [Commitizen](https://github.com/commitizen/cz-cli)

---

*Following these guidelines will make the project more maintainable and professional.*