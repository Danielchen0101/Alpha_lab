# Security Policy

## Supported versions

Security fixes are applied to the current major release. At present, that is AlphaLab 3.x. Older releases may receive a fix only when a maintainer explicitly announces extended support.

## Reporting a vulnerability

Please do not disclose vulnerabilities, exposed credentials, or account data in a public issue.

Use GitHub's **Report a vulnerability** option in the repository Security tab. Include:

- the affected route, component, or deployment mode;
- a minimal reproduction;
- the expected security boundary and observed behavior;
- impact and any known prerequisites;
- suggested mitigation, if available.

Remove real API keys, tokens, order identifiers, and personal account details from screenshots and logs. A maintainer will acknowledge a complete report as soon as practical and will coordinate validation, remediation, and disclosure through the private report.

## Operational guidance

- Keep Supabase service-role keys, Fernet keys, Flask secrets, and provider credentials server-side.
- Use separate paper and live Alpaca credentials.
- Treat a saved credential as *configured* until a live verification succeeds.
- Restrict production CORS to the deployed frontend origin.
- Use HTTPS for every production endpoint.
- Rotate any credential that appears in source control, logs, screenshots, or issue attachments.
- Review Supabase Row Level Security policies before applying schema changes.

AlphaLab is research and execution software, not a custodian. Operators are responsible for broker permissions, risk limits, secret management, monitoring, and regulatory obligations.
