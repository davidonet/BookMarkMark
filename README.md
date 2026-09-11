# BookMarkMark

A neo-brutalist sidekick to keep track of the books you hear about (from a friend, the radio, a
newsletter, a podcast…), order them from your local bookstore, and remember what you own.

**Stack:** SvelteKit 2 (Svelte 5), Tailwind CSS 4, MongoDB Atlas, Google Books API (Open Library
as a fallback), Vercel.

## The flow

1. **Search**: look a book up on [Google Books](https://books.google.com) by title, author or both,
   with covers, publisher and language. Editions in your language come first (French by default,
   see Settings). Other editions of a book you already track are flagged, so nothing is added twice.
   Tap results to select them, say where you heard about them, add them to the cart. Sources are
   free text; new ones are remembered and offered in the dropdown next time.
2. **Cart**: change the source (autosaved), or flag a book as **owned** (bought directly or
   through an online service) or **later** (a reason, remembered too, plus a free-text note).
3. **Email**: prepare one email for your bookstore (English or French, with ISBNs when known), edit
   it, open it in your mail app or copy it, then tap _I sent it_.
4. **Bookstore**: log the answer for each book: **confirmed** (then _Got it!_ once picked up)
   or **unavailable** (out of print, or not accessible to this bookstore).
5. **Owned** and **Later**: your shelf, and the books postponed with their reason. A postponed book
   can go back to the cart, or be marked as found elsewhere.

The whole app is behind a 4-digit PIN.

## Setup

```bash
pnpm install
vercel env pull .env.development.local   # MONGODB_URI, MONGO_DB, GOOGLEBOOKS_API_KEY…
pnpm dev
```

| Variable              | Required | Description                                                                |
| --------------------- | -------- | -------------------------------------------------------------------------- |
| `MONGODB_URI`         | yes      | MongoDB Atlas connection string                                            |
| `MONGO_DB`            | yes      | Database name                                                              |
| `APP_PIN`             | prod     | The 4-digit PIN. In `pnpm dev` it defaults to `1234` when unset.           |
| `GOOGLEBOOKS_API_KEY` | no       | Google Books API key. Without it, search uses Open Library.                |
| `AUTH_SECRET`         | no       | Signs the session cookie (defaults to a value derived from `MONGODB_URI`). |

Collections, indexes and the default sources / postpone reasons are created on first use.

### Book catalogs

Google Books needs a free API key (requests without one are refused): in the Google Cloud console,
enable the **Books API**, create an API key and restrict it to that API. The default quota is
1,000 requests a day, free; a search costs 2 requests (all editions + editions in your language).
If Google fails or the quota runs out, the search falls back to Open Library and says so.

## Deploy

The Vercel project `book-mark-mark` is connected to this GitHub repo: every push to `main` deploys
to production (<https://book-mark-mark.vercel.app>). Set the PIN once (environment variable changes
apply from the next deployment):

```bash
vercel env add APP_PIN production
```

Functions run in `cdg1` (Paris), next to the Atlas cluster (AWS eu-west-3), see `vite.config.ts`.

## Security notes

- The session is an HMAC-signed, HTTP-only cookie valid for 90 days. Changing `APP_PIN` signs every
  device out.
- Wrong PINs are rate-limited per IP: 5 tries, then a lockout that doubles each time (15 min → 24 h).
- A 4-digit PIN is light protection, fine for a reading list. Don't store secrets in it.

## Font

The design calls for [Neurath X](https://www.renebieder.com/fonts/neurath-x) (Studio René Bieder),
a commercial typeface. It is used automatically when installed on the device. With a webfont
licence, drop the files in `static/fonts/` and uncomment the `@font-face` rules at the top of
`src/routes/layout.css`. Until then, [Jost](https://fonts.google.com/specimen/Jost) (a free Futura
revival) and Space Mono stand in.

## Scripts

`pnpm dev` · `pnpm build` · `pnpm check` (types) · `pnpm lint` · `pnpm format`
