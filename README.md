# Bribe Lakebed

Lakebed-native rewrite of the Bribe reward campaign app. The capsule keeps the app inside Lakebed: schema, queries, mutations, public routes, and client UI all live in this repo with no installed node modules.

## Commands

```sh
npx lakebed dev
npx lakebed build . --target anonymous --json
npx lakebed deploy
```

While `npx lakebed dev` is running:

```sh
npx lakebed db list --port 3000
npx lakebed db dump --port 3000
npx lakebed logs --port 3000
```

## Main Flows

- Owner setup: sign in with Google, create a venue workspace, then manage campaigns, QR codes, landing pages, approvals, content, rewards, and staff redemption.
- Campaigns: owners define a challenge prompt, reward label, validation threshold, status, budget text, and redemption limit.
- QR codes: owners create permanent `/q/{publicId}` customer entry points and choose which active campaigns each QR exposes.
- Public pages: `/venue-slug` lists active venue campaigns, and `/venue-slug/campaign-slug` opens the campaign landing page. Campaign submission still resolves through an active QR because the server requires QR context.
- Patron submission: customers choose a task, upload a compact image or small video, grant usage rights, and receive either a reward, a retry page, or a waiting-for-approval page.
- Staff redemption: staff can look up and redeem issued reward codes from `/owner/staff`.

## Approval Behavior

If venue approval is required, automated approval creates a `needs_review` submission instead of immediately issuing a reward. The patron checking page includes the submission id, QR public id, and client token, then polls the server every 5 seconds while the submission is `uploaded` or `needs_review`. Patrons can also manually refresh the status. Owner approval changes the submission to `approved` and issues a reward code; owner rejection changes it to `rejected` and sends the patron to retry guidance.

## Privacy Boundary

Owner snapshots include private owner data: submissions, media data URLs, reward ledger entries, social post drafts, and owner auth summary. Public snapshots only expose public venue, campaign, QR, and landing settings data, plus redacted reward lookup results. Public submission status requires the submission id, QR public id, and original client token, so a bare submission id is not enough to read a patron upload.

## QR Limits

The client includes a lightweight branded QR SVG generator for short permanent links. It supports byte-mode QR versions 1 through 5 at medium error correction, custom foreground/background/accent colors, rounded or dot-style modules, custom finder corners, and an optional public logo URL. Logo space is excavated from the center of the QR before rendering to preserve scan reliability. QR previews fail closed with a visible fallback, and SVG downloads are disabled or show an error when a value is too long. Current Lakebed public QR URLs are expected to stay short; avoid putting long query strings into printed QR payloads.

## Known Constraints

- No package installs; use Lakebed APIs, relative imports, and TypeScript only.
- Client code lives in `client/`, server code in `server/`, and shared pure TypeScript in `shared/`.
- Server environment variables must be read through `ctx.env` and defined in `.env.lakebed.server`.
- File storage is not available. Uploads are compressed into compact data URLs and stored as Lakebed records.
- Local state resets when `npx lakebed dev` restarts.
- Public campaign submission depends on at least one active QR code that exposes the campaign.
- Social posting is modeled as a Lakebed approval queue; no external social account is connected.
