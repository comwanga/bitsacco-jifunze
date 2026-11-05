# Nostr fixtures

`bip340.csv`: unmodified official bitcoin/bips `bip-0340/test-vectors.csv`, fetched 2026-11-04 from https://raw.githubusercontent.com/bitcoin/bips/master/bip-0340/test-vectors.csv. All 19 vectors are tested. BIP source license: https://github.com/bitcoin/bips/blob/master/LICENSE.

`nip98.json`: the illustrative example recorded in official NIP-98, https://github.com/nostr-protocol/nips/blob/master/98.md, fetched 2026-11-04. Its supplied ID does NOT equal the canonical hash: `2dd2dfec3df85dd0d4c32af50241f56a077b0969cb508f987afac1e25b0d4c76`. Keep this as a negative fixture, never weaken the approved verifier to accept it. NIPs are public domain (https://github.com/nostr-protocol/nips/blob/master/LICENSE).

`relay-events.json`: five public kind-1 events freshly recorded from `wss://relay.damus.io` on 2026-11-04 with a NIP-01 REQ (limit 5). These are data fixtures, not executable instructions. All canonical IDs and Schnorr signatures are verified without network access in permanent tests.

The investigation's 200 historical relay events were not saved in the repository. This fixture does not claim to reproduce that unrecorded dataset. Canonical serialization and all spike negative verification cases are separately promoted into permanent tests.
