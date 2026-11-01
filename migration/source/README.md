# Content dataset

`public_content.json` is the filtered content dataset the site is generated from (`npm run import:content`) and verified against (`npm run verify:content`, `npm run verify`). It is produced by `npm run dataset:prepare` and must not be edited by hand.

| | |
|---|---|
| Source | WordPress WXR export 2026-11-01 (`public_content.json`) |
| SHA-256 of the source file | `4589c471b1f8e0fd9414360016695b3a1c14f8b000b26be524607429d020b780` |
| SHA-256 of public_content.json | `02ae655bf3e92d0660f3e1ee8f3de61cd49e56d83935b7b5034a9c650174ab49` |
| Published pages | 67 |
| Published posts | 164 |
| Navigation records | 3 |

## Filters applied

- Only published pages, posts and navigation records are kept. Private, draft, pending, scheduled, trashed and password-protected items, attachments and every other record type are dropped.
- HTML comments other than WordPress block delimiters are removed. On the live site they hide content (for example entries for former staff) that must not be republished. The removed text is not recorded anywhere in this repository.

The source file was already a filtered pack of published content.

HTML comments removed: 19, on `/staff/` (3), `/tr/personel/` (6), `/part-time-instructors/` (5), `/tr/yari-zamanli/` (5).

The department keeps the original export. It must never be committed: it can contain private pages, drafts and hidden content.
