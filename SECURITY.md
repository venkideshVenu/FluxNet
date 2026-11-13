# Security policy

## Supported versions

Security fixes go into the latest release only. Please update to the newest
version from the [releases page](https://github.com/venkideshVenu/FluxNet/releases)
before reporting.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older releases | No        |

## Reporting a vulnerability

Please **don't** report security problems in public issues, discussions or pull
requests.

Report them privately through GitHub instead:

1. Open the [Security tab](https://github.com/venkideshVenu/FluxNet/security) of the repository.
2. Choose **Report a vulnerability**.
3. Describe the problem, the FluxNet and Windows versions affected, and the steps
   to reproduce it. A proof of concept helps a lot.

You can expect:

- an acknowledgement within 7 days;
- an assessment, and a fix plan if the report is confirmed, within 30 days;
- credit in the release notes when the fix ships, unless you'd rather stay
  anonymous.

Please give us a reasonable amount of time to release a fix before you disclose
the problem publicly.

## What FluxNet does on your machine

This helps you judge whether something is in scope:

- FluxNet runs as your user and needs no administrator rights. The installer
  installs it for the current user only.
- It reads your network adapters' traffic counters. It does not capture or
  inspect packets.
- Every 5 seconds it pings `1.1.1.1` (Cloudflare) to measure latency and packet
  loss. That is the only network traffic FluxNet itself creates.
- It has no telemetry, accounts or update checks. Usage history and settings
  stay on your PC, in `%APPDATA%\com.fluxnet.app`, and logs in
  `%APPDATA%\fluxnet\logs`.
- The interface runs in WebView2 with a restrictive Content Security Policy
  that loads only files bundled with the app.

Examples of issues we want to hear about: a way for a web page or another
local user to run code through FluxNet, the installer writing to places it
shouldn't, or FluxNet sending data anywhere other than the ping described
above.
