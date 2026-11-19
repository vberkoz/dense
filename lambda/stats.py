import base64
import hashlib
import json
import os
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

TABLE_NAME = os.environ["TABLE_NAME"]
HASH_SALT = os.environ.get("HASH_SALT", "")
table = boto3.resource("dynamodb").Table(TABLE_NAME)

OWN_HOSTS = {"dense.vberkoz.com", "www.dense.vberkoz.com", "localhost", "127.0.0.1"}
PATH_RE = re.compile(r"^/(?:[A-Za-z0-9][A-Za-z0-9._/-]{0,78})?$")
HOST_RE = re.compile(
    r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$"
)
CC_RE = re.compile(r"^[A-Z]{2}$")


def _json_response(status, payload, cors=False):
    headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
    }
    if cors:
        headers["Access-Control-Allow-Origin"] = "*"
    return {"statusCode": status, "headers": headers, "body": json.dumps(payload)}


def sanitize_path(raw):
    if not isinstance(raw, str):
        return None
    p = raw.strip().split("?", 1)[0].split("#", 1)[0].strip()
    p = re.sub(r"/+", "/", p)
    if not p.startswith("/"):
        p = "/" + p
    if p in ("/index.html", "/index.htm"):
        p = "/"
    elif len(p) > 1 and p.endswith("/"):
        p = p.rstrip("/") or "/"
    if (
        len(p) > 80
        or ".." in p
        or p.startswith("/api")
        or p.startswith("/_cfn-artifacts")
        or not PATH_RE.match(p)
    ):
        return None
    return p


def extract_ref_host(payload, headers):
    if "ref" in payload:
        raw = payload.get("ref")
        raw = raw.strip() if isinstance(raw, str) else ""
    else:
        raw = (headers.get("referer") or "").strip()
    if not raw:
        return "direct"
    if "://" in raw:
        try:
            host = (urlparse(raw).hostname or "").lower()
        except ValueError:
            return "direct"
    else:
        host = raw.lower()
    host = host.rstrip(".")[:80]
    if not host or host in OWN_HOSTS or not HOST_RE.match(host):
        return "direct"
    return host


def classify_scheme(raw):
    s = str(raw or "").strip().lower()
    return s if s in ("dark", "light") else "unknown"


def extract_country(headers):
    cc = (headers.get("cloudfront-viewer-country") or "").strip().upper()
    return cc if CC_RE.match(cc) else "XX"


def extract_device(headers, payload):
    if (headers.get("cloudfront-is-tablet-viewer") or "").strip().lower() == "true":
        return "tablet"
    if (headers.get("cloudfront-is-mobile-viewer") or "").strip().lower() == "true":
        return "mobile"
    if (headers.get("cloudfront-is-desktop-viewer") or "").strip().lower() == "true":
        return "desktop"
    vw = payload.get("vw")
    if isinstance(vw, (int, float)) and not isinstance(vw, bool) and vw > 0:
        if vw < 768:
            return "mobile"
        if vw < 1024:
            return "tablet"
        return "desktop"
    return "desktop"


