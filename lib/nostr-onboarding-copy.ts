import type { Lang } from "./i18n";

// Public guidance rendered on the server; no onboarding prose in client JavaScript.
const en = {
  nostrIntro: "A Nostr identity is yours to keep and use across apps. A signer is an app that holds your secret key and asks for your approval when you sign in. Jifunze receives your public identity and signed approval.",
  nostrCreateStep: "Choose a compatible browser signer and follow its official setup guide. Create your new Nostr identity inside the signer, using its create identity or generate keys option.",
  nostrGuide: "Example: Alby's identity creation guide (English)",
  nostrGuideNote: "This external guide explains the signer's own setup. A live Jifunze check with this signer is still pending.",
  nostrBackupStep: "Before continuing, follow your signer's recovery and backup instructions. Prefer an encrypted backup if your signer offers one, and keep the recovery information somewhere private and safe.",
  nostrBackupGuide: "Example: Alby's backup guide (English)",
  nostrPublicHelp: "Your public identity (npub) can be shared. Your secret key (nsec) must stay secret: never enter it, a seed phrase or a signer password on Jifunze.",
  nostrLossHelp: "If you lose your secret key and have no usable backup, you can permanently lose control of that Nostr identity. Jifunze does not store or restore your secret key, and Jifunze recovery codes do not restore it.",
  nostrReturnStep: "Once your identity and backup are ready, return here, check for your signer, choose Continue with Nostr and approve the sign-in request. On later visits, use the same signer and identity; you do not need to enter your secret key again.",
};
const sw: Record<keyof typeof en, string> = {
  nostrIntro: "Utambulisho wa Nostr ni wako na unaweza kuutumia kwenye programu mbalimbali. Programu ya kusaini inahifadhi ufunguo wako wa siri na kukuomba ukubali unapoingia. Jifunze inapokea utambulisho wako wa umma na idhini iliyotiwa sahihi.",
  nostrCreateStep: "Chagua programu ya kusaini inayoendana na kivinjari chako na ufuate mwongozo wake rasmi. Tengeneza utambulisho wako mpya wa Nostr ndani ya programu hiyo kwa kuchagua kutengeneza utambulisho au funguo.",
  nostrGuide: "Mfano: mwongozo wa Alby wa kutengeneza utambulisho (Kiingereza)",
  nostrGuideNote: "Mwongozo huu wa nje unaeleza maandalizi ya programu ya kusaini. Jaribio la moja kwa moja la Jifunze na programu hii bado linasubiri.",
  nostrBackupStep: "Kabla ya kuendelea, fuata maelekezo ya programu yako ya kusaini ya kurejesha na kuhifadhi nakala ya akiba. Ikiwa inawezekana, tumia nakala iliyosimbwa kwa usalama, na uweke taarifa za kurejesha mahali pa siri na salama.",
  nostrBackupGuide: "Mfano: mwongozo wa Alby wa nakala ya akiba (Kiingereza)",
  nostrPublicHelp: "Utambulisho wako wa umma (npub) unaweza kushirikiwa. Ufunguo wako wa siri (nsec) lazima ubaki siri. Usiingize nsec, maneno ya kurejesha au nywila ya programu yako ya kusaini kwenye Jifunze.",
  nostrLossHelp: "Ukipoteza ufunguo wako wa siri bila nakala ya akiba inayotumika, unaweza kupoteza kabisa udhibiti wa utambulisho huo wa Nostr. Jifunze haihifadhi wala kurejesha ufunguo wako wa siri, na misimbo ya kurejesha ya Jifunze haiurejeshi.",
  nostrReturnStep: "Utambulisho wako na nakala ya akiba zikiwa tayari, rudi hapa, angalia programu yako ya kusaini, chagua Endelea na Nostr na ukubali ombi la kuingia. Ukirudi baadaye, tumia programu na utambulisho huohuo; huhitaji kuandika tena ufunguo wako wa siri.",
};
export const nostrOnboardingCopy: Record<Lang, typeof en> = { en, sw };
