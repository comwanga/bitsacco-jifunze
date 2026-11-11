# Savers curriculum: design, sources and review record

## Learning model

The eight original Savers lessons remain the introductory sequence, with stable URLs and progress keys. Three optional sections extend that roadmap. Learners may choose one specialization; section prerequisites are guidance, never forced account-based gates. Each optional sequence ends at its own capstone and links back to the path choices. The catalogue supports level filtering and the existing tree shows prerequisites. Builder courses/labs retain their separate technical audience.

Every new lesson has English and Kiswahili objectives, explanation, a fictional case, a worked activity, required discussion, further reading and a four-question scenario quiz with explanations. No real money, keys or wallet connection is used. A single shared financial-scenario simulation supports reserve, price-shock and liquidity comparisons; paper exercises remain available without JavaScript.

## Coverage and prerequisites

The order below is the proposed implementation order within each specialization. A listed prerequisite is an existing introductory lesson or an earlier lesson of the same specialization. Existing wallet, scam, sats and Lightning introductions are reused rather than duplicated.

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

## Sources checked on 11 November 2026

These are primary institutional/project sources, not endorsements of a product or proof of legal authority. Lessons provide their directly relevant links in front matter. Explanations and fictional cases are original educational synthesis; source jurisdiction, scope and uncertainty must remain visible. No economic forecast or asset allocation is recommended.

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

## Human review status — updated 11 November 2026

The project owner reports completing the educational review of the expansion on 11 November 2026, including Kiswahili terminology/translations, Bitcoin technical accuracy, financial explanations, chamas, SACCOs/cooperative savings and associated documentation. See the [owner review record](2026-11-11-owner-review.md). These areas are not awaiting the owner's initial review. No reviewer identity, findings, corrections or formal independent approval was supplied. Do not set `lastReviewed` until both documented sign-offs required by `CONTRIBUTING.md` exist; independent technical sign-off and release authorization remain separate.

The completed owner review includes Kiswahili terminology. Working expressions such as purchasing power (*uwezo wa kununua*), liquidity (*uwezo wa kupata pesa za kulipa kwa wakati*), solvency (*uwezo wa mali kufidia madeni*), impairment (*upungufu wa thamani ya mkopo*) and segregation of duties (*mgawanyo wa majukumu*) retain pending metadata where the separate documented sign-off is absent. That status does not negate the owner's review or certify a preferred translation. Practical assistive-technology review remains separate.

Independent finance/cooperative and Bitcoin specialist sign-off remains an acceptance requirement from the audit, covering the topic map, money creation, custody/recovery limits, nominal/real examples, balance sheets and legal boundaries. Regional comparisons use chama/arisan/pandero without treating names as legal categories. A qualified local professional must establish current institutional legal permissions and reporting rules before any real financial-service activity; a generic educational policy exercise supplies none. This does not request repetition of the completed owner review.

## Implementation and acceptance

All 16 mapped lessons and their 16 bilingual four-question quizzes are implemented: six individual, five community and five cooperative lessons. The three original paths now contain 49 lessons / 98 language files and 49 bilingual quizzes. Seven glossary entries were added; existing *ukwasi* (liquidity) was broadened from its Lightning-only definition to include timely financial payments while retaining its directional channel meaning.

### Chaincode research and required discussion

Following the user's additional direction, open-ended questions are **required curriculum**, not optional side quests. All 49 lessons now have at least three English/Kiswahili discussion prompts. The learner explains reasoning, identifies assumptions, tests a counterexample and formulates a question of their own. Answers can be written privately or discussed, including independently without joining a group. Jifunze stores only a self-attestation timestamp, not answers. This is completion tracking, not expert evaluation or proof of competence. Old completed lessons remain complete, and version-1 progress imports/exports remain compatible.

The [Chaincode seminar](https://chaincode.gitbook.io/seminars) and its [Bitcoin protocol sequence](https://chaincode.gitbook.io/seminars/bitcoin-protocol-development) organize readings and discussions around protocol introduction, SegWit, mining/propagation, P2P, and scripts/wallets. Its facilitation notes encourage participants to develop questions themselves. The [SegWit](https://chaincode.gitbook.io/seminars/bitcoin-protocol-development/segwit), [P2P](https://chaincode.gitbook.io/seminars/bitcoin-protocol-development/p2p) and [Scripts and Wallets](https://chaincode.gitbook.io/seminars/bitcoin-protocol-development/script-wallets) modules were examined for their mechanism, trade-off and failure-analysis approach. GitBook's direct Markdown response was unavailable to the web reader; indexed primary-site pages and the [source repository](https://github.com/chaincodelabs/seminars) supplied the available research evidence.

Jifunze's questions are newly authored, not copied or translated from that question bank. No third-party license grant or endorsement is assumed. The approach is credited in `ATTRIBUTIONS.md`. Technical facts in additional builder explanations use [Bitcoin developer networking documentation](https://developer.bitcoin.org/devguide/p2p_network.html) and [BIP 141](https://github.com/bitcoin/bips/blob/master/bip-0141.mediawiki), rather than treating a seminar question as evidence of an answer.

| Relevant seminar subject | Implemented fit in existing Jifunze curriculum |
| --- | --- |
| Protocol validation and mining/propagation | `builders/dev-environment-regtest`: independent validation versus production/relay; archival versus pruned nodes; reason about two-node observations and limits of regtest evidence. |
| SegWit and transaction identity | `builders/utxos-transactions`: intent versus serialization, parent-transaction dependencies, witness versus transaction identifiers and limits of malleability claims. |
| Scripts and wallet design | `builders/keys-addresses-descriptors`: spending policies, recovery metadata and technical versus social authorization. |
| Adversarial protocol discussion | Builder and Lightning prompts examine ambiguous payment outcomes, correlated backups, HTLC timing, graph uncertainty, peer behavior and trust boundaries. |
| Generalizable inquiry method | Savers prompts examine cash-flow timing, purchasing-power benchmarks, contribution fairness, independent audit evidence, collusion and jurisdiction-specific authority. Technical labs are not imposed on Savers learners. |

The full seminar's reading workload and specialist topics are not claimed implemented. Deep mining incentives, activation history and a dedicated P2P protocol lab would need a separately scoped builder expansion. Existing technical lessons and labs remain usable.

Actual lesson/quiz/exercise counts, automated results and remaining limits are recorded in [the platform audit](2026-11-11-platform.md). The coverage map alone does not establish acceptance. Checks cover bilingual loading, prerequisites, case arithmetic, retained progress, branch choice and security boundaries. The user-requested 1 KiB general budget allowance and unchanged stricter learner limits are documented in that report.
