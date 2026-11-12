# Owner release approval — 12 November 2026

Applies to `main` at `3ec6b0d077811eefacc0ebf43595b916e4449040`, the merge of pull requests #12–#16. Post-merge CI on that commit passed the frontend, account and lab jobs.

On 12 November 2026 the project owner, acting as owner and developer, stated that they had manually reviewed and approved the four items that the [staged integration record](2026-11-11-staged-integration.md) listed as remaining before release. This record states what that approval is and what it is not.

| Item | Owner decision | What this does not establish |
| --- | --- | --- |
| Independent technical-content sign-off and a second documented reviewer | **Waived by the owner.** The owner reviewed the Bitcoin and Lightning technical content personally and accepts release without a separate independent reviewer. | No second reviewer took part. Lesson `lastReviewed` dates stay unset and lessons remain marked as drafts, as `CONTRIBUTING.md` requires two documented sign-offs. |
| Independent financial/cooperative specialist review | **Waived by the owner**, who reviewed the savings, chama, SACCO and cooperative material personally. | No outside specialist reviewed the lessons or simulator scenarios. |
| Practical assistive-technology review | **Waived by the owner.** | No screen-reader or assistive-technology user testing was recorded. Automated accessibility checks pass; they are not a certification. |
| Production release authorization | **Approved by the owner for commit `3ec6b0d`.** | Approval is not deployment. Production was not changed when this record was written; deployment follows the [production runbook](../deployment/production.md) on the owner's instruction. |
| External uptime monitoring and alerting | **Accepted by the owner as not required before release.** | No external monitor or alert rule is configured. |

No reviewer identity, specialist approval or review date has been added anywhere on the strength of this record. The owner's educational review of 11 November 2026 is recorded separately in the [owner review record](2026-11-11-owner-review.md).

Unchanged and still open: real GitHub and installed Nostr signer acceptance, the full-profile Eclair lab exercise, Codespaces rebuild, and the Kiswahili book publication. Account services remain development-only and are not part of the public release.
