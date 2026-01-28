build-NestJSFunction:
	@echo "Building NestJSFunction..."
	mkdir -p $(ARTIFACTS_DIR)
	# Copy built code
	cp -r dist $(ARTIFACTS_DIR)/
	cp package.json $(ARTIFACTS_DIR)/
	# Copy prisma config and schema directory (Prisma 7 multi-file)
	cp prisma.config.ts $(ARTIFACTS_DIR)/
	cp -r prisma $(ARTIFACTS_DIR)/
	# Install ALL dependencies (including dev) to ensure prisma CLI is available
	cd $(ARTIFACTS_DIR) && npm install
	# Generate Prisma Client using prisma.config.ts
	@echo "Generating Prisma Client..."
	cd $(ARTIFACTS_DIR) && npx -y prisma generate
	# Remove dev dependencies
	@echo "Pruning dev dependencies..."
	cd $(ARTIFACTS_DIR) && npm prune --production
	# SURGICAL CLEANUP - Delete large non-runtime packages and files
	@echo "Surgical cleanup of node_modules..."
	# Remove known large packages that aren't needed at runtime (often missed by prune or dragged in as deep dependencies)
	-rm -rf $(ARTIFACTS_DIR)/node_modules/typescript
	-rm -rf $(ARTIFACTS_DIR)/node_modules/prisma
	-rm -rf $(ARTIFACTS_DIR)/node_modules/swagger-ui-dist
	-rm -rf $(ARTIFACTS_DIR)/node_modules/effect
	-rm -rf $(ARTIFACTS_DIR)/node_modules/@electric-sql
	-rm -rf $(ARTIFACTS_DIR)/node_modules/fast-check
	-rm -rf $(ARTIFACTS_DIR)/node_modules/chevrotain
	# Remove docs, tests, and examples from remaining node_modules to shave off more MBs
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "test" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "tests" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "docs" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "examples" -prune -exec rm -rf {} +
	# DEEP CLEAN: Remove @prisma/studio and frontend deps
	rm -rf $(ARTIFACTS_DIR)/node_modules/@prisma/studio*
	rm -rf $(ARTIFACTS_DIR)/node_modules/react
	rm -rf $(ARTIFACTS_DIR)/node_modules/react-dom
	rm -rf $(ARTIFACTS_DIR)/node_modules/@types
	rm -rf $(ARTIFACTS_DIR)/node_modules/@nestjs/cli
	# Remove prisma CLI package (save space, not needed for runtime)
	rm -rf $(ARTIFACTS_DIR)/node_modules/prisma
	# Remove large Prisma engine binaries (generic search)
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*darwin*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*windows*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*debian*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*musl*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*darwin*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*windows*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*debian*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*musl*" -delete
	# Remove schema engines (not needed for runtime)
	find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-*" -delete
	# Verify libquery_engine exists for rhel
	@echo "Verifying libquery_engine-rhel-openssl-3.0.x..."
	@find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-rhel-openssl-3.0.x*" || echo "WARNING: libquery_engine-rhel-openssl-3.0.x not found!"
	# AGGRESSIVE CLEANUP: Remove source maps, definition files, and markdown docs
	find $(ARTIFACTS_DIR)/node_modules -name "*.map" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.d.ts" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.md" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.ts" -type f -delete
	# CRITICAL: Fix broken symlinks in .bin to prevent SAM packaging errors
	# Portable way to delete broken symlinks
	@echo "Fixing broken symlinks in node_modules/.bin..."
	find $(ARTIFACTS_DIR)/node_modules/.bin -type l ! -exec test -e {} \; -delete
	# Remove temporary files
	rm -rf $(ARTIFACTS_DIR)/node_modules/.cache
	rm -rf $(ARTIFACTS_DIR)/prisma
	@echo "✅ NestJSFunction built and surgically optimized"

