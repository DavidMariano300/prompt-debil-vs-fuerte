# Weak Prompt vs. Strong Prompt

A controlled **prompt engineering** experiment: same task, same model, two different instructions. The result is two applications that **work the same** but are miles apart in terms of being ready to deploy.

> **The thesis:** the model doesn't guess your quality standards. Whatever you don't explicitly ask for (logging, configuration validation, error handling, documentation) simply doesn't appear.

![Login screen of ./Debil (left) and ./Fuerte (right)](img/debil_vs_fuerte.png)

**Technologies:** Node.js, Express, JWT, bcrypt, SQLite, HTML/CSS and Tailwind CSS; presentation built with Reveal.js.

`Debil` holds the weak-prompt result and `Fuerte` the strong-prompt result. The apps, [`HALLAZGOS.md`](HALLAZGOS.md), [`PROMPTS.md`](PROMPTS.md) and the presentation are in Spanish.

---

## ⚠️ Security notice

**`./Debil` contains deliberately deficient code and is published only as teaching material.** Don't copy it, use it as a template or deploy it. Its flaws are documented on purpose in [`HALLAZGOS.md`](HALLAZGOS.md).

Neither folder contains real credentials: the `.env` files are excluded from the repository and their original values were sample strings.

---

## The experiment

Both projects solve the same brief: a web application with **JWT sign-up and login, passwords hashed with bcrypt, a SQLite database and a protected dashboard** that lists registered users.

| | `./Debil` | `./Fuerte` |
|---|---|---|
| Lines of code | 534 | 993 |
| Backend lines | 118 | 379 |
| `console.*` statements in backend | **1** | **37** |
| `try/catch` blocks in routes | **0** | **4** |
| Documentation | none | 71-line README |
| Comments / JSDoc | none | on every exported function |
| Port | 3002 | 3003 |

---

## The four main findings

**1. Observability: the starkest difference.**
`./Debil` prints **a single line** in its entire lifecycle: the startup message. You can't tell who logged in, what failed or when. `./Fuerte` logs every HTTP request with timestamp and IP, every SQL query and every security event (`[AUTH]`, `[SECURITY ALERT]`, `[SERVER ERROR]`).

**2. Configuration: failing early vs. failing in production.**
`./Debil` uses `process.env.JWT_SECRET` without validating it: it starts fine even without `.env`, then crashes with a 500 on the first login. `./Fuerte` checks the variable at startup and refuses to run, with a clear message.

**3. Error handling: no safety net.**
`./Debil` doesn't have a single `try/catch` in its routes, so any database failure escapes to Express and exposes the stack trace. `./Fuerte` wraps every endpoint and adds an error middleware and a JSON 404 for `/api`.

**4. Interface: generic template vs. product.**
`./Debil` uses plain HTML with 183 lines of handwritten CSS and no loading states, so the login button can be pressed repeatedly. `./Fuerte` uses Tailwind with a dark theme, a spinner, buttons that disable themselves, metric cards and an explicit notice when the session expires.

### What is NOT different

To keep the comparison honest, here is where they tie:

- Both use **bcrypt with a salt of 10** and never store plain-text passwords.
- Both use **parameterized queries**, so neither is vulnerable to SQL injection.
- Both **escape HTML** before rendering server data, so neither is vulnerable to XSS.
- Both pin versions with `package-lock.json` v3.
- **Neither** includes a `.env.example`.

One nuance goes against the headline: in folder organization, `./Debil` is *better* separated (`routes/`, `middleware/`, `db/`) than the monolithic `server.js` in `./Fuerte`. What it lacks is substance inside that structure. The full analysis is in [`HALLAZGOS.md`](HALLAZGOS.md).

---

## Presentation

[`presentacion.html`](presentacion.html) has 6 slides (Reveal.js + Tailwind, dark theme). Navigate with the arrow keys. Open it directly in a browser; it needs an internet connection because it loads its libraries from a CDN.

---

## Try it yourself

Three experiments make the difference obvious:

### 1. Remove the configuration

```bash
cd Fuerte && mv .env .env.bak && npm start
```

`./Fuerte` refuses to start: `[CONFIG ERROR] Falta la variable JWT_SECRET`. Do the same in `./Debil`: it starts normally and only fails, with an opaque 500, when someone tries to log in.

### 2. Watch the console during a login

Register a user and log in to each app while watching the terminal. In `./Debil` nothing moves. In `./Fuerte` you'll see the full request trace, the SQL query and the JWT generation.

### 3. Use an invalid token

```bash
curl -i http://localhost:3003/api/users -H "Authorization: Bearer token-falso"
```

`./Fuerte` returns 401, distinguishes whether the token expired and leaves a `[SECURITY ALERT]` in the log. `./Debil` returns a generic 401 and logs nothing.

---

## Getting started

Each project is independent. The `.env` files are **not** in the repository (on purpose), so you need to create them:

```bash
cd Debil
npm install
printf 'PORT=3002\nJWT_SECRET=%s\nJWT_EXPIRES_IN=1h\n' "$(openssl rand -hex 32)" > .env
npm start   # http://localhost:3002
```

```bash
cd Fuerte
npm install
printf 'PORT=3003\nJWT_SECRET=%s\nJWT_EXPIRES_IN=1h\n' "$(openssl rand -hex 32)" > .env
npm start   # http://localhost:3003
```

Both create their SQLite database on first run. They can run at the same time, since they use different ports.

| Variable | Description | `Debil` | `Fuerte` |
|---|---|---|---|
| `PORT` | Server port | `3002` | `3003` |
| `JWT_SECRET` | Key used to sign tokens | required | required (validated at startup) |
| `JWT_EXPIRES_IN` | Token lifetime | `1h` | `1h` |

---

## Structure

```
├── Debil/            Weak prompt result   (534 lines)
├── Fuerte/           Strong prompt result (993 lines)
├── presentacion.html 6-slide comparison
├── HALLAZGOS.md      Detailed technical analysis, with file and line references
├── PROMPTS.md        The two prompts behind each project
└── README.md
```

---

## Methodology

The analysis came from reading the full source code of both projects. The metrics (lines, `console.*` statements, `try/catch` blocks, package counts) were measured with `wc`, `grep` and the `package-lock.json` files, not estimated. Every claim in [`HALLAZGOS.md`](HALLAZGOS.md) points to a specific file and line so you can verify it.
