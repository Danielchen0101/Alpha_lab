# AlphaLab Supabase Auth email templates

These six complete HTML files are ready to paste into the corresponding hosted Supabase Auth email templates. They use AlphaLab's warm cream canvas, paper card, ink, restrained blue light-mode accents, gold dark-mode security accents, serif wordmark, and bilingual English/简体中文 security copy. Layout tables, inline critical styles, a 600 px responsive shell, visible fallback URLs, dark-mode rules, and Outlook dark-mode selectors keep them useful across common email clients.

These are repository artifacts only. Adding this directory does **not** update any hosted Supabase project.

Documentation and variable names were verified against the current Supabase Auth documentation on 2026-07-25:

- [Email Templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Customizing email templates locally](https://supabase.com/docs/guides/local-development/customizing-email-templates)
- [Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)

## Dashboard mapping

Use these exact Supabase dashboard categories and subjects. The machine-readable equivalent is in `template-manifest.json`.

| Supabase dashboard template | HTML file | Recommended subject | Variables used | Local config key |
| --- | --- | --- | --- | --- |
| Confirm sign up | `confirmation.html` | `Confirm your AlphaLab account / 确认 AlphaLab 账户` | `{{ .ConfirmationURL }}` | `auth.email.template.confirmation` |
| Invite user | `invite.html` | `You're invited to AlphaLab / 邀请加入 AlphaLab` | `{{ .ConfirmationURL }}` | `auth.email.template.invite` |
| Magic link or OTP | `magic-link.html` | `Your AlphaLab sign-in link / AlphaLab 登录链接` | `{{ .ConfirmationURL }}` | `auth.email.template.magic_link` |
| Change email address | `email-change.html` | `Confirm your new AlphaLab email / 确认新的 AlphaLab 邮箱` | `{{ .ConfirmationURL }}`, `{{ .NewEmail }}` | `auth.email.template.email_change` |
| Reset password | `recovery.html` | `Reset your AlphaLab password / 重置 AlphaLab 密码` | `{{ .ConfirmationURL }}` | `auth.email.template.recovery` |
| Reauthentication | `reauthentication.html` | `AlphaLab verification code / AlphaLab 验证码` | `{{ .Token }}` | `auth.email.template.reauthentication` |

`{{ .ConfirmationURL }}` is Supabase's complete, server-generated verification URL. The five link templates use it unchanged for both the primary button and the visible copy/paste fallback. The reauthentication template is deliberately code-only because Supabase supplies its six-digit OTP through `{{ .Token }}`. Its subject and hidden preheader intentionally omit the OTP so notification previews and email metadata do not disclose the code.

## Hosted Supabase setup

1. Configure the production Site URL and every permitted redirect under **Authentication → URL Configuration**. Supabase builds `{{ .ConfirmationURL }}` from that Auth configuration and the redirect passed by the client.
2. Configure a transactional SMTP provider under **Authentication → SMTP Settings**. Supply the host, port, username, password, From address, and sender name. Use a From address on a domain you control.
3. Under **Authentication → Email Templates**, open each dashboard category in the table above, paste its recommended subject, replace the message body with the full matching HTML file, preview, and save.
4. Disable click/open tracking in the SMTP provider for Auth messages. Supabase warns that link rewriting by email tracking can stop Auth links from working.
5. Exercise all enabled flows against test accounts and inspect delivery in Gmail, Outlook, Apple Mail, and a narrow mobile viewport. Confirm that each link reaches an allow-listed URL and that the reauthentication code is accepted.

### SMTP prerequisites and deliverability

- Supabase's built-in sender is for exploration, not production: it only delivers to pre-authorized organization-team addresses, has restrictive limits, and has no delivery SLA.
- Since **2026-06-03**, new Free-plan projects using the default SMTP cannot customize Auth email templates. A custom SMTP provider is required for those projects. See Supabase's [Free-tier email-template customization change](https://supabase.com/changelog/46599-changes-to-email-template-customisation-on-free-tier).
- Authenticate the sending domain with SPF, DKIM, and DMARC. Prefer a dedicated Auth subdomain and From address, separate from marketing mail.
- Keep Auth messages transactional. These templates intentionally avoid external images, promotional copy, user metadata, JavaScript, and external fonts.
- Review Auth rate limits after enabling custom SMTP; Supabase applies a conservative initial sending limit that can be adjusted in the dashboard.

## Hosted drift check and synchronization

`sync-templates.mjs` is a dependency-free Node.js 20 tool for the hosted Supabase [Management API Auth configuration endpoint](https://supabase.com/docs/guides/auth/auth-email-templates#editing-email-templates). It manages only the twelve subject/content fields named by `template-manifest.json`; unrelated Auth, provider, URL, SMTP, and security settings are ignored and never sent.

The default command is deliberately offline and read-only:

```powershell
node supabase/email-templates/sync-templates.mjs
```

It loads the six local templates, normalizes HTML line endings to LF, and prints a plan containing field names, byte lengths, and SHA-256 hashes. It does not require credentials, call the network, write a file, or change hosted configuration.

For a hosted check, provide a fine-grained Supabase personal access token with `auth_config_read` and the project reference through environment variables only:

```powershell
$env:SUPABASE_ACCESS_TOKEN = "<fine-grained-token>"
$env:SUPABASE_PROJECT_REF = "<project-ref>"
node supabase/email-templates/sync-templates.mjs --check
```

`--check` performs `GET /v1/projects/{ref}/config/auth` and compares every manifest-owned subject and body exactly. It exits `0` when all fields match, `1` when drift exists, and `2` for configuration, network, authorization, rate-limit, or response errors.

Applying is a separate, explicit operation and requires both `auth_config_read` and `auth_config_write`:

```powershell
node supabase/email-templates/sync-templates.mjs --apply
```

`--apply` sends one PATCH containing only the twelve manifest-owned fields, then performs a fresh GET and exits nonzero unless the read-back matches every subject and normalized body exactly. The tool never prints the access token, subjects, complete HTML bodies, or Management API response bodies. Keep the access token out of shell history, source files, CI logs, and untrusted pull-request jobs.

The ordinary CI job runs only the offline static verifier and mock-fetch Node tests. It has no Supabase credentials and does not access a hosted project. Run the mock tests locally with:

```powershell
node --test supabase/email-templates/sync-templates.test.mjs
```

New Free-plan projects using Supabase's default SMTP cannot customize Auth templates as of 2026-06-03. In that configuration `--apply` will fail safely; configure custom SMTP or use an eligible plan before applying branded templates.

## Local development

For local Supabase, map each `auth.email.template.*` key in the table to its subject and `content_path` in `supabase/config.toml`, following the [current local template guide](https://supabase.com/docs/guides/local-development/customizing-email-templates). Restart the local Supabase stack after changes. Mailpit is normally available at `http://localhost:54324` for captured Auth messages.

The files are intentionally standalone so the same HTML can be pasted into a hosted project without a build step. Do not add JavaScript, external font imports, remote stylesheets, or tracking URLs.

## Static verification

Run the dependency-free verifier from the repository root:

```powershell
node supabase/email-templates/verify-templates.mjs
```

It checks:

- the exact six-file manifest;
- per-template Supabase variable allowlists and required placeholders;
- complete `{{ .ConfirmationURL }}` usage plus copyable fallback links;
- code-only reauthentication behavior;
- balanced HTML tags and presentation-table semantics;
- responsive, bilingual, preheader, and dark-mode hooks;
- absence of JavaScript, external styles/fonts, and remote assets.

Static verification cannot prove SMTP deliverability or remote dashboard configuration. Complete the hosted or Mailpit flow tests before production use.
