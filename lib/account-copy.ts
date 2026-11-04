import type { ErrorCode } from "../api/src/errors.ts";
import type { Lang } from "./i18n.ts";

// Copy for the account pages only. Kept out of lib/i18n.ts, whose dictionary is bundled into every page's
// JavaScript, the same way lib/simulations/copy.ts is. The pages show this copy, keyed by the API's error
// code, and never the API's own message strings. Kiswahili and English are written separately; the shared
// terms are listed as pending in content/terminology-review.json.

type ErrorKeys = `error_${ErrorCode}`;

const errorsEn: Record<ErrorKeys, string> = {
  error_not_found: "We could not find that.",
  error_method_not_allowed: "That request is not accepted here. Reload the page and try again.",
  error_bad_origin: "The request was refused because it did not come from a Jifunze page. Reload the page and try again.",
  error_bad_request: "We could not understand what was sent. Check what you entered and try again.",
  error_payload_too_large: "What you sent is too long. Shorten it and try again.",
  error_unauthenticated: "You are not signed in, or your sign-in has expired. Please sign in again.",
  error_recovery_scope: "You signed in with a recovery code, so this step is not available yet. Replace your GitHub sign-in first.",
  error_reauth_required: "For your safety, confirm it is you by signing in with GitHub again first.",
  error_recovery_invalid: "That recovery code is wrong or has already been used. Check the letters and try again.",
  error_rate_limited: "Too many tries in a short time. Wait a few minutes, then try again.",
  error_state_invalid: "Sign-in took too long, or it was started again somewhere else. Please start again here.",
  error_github_denied: "You did not approve the request on GitHub, so you are not signed in. You can try again at any time.",
  error_github_failed: "GitHub did not respond as expected. Try again in a little while.",
  error_identity_in_use: "That GitHub account is already linked to a different Jifunze account. Use another GitHub account.",
  error_replace_conflict: "Another change to your account was happening at the same moment. Reload the page and try again.",
  error_codes_already_issued: "Your recovery codes were already shown once. If you did not save them, make new ones on your account page.",
  error_reauth_mismatch: "You confirmed with a different GitHub account. Use the GitHub account that is linked to your Jifunze account.",
  error_internal: "Something went wrong on our side. Please try again later.",
};

const en = {
  ...errorsEn,
  error_network: "We could not reach the account service. Check your internet connection and try again.",

  titleHome: "Account",
  titleSignin: "Sign in",
  titleWelcome: "Welcome",
  titleRecovery: "Account recovery",
  titleSignout: "Sign out",

  loading: "Checking your account…",
  retry: "Try again",
  signedOut: "You are not signed in.",
  signInLink: "Sign in",
  signOut: "Sign out",
  toAccount: "Go to your account",
  keepLearning: "Keep learning",
  optional: "Lessons, quizzes and the progress saved on this device all work without an account.",

  signinHeading: "Sign in to Jifunze",
  signinLead: "Sign in with your GitHub account. Jifunze only asks GitHub to confirm who you are. It gets no access to your repositories.",
  continueGithub: "Continue with GitHub",
  useRecoveryCode: "Use a recovery code",
  recoveryCodeHelp: "Lost access to GitHub? Enter one of the recovery codes you saved. Each code works only once.",
  recoveryCodeLabel: "Recovery code",
  recoveryCodeSubmit: "Sign in with this code",
  recoveryCodeEmpty: "Enter a recovery code.",
  checking: "Checking…",

  welcomeHeading: "Welcome to Jifunze",
  welcomeLead: "Your account is ready. Save these recovery codes now: they are your only way back in if you lose access to your GitHub account.",
  issuing: "Preparing your recovery codes…",
  codesHeading: "Your recovery codes",
  codesOnce: "We show these codes only once, and each one works a single time. Keep them somewhere private, such as a password manager or on paper.",
  copyCodes: "Copy",
  copied: "Codes copied.",
  copyFailed: "Copying did not work. Select the codes and copy them yourself, or download them.",
  downloadCodes: "Download (.txt)",
  fileTitle: "Bitsacco Jifunze recovery codes",
  fileNote: "Each code works once. Keep this file private.",
  savedConfirm: "I've saved them",
  savedHint: "Tick the box once your codes are saved.",
  continue: "Continue",

  homeHeading: "Your account",
  identityHeading: "Sign-in method",
  github: "GitHub",
  linkedOn: "Linked on",
  noticeCodeUsed: "A recovery code was used to sign in to your account on {date}. If that was not you, make new recovery codes now.",
  replacedGithub: "Your GitHub sign-in has been replaced. From now on, sign in with the new GitHub account.",
  recoveryActive: "You are signed in with a recovery code. Continue on the account recovery page.",
  toRecovery: "Continue recovery",
  codesSection: "Recovery codes",
  noCodesYet: "You do not have recovery codes yet. Make a set so you can get back in if you lose access to GitHub.",
  newCodesHelp: "Making new codes stops all your old ones from working. For your safety, GitHub will first ask you to confirm it is you.",
  newCodes: "New recovery codes",
  newCodesReady: "You have confirmed it is you. Make your new recovery codes now? Your old codes will stop working.",
  newCodesConfirm: "Generate new codes now",
  newCodesCancel: "Not now",
  newCodesWorking: "Making new codes…",
  newCodesDone: "Your new recovery codes are saved. Your old codes no longer work.",

  recoveryHeading: "Recover your account",
  recoveryLead: "You signed in with a recovery code. This session ends after 15 minutes and allows only a few steps.",
  replaceHeading: "Replace your GitHub sign-in",
  replaceHelp: "Link a GitHub account you can use, so you can sign in as usual again. It takes the place of the GitHub account linked now.",
  linkedNow: "Linked now",
  replaceGithub: "Replace GitHub",
  recoveryCodesHelp: "The code you just used will not work again. Make a new set so you have codes for next time. All your old codes will stop working.",
  notInRecovery: "You are fully signed in, so there is nothing to recover.",

  signingOut: "Signing you out…",
  signedOutDone: "You are signed out. Your lessons and the progress saved on this device are still here.",
  signInAgain: "Sign in again",
};

