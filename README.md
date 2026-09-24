# tjklug.com

Personal site and blog of TJ Klug. Built with [Astro](https://astro.build) and React, deployed to GitHub Pages by GitHub Actions.

## Run it locally

Requires Node 22 or newer.

```sh
npm install
npx playwright install chromium webkit   # once, for the browser tests
npm run dev                               # http://localhost:4321, reloads on save
```

## Write a post

```sh
npm run new -- "Post title" --topic ai-engineering
```

This creates `src/content/posts/YYYY-MM-DD-slug.md` as a draft. Add the header image it names under `src/assets/img/`, write the post, and remove `draft: true` to publish. Drafts only show in `npm run dev`.

Front matter:

| Field         | Required | Notes                                                               |
| ------------- | -------- | ------------------------------------------------------------------- |
| `title`       | yes      |                                                                     |
| `date`        | yes      | Must match the date in the filename                                 |
| `topic`       | yes      | `ai-operations`, `ai-engineering` or `frontend-devops`              |
| `image`       | yes      | Relative path to the header image, e.g. `../../assets/img/slug.png` |
| `tags`        | no       | Lowercase, hyphenated                                               |
| `description` | no       | Search and link-preview text. Defaults to the first paragraph       |
| `featured`    | no       | `1`, `2` or `3`: position on the home page. Needs `stat`            |
| `stat`        | no       | `value` and `label` shown on the featured card                      |
| `draft`       | no       | `true` keeps it off the live site                                   |

Posts are served at `/posts/<slug>/`, the same URLs the old Jekyll site used. Posts can also be `.mdx` to embed React components.

## Checks

| Command             | What it runs                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm run check`     | Type check, front matter schema, ESLint, Prettier, markdownlint, unit tests, production build, link check |
| `npm run test:e2e`  | Playwright in Chromium, WebKit and a phone viewport, including axe accessibility checks in both themes    |
| `npm run test:perf` | Lighthouse CI against the built site with score and page-weight budgets                                   |
| `npm run check:all` | All of the above                                                                                          |
| `npm run format`    | Fix formatting and Markdown lint issues                                                                   |

Git hooks (installed by `npm install`): formatting and lint on staged files at commit, `npm run check` before push.

The link check (`scripts/check-links.mjs`) also confirms every URL from the old site's sitemap, listed in `tests/fixtures/legacy-urls.txt`, still resolves. Old category and archive pages redirect to the matching topic filter on the home page.

## Deploy

Pushing to `main` runs every check in `.github/workflows/site.yml` and deploys to GitHub Pages only if they pass. Pull requests run the same checks and attach the built site and test reports as artifacts.

## Layout

```text
src/content/posts/   posts (Markdown or MDX)
src/assets/img/      post images and the headshot, optimized at build time
src/data/site.ts     bio, links, experience and numbers for the home and About pages
src/components/      React islands (post table, theme toggle) and Astro components
src/pages/           routes, RSS feed (/feed.xml) and sitemap (/sitemap.xml)
tests/               unit tests, Playwright specs and the legacy URL list
```

## License

Code is MIT. Posts, images, the headshot and the bio text are all rights reserved. See [LICENSE](LICENSE).
