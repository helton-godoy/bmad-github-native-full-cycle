# Deferred Work

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-loop-detection.md`
  summary: Auto-generated `.github/logs/*.json.log` files are tracked by git and should be added to `.gitignore` to prevent accidental commits.
  evidence: These log files (bmad-commithandler, bmad-enhancedgatekeeper, bmad-errorrecoverymanager) are modified every time tests run, creating noise in git status.
