# Security policy

## Reporting a vulnerability

Email **hello@citlyze.com** with the subject "ai-readable security". Include the version, a minimal reproduction, and the impact as you understand it. You will get an acknowledgement within three working days and a fix or a mitigation plan within fourteen days for confirmed issues. Please do not open a public issue for security reports until a fix is released.

## Scope

`ai-readable` fetches URLs you give it, parses their HTML and robots.txt, optionally loads them in headless Chromium, and in CI posts a comment to your own pull request. Reports that matter most:

- Custom request headers (preview bypass tokens, basic auth) reaching a host other than the origin you pointed the tool at.
- Anything in a fetched page or robots.txt that can execute code in the CLI process, break out of the Playwright sandbox, or inject GitHub Actions workflow commands.
- Path handling in `--card`, the baseline and badge writers, or `init`.

Denial of service by pointing the tool at a slow or huge site is out of scope: fetches are byte-capped and time-bounded by design, and the user chooses the targets.

## Supported versions

The latest minor release. Older releases receive fixes only when the issue is critical.
