# Skylya paid invite payment prototype

This public repository contains the 2026-08-27 feature overlay for Skylya's paid, one-time invite-code prototype. Apply these files to the matching Skylya V6 baseline; this repository is intentionally limited to the files changed by this feature and is not a standalone copy of the full product.

## Included

- Official website phone-number and simulated "payment completed" entry.
- User Web/App registration form with a required paid invite code.
- Auth/User/Gateway backend flow for issuing, validating, and atomically consuming one-time invite codes.
- Aliyun SMS template configuration binding for the paid invite-code notification.
- Focused backend tests, MySQL migration, synchronized schema files, Docker Compose passthrough, and the release change-log.

## Security boundary

- No `.env` files, credentials, real phone numbers, database exports, runtime logs, release archives, JARs, APKs, or server backups are included.
- The public payment endpoint remains a simulation protected by a production configuration switch.
- Real payment-provider callbacks, signature verification, reconciliation, and refunds are not implemented.

## Key paths

- `Skylya 官网7.30/src`: official website changes.
- `matching-agent/newSkyLiaUi v1/src`: user Web/App registration changes.
- `matching-agent/skylia-cloud`: backend implementation and tests.
- `server-script/sql/157_paid_invite_codes.sql`: production migration.
- `project-docs/change-logs/2026-08-27-付费一次性邀请码原型.md`: implementation and verification record.

