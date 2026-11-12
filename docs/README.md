# Documentation

Start with the [project README](../README.md) for the learning paths, feedback and local development.

- [Contributing](../CONTRIBUTING.md): bilingual lessons, schemas, quizzes, exercises and reviewer policy.
- [Curriculum and content review](content-guide.md): implemented specializations, primary sources, required discussion and current review status.
- [Production operations](deployment/production.md): deployed commit, isolation, exact-commit deployment, rollback and live acceptance.
- [Staging operations](deployment/railway-staging.md): current services, allowlist/proxy state and controlled web deployment.
- [Lightning lab](../lab/README.md): the learner's local Docker/WSL2 lab and connection instructions.
- [Feedback](development/feedback.md): the plain email link and its public build-time recipient.
- [Retained API maintenance](development/retained-api.md): unused API checks and security/logging constraints; no learner account interface.
- [English book provenance and reproduction](deployment/mastering-bitcoin-generated.md): source revision, license, artifact verification and generation. The [source manifest](../public/books/mastering-bitcoin-en-3rd-edition.source.json) identifies the published PDF.
- [Attributions](../ATTRIBUTIONS.md), [code license](../LICENSE), [curriculum license](../content/LICENSE), [font notices](../scripts/books/font-notices.txt) and [MathJax notice](../scripts/books/mathjax-LICENSE.txt).

## Performance

The source definitions are the authority for current limits: [build budgets](../lib/build/budget.ts) and [per-page UX budgets](../lib/build/ux-budget.ts). Run `npm run build` and `npm run check:ux-budget`; CI also checks activated simulation chunks with [browser measurements](../e2e/budget.spec.ts). The 151 KiB general JavaScript ceiling includes the measured curriculum-navigation allowance; stricter learner-page UX limits remain unchanged. The original 100 KiB aspiration is a warning threshold, not an achieved runtime size.

## Documentation maintenance

Current guides describe the account-free application. Completed implementation plans, superseded release proposals, obsolete investigation artifacts and old audit files have been removed. Their original versions remain in Git history. Keep the operating guides, source/license provenance and content-review references current instead of adding duplicate dated checklists.
