# Dependency & Supply Chain Security Policy

> **DEPENDENCY INTEGRITY, VULNERABILITY TRIAGE, AND SUPPLY CHAIN CONTROLS**  
> *This document establishes the binding protocols for dependency auditing, lockfile verification, version pinning, and supply chain risk reduction across the ReachInternational monorepo.*

---

## 1. Package Manager & Lockfile Integrity

1. **Authoritative Package Manager**: The monorepo strictly enforces **`pnpm@11.21.0`** as declared in root `package.json`:
   ```json
   "packageManager": "pnpm@11.21.0"
   ```
2. **Frozen Lockfile Enforcement in CI**:
   All GitHub Actions CI workflows (`.github/workflows/ci.yml`) MUST install dependencies using:
   ```bash
   pnpm install --frozen-lockfile
   ```
   This guarantees that CI builds fail immediately if `pnpm-lock.yaml` is out of sync with package specifications, preventing accidental or malicious dependency modifications.
3. **No Unchecked Updates**: Developers and AI agents must never run `pnpm update` blindly across the entire monorepo. Dependencies must be updated deliberately and tested for regressions.

---

## 2. Supply Chain Build Protections (`onlyBuiltDependencies`)

Node.js package installation scripts (`postinstall`, `build`) represent a significant supply chain attack vector. ReachInternational enforces strict script isolation in `pnpm-workspace.yaml`:

```yaml
onlyBuiltDependencies:
  - "sharp"
  - "unrs-resolver"
  - "@sentry/cli"
```

Only explicitly listed packages with native compilation requirements are permitted to execute build scripts during `pnpm install`. All other third-party dependencies are blocked from running arbitrary lifecycle scripts on developer or CI machines.

---

## 3. Vulnerability Overrides & Mitigation

Known transitive vulnerabilities are remediated via explicit `overrides` in root `package.json` and `pnpm-workspace.yaml`:

```json
"overrides": {
  "@types/react": "^19.0.0",
  "@types/react-dom": "^19.0.0",
  "image-size": ">=2.0.3",
  "postcss": ">=8.5.23",
  "uuid": ">=11.1.1",
  "@xmldom/xmldom": ">=0.9.12"
}
```

These overrides force all monorepo packages to resolve secure minimum versions of vulnerable transitive dependencies.

---

## 4. Routine Dependency Auditing Protocol

### Running Vulnerability Audits:
Developers and AI agents should regularly audit workspace dependencies using native pnpm commands:

```bash
# Check for known CVEs across all workspaces:
pnpm audit

# Filter by audit severity (e.g. high and critical only):
pnpm audit --audit-level=high
```

### Triage & Resolution Procedure:
When `pnpm audit` reports a vulnerability:
1. **Analyze Direct vs Transitive**: Determine whether the package is a direct dependency or pulled in transitively.
2. **Assess Exploitability**: Check if the vulnerable code path is actually reachable in ReachInternational's execution model (e.g., server vs client, unused utility).
3. **Remediation Priority**:
   - **Critical / High (Reachable)**: Immediate patch within 24 hours. Update direct version or add a pnpm override.
   - **Moderate**: Remediate during the next scheduled sprint or maintenance cycle.
   - **Low**: Remediate during routine dependency upgrades.
4. **Lockfile Verification**: After updating or overriding a dependency, verify all workspace type checks and builds:
   ```bash
   pnpm typecheck
   pnpm build
   ```

---

## 5. Adding New Dependencies

Before introducing ANY new dependency to `packages/*`, `apps/web`, or `apps/mobile`:
1. **Check Existing Implementation**: Determine if existing packages (`@reachinternational/utils`, native platform APIs) already provide the capability.
2. **Review Maintenance & License**: Verify the package is actively maintained, has strong community adoption, and carries a permissive license (MIT, Apache 2.0, BSD).
3. **Evaluate Bundle Impact**: Ensure the library does not introduce excessive bundle bloat or unnecessary transitive sub-dependencies.
