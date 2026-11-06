# Contributing to Bitsacco Jifunze

Karibu! Translations, fixes and new lessons all arrive as ordinary pull requests. Every change reaches readers only after review and a green CI run.

## Quick start

```bash
gh repo fork comwanga/bitsacco-jifunze --clone
cd bitsacco-jifunze
npm ci
npm ci --prefix api # dependencies for repository checks; does not start an API server
git switch -c content/my-change
# edit files in content/
npm run validate
npm run check
```

Open a pull request that says **what** changed, **why**, and **how you checked it**.

## Licence agreement

Code is MIT. Everything in `content/` is CC BY-SA 4.0. By opening a pull request that changes `content/`, you agree that your lessons and translations are released under CC BY-SA 4.0. Only contribute text you wrote yourself or are allowed to share under that licence, and credit adapted sources (see below).

## Adding or translating a lesson

Each lesson has one file per language with the same slug:

```
content/<roadmap>/sw/<slug>.mdx
content/<roadmap>/en/<slug>.mdx
```

Add the slug to `content/roadmaps/<roadmap>.json`. If only one language is ready, set `translationPending: true` in that file's front matter; readers of the other language see it with a "translation coming" notice.

### Front matter

| Field | Required | Notes |
| --- | --- | --- |
| `title`, `description` | yes | In the file's language |
| `level` | yes | `beginner`, `intermediate` or `advanced` |
| `minutes` | yes | Whole number |
| `objectives` | yes | List; quote any item that contains `: ` |
| `resources` | yes | Each has `title`, `url` (https or a site path), `kind`, `language`, optional `note` |
| `reflection` | yes | Prompts shown after the lesson |
| `source` | yes | `type: original`, or `type: adapted` with `from`, `url`, `licence`, `credit` |
| `translationOf` | no | The language this file was translated from |
| `lastReviewed` | no | `YYYY-MM-DD`, set by a reviewer when they sign off |
| `translationPending` | no | `true` when the other language is missing |
| `terms` | no | Glossary ids shown as key terms |

### In the body

- `<Term id="seed-phrase" />` shows a glossary term in the lesson's language and links to the glossary. Use `<Term id="wallet">Pochi</Term>` to control the wording, for example at the start of a sentence.
- `<Callout type="tip|warning|scam" title="...">...</Callout>` for boxed notes.
- End with a `## Try it` / `## Jaribu` activity. The reader adds the reflection, quiz and resources itself.

### Quizzes

`content/quizzes/<roadmap>/<slug>.json` holds about 4 questions with `prompt`, `options` (each with an `id` and `label`), `answer` and `explanation`, all bilingual.

## Glossary consistency

`content/glossary.json` pairs each Kiswahili term with its English term. In Kiswahili lessons, use the Kiswahili term (for example *maneno ya siri*, not "seed phrase"). `npm run validate` warns when it spots the English term in Kiswahili prose. Add new terms to the glossary rather than inventing a different word in one lesson.

## What CI checks

1. Every lesson exists in both `sw` and `en`, or is marked `translationPending`.
2. Front matter matches the schema, and every roadmap entry and prerequisite points to a real lesson.
3. Every quiz answer is one of its options, and every resource link is well formed (https).
4. Adapted lessons name their source and licence.
5. Glossary terms are used consistently. This is a warning, not a failure.

Then lint, typecheck, unit tests, the static build, a link check, CSP generation and the performance budget.

## Reviewers

Each lesson needs two sign-offs before `lastReviewed` is set:

- a **Kiswahili reviewer** for wording and clarity, and
- a **technical reviewer** for accuracy.

Lessons explain how things work. They must never give financial or investment advice, promise returns, or tell readers what to buy.

## Code

Keep client JavaScript small: the site must work on low-end Android phones over 3G. Run `npm run build` and check the budget table before opening a PR that adds client code.

## Adding a Lightning lab exercise

1. In the lesson (`content/lightning/{sw,en}/<slug>.mdx`), add `<Exercise id="chNN-short-name" />` where it belongs.
2. Create `content/lightning/exercises/chNN-short-name.json` with `id`, `lesson` (the slug), bilingual `title`, `node` (`alice`, `bob`, `chan`, `dina`, `erin` or `none`), `tab` (`cli` or `python`), optional `"profile": "full"`, a `starter` for the tab, and a working `solution`.
3. Add a check in `lab/jifunze_lab/checks/` and register it in that module's `CHECKS`. A check returns results with bilingual labels. Prefer checking node state over matching output.
4. Make sure the lesson has a scenario in `lab/scenarios/<slug>.json` (usually `{ "base": "route" }`).
5. With the lab up, run `JIFUNZE_LAB_TOKEN="$(lab/lab pair --raw)" python3 lab/tests/smoke_solutions.py --only chNN-short-name`. CI runs every exercise this way.

`npm run validate` (rule 6) fails if an `<Exercise>` has no file, its `lesson` doesn't match, it has no starter for its tab, or it has no check.
