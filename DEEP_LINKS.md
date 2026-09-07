# `.well-known` — served at the apex of spsmwayland.org

Both files must return **HTTP 200 with no redirect**. Apple and Android both refuse
to follow one, and both fail silently when they do — no error surfaces in the app,
the link just quietly opens a browser instead.

This is why the apex moved from Wix to Firebase Hosting: Wix answered these paths
with a 301 to `www` and then a 400.

## Before the first deploy: fill in the Android fingerprints

`assetlinks.json` ships with deliberately invalid placeholders. Android App Links
will not verify until both are replaced with real SHA-256 fingerprints. Note that
`google-services.json` carries only SHA-1 values, which are not usable here.

- **Play App Signing** (the one that matters for installs from the Play Store):
  Play Console → Setup → App integrity → App signing → SHA-256 certificate fingerprint.
- **Upload key** (needed so locally-built APKs verify too):

  ```
  keytool -list -v -keystore credentials/android/keystore.jks -alias <alias> | grep SHA256
  ```

Include both. Omitting the upload key is the usual reason App Links verify in
production but not on a locally-installed build.

## Verifying after deploy

```
curl -sS -D- -o/dev/null https://spsmwayland.org/.well-known/apple-app-site-association
curl -sS -D- -o/dev/null https://spsmwayland.org/.well-known/assetlinks.json
```

Both want `200`, `content-type: application/json`, and no `location` header.

The AASA has no file extension on purpose; the content type comes from the
`headers` block in `firebase.json`.
