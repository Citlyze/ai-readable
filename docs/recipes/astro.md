# Recipe: Astro

Astro ships HTML by default, so most failures here are content structure, not rendering. Section names match the check ids.

## noindex

Search `src/` for `noindex` and check `astro.config.*` for adapters that add headers. A `<meta name="robots" content="noindex">` in a shared `BaseHead.astro` guarded by `import.meta.env.PROD` is the usual leak: confirm the production build sets `PROD` the way you expect.

## metadata

Every page needs its own title and description. If you use a layout, pass them as props and render them in `<head>`:

```astro
---
// src/layouts/Base.astro
const { title, description } = Astro.props;
---
<head>
  <title>{title}</title>
  <meta name="description" content={description} />
</head>
```

Content collections: put `title` and `description` in the frontmatter schema and make `description` required, so a missing one fails the build instead of the check.

## headings

One H1 per page, with three or more words. In Markdown content, the H1 usually comes from `title` in the layout; make sure the Markdown body does not start with another `# Heading`.

Rephrase H2 and H3 labels as questions where a question is what they answer: "Pricing" becomes "How much does it cost?".

## answers

Under each question heading, write a direct 25 to 90 word paragraph first. In Markdown that is simply the first paragraph after the heading; keep it as a paragraph, not a list or a callout component.

## structured-data

```astro
---
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: frontmatter.title,
  author: { "@type": "Organization", name: "Acme" },
};
---
<script type="application/ld+json" set:html={JSON.stringify(jsonLd)} />
```

`set:html` avoids escaping. Put it in the layout so every page carries entity markup.

## formats

Markdown tables render as `<table>`, which the check counts. Comparison content that lives in a custom card component does not; add a table or at least a three-item list.

## Content only after JavaScript

If the rendered gap fails on an Astro site, an island with `client:only` is rendering the content. Change it to `client:load` or `client:visible` so the HTML is server-rendered and the component hydrates, or move the content out of the island entirely.

## Rerun

```bash
npx ai-readable https://example.com/docs/setup --render
```
