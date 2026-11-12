# Learner feedback

`Send Feedback` / `Tuma Maoni` is a normal email link in the header (where the account link used to be), in the shared footer and beside lesson/path navigation. Jifunze has no accounts, so nothing is needed to use it. It opens the learner's configured email application. Jifunze does not send an email, receive a feedback submission or load an email/analytics SDK.

Set the **public build-time** variable `JIFUNZE_FEEDBACK_EMAIL` to one plain mailbox address. The default is defined once in `lib/feedback.ts`. The recipient is visible in the exported HTML and mailto URL; the variable does not conceal it.

```powershell
$env:JIFUNZE_FEEDBACK_EMAIL = 'mwanga@bitsacco.com'
npm run build
```

For container builds use `docker build --build-arg JIFUNZE_FEEDBACK_EMAIL=...`; Compose forwards the same optional variable as a build argument. A runtime-only variable cannot change an already exported recipient: rebuild and review the artifact before any authorized deployment. Invalid multi-address/header/URL values fail the build. No API secret belongs in this variable.

Only public curriculum titles, language, learning-path/lesson paths and the build's canonical origin are included in contextual drafts. Current query strings/fragments, browser storage, progress and cookies are never read. The header link carries no page context at all. The generic footer link includes no lesson context. Contextual text links by the lesson/path navigation identify the relevant material without introducing another toolbar or competing primary button.

Feedback is a single plain link. Clicking it opens the learner's configured email application; it also works with keyboard activation and JavaScript disabled. There is no copy icon, address field, disclosure or helper text. Contextual drafts contain only the public path/lesson titles and canonical address, without extra instructions or translated field labels. The mail draft and any message sent remain under the learner's control.

The two action labels were explicitly supplied by the owner. On 13 November 2026 the owner requested this single-link interaction. The earlier helper/privacy wording and its pending terminology entry were removed rather than retained for approval.

Verification: `tests/feedback.test.ts` checks recipient validation/configuration and safe context encoding. `e2e/feedback.spec.ts` checks anonymous use, static-only context, keyboard activation, the absence of copy controls, no-script operation, accessibility and mobile overflow. It deliberately intercepts mailto activation instead of sending a test email. Actual OS mail-client configuration/delivery remains a manual acceptance step.
