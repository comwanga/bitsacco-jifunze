# Curriculum and content review

Jifunze has 49 lessons in English and Kiswahili: 24 Savers lessons, eight Bitcoin Builder lessons and 17 Lightning Builder lessons. The roadmap JSON files under [`content/roadmaps/`](../content/roadmaps/) define the current order and prerequisites. [CONTRIBUTING.md](../CONTRIBUTING.md) describes schemas, bilingual content, quizzes and the review process.

## Learning model

The eight original Savers lessons remain the introductory sequence, with stable URLs and progress keys. Three optional sections extend that roadmap. Learners may choose one specialization; section prerequisites are guidance, never forced account-based gates. Each optional sequence ends at its own capstone and links back to the path choices. The catalogue supports level filtering and the existing tree shows prerequisites. Builder courses/labs retain their separate technical audience.

Every new lesson has English and Kiswahili objectives, explanation, a fictional case, a worked activity, required discussion, further reading and a four-question scenario quiz with explanations. No real money, keys or wallet connection is used. A single shared financial-scenario simulation supports reserve, price-shock and liquidity comparisons; paper exercises remain available without JavaScript.

## Coverage and prerequisites

The order below is the implemented reading order within each specialization. A listed prerequisite is an existing introductory lesson or an earlier lesson of the same specialization. Existing wallet, scam, sats and Lightning introductions are reused rather than duplicated.

| Specialization / level / slug | Learning objectives and applied work | Read first |
| --- | --- | --- |
| Individual / foundation / `budget-resilience` | Separate income, expenses and transfers; build dated cash flow, distinguish planned bills and emergencies; compare reserve instruments and access. Fictional irregular-income household budget. | `money-and-bitcoin` |
| Individual / foundation / `money-purchasing-power` | Distinguish cash, bank deposits, mobile balances and Bitcoin; inflation versus depreciation; compute a basket and real value; explain policy trade-offs without predictions. | `budget-resilience`, `sats-and-volatility` |
| Individual / intermediate / `payments-liquidity` | Compare on-chain/Lightning/provider access, fees/spreads/confirmation and emergency conversion; distinguish unit of account from payment rail. Fictional cross-border family expense. | `money-purchasing-power`, `lightning-payments` |
| Individual / intermediate / `custody-recovery` | Compare custody responsibilities, backup types, phishing, address privacy and coercion; write and rehearse a no-secrets recovery procedure. | `wallets-keys`, `custody-and-fedimint`, `scams` |
| Individual / advanced / `planning-sovereignty` | Relate supply/consensus to uncertain demand, goal horizons, diversification/concentration, traditional services and realistic autonomy. Stress-test loss and access assumptions. | `payments-liquidity`, `custody-recovery` |
| Individual / advanced / `multisig-inheritance` | Distinguish key threshold from legal ownership, recover with public wallet metadata, plan incapacity/succession and test correlated loss. | `planning-sovereignty` |
| Community / foundation / `savings-groups` | Compare rotating and accumulating groups, village groups, chama/arisan/pandero examples without treating names as legal forms. Compute a fictional rotation and default exposure. | `saving-together` |
| Community / intermediate / `group-governance` | Establish membership, votes/quorum, conflicts, dispute/appeal and contribution records; segregate receiving, recording, approval and reconciliation. | `savings-groups` |
| Community / intermediate / `group-payments` | Record local-unit obligations separately from sats receipts, fees and FX; reconcile payments/refunds and test Lightning/provider failures. | `group-governance`, `lightning-payments` |
| Community / advanced / `group-multisig` | Separate member decision from signing threshold, test collusion and key loss, manage onboarding/exit and public metadata without exposing secrets. | `group-payments`, `wallets-keys` |
| Community / advanced / `group-treasury` | Set fictional permitted-use/stop rules, reconcile treasury and member liabilities, stress liquidity/volatility, balance transparency/privacy and conduct a failure exercise. | `group-multisig` |
| Cooperative / foundation / `cooperative-foundations` | Explain ownership, shares versus withdrawable savings, member control and institutional trust; distinguish savings groups, banks and Bitcoin communities. | `saving-together` |
| Cooperative / intermediate / `cooperative-balance-sheet` | Explain assets/liabilities/equity, loan impairment, maturity and currency mismatch; calculate liquidity shortfall separately from solvency. | `cooperative-foundations` |
| Cooperative / intermediate / `cooperative-controls` | Trace member records, role separation, voting accountability, independent audit, digital vendor responsibility and complaints. | `cooperative-balance-sheet` |
| Cooperative / advanced / `cooperative-bitcoin-policy` | Distinguish institutional treasury, member custody and payment proposals; require jurisdiction-specific authority, qualified accounting and member protection; assess lending limits. | `cooperative-controls`, `custody-and-fedimint` |
| Cooperative / advanced / `cooperative-recovery` | Design conditional institutional custody, approvals and duty separation; stress key/provider/site failures, financial disclosure and recovery governance. | `cooperative-bitcoin-policy` |

