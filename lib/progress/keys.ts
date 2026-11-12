// Storage keys shared by pages that must stay small. No imports here on purpose.

/** Present only while this browser believes a learner is signed in: "?" or the account id, never a token. */
export const ACCOUNT_KEY = "jifunze:account:v1";
/** "1" while something written on this device has not been confirmed by the account. */
export const DIRTY_KEY = "jifunze:sync:dirty:v1";
