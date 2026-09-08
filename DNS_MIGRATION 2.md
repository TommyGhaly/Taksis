# spsmwayland.org — DNS record inventory

Captured 2026-09-07, while nameservers were still `ns10/ns11.wixdns.net`.

The registrar is already Porkbun (transferred 2026-09-06). **The registrar
transfer did not move DNS** — nameserver delegation lives at the registry and
survived it. Moving DNS to Porkbun is a separate, optional decision.

If you keep the Wix nameservers, none of this migration is needed: just add the
Firebase records in Wix and skip to the last section.

## Do this as two changes, not one

1. Migrate DNS unchanged — recreate every record below in Porkbun, *including
   the existing Wix apex A records*, then flip the nameservers. Nothing about the
   setup changes. Verify email and the website.
2. Only then swap the apex A records to Firebase.

Combined, a failure is ambiguous: nameserver move or Firebase change? Separated,
each is independently verifiable and independently revertible.

Porkbun lets you create records before the nameservers point at it, so there is
no gap — populate everything first, then flip.

## Microsoft 365 — email and Teams

**Miss one of these and church email stops.** Bounced mail does not come back.

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `@` | `spsmwayland-org.mail.protection.outlook.com` | 10 |
| TXT | `@` | `v=spf1 include:spf.protection.outlook.com -all` | |
| TXT | `@` | `MS=ms48470416` | |
| CNAME | `autodiscover` | `autodiscover.outlook.com` | |
| CNAME | `enterpriseregistration` | `enterpriseregistration.windows.net` | |
| CNAME | `enterpriseenrollment` | `enterpriseenrollment.manage.microsoft.com` | |
| CNAME | `lyncdiscover` | `webdir.online.lync.com` | |
| CNAME | `sip` | `sipdir.online.lync.com` | |
| SRV | `_sip._tls` | `100 1 443 sipdir.online.lync.com` | |
| SRV | `_sipfederationtls._tcp` | `100 1 5061 sipfed.online.lync.com` | |

`MS=ms48470416` is the Microsoft tenant verification. The Taksis app uses
Microsoft sign-in against that tenant, so this is not only an email record.

No `_dmarc` record exists and no DKIM selectors (`selector1/2._domainkey`)
resolve, so DKIM signing appears to be off in M365. That is the state today —
not something lost in the migration.

## Other verification

| Type | Host | Value |
|---|---|---|
| TXT | `@` | `amazon-business-verification=f0832c4e910f1912ff93a4620d19ee025e0d3d9fc6697648e909975943e39434` |

## Website — stays on Wix

| Type | Host | Value |
|---|---|---|
| CNAME | `www` | `cdn3.wixdns.net` |

The church site lives at `www`. It stays on Wix regardless of who serves DNS.

## Apex — the only record Taksis changes

Currently Wix, which is why `/.well-known/*` returns a 301 to `www` and then a
400, and why the App Clip cannot be verified from this domain.

| | Value |
|---|---|
| Now (Wix) | `185.230.63.107`, `185.230.63.171`, `185.230.63.186` |
| After | the A records the Firebase console shows for the `spsmwayland` site |

Read Firebase's records off the console — do not copy them from documentation,
they change. Firebase also requires a TXT verification record before it issues
the certificate.

**Keep the Wix apex values above.** Pasting them back is the rollback.

No CAA record exists, so nothing blocks Firebase issuing a certificate.

## Verifying after any change

```bash
dig +short spsmwayland.org MX && dig +short spsmwayland.org TXT
```

```bash
curl -sS -o/dev/null -w '%{http_code} %{redirect_url}\n' https://www.spsmwayland.org/
```

Then send a test message to a church address and confirm it arrives. Email is
the one that matters most and the one nobody checks.

Once the apex is on Firebase, see `DEEP_LINKS.md` for the App Clip verification.
