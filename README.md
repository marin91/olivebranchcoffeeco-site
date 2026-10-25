# Olive Branch Coffee Co. — website

Phase 0 brochure site for **olivebranchcoffeeco.com**: home, menu, story, events, and
contact pages, plus a newsletter signup. No backend yet — see "Known gaps" below.

Stack: [Astro](https://astro.build) (static output) + React islands + Tailwind CSS,
targeting deployment on Azure Static Web Apps.

## Project structure

```
src/
  components/   Header, Footer, MobileNav (React island), NewsletterSignup (React island)
  layouts/      BaseLayout.astro — shared <head>, header, footer
  data/         site.ts (nav/contact info), menu.ts, events.ts — static content
  pages/        index, menu, story, events, contact, 404
public/         favicon.svg
staticwebapp.config.json   SWA routing / headers config (used once deployed to SWA)
```

Content (menu items, hours, event dates, contact info) lives in `src/data/*.ts` as
placeholder data — replace with the real menu, hours, and upcoming events before launch.

## Commands

| Command           | Action                                      |
| ------------------ | -------------------------------------------- |
| `npm install`      | Install dependencies                         |
| `npm run dev`       | Start local dev server at `localhost:4321`   |
| `npm run build`     | Build the static site to `./dist/`           |
| `npm run preview`   | Preview the production build locally         |

Node 20.20 is the version this was built and tested against. `npm create astro@latest`
now requires Node 22+; this project pins `astro@^5` and companion packages instead, which
support Node 18.20.8+/20.3.0+/22. Upgrade Node and these pins can move to the latest
Astro/React major versions.

## Known gaps (by design — Phase 0 only)

- **Newsletter signup** (`NewsletterSignup.tsx`) only validates the email format
  client-side and shows a thank-you message. It is **not wired to a real mailing list**.
  Before launch, connect it to an ESP (Mailchimp, ConvertKit, etc.) or to the Phase 1
  API once that exists.
- **Event booking** has no request form. The Events page points visitors to a `mailto:`
  link instead. The request-to-book form, owner approval flow, and deposit handling are
  Phase 1/2 per the project's `olive-branch-coffee-site` skill and are intentionally
  deferred — see that skill's `references/booking-system.md`.
- **Images** are placeholder olive-colored blocks (`bg-olive-200`), not real photography.
- `npm audit` reports some vulnerabilities in transitive dev dependencies pulled in by
  the Astro/Tailwind toolchain; review before shipping if that matters to you.

## Deployment (Azure Static Web Apps)

Per the project's hosting notes: connect this repo to an Azure Static Web App, with
`app_location: "/"`, `output_location: "dist"`, build command `npm run build`.
`staticwebapp.config.json` is already in place for the custom 404 page and baseline
security headers. DNS/custom domain setup for olivebranchcoffeeco.com is not yet
recorded — see the skill's `references/azure-hosting.md`.
