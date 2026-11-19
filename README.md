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
| `src/` | Core stylesheets (`ds.css`, `picker.css`) & runtime (`ds.js`, `picker.js`) |

## Local Preview

Open `index.html` directly via `file://`, or serve locally for ES module demos (`demo-picker.html`):

```sh
python -m http.server 8080
```

## AWS Deployment (`us-east-1`)

Deploy private S3 + CloudFront (OAC) + ACM + Route 53 stack:

```sh
aws cloudformation validate-template --template-body file://cloudformation.yaml --profile basil --region us-east-1

aws cloudformation deploy \
  --template-file cloudformation.yaml \
  --stack-name dense-site \
  --region us-east-1 \
  --profile basil \
  --no-fail-on-empty-changeset \
  --parameter-overrides DomainName=dense.vberkoz.com HostedZoneId=<HOSTED_ZONE_ID>
```

Sync static site assets only (never upload `.git/`, `cloudformation.yaml`, or repo docs) and invalidate CloudFront:

```sh
aws s3 sync . s3://<BUCKET_NAME> --profile basil --region us-east-1 --exclude "*" --include "*.html" --include "src/*.css" --include "src/*.js" --delete
aws s3 cp . s3://<BUCKET_NAME>/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.html" --cache-control "no-cache, must-revalidate" --content-type "text/html; charset=utf-8"
aws s3 cp src s3://<BUCKET_NAME>/src/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.css" --cache-control "public, max-age=86400" --content-type "text/css; charset=utf-8"
aws s3 cp src s3://<BUCKET_NAME>/src/ --recursive --profile basil --region us-east-1 --exclude "*" --include "*.js" --cache-control "public, max-age=86400" --content-type "text/javascript; charset=utf-8"

aws cloudfront create-invalidation --distribution-id <DISTRIBUTION_ID> --paths "/*" --profile basil
```
