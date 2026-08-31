# RAG Knowledge Base — Enterprise RAG UI

The **Angular 18** front end of a multi-tenant, retrieval-augmented generation platform.

The API lives in its own repository: **[uttor-ai-api](https://github.com/daud-cse/uttor-ai-api)**.
This app is a pure client — it holds no secrets and talks only to that service.

---

## Quick start

The API must be running on `http://localhost:5210` first.

```bash
npm install     # first run only
npm start       # ng serve on port 4300
```

Open <http://localhost:4300>.

`proxy.conf.json` forwards `/api` to the back end, so the browser sees a single origin and there is
no CORS to configure in development.

### Demo accounts — password `Passw0rd!`

| Account | Role | Sees |
|---|---|---|
| `admin@contoso.com` | Company Admin | Users, roles, audit log, all of the below |
| `knowledge@contoso.com` | Knowledge Admin | Company knowledge bases and documents |
| `user@contoso.com` | User | Chat only, Internal clearance |

Or create your own from the sign-up page: a **personal** workspace for one person, or a **company**
workspace where you invite colleagues.

---

## What the app does

| Area | Screen |
|---|---|
| Chat | Conversation rail with search, rename, delete and export; citations expand to show the source passage, page and score; thumbs up/down; regenerate; per-conversation file attachments |
| Knowledge | Company and personal knowledge bases, chunking and embedding settings |
| Documents | Upload with a live pipeline indicator (validate → extract → chunk → embed → index), per-document classification, versioning, re-index, and a chunk inspector showing exactly what retrieval can return |
| Chatbots | Prompt, model, temperature, token limits, and a Retrieval tab for top-K, reranking, hybrid search, query rewriting and the context budget, plus knowledge-base mapping with priority |
| Dashboard | Questions per day, answered-from-sources rate, latency, token usage, cost, feedback and the largest knowledge bases |
| Users & roles | The five-role ladder and per-user document clearance |
| Workspaces | Super-admin view of every company and personal tenant |
| Audit log | Every sign-in, upload, download, deletion and question, with the sources retrieved |

Navigation adapts to the workspace: a personal workspace hides "Users & roles", which would have
nothing to manage.

---

## Architecture

Standalone components with signals throughout — no NgModules, no state-management library.

```
src/app/
  core/       models, typed API client, auth + SSO services, HTTP interceptor, route guards, toasts
  shell/      sidebar, top bar, provider status
  pages/
    login/    sign-in, sign-up, Google and Microsoft SSO
    chat/     conversation rail, transcript, citations, composer
    admin/    dashboard, chatbots, knowledge bases, documents, users, workspaces, audit
```

- **`ApiService`** is the single place that knows the shape of the API, so components stay declarative.
- **`authInterceptor`** attaches the bearer token, and turns a 401 into a redirect to the login page.
- **Route guards** mirror the server's role ladder. They are a convenience, not a control: every rule
  is enforced again by the API, which never trusts anything the browser sends.

### Single sign-on

The browser obtains an **ID token** from Google or Microsoft and posts it to the API, which verifies
the signature against the provider's published keys before issuing an application session. The
client never sees a client secret, and asserting an email here proves nothing on its own.

Google renders its own button into a host element (its terms require this). Microsoft uses
`@azure/msal-browser` in a popup. Each button appears only when the API reports that provider as
configured.

---

## Build

```bash
npm run build       # production build into dist/ui
npm run watch       # rebuild on change
```

## Configuration

The UI has none worth speaking of, by design. The API endpoint comes from `proxy.conf.json` in
development; in production, serve `dist/ui` behind the same origin as the API, or point a reverse
proxy at it. Which identity providers appear, which models are offered and every retrieval setting
are all served by the API at runtime.
