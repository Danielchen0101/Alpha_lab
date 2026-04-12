# Version Mapping Guide

This document explains the mapping between backup directory names and semantic version numbers for the Professional Quantitative Trading Platform.

## Current Version: 1.7.0

The project follows [Semantic Versioning](https://semver.org/):
- **MAJOR** version (1): Breaking changes
- **MINOR** version (7): New features (backward compatible)
- **PATCH** version (0): Bug fixes

## Backup Directory to Version Mapping

| Backup Directory | Semantic Version | Release Date | Key Features |
|------------------|------------------|--------------|--------------|
| `version2` | **v1.2.0** | 2026-04-04 | Stable base version with working frontend and backend |
| `version_3.0` | **v1.3.0** | 2026-04-05 | Version 3.0 stable release |
| `version_4.0_with_ai_trading` | **v1.4.0** | 2026-04-05 | AI trading features integration |
| `version_6.0_ai_agent` | **v1.6.0** | 2026-04-11 | Market Analyze 1D chart fixes, non-trading day fallback |
| `version_7_scanner` | **v1.7.0** | 2026-04-12 | Market scanner feature, real-time screening |

**Note**: 
- Version 1.0.0 corresponds to the initial professional release (2026-04-12)
- Version 1.1.0 and 1.5.0 do not have corresponding backup directories
- Backup directories use internal naming convention (versionX), while public releases use semantic versioning (vX.Y.Z)

## How to Use Backup Versions

### Restore Specific Version
```bash
# Example: Restore version 1.6.0 (AI Agent fix)
cd professional_quant_platform/backups/version_6.0_ai_agent
.\restore.ps1 -Type full

# Example: Restore version 1.4.0 (AI Trading)
cd professional_quant_platform/backups/version_4.0_with_ai_trading
.\restore.ps1 -Type full
```

### Check Current Version
```bash
# Frontend version
cat frontend/package.json | grep '"version"'

# Or from README
grep "版本:" README.md
```

## Creating New Versions

### Version Bump Rules
1. **PATCH (x.x.1)**: Bug fixes, documentation updates
2. **MINOR (x.1.0)**: New features (backward compatible)
3. **MAJOR (2.0.0)**: Breaking changes

### Creating a Backup
```bash
# 1. Update version in package.json
# 2. Create backup directory
mkdir backups/version_8.0_new_feature

# 3. Copy current project state
cp -r backend frontend docs scripts backups/version_8.0_new_feature/

# 4. Update version mapping
# 5. Update CHANGELOG.md
```

## GitHub Releases

When creating GitHub releases, use semantic versions:

| GitHub Release Tag | Corresponds to Backup |
|--------------------|----------------------|
| v1.2.0 | `version2` |
| v1.3.0 | `version_3.0` |
| v1.4.0 | `version_4.0_with_ai_trading` |
| v1.6.0 | `version_6.0_ai_agent` |
| v1.7.0 | `version_7_scanner` |

### Creating a GitHub Release
1. Tag the commit: `git tag -a v1.7.0 -m "Release v1.7.0 - Market scanner"`
2. Push the tag: `git push origin v1.7.0`
3. Create release on GitHub with release notes from CHANGELOG.md

## Migration Between Versions

### From v1.6.0 to v1.7.0
```bash
# Backup current state
cd professional_quant_platform/backups
mkdir before_upgrade_$(date +%Y%m%d)
cp -r ../backend ../frontend before_upgrade_$(date +%Y%m%d)/

# Restore v1.7.0
cd version_7_scanner
.\restore.ps1 -Type full
```

### Version Compatibility
| Feature | v1.4.0 | v1.6.0 | v1.7.0 |
|---------|--------|--------|--------|
| AI Trading | ✅ | ✅ | ✅ |
| Market Scanner | ❌ | ❌ | ✅ |
| 1D Chart Fix | ❌ | ✅ | ✅ |
| Professional Docs | ❌ | ❌ | ✅ |

## Troubleshooting

### Version Conflicts
If you encounter version conflicts:
1. Check current version: `cat frontend/package.json | grep version`
2. Check backup version: Look at backup directory name
3. Refer to this mapping table

### Missing Backups
If a semantic version doesn't have a backup:
1. Check if it's a patch release (may not have separate backup)
2. Use the nearest lower version backup
3. Apply patch changes manually

## Future Version Planning

| Planned Version | Target Features | Expected Date |
|-----------------|-----------------|---------------|
| v1.8.0 | Advanced risk analytics | Q2 2026 |
| v1.9.0 | Real-time data streaming | Q3 2026 |
| v2.0.0 | Multi-account support, breaking API changes | Q4 2026 |

---

**Last Updated**: 2026-04-12  
**Current Version**: 1.7.0  
**Maintainer**: Project Team