build-MigrationFunction:
	@echo "Building MigrationFunction..."
	mkdir -p $(ARTIFACTS_DIR)
	# Copy essential files
	# Copy essential files from migration directory (package.json, index.js)
	cp migration/index.js migration/package.json $(ARTIFACTS_DIR)/
	# Assemble migration schema from split files
	# Start with migration datasource (Prisma 7: NO URL in schema, only provider)
	echo "datasource db {" > $(ARTIFACTS_DIR)/schema.prisma
	echo "  provider = \"postgresql\"" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "}" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "" >> $(ARTIFACTS_DIR)/schema.prisma
	# Add generator (from main prisma schema, compatible with Prisma 5)
	echo "generator client {" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "  provider = \"prisma-client-js\"" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "  binaryTargets = [\"native\", \"rhel-openssl-3.0.x\"]" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "}" >> $(ARTIFACTS_DIR)/schema.prisma
	echo "" >> $(ARTIFACTS_DIR)/schema.prisma
	# Append all business models
	cat prisma/schema/user.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/agent.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/job.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/execution.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/transaction.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/bill.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	cat prisma/schema/dispute.prisma >> $(ARTIFACTS_DIR)/schema.prisma
	# Copy migrations directory from root prisma folder
	cp -r prisma/migrations $(ARTIFACTS_DIR)/
	# Force download of RHEL engines (especially schema-engine) during install
	rm -rf $(ARTIFACTS_DIR)/node_modules $(ARTIFACTS_DIR)/package-lock.json
	# Generate Prisma 7 Config for Migration
	echo "import { defineConfig } from 'prisma/config';" > $(ARTIFACTS_DIR)/prisma.config.ts
	echo "export default defineConfig({" >> $(ARTIFACTS_DIR)/prisma.config.ts
	echo "  schema: 'schema.prisma'," >> $(ARTIFACTS_DIR)/prisma.config.ts
	echo "  datasource: { url: process.env.DATABASE_URL }" >> $(ARTIFACTS_DIR)/prisma.config.ts
	echo "});" >> $(ARTIFACTS_DIR)/prisma.config.ts
	
	# Prisma 7: Try to rely on PRISMA_CLI_BINARY_TARGETS and post-install script
	# We also set PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 just in case
	export PRISMA_CLI_BINARY_TARGETS=native,rhel-openssl-3.0.x && cd $(ARTIFACTS_DIR) && npm install --production --no-optional
	
	# MANUAL FIX (Prisma 7.3.0): Download missing schema-engine for RHEL
	# Hash: 9d6ad21cbbceab97458517b147a6a09ff43aa735
	curl -L https://binaries.prisma.sh/all_commits/9d6ad21cbbceab97458517b147a6a09ff43aa735/rhel-openssl-3.0.x/schema-engine.gz -o $(ARTIFACTS_DIR)/schema-engine.gz
	gunzip $(ARTIFACTS_DIR)/schema-engine.gz
	chmod +x $(ARTIFACTS_DIR)/schema-engine
	mkdir -p $(ARTIFACTS_DIR)/node_modules/@prisma/engines
	mv $(ARTIFACTS_DIR)/schema-engine $(ARTIFACTS_DIR)/node_modules/@prisma/engines/schema-engine-rhel-openssl-3.0.x
	
	# Generate Prisma Client
	@echo "Generating Prisma Client for migration..."
	# Prisma 7 will automatically download the needed engines based on binaryTargets in schema.prisma
	# Ensure binaryTargets includes "rhel-openssl-3.0.x"
	cd $(ARTIFACTS_DIR) && npx -y prisma generate --schema=./schema.prisma
	# Surgical cleanup for migration
	@echo "Surgical cleanup for migration..."
	# DO NOT remove prisma package for MigrationFunction, we need the CLI (via node_modules/prisma)
	-rm -rf $(ARTIFACTS_DIR)/node_modules/typescript
	# Prisma 7 CLI dependencies are complex. Let's keep effect, electric-sql, fast-check, and chevrotain.
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/effect
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/@electric-sql
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/fast-check
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/chevrotain
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/@prisma/studio* # RESTORED: Needed by Prisma 7 CLI
	-rm -rf $(ARTIFACTS_DIR)/node_modules/react
	-rm -rf $(ARTIFACTS_DIR)/node_modules/react-dom
	-rm -rf $(ARTIFACTS_DIR)/node_modules/@types
	# Remove lodash and other large utils if possible (ONLY if size is an issue)
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/lodash
	# -rm -rf $(ARTIFACTS_DIR)/node_modules/remeda
	# Remove unnecessary files from remaining node_modules
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "test" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "tests" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "docs" -prune -exec rm -rf {} +
	-find $(ARTIFACTS_DIR)/node_modules -type d -name "examples" -prune -exec rm -rf {} +
	# Remove unused engines (darwin, windows, debian, musl) but KEEP rhel-openssl-3.0.x
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*darwin*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*windows*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*debian*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "libquery_engine-*musl*" -delete
	# Schema engine (migration engine) - CRITICAL: Keep rhel-openssl-3.0.x!
	find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-*darwin*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-*windows*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-*debian*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-*musl*" -delete
	# Verify schema-engine exists
	@echo "Verifying schema-engine-rhel-openssl-3.0.x..."
	@find $(ARTIFACTS_DIR)/node_modules -name "schema-engine-rhel-openssl-3.0.x" || echo "WARNING: schema-engine-rhel-openssl-3.0.x not found!"
	# Common query engines cleanup
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*darwin*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*windows*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*debian*" -delete
	find $(ARTIFACTS_DIR)/node_modules -name "query-engine-*musl*" -delete
	# AGGRESSIVE CLEANUP: Remove source maps, definition files, and markdown docs
	find $(ARTIFACTS_DIR)/node_modules -name "*.map" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.d.ts" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.md" -type f -delete
	find $(ARTIFACTS_DIR)/node_modules -name "*.ts" -type f -delete
	# Remove cache and bin symlinks
	find $(ARTIFACTS_DIR)/node_modules/.bin -type l ! -exec test -e {} \; -delete
	rm -rf $(ARTIFACTS_DIR)/node_modules/.cache
	@echo "✅ Migration built and surgically optimized (Prisma 7)"

