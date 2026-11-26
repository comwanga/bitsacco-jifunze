# Batch 1 — Kiswahili wording for owner review

Status: awaiting the owner's review (the redesign list was approved separately on 25 November 2026). Some Batch 1 strings were later removed from the homepage by the redesign (start-link placement, builders heading, glossary links).

Branch `feat/community-finance-homepage`. Every new or changed Kiswahili string, with its English pair. Mark any line to change.

## Homepage hero (`lib/site-copy.ts`)
| Kiswahili | English |
|---|---|
| Kagua kabla ya kuweka akiba | Check before you save |
| Chama, SACCO, akiba binafsi na Bitcoin | Chamas, SACCOs, personal savings and Bitcoin |
| Elewa jinsi vikundi vya akiba na zana za fedha zinavyofanya kazi, hatari zake halisi, na jinsi Bitcoin inavyoweza kuviimarisha. Bure, kwa Kiswahili au Kiingereza, bila kujisajili. | Learn how savings groups and money tools really work, what the real risks are, and how Bitcoin can make them stronger. Free, in Kiswahili or English, no sign-up. |
| masomo {n} · lugha {n} · takriban saa {n} za kusoma · maneno {n} ya kamusi | {n} lessons · {n} languages · about {n} hours of reading · {n} glossary terms |
| Imehifadhiwa kwenye kivinjari hiki pekee. · Dhibiti maendeleo | Saved only in this browser. · Manage progress |

## Starting points and path cards
| Kiswahili | English |
|---|---|
| Unaanzia wapi? | Where are you starting? |
| Ninakaribia kujiunga na kikundi cha akiba | I'm about to join a savings group |
| Tayari niko kwenye chama au SACCO | I'm already in a chama or SACCO |
| Nataka kuweka akiba peke yangu | I want to save on my own |
| Nataka kuhamishia kikundi changu kwenye Bitcoin | I want to move my group to Bitcoin |
| Baada ya njia hii utaweza kukagua chama au SACCO kabla ya kujiunga, kulinganisha njia za kuweka akiba, na kupanga akiba ya kikundi kwa Bitcoin. | After this path you can check a chama or SACCO before you join, compare ways to save, and plan group savings with Bitcoin. |
| Jenga zana zinazohitajika na jamii | Build the tools communities need |
| Jamii (branch label) | Community |
| Mbuyu unaokua alfajiri, wenye matawi matatu: Jamii, Lightning na Wajenzi | A baobab growing at sunrise, with three branches: Community, Lightning and Builders |

## Glossary links and 404
| Kiswahili | English |
|---|---|
| Maneno ya vikundi vya akiba kwenye kamusi (screen-reader label) | Savings-group words in the glossary |
| Tafuta maneno yote {n} | Search all {n} terms |
| Unaweza kwenda wapi sasa | Where to go next |

## Community Finance path (`content/roadmaps/savers.json`)
| Kiswahili | English |
|---|---|
| Fedha za Jamii na Bitcoin | Community Finance & Bitcoin |
| Elewa chama, SACCO na akiba binafsi, kisha uone jinsi Bitcoin inavyoviimarisha. | Understand chamas, SACCOs and personal savings, then see how Bitcoin strengthens them. |
| Anza na pesa, akiba, pochi na usalama. Kisha chagua akiba binafsi, vikundi vya akiba vya jamii au fedha za ushirika, na ujifunze kupima hatari, sheria na kumbukumbu kabla ya kuweka pesa. Huhitaji kujua programu. | Start with money, savings, wallets and safety. … No programming needed. |
| Utakachojifunza · Jinsi inavyofanya kazi · Ni kwa ajili ya nani | What you'll learn · How it works · Who it's for |
| Jinsi vikundi vya mzunguko, vikundi vya kulimbikiza na SACCO vinavyoshughulikia pesa, na wapi kila kimoja kinaweza kushindwa | How rotating groups, accumulating groups and SACCOs handle money, and where each one can fail |
| Maswali ya kuuliza kuhusu sheria, kumbukumbu na uongozi kabla ya kujiunga | Questions to ask about rules, records and leadership before you join |
| Jinsi ya kulinganisha njia za kuweka akiba kwa gharama, upatikanaji na nani anadhibiti pesa | How to compare savings options by cost, access and who controls the money |
| Jinsi ya kushikilia Bitcoin mwenyewe kwa usalama, na jinsi kikundi kinavyoweza kuitumia kwa sheria zilizo wazi | How to hold Bitcoin safely yourself, and how a group can use it with clear rules |
| Masomo manane mafupi ya utangulizi, kisha uchague fedha binafsi, za kikundi au za ushirika. Kila somo lina mfano wa kubuni, zoezi, maswali ya majadiliano na jaribio fupi. Hakuna pesa halisi inayotumika. | Eight short introductory lessons, … No real money is used. |
| Yeyote anayekaribia kujiunga au aliye tayari kwenye chama, SACCO au kikundi cha akiba, yeyote anayeweka akiba peke yake, na wanaoongoza au kufundisha kikundi. Huhitaji ujuzi wa kiufundi. | Anyone about to join or already in a chama, SACCO or savings group, … No technical background needed. |

## Builders and Lightning intros (`content/roadmaps/builders.json`, `lightning.json`)
| Kiswahili | English |
|---|---|
| Endesha mtandao binafsi wa majaribio wa Bitcoin kwenye kompyuta yako | Run a private Bitcoin test network on your own computer |
| Soma miamala, funguo na descriptors | Read transactions, keys and descriptors |
| Elewa jinsi Lightning na Fedimint zinavyofanya kazi ndani | Understand how Lightning and Fedimint work underneath |
| Changia miradi ya chanzo huria na utengeneze zana ndogo kwa ajili ya jamii yako | Contribute to open-source projects and ship a small tool for your community |
| Masomo manane ya vitendo kwa kutumia regtest, kwa hiyo hakuna pesa halisi. Kila somo linaishia na majadiliano na jaribio, na la mwisho ni mradi. | Eight hands-on lessons on regtest, … the last one is a project. |
| Watu wanaoweza kutumia terminal wanaotaka kujenga zana kwa ajili ya vikundi vya akiba na jamii. | People comfortable with a terminal who want to build tools for savings groups and communities. |
| Jinsi njia za malipo, ankara na uelekezaji zinavyofanya kazi | How payment channels, invoices and routing work |
| Jinsi nodi zinavyotafuta njia na kupeleka malipo kwa usalama | How nodes find paths and forward payments safely |
| Jinsi ya kuendesha, kuhifadhi nakala na kulinda nodi | How to operate, back up and secure a node |
| Masomo kumi na saba yaliyotoholewa kutoka Mastering the Lightning Network, pamoja na mazoezi unayoweza kuendesha kwenye maabara ya ndani. Hakuna pesa halisi inayotumika. | Seventeen lessons adapted from Mastering the Lightning Network, … No real money is used. |
| Wajenzi waliomaliza njia ya Wajenzi au wanaojua tayari miamala ya Bitcoin, wanaotaka kuendesha njia za malipo zinazotumiwa na jamii. | Builders who finished the Builders path or already know Bitcoin transactions, … |

## Lesson link label (`content/savers/sw/next-steps.mdx`)
Chagua eneo la hiari katika [njia ya Fedha za Jamii na Bitcoin](…) / Choose an optional module in the [Community Finance & Bitcoin path](…)

## App manifest (`public/manifest.webmanifest`)
Elewa chama, SACCO na akiba, na jinsi Bitcoin inavyoviimarisha. / Understand chamas, SACCOs and savings, and how Bitcoin strengthens them.