def extract_client_ip(headers, event):
    xff = (headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if xff:
        return xff
    return (event.get("requestContext", {}).get("http", {}).get("sourceIp") or "").strip()


def query_all(**kwargs):
    items = []
    while True:
        resp = table.query(**kwargs)
        items.extend(resp.get("Items", []))
        last_key = resp.get("LastEvaluatedKey")
        if not last_key:
            break
        kwargs["ExclusiveStartKey"] = last_key
    return items


def handle_collect(event, headers):
    raw_body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        try:
            body_bytes = base64.b64decode(raw_body, validate=True)
        except Exception:
            return _json_response(400, {"error": "invalid body"})
    else:
        body_bytes = raw_body.encode("utf-8")

    if len(body_bytes) > 2048:
        return _json_response(413, {"error": "payload too large"})

    try:
        payload = json.loads(body_bytes.decode("utf-8") if body_bytes else "{}")
    except Exception:
        return _json_response(400, {"error": "invalid json"})
    if not isinstance(payload, dict):
        return _json_response(400, {"error": "invalid payload"})

    path = sanitize_path(payload.get("path", "/"))
    if path is None:
        return _json_response(400, {"error": "invalid path"})

    ref = extract_ref_host(payload, headers)
    scheme = classify_scheme(payload.get("scheme"))
    cc = extract_country(headers)
    dev = extract_device(headers, payload)

    now_dt = datetime.now(timezone.utc)
    now_ts = int(now_dt.timestamp())
    day = now_dt.strftime("%Y-%m-%d")

    ip = extract_client_ip(headers, event)
    ua = headers.get("user-agent") or event.get("requestContext", {}).get("http", {}).get("userAgent", "")
    uv_hash = hashlib.sha256(f"{day}|{HASH_SALT}|{ip}|{ua}".encode("utf-8")).hexdigest()[:16]

    is_unique = True
    try:
        table.put_item(
            Item={"PK": f"UV#{day}", "SK": uv_hash, "ttl": now_ts + 48 * 3600},
            ConditionExpression="attribute_not_exists(PK)",
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") == "ConditionalCheckFailedException":
            is_unique = False
        else:
            raise

    ttl_365 = now_ts + 365 * 86400
    expr_names = {"#ttl": "ttl", "#views": "views"}
    add_parts = ["#views :one"]
    if is_unique:
        expr_names["#uniques"] = "uniques"
        add_parts.append("#uniques :one")
    if scheme == "dark":
        add_parts.append("s_dark :one")
    elif scheme == "light":
        add_parts.append("s_light :one")
    add_parts.append(f"d_{dev} :one")

    table.update_item(
        Key={"PK": "DAILY", "SK": day},
        UpdateExpression="ADD " + ", ".join(add_parts) + " SET #ttl = :ttl",
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues={":one": 1, ":ttl": ttl_365},
    )

    for pk, dim_val in (("DIM#P", path), ("DIM#R", ref), ("DIM#C", cc)):
        table.update_item(
            Key={"PK": pk, "SK": f"{day}#{dim_val}"},
            UpdateExpression="ADD #views :one SET #ttl = :ttl",
            ExpressionAttributeNames={"#views": "views", "#ttl": "ttl"},
            ExpressionAttributeValues={":one": 1, ":ttl": ttl_365},
        )

    iso_ms = now_dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{now_dt.microsecond // 1000:03d}Z"
    table.put_item(
        Item={
            "PK": "EVT",
            "SK": f"{iso_ms}#{secrets.token_hex(2)}",
            "path": path,
            "ref": ref,
            "cc": cc,
            "dev": dev,
            "scheme": scheme,
            "ttl": now_ts + 7 * 86400,
        }
    )

    return {"statusCode": 204, "headers": {"Cache-Control": "no-store"}, "body": ""}


def _agg_dim(items):
    counts = {}
    for item in items:
        sk = item.get("SK", "")
        if "#" not in sk:
            continue
        key = sk.split("#", 1)[1]
        counts[key] = counts.get(key, 0) + int(item.get("views", 0))
    return sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))[:25]


def handle_stats(event):
    qs = event.get("queryStringParameters") or {}
    try:
        days = int(qs.get("days", "14"))
    except (ValueError, TypeError):
        days = 14
    days = max(1, min(90, days))

    now_dt = datetime.now(timezone.utc)
    end_date = now_dt.date()
    start_date = end_date - timedelta(days=days - 1)
    start_str = start_date.isoformat()
    end_str = end_date.isoformat()

    daily_items = query_all(
        KeyConditionExpression=Key("PK").eq("DAILY") & Key("SK").between(start_str, end_str)
    )
    page_items = query_all(
        KeyConditionExpression=Key("PK").eq("DIM#P")
        & Key("SK").between(f"{start_str}#", f"{end_str}#\uffff")
    )
    ref_items = query_all(
        KeyConditionExpression=Key("PK").eq("DIM#R")
        & Key("SK").between(f"{start_str}#", f"{end_str}#\uffff")
    )
    country_items = query_all(
        KeyConditionExpression=Key("PK").eq("DIM#C")
        & Key("SK").between(f"{start_str}#", f"{end_str}#\uffff")
    )
    evt_items = table.query(
        KeyConditionExpression=Key("PK").eq("EVT"),
        ScanIndexForward=False,
        Limit=25,
    ).get("Items", [])

    daily_map = {}
    total_views = 0
    total_uniques = 0
    s_dark = 0
    s_light = 0
    d_desktop = 0
    d_mobile = 0
    d_tablet = 0

    for item in daily_items:
        sk = item["SK"]
        v = int(item.get("views", 0))
        u = int(item.get("uniques", 0))
        daily_map[sk] = (v, u)
        total_views += v
        total_uniques += u
        s_dark += int(item.get("s_dark", 0))
        s_light += int(item.get("s_light", 0))
        d_desktop += int(item.get("d_desktop", 0))
        d_mobile += int(item.get("d_mobile", 0))
        d_tablet += int(item.get("d_tablet", 0))

    daily = []
    for offset in range(days):
        d_str = (start_date + timedelta(days=offset)).isoformat()
        v, u = daily_map.get(d_str, (0, 0))
        daily.append({"date": d_str, "views": v, "uniques": u})

    pages = [{"path": k, "views": v} for k, v in _agg_dim(page_items)]
    referrers = [{"ref": k, "views": v} for k, v in _agg_dim(ref_items)]
    countries = [{"cc": k, "views": v} for k, v in _agg_dim(country_items)]
    schemes = {
        "dark": s_dark,
        "light": s_light,
        "unknown": max(0, total_views - s_dark - s_light),
    }
    devices = {
        "desktop": d_desktop,
        "mobile": d_mobile,
        "tablet": d_tablet,
    }
    recent = [
        {
            "ts": it.get("SK", "").split("#", 1)[0],
            "path": it.get("path", "/"),
            "ref": it.get("ref", "direct"),
            "cc": it.get("cc", "XX"),
            "dev": it.get("dev", "desktop"),
            "scheme": it.get("scheme", "unknown"),
        }
        for it in evt_items
    ]

    return _json_response(
        200,
        {
            "days": days,
            "start": start_str,
            "end": end_str,
            "generated_at": now_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "totals": {"views": total_views, "uniques": total_uniques},
            "daily": daily,
            "pages": pages,
            "referrers": referrers,
            "countries": countries,
            "devices": devices,
            "schemes": schemes,
            "recent": recent,
        },
        cors=True,
    )


def handler(event, context):
    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    http = event.get("requestContext", {}).get("http", {})
    method = (http.get("method") or "").upper()
    raw_path = event.get("rawPath") or http.get("path", "")

    if method == "POST" and raw_path == "/api/collect":
        return handle_collect(event, headers)
    if method == "GET" and raw_path == "/api/stats":
        return handle_stats(event)
    return _json_response(404, {"error": "not found"})
