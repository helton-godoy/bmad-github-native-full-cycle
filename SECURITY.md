# Security Policy

## Supported Versions

We release patches for security vulnerabilities in the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

We take the security of BMAD-GitHub Native Full Cycle seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do NOT report security vulnerabilities through public GitHub issues.**

Instead, please report them via one of the following methods:

1. **GitHub Security Advisories:** Use the [Security Advisories](https://github.com/helton-godoy/bmad-github-native-full-cycle/security/advisories) feature
2. **Email:** Send details to [helton.godoy@example.com] (replace with actual email)

### What to Include

Please include the following information in your report:

- Type of vulnerability (e.g., SQL injection, XSS, authentication bypass)
- Full paths of source file(s) related to the vulnerability
- Location of the affected source code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### Response Timeline

- **Initial Response:** Within 48 hours
- **Status Update:** Within 7 days
- **Fix Timeline:** Depends on severity
  - **Critical:** 1-7 days
  - **High:** 7-14 days
  - **Medium:** 14-30 days
  - **Low:** 30-90 days

---

## Security Best Practices

When contributing to this project, please follow these security guidelines:

### Code Security

- Never commit secrets, API keys, or credentials
- Use environment variables for sensitive configuration
- Validate and sanitize all user inputs
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Keep dependencies up to date

### Dependency Management

- Run `npm audit` regularly
- Review Dependabot alerts promptly
- Update dependencies with known vulnerabilities
- Use exact versions in `package-lock.json`

### GitHub Actions Security

- Use pinned versions for actions (e.g., `actions/checkout@v4`)
- Limit permissions in workflows (principle of least privilege)
- Never expose secrets in logs
- Use `GITHUB_TOKEN` with minimal required permissions

---

## Automated Security Checks

This project uses the following automated security tools:

1. **CodeQL:** Static analysis for security vulnerabilities
2. **Dependabot:** Automated dependency updates
3. **npm audit:** Package vulnerability scanning
4. **GitHub Security Advisories:** Vulnerability tracking

These checks run automatically on:

- Every push to `main` and `develop` branches
- Every pull request
- Weekly scheduled scans (Mondays at 00:00 UTC)

---

## Security Contacts

- **Security Team:** [SECURITY] Persona (BMAD Method)
- **Project Maintainer:** helton-godoy
- **GitHub Repository:** <https://github.com/helton-godoy/bmad-github-native-full-cycle>

---

## Disclosure Policy

When we receive a security bug report, we will:

1. Confirm the problem and determine affected versions
2. Audit code to find similar problems
3. Prepare fixes for all supported versions
4. Release patches as soon as possible

We will credit security researchers who responsibly disclose vulnerabilities.

---

**Last Updated:** 2025-11-21  
**Version:** 1.0.0