export type AccountCopy = Record<keyof typeof en, string>;

const sw: AccountCopy = {
  error_not_found: "Hatukupata ulichokuwa ukitafuta.",
  error_method_not_allowed: "Ombi la aina hii halikubaliki hapa. Pakia ukurasa upya kisha ujaribu tena.",
  error_bad_origin: "Ombi limekataliwa kwa sababu halikutoka kwenye ukurasa wa Jifunze. Pakia ukurasa upya kisha ujaribu tena.",
  error_bad_request: "Hatukuelewa kilichotumwa. Angalia ulichoandika kisha ujaribu tena.",
  error_payload_too_large: "Ulichotuma ni kirefu mno. Kifupishe kisha ujaribu tena.",
  error_unauthenticated: "Hujaingia, au muda wako wa kuingia umekwisha. Tafadhali ingia tena.",
  error_recovery_scope: "Umeingia kwa msimbo wa kurejesha, kwa hiyo hatua hii bado haipatikani. Badilisha akaunti ya GitHub kwanza.",
  error_reauth_required: "Kwa usalama wako, thibitisha kwanza kuwa ni wewe kwa kuingia tena kwa GitHub.",
  error_recovery_invalid: "Msimbo huu wa kurejesha si sahihi au umeshatumika. Angalia herufi kisha ujaribu tena.",
  error_rate_limited: "Umejaribu mara nyingi sana kwa muda mfupi. Subiri dakika chache, kisha ujaribu tena.",
  error_state_invalid: "Kuingia kulichukua muda mrefu, au kulianzishwa upya mahali pengine. Tafadhali anza tena hapa.",
  error_github_denied: "Hukukubali ombi kwenye GitHub, kwa hiyo hujaingia. Unaweza kujaribu tena wakati wowote.",
  error_github_failed: "GitHub haikujibu kama ilivyotarajiwa. Jaribu tena baada ya muda mfupi.",
  error_identity_in_use: "Akaunti hiyo ya GitHub tayari imeunganishwa na akaunti nyingine ya Jifunze. Tumia akaunti nyingine ya GitHub.",
  error_replace_conflict: "Badiliko jingine la akaunti yako lilikuwa likifanyika wakati huo huo. Pakia ukurasa upya kisha ujaribu tena.",
  error_codes_already_issued: "Misimbo yako ya kurejesha ilishaonyeshwa mara moja. Kama hukuihifadhi, tengeneza mipya kwenye ukurasa wa akaunti yako.",
  error_reauth_mismatch: "Ulithibitisha kwa akaunti tofauti ya GitHub. Tumia akaunti ya GitHub iliyounganishwa na akaunti yako ya Jifunze.",
  error_internal: "Kuna tatizo upande wetu. Tafadhali jaribu tena baadaye.",
  error_network: "Hatukuweza kufikia huduma ya akaunti. Angalia muunganisho wako wa intaneti kisha ujaribu tena.",

  titleHome: "Akaunti",
  titleSignin: "Ingia",
  titleWelcome: "Karibu",
  titleRecovery: "Kurejesha akaunti",
  titleSignout: "Toka",

  loading: "Tunaangalia akaunti yako…",
  retry: "Jaribu tena",
  signedOut: "Hujaingia kwenye akaunti.",
  signInLink: "Ingia",
  signOut: "Toka",
  toAccount: "Nenda kwenye akaunti yako",
  keepLearning: "Endelea kujifunza",
  optional: "Masomo, majaribio na maendeleo yaliyohifadhiwa kwenye kifaa hiki yote yanafanya kazi bila akaunti.",

  signinHeading: "Ingia kwenye Jifunze",
  signinLead: "Ingia kwa akaunti yako ya GitHub. Jifunze inaiomba GitHub ithibitishe wewe ni nani tu, na haipati ruhusa yoyote kwenye hazina zako.",
  continueGithub: "Endelea na GitHub",
  useRecoveryCode: "Tumia msimbo wa kurejesha",
  recoveryCodeHelp: "Huwezi tena kuingia kwenye GitHub? Andika mmojawapo wa misimbo ya kurejesha uliyohifadhi. Kila msimbo unatumika mara moja tu.",
  recoveryCodeLabel: "Msimbo wa kurejesha",
  recoveryCodeSubmit: "Ingia kwa msimbo huu",
  recoveryCodeEmpty: "Andika msimbo wa kurejesha.",
  checking: "Tunakagua…",

  welcomeHeading: "Karibu Jifunze",
  welcomeLead: "Akaunti yako iko tayari. Hifadhi misimbo hii ya kurejesha sasa: ndiyo njia yako pekee ya kurudi ukishindwa kuingia kwenye akaunti yako ya GitHub.",
  issuing: "Tunaandaa misimbo yako ya kurejesha…",
  codesHeading: "Misimbo yako ya kurejesha",
  codesOnce: "Tunakuonyesha misimbo hii mara moja tu, na kila msimbo unatumika mara moja. Iweke mahali pa siri, kama kwenye programu ya kuhifadhi nywila au kwenye karatasi.",
  copyCodes: "Nakili",
  copied: "Misimbo imenakiliwa.",
  copyFailed: "Imeshindikana kunakili. Chagua misimbo uinakili mwenyewe, au uipakue.",
  downloadCodes: "Pakua (.txt)",
  fileTitle: "Misimbo ya kurejesha ya Bitsacco Jifunze",
  fileNote: "Kila msimbo unatumika mara moja. Weka faili hii mahali pa siri.",
  savedConfirm: "Nimezihifadhi",
  savedHint: "Weka alama kwenye kisanduku ukishahifadhi misimbo yako.",
  continue: "Endelea",

  homeHeading: "Akaunti yako",
  identityHeading: "Njia ya kuingia",
  github: "GitHub",
  linkedOn: "Iliunganishwa tarehe",
  noticeCodeUsed: "Msimbo wa kurejesha ulitumika kuingia kwenye akaunti yako tarehe {date}. Kama si wewe, tengeneza misimbo mipya sasa.",
  replacedGithub: "Akaunti yako ya GitHub ya kuingia imebadilishwa. Kuanzia sasa, ingia kwa akaunti mpya ya GitHub.",
  recoveryActive: "Umeingia kwa msimbo wa kurejesha. Endelea kwenye ukurasa wa kurejesha akaunti.",
  toRecovery: "Endelea kurejesha akaunti",
  codesSection: "Misimbo ya kurejesha",
  noCodesYet: "Bado huna misimbo ya kurejesha. Tengeneza seti moja ili uweze kurudi ukishindwa kuingia kwenye GitHub.",
  newCodesHelp: "Ukitengeneza misimbo mipya, yote ya zamani itaacha kufanya kazi. Kwa usalama wako, GitHub itakuomba kwanza uthibitishe kuwa ni wewe.",
  newCodes: "Tengeneza misimbo mipya",
  newCodesReady: "Umethibitisha kuwa ni wewe. Utengeneze misimbo mipya ya kurejesha sasa? Misimbo ya zamani itaacha kufanya kazi.",
  newCodesConfirm: "Tengeneza misimbo mipya sasa",
  newCodesCancel: "Si sasa",
  newCodesWorking: "Tunatengeneza misimbo mipya…",
  newCodesDone: "Misimbo yako mipya imehifadhiwa. Misimbo ya zamani haifanyi kazi tena.",

  recoveryHeading: "Rejesha akaunti yako",
  recoveryLead: "Umeingia kwa msimbo wa kurejesha. Kipindi hiki kinaisha baada ya dakika 15 na kinaruhusu hatua chache tu.",
  replaceHeading: "Badilisha akaunti ya GitHub ya kuingia",
  replaceHelp: "Unganisha akaunti ya GitHub unayoweza kuitumia, ili uweze kuingia kama kawaida tena. Itachukua nafasi ya akaunti ya GitHub iliyounganishwa sasa.",
  linkedNow: "Iliyounganishwa sasa",
  replaceGithub: "Badilisha GitHub",
  recoveryCodesHelp: "Msimbo uliotumia sasa hivi hautafanya kazi tena. Tengeneza seti mpya ili uwe na misimbo kwa wakati ujao. Misimbo yako yote ya zamani itaacha kufanya kazi.",
  notInRecovery: "Umeingia kikamilifu, kwa hiyo hakuna cha kurejesha.",

  signingOut: "Tunakutoa kwenye akaunti…",
  signedOutDone: "Umetoka kwenye akaunti. Masomo yako na maendeleo yaliyohifadhiwa kwenye kifaa hiki bado yapo.",
  signInAgain: "Ingia tena",
};

export const accountCopy: Record<Lang, AccountCopy> = { en, sw };

/** The page's own message for an API error code, or "network" when the API could not be reached. */
export function errorText(lang: Lang, code: string | null | undefined): string {
  const copy = accountCopy[lang];
  const key = `error_${code}`;
  return Object.hasOwn(copy, key) ? copy[key as keyof AccountCopy] : copy.error_internal;
}
