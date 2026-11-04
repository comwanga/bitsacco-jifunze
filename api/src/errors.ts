export type ErrorCode =
  | "nostr_invalid"
  | "nostr_expired"
  | "challenge_invalid"
  | "nostr_lifecycle_pending"
  | "not_found"
  | "method_not_allowed"
  | "bad_origin"
  | "bad_request"
  | "payload_too_large"
  | "unauthenticated"
  | "recovery_scope"
  | "reauth_required"
  | "recovery_invalid"
  | "rate_limited"
  | "state_invalid"
  | "github_denied"
  | "github_failed"
  | "identity_in_use"
  | "replace_conflict"
  | "codes_already_issued"
  | "reauth_mismatch"
  | "internal";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  constructor(status: number, code: ErrorCode) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

export const MESSAGES: Record<ErrorCode, { sw: string; en: string }> = {
  nostr_invalid: { sw: "Sahihi ya Nostr si halali kwa ombi hili. Tafadhali jaribu tena.", en: "The Nostr signature is not valid for this request. Please try again." },
  nostr_expired: { sw: "Muda wa ombi la kuingia umekwisha. Tafadhali anza tena.", en: "The sign-in request has expired. Please start again." },
  challenge_invalid: { sw: "Ombi la kuingia limekwisha au si halali kwenye kivinjari hiki. Tafadhali anza tena.", en: "The sign-in request has expired or is not valid in this browser. Please start again." },
  nostr_lifecycle_pending: { sw: "Kubadilisha njia ya kuingia ya Nostr bado hakupatikani. Unaweza kutoka na kuendelea kujifunza.", en: "Replacing a Nostr sign-in method is not available yet. You can sign out and keep learning." },
  not_found: {
    sw: "Hatukupata ukurasa au kitu ulichotafuta.",
    en: "We could not find what you were looking for.",
  },
  method_not_allowed: {
    sw: "Njia hii haikubali ombi la aina hii.",
    en: "This address does not accept that kind of request.",
  },
  bad_origin: {
    sw: "Ombi hili halikutoka kwenye tovuti yetu, kwa hiyo limekataliwa.",
    en: "This request did not come from our site, so it was refused.",
  },
  bad_request: {
    sw: "Ombi lako halieleweki. Tafadhali angalia taarifa ulizotuma na ujaribu tena.",
    en: "We could not understand your request. Please check what you sent and try again.",
  },
  payload_too_large: {
    sw: "Taarifa ulizotuma ni nyingi mno.",
    en: "What you sent is too large.",
  },
  unauthenticated: {
    sw: "Tafadhali ingia kwanza ili uendelee.",
    en: "Please sign in first to continue.",
  },
  recovery_scope: {
    sw: "Umeingia kwa njia ya kurejesha akaunti, ambayo inaruhusu hatua chache tu. Weka kitambulisho kipya cha kuingia kwanza.",
    en: "You signed in through account recovery, which allows only a few actions. Please set up a new way to sign in first.",
  },
  reauth_required: {
    sw: "Kwa usalama wako, tafadhali thibitisha tena kuwa ni wewe kabla ya kuendelea.",
    en: "For your safety, please confirm it is you again before continuing.",
  },
  recovery_invalid: {
    sw: "Msimbo wa kurejesha si sahihi au umeshatumika. Angalia msimbo na ujaribu tena.",
    en: "That recovery code is not valid or has already been used. Check the code and try again.",
  },
  rate_limited: {
    sw: "Umejaribu mara nyingi mno. Subiri kidogo kisha ujaribu tena.",
    en: "You have tried too many times. Please wait a little and try again.",
  },
  state_invalid: {
    sw: "Kuingia kumeshindwa kwa sababu ombi limeisha muda au si sahihi. Anza upya.",
    en: "Sign-in could not continue because the request expired or was not valid. Please start again.",
  },
  github_denied: {
    sw: "Hukuruhusu GitHub kushiriki taarifa zako, kwa hiyo hatukuweza kukuingiza.",
    en: "You did not allow GitHub to share your details, so we could not sign you in.",
  },
  github_failed: {
    sw: "Hatukuweza kuwasiliana na GitHub kwa sasa. Tafadhali jaribu tena baadaye.",
    en: "We could not reach GitHub right now. Please try again later.",
  },
  identity_in_use: {
    sw: "Akaunti hii ya GitHub tayari inatumika na akaunti nyingine.",
    en: "This GitHub account is already used by another account.",
  },
  replace_conflict: {
    sw: "Huwezi kubadilisha kitambulisho hiki kwa sasa kwa sababu kuna mabadiliko mengine yanayoendelea.",
    en: "This sign-in method cannot be replaced right now because another change is in progress.",
  },
  codes_already_issued: {
    sw: "Misimbo ya kurejesha tayari imetolewa kwa akaunti hii.",
    en: "Recovery codes have already been issued for this account.",
  },
  reauth_mismatch: {
    sw: "Akaunti ya GitHub uliyotumia kuthibitisha si ile ya akaunti yako. Jaribu tena kwa akaunti sahihi.",
    en: "The GitHub account you used to confirm is not the one linked to your account. Please try again with the right one.",
  },
  internal: {
    sw: "Kuna hitilafu upande wetu. Tafadhali jaribu tena baadaye.",
    en: "Something went wrong on our side. Please try again later.",
  },
};
