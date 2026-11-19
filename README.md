# DENSE//DS

Ultra-condensed, zero-build vanilla HTML5, CSS3, and ES6+ design system for telemetry consoles, ledgers, and data-dense operational UIs.

- **Live site**: https://dense.vberkoz.com
- **Stack**: Vanilla HTML5, CSS3 (`light-dark()`, CSS Grid, `@container`), ES6+ (`<dialog>`, Popover API, Invoker Commands) — zero frameworks, bundlers, or npm dependencies.

## Surfaces

| File | Surface |
| --- | --- |
| `index.html` | Landing page & interactive mini-workbench |
| `catalog.html` | Living component catalog & style guide |
| `demo-telemetry.html` | System telemetry & 80-node fleet operations |
| `demo-ledger.html` | Double-entry financial ledger & audit log |
| `demo-inventory.html` | Supply chain SKU catalog & reorder matrix |
| `demo-picker.html` | Custom popover date/time/datetime-local pickers |
| `stats.html` | Live traffic telemetry dashboard |
| `src/` | Core stylesheets (`ds.css`, `picker.css`) & runtime (`ds.js`, `picker.js`, `stats.js`) |

## Traffic Stats

Zero-PII serverless analytics (`src/stats.js` -> CloudFront `/api/*` -> API Gateway HTTP API -> `lambda/stats.py` -> DynamoDB `StatsTable`):

- No cookies, client IDs, raw IPs, or raw User-Agent storage; daily unique counts use salted `SHA-256(day|salt|ip|ua)[:16]` hashes with 48h TTL.
- Window-queryable daily rollups, top pages, top referrers, countries, device/scheme splits, and latest 25 events served via `GET /api/stats?days=14` with zero DynamoDB table scans.

## Local Preview

Open `index.html` directly via `file://`, or serve locally for ES module demos (`demo-picker.html`):

```sh
python -m http.server 8080
```

## AWS Deployment (`us-east-1`)

Package, validate, and deploy the S3 + CloudFront (OAC) + ACM + Route 53 + API Gateway + Lambda + DynamoDB stack:

```sh
aws cloudformation package \
  --template-file cloudformation.yaml \
  --s3-bucket <BUCKET_NAME> \
  --s3-prefix _cfn-artifacts \
  --output-template-file .cfn-packaged.yaml \
  --profile basil \
  --region us-east-1

aws cloudformation validate-template --template-body file://.cfn-packaged.yaml --profile basil --region us-east-1

aws cloudformation deploy \
  --template-file .cfn-packaged.yaml \
  --stack-name dense-site \
  --region us-east-1 \
  --profile basil \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides DomainName=dense.vberkoz.com HostedZoneId=<HOSTED_ZONE_ID>

rm -f .cfn-packaged.yaml
```

Sync static site assets only (never upload `.git/`, `cloudformation.yaml`, `lambda/`, or repo docs, and never delete `_cfn-artifacts/`) and invalidate CloudFront:

```sh
aws s3 sync . s3://<BUCKET_NAME> --profile basil --region us-east-1 --exclude "*" --include "*.html" --include "src/*.css" --include "src/*.js" --exclude "_cfn-artifacts/*" --delete
aws s3 cp . s3://<BUCKET_NAME>/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.html" --cache-control "no-cache, must-revalidate" --content-type "text/html; charset=utf-8"
aws s3 cp src s3://<BUCKET_NAME>/src/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.css" --cache-control "public, max-age=86400" --content-type "text/css; charset=utf-8"
aws s3 cp src s3://<BUCKET_NAME>/src/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.js" --cache-control "public, max-age=86400" --content-type "text/javascript; charset=utf-8"

aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*" --profile basil
```
