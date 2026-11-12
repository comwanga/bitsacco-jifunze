import type { Lang } from "./i18n.ts";

// Copy for the progress panel on the account page. Kept out of lib/account-copy.ts, which every account page
// loads: this module arrives only with the panel, after an account is confirmed. The Kiswahili is recorded in
// content/terminology-review.json: owner review confirmed 2026-11-12; actual review date unspecified.

const en = {
  syncLocal: "Progress is saved on this device.",
  syncConsent: "Progress is on this device only. It will join your account only if you choose to add it.",
  syncPending: "Progress is on this device; some changes are not yet confirmed as saved to your account.",
  syncExpired: "Account saving is paused because your session ended. Progress stays on this device.",
  syncHeading: "Progress on this device",
  syncWorking: "Saving your progress to your account…",
  syncSaved: "Your progress on this device is saved to your account.",
  syncOffline: "Your progress is safe on this device. It will be saved to your account when you are back online.",
  syncError: "Your progress is safe on this device, but it could not be saved to your account just now.",
  syncRetry: "Try again",
  syncAsk: "This device already has learning progress from before you signed in. Add it to your account?",
  syncAdd: "Add it to my account",
  syncNotNow: "Not now",
  syncSeparate: "The progress on this device is not being saved to your account. It stays on this device only.",
  syncOther: "This device holds the progress of a different account. It will not be mixed with yours, and your progress is not being saved from this device.",
  syncDownload: "Download a copy of it",
  syncReplace: "Use my account's progress on this device",
  syncReplaceWarn: "This removes the other account's progress from this device. Anything in it that was never saved to that account will be lost unless you download a copy first.",
  syncReplaceConfirm: "Remove it and use my progress",
  syncCancel: "Cancel",
};

export type SyncCopy = Record<keyof typeof en, string>;

const sw: SyncCopy = {
  syncLocal: "Maendeleo yanahifadhiwa kwenye kifaa hiki.",
  syncConsent: "Maendeleo yanahifadhiwa kwenye kifaa hiki pekee. Yataongezwa kwenye akaunti yako ukiamua kuyaongeza tu.",
  syncPending: "Maendeleo yamehifadhiwa kwenye kifaa hiki; baadhi ya mabadiliko bado hayajathibitishwa kuwa yamehifadhiwa kwenye akaunti yako.",
  syncExpired: "Kuhifadhi kwenye akaunti kumesitishwa kwa sababu kipindi chako kimeisha. Maendeleo yanabaki kwenye kifaa hiki.",
  syncHeading: "Maendeleo kwenye kifaa hiki",
  syncWorking: "Tunahifadhi maendeleo yako kwenye akaunti yako…",
  syncSaved: "Maendeleo yako kwenye kifaa hiki yamehifadhiwa kwenye akaunti yako.",
  syncOffline: "Maendeleo yako yako salama kwenye kifaa hiki. Yatahifadhiwa kwenye akaunti yako utakaporudi mtandaoni.",
  syncError: "Maendeleo yako yako salama kwenye kifaa hiki, lakini hayakuweza kuhifadhiwa kwenye akaunti yako kwa sasa.",
  syncRetry: "Jaribu tena",
  syncAsk: "Kifaa hiki tayari kina maendeleo ya kujifunza ya kabla hujaingia. Ungependa kuyaongeza kwenye akaunti yako?",
  syncAdd: "Yaongeze kwenye akaunti yangu",
  syncNotNow: "Si sasa",
  syncSeparate: "Maendeleo yaliyo kwenye kifaa hiki hayahifadhiwi kwenye akaunti yako. Yanabaki kwenye kifaa hiki pekee.",
  syncOther: "Kifaa hiki kina maendeleo ya akaunti nyingine. Hayatachanganywa na yako, na maendeleo yako hayahifadhiwi kutoka kwenye kifaa hiki.",
  syncDownload: "Pakua nakala yake",
  syncReplace: "Tumia maendeleo ya akaunti yangu kwenye kifaa hiki",
  syncReplaceWarn: "Hatua hii inaondoa maendeleo ya akaunti nyingine kwenye kifaa hiki. Chochote ambacho hakikuwahi kuhifadhiwa kwenye akaunti hiyo kitapotea usipopakua nakala kwanza.",
  syncReplaceConfirm: "Yaondoe na utumie maendeleo yangu",
  syncCancel: "Ghairi",
};

export const syncCopy: Record<Lang, SyncCopy> = { en, sw };
