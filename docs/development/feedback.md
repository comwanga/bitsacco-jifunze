# Learner feedback

`Send Feedback` / `Tuma Maoni` is a normal email link, available without an account in the shared footer and beside lesson/path navigation. It opens the learner's configured email application. Jifunze does not send an email, receive a feedback submission or load an email/analytics SDK.

Set the **public build-time** variable `JIFUNZE_FEEDBACK_EMAIL` to one plain mailbox address. The default is defined once in `lib/feedback.ts`. The recipient is visible in the exported HTML, mailto URL and copy-address fallback; the variable does not conceal it.

```powershell
$env:JIFUNZE_FEEDBACK_EMAIL = 'mwanga@bitsacco.com'
npm run build
```

For container builds use `docker build --build-arg JIFUNZE_FEEDBACK_EMAIL=...`; Compose forwards the same optional variable as a build argument. A runtime-only variable cannot change an already exported recipient: rebuild and review the artifact before any authorized deployment. Invalid multi-address/header/URL values fail the build. No API secret belongs in this variable.

Only public curriculum titles, language, learning-path/lesson paths and the build's canonical origin are included in contextual drafts. Current query strings/fragments, browser storage, progress, account identifiers, keys, recovery codes and cookies are never read. The generic footer link includes no lesson context. Contextual text links by the lesson/path navigation identify the relevant material without introducing another toolbar or competing primary button.

The adjacent, labeled copy icon opens a native HTML disclosure with a selectable read-only email address. Select it and use the device's usual Copy action; keyboard users can focus the field and select all. This fallback works without JavaScript or clipboard permission and remains useful when no mail application is configured. It cannot automatically detect whether an OS email handler exists. The mail draft and any message sent remain under the learner's control; their email software may include their sender address/signature. Do not include passwords, recovery codes or private account information.

The two action labels were explicitly supplied by the owner. New Kiswahili helper/privacy wording is separately marked pending in `content/terminology-review.json`; the completed account/identity review is not treated as approval of newly written copy.

Verification: `tests/feedback.test.ts` checks recipient validation/configuration and safe context encoding. `e2e/feedback.spec.ts` checks anonymous use, static-only context, keyboard activation, a selectable fallback, no-script operation, accessibility and mobile overflow. It deliberately intercepts mailto activation instead of sending a test email. Actual OS mail-client configuration/delivery remains a manual acceptance step.
