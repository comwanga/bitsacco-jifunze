# Documentation

Start with the [project README](../README.md) for learning paths, features and local development.

## Current guides

- [11 November platform audit](audit/2026-11-11-platform.md): baseline, classified evidence, implementation, validation and remaining gates. [Curriculum design and sources](audit/2026-11-11-curriculum.md) includes the Savers specialization map and required discussion approach.

- [Contributing](../CONTRIBUTING.md): content format, checks, translation and technical-review policy.
- [Production operations](deployment/production.md): accepted release, Railway/DNS, deployment, rollback, monitoring and scaling.
- [Staging safeguards](deployment/railway-staging.md): deployed baseline and separate authentication acceptance gates; older ingress evidence is labelled within the document.
- [Lightning lab](../lab/README.md): demonstrated local WSL2/Docker setup, pairing and the separate Codespaces limitation.
- [Account development](development/accounts.md): local compatibility stack and retained security/logging requirements; accounts are unavailable in public production.
- [English book provenance and reproduction](deployment/mastering-bitcoin-generated.md): official source revision, license, generation, completeness checks and rendering limits. See also the [artifact manifest](../public/books/mastering-bitcoin-en-3rd-edition.source.json).
- Performance limits: [general build budgets](../lib/build/budget.ts), [per-page UX budgets](../lib/build/ux-budget.ts) and [activated browser measurements](../e2e/budget.spec.ts). The original 100 KiB JavaScript aspiration remains unmet by the React/Next runtime. The November audit records a measured increase of the general ceiling from 150 to 151 KiB; learner-page, lab, activated-simulation and first-lesson limits remain unchanged.
- [Attributions](../ATTRIBUTIONS.md), [software license](../LICENSE), [curriculum license](../content/LICENSE), [font notices](../scripts/books/font-notices.txt) and [MathJax notice](../scripts/books/mathjax-LICENSE.txt).

The project owner's educational review of this expansion is complete, dated 11 November 2026. The [owner review record](audit/2026-11-11-owner-review.md) covers Kiswahili, Bitcoin, finance, community/cooperative savings and documentation, without inventing formal dual sign-offs. Independent technical-content sign-off remains outstanding before a launch announcement. Account-provider acceptance and the pending Kiswahili book remain separate from anonymous public learning.

## Historical records

These records preserve decisions, measured results and unresolved limitations at their stated commits. They are not deployment instructions or promises that proposed features are available. Historical hostnames, budgets and “not yet deployed” statements must be read in that context.

- [Original two-roadmap v1 proposal](history/v1-spec.md).
- [Lightning design](superpowers/specs/2026-11-03-lightning-lab-design.md); the current lab guide records the actual topology and security limits.
- [Phase 1 UX design](superpowers/specs/2026-11-03-phase-1-ux-design.md) and [implementation/completion record](superpowers/plans/2026-11-03-phase-1-ux.md).
- [Phase 2 UX design](superpowers/specs/2026-11-03-phase-2-ux-design.md) and [implementation report](superpowers/reports/2026-11-03-phase-2-ux-implementation.md): learning trees, simulation scope, offline and performance evidence.
- [Account/community design](superpowers/specs/2026-11-04-phase-3-design.md), [GitHub/session/recovery contract](superpowers/plans/2026-11-04-phase-3-increment-2a.md), and [investigations](superpowers/spikes/2026-11-04-phase-3/README.md). The latter's scripts and [permanent fixture provenance](../api/test/fixtures/README.md) retain authentication/privacy evidence; not all proposals were implemented or released.
- Nostr [execution decisions](superpowers/plans/2026-11-04-phase-3-increment-2b.md), [implementation report](superpowers/plans/2026-11-04-phase-3-increment-2b-report.md) and [review corrections](superpowers/plans/2026-11-04-phase-3-increment-2b-review-fixes.md): custody boundaries, test provenance and outstanding real-signer acceptance.
- Public release [preparation](deployment/public-release.md), [online-only candidate review](deployment/final-release-review.md), [book artifact search](deployment/mastering-bitcoin-sources.md) and [local PDF integration review](deployment/mastering-bitcoin-integration-review.md). Current production and book guides supersede their pending-publication/deployment statements.

Superseded implementation checklists were removed where retained designs and reports cover their useful guidance. Their original text remains in [the production release history](https://github.com/comwanga/bitsacco-jifunze/tree/39fa78a34deece8f3ed6eedd162725557de9829e/docs/superpowers/plans). Security decisions, actual test reports, licenses and resource provenance were retained. Other historical records stay at their existing paths to preserve references; the v1 proposal moved out of the repository root.
