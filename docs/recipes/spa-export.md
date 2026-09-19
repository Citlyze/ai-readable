# Recipe: single-page apps (Vite, Lovable, v0, Bolt, Create React App)

Sites exported from Lovable, v0 and Bolt are Vite React apps: `index.html` at the root with an empty `<div id="root">`, and everything rendered by JavaScript. To a crawler that does not run JavaScript, and most AI retrieval crawlers do not, the page is a title and an empty div.

`ai-readable --render` shows this as the rendered gap: "14 words in the initial HTML, 312 after JavaScript". The fix is to put the content into the HTML at build time.

## Option 1: prerender the routes at build time (smallest change)

Prerendering runs your app once per route at build time and writes the resulting HTML into `dist/`. The app still hydrates and behaves the same.

With Vite and React:

```bash
npm i -D vite-plugin-prerender
```

```ts
// vite.config.ts
import prerender from "vite-plugin-prerender";

export default defineConfig({
  plugins: [
    react(),
    prerender({
      routes: ["/", "/pricing", "/features"],
      renderer: "@prerenderer/renderer-puppeteer",
    }),
  ],
});
```

Any prerender plugin works; the important part is that `dist/pricing/index.html` contains the real headings and paragraphs after the build. Verify with:

```bash
npx ai-readable http://localhost:4173/pricing --render
```

## Option 2: move the marketing pages to static HTML or an SSG

If the app is a product behind a login and only a few pages are public, keep the app as it is and serve the public pages as static HTML: Astro, Next.js static export, or plain HTML files in `public/`. The public pages then need no JavaScript at all.

## Option 3: server-side rendering

For content that changes per request, move to a framework with SSR (Next.js, Remix, Nuxt, SvelteKit). This is the largest change and rarely needed for marketing pages.

## While you are in there

- **Metadata:** set a real `<title>` and `<meta name="description">` in `index.html` for the root, and per route through the prerenderer or a head manager. The exported default is usually the project name.
- **One H1:** hero components in generated apps often render an H1 for the logo and another for the headline. Keep the headline.
- **Question headings and direct answers:** "How much does it cost?" followed by a 25 to 90 word paragraph, in the HTML, not fetched from an API on mount.
- **Pricing from an API:** if plans come from a billing API or a CMS at runtime, fetch them at build time and inline them, or hard-code the public prices in the page. AI crawlers will never see the API response.
- **Structured data:** add a `<script type="application/ld+json">` with `Organization` or `Product` to `index.html`.
- **robots.txt:** exported apps ship none or a permissive one. That is fine. If a template added `Disallow: /` "for staging", remove it in production.

## Rerun

```bash
npx ai-readable https://example.com/pricing --render
```

The gap line should read close to 100% of rendered words present in the initial HTML.
