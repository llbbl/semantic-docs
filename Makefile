# Semantic Docs - Version Management
# Usage:
#   make bump-patch  - Increment patch version (1.0.0 → 1.0.1)
#   make bump-minor  - Increment minor version (1.0.0 → 1.1.0)
#   make bump-major  - Increment major version (1.0.0 → 2.0.0)

# Get current version from package.json
CURRENT_VERSION = $(shell jq -r '.version' package.json 2>/dev/null || echo "0.0.0")

.PHONY: bump-patch bump-minor bump-major show-version

# Semantic version bumping
bump-patch:
	@$(MAKE) bump-version BUMP_TYPE=patch

bump-minor:
	@$(MAKE) bump-version BUMP_TYPE=minor

bump-major:
	@$(MAKE) bump-version BUMP_TYPE=major

# Internal target for version bumping
bump-version:
	@if [ -z "$(BUMP_TYPE)" ]; then \
		echo "❌ Error: Don't call 'make bump-version' directly!"; \
		echo ""; \
		echo "Use one of these commands instead:"; \
		echo "  make bump-patch  - Increment patch version (1.0.0 → 1.0.1)"; \
		echo "  make bump-minor  - Increment minor version (1.0.0 → 1.1.0)"; \
		echo "  make bump-major  - Increment major version (1.0.0 → 2.0.0)"; \
		echo ""; \
		exit 1; \
	fi
	@echo "📦 Current version: $(CURRENT_VERSION)"
	@npm version $(BUMP_TYPE) --no-git-tag-version >/dev/null
	@NEW_VERSION=$$(jq -r '.version' package.json); \
	echo "✨ New version: $$NEW_VERSION"; \
	$(MAKE) commit-version VERSION=$$NEW_VERSION

# Commit the version changes and create tag
commit-version:
	@if [ -z "$(VERSION)" ]; then \
		echo "❌ Error: VERSION is empty!"; \
		exit 1; \
	fi
	@echo "📝 Committing version $(VERSION)"
	@git add package.json
	@git commit -m "Release v$(VERSION)"
	@git tag v$(VERSION)
	@echo "✅ Created tag v$(VERSION)"
	@echo ""
	@echo "To push the release, run:"
	@echo "  git push origin main && git push origin v$(VERSION)"

# Show current version
show-version:
	@echo "📦 semantic-docs v$(CURRENT_VERSION)"

# Manual version setting (if needed)
set-version:
	@read -p "Enter version (e.g., 1.2.3): " version; \
	jq --arg v "$$version" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json; \
	$(MAKE) commit-version VERSION=$$version