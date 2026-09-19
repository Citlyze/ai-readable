# Recipe: Next.js

Each section maps to a check id in the report. Fix the highest-point failure first.

## noindex

`indexable` fails on a `noindex` meta tag, an `X-Robots-Tag: noindex` header, or an error status.

The usual cause is a preview-environment setting that shipped to production:

```ts
// app/layout.tsx or app/page.tsx
export const metadata = {
  robots: process.env.VERCEL_ENV === "production" ? { index: true, follow: true } : { index: false },
};
```

Check the value of `VERCEL_ENV` or your own flag in the production deployment. For headers, look in `next.config.js` `headers()` and in middleware for `x-robots-tag`. Vercel's Deployment Protection returns 401 on previews; pass the bypass header in CI (see [ci-setup.md](../ci-setup.md)) rather than disabling protection.

## metadata

`titleAndDescription` wants a title of at least 15 characters and a description of at least 50, on every page, not only the root layout.

```ts
// app/pricing/page.tsx
export const metadata = {
  title: "Acme Widget Pro pricing: base and extended plans",
  description: "Acme Widget Pro costs $129 for the base model and $199 with the extended battery. Both include a two-year warranty.",
};
```

Use `generateMetadata` for dynamic routes so the description reflects the entity on the page.

## headings

`singleH1` wants exactly one H1 with three or more words. Component libraries often render an H1 inside the logo or the hero and another inside the page body. Search the route's components for `<h1` and keep one.

`questionHeadings` wants at least two H2 or H3 headings phrased as the questions buyers ask. "How much does Acme Widget Pro cost?" beats "Pricing". Keep the wording the user already has where it is a question; rephrase labels, not claims.

## answers

`answerBlocks` counts headings followed immediately by a 25 to 90 word paragraph. Put the direct answer first, then the detail:

```tsx
<h2>How much does Acme Widget Pro cost?</h2>
<p>The base model costs $129 and the extended-battery model $199. Both include a two-year warranty and free shipping. Most workshops pick the base model; choose the extended battery only for off-grid work.</p>
```

A `<div>` wrapper around the heading is fine. A card grid where the heading and the paragraph sit in different components is not, because the paragraph is no longer the next text block.

## structured-data

`structuredData` wants JSON-LD naming the entity: Organization, Product, SoftwareApplication, Article, LocalBusiness, Person or BreadcrumbList. FAQPage alone earns nothing.

```tsx
// app/pricing/page.tsx
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Acme Widget Pro",
  brand: { "@type": "Organization", name: "Acme" },
  offers: [{ "@type": "Offer", price: "129", priceCurrency: "USD" }],
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {/* page */}
    </>
  );
}
```

Render it in a Server Component so it is in the initial HTML.

## formats

`extractableFormats` wants a table or at least three list items. Plan comparisons, feature matrices and specs belong in a real `<table>`, not a CSS grid of divs. A pricing grid built from `<div>` cards is invisible to this check and to most extractors.

## Content only after JavaScript

If the report's rendered gap fails, the page is a Client Component that fetches its content on mount. Move the fetch into a Server Component or `generateStaticParams`, and pass the data down as props. Pricing pulled from a billing API on the client is the classic case: fetch it on the server with revalidation instead.

```tsx
// app/pricing/page.tsx (Server Component)
export const revalidate = 3600;
export default async function Page() {
  const plans = await getPlans(); // runs on the server, content is in the HTML
  return <PricingTable plans={plans} />;
}
```

## Rerun

```bash
npx ai-readable https://example.com/pricing --render
```
