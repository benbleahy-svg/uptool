# Postmark Inbound Webhook — Setup

This runbook covers setting up Postmark's inbound email processing so that shop owners can forward unknown customer RFQs to their ToolUp forwarding address.

## How it works

Each org has a unique forwarding address: `rfq+{slug}@in.toolup.de`.

When the shop owner receives a customer RFQ in a mailbox not connected to ToolUp, they forward it to that address. Postmark receives the email and posts it to the inbound webhook at `POST /api/inbound/postmark/forward`. ToolUp looks up the org by forwarding address and creates an RFQ row (`source = 'manual_forward'`).

## Postmark configuration

1. Log in to your Postmark account at https://account.postmarkapp.com
2. Navigate to **Servers → [your server] → Message Streams → Inbound**
3. Set the inbound domain to `in.toolup.de` (or whatever `BRAND.forwardingDomain` is set to)
4. Set the **Webhook URL** to: `https://your-domain.com/api/inbound/postmark/forward`
5. Under **Webhook security**, generate a secret token and set it in your env:
   ```
   POSTMARK_INBOUND_WEBHOOK_SECRET=<generated-secret>
   ```
6. Set the same secret as the HTTP header value that Postmark sends as `X-Postmark-Signature`

## DNS setup

Add an MX record for `in.toolup.de` pointing to Postmark's inbound MX:

```
in.toolup.de  MX  10  inbound.postmarkapp.com
```

## Environment variables

| Variable | Description |
|---|---|
| `POSTMARK_INBOUND_WEBHOOK_SECRET` | Webhook verification secret (set in Postmark + env) |
| `POSTMARK_FROM_DOMAIN` | Domain for outbound Postmark emails (e.g. `toolup.de`) |

## Local testing

Use a tool like `ngrok` to expose your local server:

```bash
ngrok http 3000
```

Then set the Postmark webhook URL to your ngrok URL and use `curl` to simulate a payload:

```bash
curl -X POST https://<ngrok-url>/api/inbound/postmark/forward \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Signature: <your-secret>" \
  -d '{
    "To": "rfq+acme@in.toolup.de",
    "From": "customer@example.com",
    "FromName": "Max Mustermann",
    "Subject": "Anfrage Halterung",
    "MessageID": "test-123"
  }'
```

Expected response: `{"ok": true}` and a new RFQ appears in `/acme/rfqs`.

## Notes

- If `POSTMARK_INBOUND_WEBHOOK_SECRET` is not set, the webhook skips verification (dev-only behaviour — always set the secret in production)
- If the `To` address doesn't match any org's forwarding address, the webhook returns `{"ok": true, "skipped": true}` — this is intentional so Postmark doesn't retry
- Full email ingestion (parsing body, creating contacts, attaching files) is implemented in Epic 1. This route only creates the bare RFQ row
