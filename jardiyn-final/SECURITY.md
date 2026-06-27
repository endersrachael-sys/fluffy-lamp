# JarDIYn Security Notes

## Public surface

Public endpoints must be minimal and safe.

Safe public endpoint:

- `GET /api/health` returns only status, app, version, timestamp.

Sanitized debug endpoints:

- `GET /api/debug/status`
- `GET /api/tools`
- `GET /api/sources`

These must not expose secrets, raw prompts, raw logs, stack traces, private property data, photos, or exact addresses.

## Current persistence

MVP persistence is browser localStorage plus optional server memory session. This is not cloud sync and not account storage.

## Future property intelligence risk

Future GIS, satellite, drone, parcel, and OSINT features must be consent-based and privacy-safe. They must not expose private property vulnerabilities or personal surveillance data.

## Never expose

- `ANTHROPIC_API_KEY`
- raw environment variables
- raw stack traces
- user photos
- EXIF data
- raw precise coordinates unless user explicitly provides and needs them
- property reports to other users without permission