## Primary source map

This source map was prepared on 11 November 2026. These are primary institutional/project sources, not endorsements of a product or proof of legal authority. Lessons provide their directly relevant links in front matter. Explanations and fictional cases are original educational synthesis; source jurisdiction, scope and uncertainty must remain visible. No economic forecast or asset allocation is recommended.

| Reference | Supported subject and limits |
| --- | --- |
| [CFPB emergency-fund guide](https://www.consumerfinance.gov/an-essential-guide-to-building-an-emergency-fund/) and [spending assessment](https://www.consumerfinance.gov/owning-a-home/prepare/assess-your-spending/) | Cash-flow timing, reserves and actual expenses. US examples are not universal deposit-protection guarantees or reserve-size prescriptions. |
| [IMF: Inflation](https://www.imf.org/en/Publications/fandd/issues/Series/Back-to-Basics/Inflation) | Price indices, real purchasing power, multiple inflation drivers and policy trade-offs. Arithmetic scenarios are not forecasts. |
| [Bank of England: Money creation](https://www.bankofengland.co.uk/quarterly-bulletin/2014/q1/money-creation-in-the-modern-economy) | Distinguishes central-bank money and commercial-bank deposit creation, with lending constraints. UK explanation, not a claim about every monetary system. |
| [Central Bank of Kenya monetary-policy statement, money-supply definitions](https://www.centralbank.go.ke/uploads/monetary_policy_statements/308913895_46thJune.pdf) | Kenyan money supply includes currency outside banks and commercial-bank deposits. No current inflation-rate claim or legal recommendation. |
| [Bitcoin developer block-chain reference](https://developer.bitcoin.org/reference/block_chain.html) and [guide](https://developer.bitcoin.org/devguide/block_chain.html) | Block subsidy, consensus validation, difficulty and approximate timing; transaction fees differ from new issuance. |
| [Bitcoin Core validation source](https://github.com/bitcoin/bitcoin/blob/master/src/validation.cpp) | `GetBlockSubsidy` makes issuance height-based. Mutable source link; pedagogical description must be reviewed if rules change. |
| [Bitcoin wallet security](https://bitcoin.org/en/secure-your-wallet) and [privacy](https://bitcoin.org/en/protect-your-privacy) | Backups, wallet responsibility, public transaction information and inheritance planning; no guarantee of theft prevention or recovery. |
| [BIP 129](https://github.com/bitcoin/bips/blob/master/bip-0129.mediawiki) | Multisignature setup coordination and public wallet configuration; an implementation proposal, not a universal recovery procedure. |
| [Lightning Labs liquidity](https://docs.lightning.engineering/the-lightning-network/liquidity/understanding-liquidity) and [recovery planning](https://docs.lightning.engineering/lightning-network-tools/lnd/recovery-planning-for-failure) | Direction-dependent liquidity and implementation-specific backup requirements. Node operation is not required of Savers learners. |
| [Core Lightning backup guide](https://docs.corelightning.org/docs/backup) | Another implementation demonstrating that a seed alone is not a universal channel-recovery method. |
| [Fedimint: How it works](https://fedimint.org/users/how-it-works) | Federated custody and ecash trust/privacy boundaries; not insurance or a substitute for governance. |
| [CARE VSLA FAQ](https://www.care.org/our-work/economic-growth/savings-groups/vsla-101/) | Accumulating group fund, loans, constitutions and cycle-end share-out. Describes CARE's model; not every savings association. |
| [ICA cooperative identity](https://www.ica.coop/en/cooperatives/cooperative-identity/) and [guidance notes](https://www.ica.coop/sites/default/files/2021-11/ICA%20Guidance%20Notes%20EN.pdf) | Member ownership/control, economic participation and accountable representatives. Principles are not national authorization or identical statutory voting rules. |
| [NCUA risk categories](https://publishedguides.ncua.gov/examiner/Content/ExaminersGuide/Examination%26SupervisionContacts/Risk-Focused_Exam/Risk%20Categories.htm) | Credit, liquidity, transaction and compliance risks; US supervisory context used for concepts, not universal rules. |
| [NCUA financial technology and digital assets](https://ncua.gov/regulation-supervision/regulatory-compliance-resources/financial-technology-and-digital-assets) | Shows why charter, insurance and service permissions must be checked separately. No lesson grants a SACCO/credit union permission to custody, invest or lend Bitcoin. |

## Required discussion

Every lesson includes paired English/Kiswahili discussion prompts. Learners explain reasoning, test assumptions or failure cases, and formulate a question of their own. They may write privately or discuss their answers. Jifunze stores only the self-confirmation timestamp, never the answers. This tracks completion rather than certifying understanding. Existing completed lessons and version 1 progress exports remain valid.

The [Chaincode Bitcoin Protocol Development seminar](https://chaincode.gitbook.io/seminars/bitcoin-protocol-development) informed the reading/discussion approach. Jifunze's questions are newly authored; they are not copies or translations of its question bank. See [Attributions](../ATTRIBUTIONS.md). Technical topics map to existing lessons as follows:

Technical explanations use primary references such as the [Bitcoin developer networking guide](https://developer.bitcoin.org/devguide/p2p_network.html) and [BIP 141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki); a seminar question is not evidence of an answer.

| Topic | Lesson |
| --- | --- |
| Independent validation, propagation, archival/pruned nodes and regtest limits | `builders/dev-environment-regtest` |
| Transaction serialization, SegWit, transaction identity and parent dependencies | `builders/utxos-transactions` |
| Spending policies, descriptors, recovery metadata and authorization | `builders/keys-addresses-descriptors` |
| Payment ambiguity, backups, HTLC timing and peer trust | Builder and Lightning lesson discussions |
| Cash-flow timing, purchasing-power comparisons, contribution fairness and governance evidence | Savers lesson discussions |

## Review status

The project owner completed educational review on 11 November 2026, covering Kiswahili wording, Bitcoin accuracy, financial explanations, community/cooperative savings and documentation. On 12 November the owner waived separate independent technical, financial/cooperative specialist and practical assistive-technology reviews for that curriculum release. These decisions do not establish an independent reviewer identity or specialist sign-off.

The two-sign-off policy in [Contributing](../CONTRIBUTING.md#reviewers) still governs `lastReviewed`: do not invent review dates or mark lessons reviewed without the required documented sign-offs. Existing draft labels and pending terminology metadata remain honest descriptions of that metadata; they do not undo the owner's completed review. Future content changes need their applicable reviews.

The current interface uses the owner-supplied feedback labels “Send Feedback” / “Tuma Maoni”. The discarded copy-address helper text is not part of the site and requires no approval.

Lessons and scenarios are educational material, not permission to conduct regulated activity or financial/investment advice. Jurisdiction-specific institutional rules and implementation-specific recovery behavior must remain explicit in relevant lessons and their sources.
