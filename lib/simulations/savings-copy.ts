const en = {
  title: "Savings, purchasing power and access", lead: "Stress-test fictional household, group and cooperative resources against a payment deadline.",
  explain: "Compare accessible currency and an asset valued in that currency against one expense. Change an assumed asset price, expense inflation and conversion costs, then remove asset access. No real accounts or prices are used.",
  example: "Noor has 8,000 currency units and an asset quoted at 4,000. A 50% asset-price fall leaves 2,000. A 12,000 expense rising 10% becomes 13,200. With no costs, resources are 10,000 and the shortfall is 3,200. The community preset shows a 4,000 surplus after a sale, but a 10,000 shortfall if conversion is unavailable.",
  limits: "One illustrative period, two-decimal currency units, no probabilities or forecasts. Currency earns no interest; no income, tax, borrowing, correlation or legal permission is modelled. The asset can represent Bitcoin but the arithmetic does not model a wallet or a full institution. Fees apply to conversion proceeds and are capped at those proceeds. An unavailable asset retains a quoted value but contributes zero to timely payment. Cooperative expected repayments are uncertain inflows, not tradable Bitcoin or a complete balance sheet.",
  preset: "Fictional case", household: "Household goal", community: "Community payout", cooperative: "Cooperative cash timing",
  cooperativeNote: "In this case the second resource represents 5,000 of expected loan repayments before the deadline. Switch access off to model delayed repayment. This does not model loan creation or permit Bitcoin lending.",
  cash: "Accessible currency (units)", riskyAsset: "Second resource at starting quote (units)", priceChange: "Assumed value change (%)", inflation: "Assumed expense change (%)",
  expense: "Expense at starting price (units)", feePercent: "Illustrative conversion cost (%)", fixedFee: "Fixed conversion cost (units)",
  availableLabel: "Second resource available before the deadline", calculate: "Compare this scenario", reset: "Reset selected case",
  invalid: "Use nonnegative amounts up to 1 billion with at most two decimal places and a positive expense. Percentages: value change −100 to 100; expense change above −100 to 100; conversion cost 0 to 100.",
  result: "Scenario result", assetValue: "Quoted second resource", netAsset: "Second resource available after costs", available: "Total available by deadline", adjustedExpense: "Expense after assumed change", balance: "Surplus or shortfall", units: "fictional units",
  feedback: "Explain why this result changes when access is removed. Which assumption most affects the deadline, and when would the arrangement be inappropriate? Return to your lesson to complete its required discussion.",
};
export type SavingsCopy = Record<keyof typeof en, string>;
const sw: SavingsCopy = {
  title: "Akiba, uwezo wa kununua na upatikanaji", lead: "Jaribu rasilimali za kubuni za familia, kikundi na ushirika dhidi ya tarehe ya malipo.",
  explain: "Linganisha sarafu inayopatikana na mali iliyopimwa kwa sarafu hiyo dhidi ya gharama moja. Badili bei ya kudhaniwa, gharama na ada, kisha ondoa upatikanaji wa mali. Hakuna akaunti au bei halisi.",
  example: "Noor ana vipimo 8,000 vya sarafu na mali yenye bei ya 4,000. Kushuka kwa 50% huacha 2,000. Gharama ya 12,000 ikipanda 10% huwa 13,200. Bila ada, rasilimali ni 10,000 na pengo 3,200. Mfano wa jamii una ziada ya 4,000 baada ya kuuza, lakini pengo la 10,000 kubadilisha kusipopatikana.",
  limits: "Kipindi kimoja cha mfano, vipimo vya sarafu vyenye desimali mbili, bila uwezekano wa kitakwimu au utabiri. Sarafu haipati riba; mapato, kodi, kukopa, uhusiano wa hatari na ruhusa za sheria havijaigwa. Mali inaweza kuwakilisha Bitcoin lakini hesabu haziigi pochi au taasisi nzima. Ada hutumika kwa mapato ya kubadilisha hadi kiasi hicho pekee. Mali isiyopatikana ina bei kwenye rekodi lakini sifuri kwa malipo ya wakati. Malipo ya mikopo yanayotarajiwa ni mapokezi yasiyo na uhakika, si Bitcoin inayouzwa wala taarifa kamili ya mali na madeni.",
  preset: "Kisa cha kubuni", household: "Lengo la familia", community: "Malipo ya jamii", cooperative: "Muda wa pesa za ushirika",
  cooperativeNote: "Katika kisa hiki rasilimali ya pili ni malipo ya mikopo 5,000 yanayotarajiwa kabla ya tarehe. Ondoa upatikanaji kuiga kuchelewa. Huu si mfano wa kuunda mikopo wala ruhusa ya kukopesha Bitcoin.",
  cash: "Sarafu inayopatikana (vipimo)", riskyAsset: "Rasilimali ya pili kwa bei ya mwanzo (vipimo)", priceChange: "Badiliko la thamani linalodhaniwa (%)", inflation: "Badiliko la gharama linalodhaniwa (%)",
  expense: "Gharama kwa bei ya mwanzo (vipimo)", feePercent: "Gharama ya kubadilisha ya mfano (%)", fixedFee: "Gharama ya kudumu ya kubadilisha (vipimo)",
  availableLabel: "Rasilimali ya pili inapatikana kabla ya tarehe", calculate: "Linganisha hali hii", reset: "Anza kisa kilichochaguliwa upya",
  invalid: "Weka kiasi kisicho hasi hadi bilioni moja, desimali zisizozidi mbili na gharama chanya. Asilimia: thamani −100 hadi 100; gharama zaidi ya −100 hadi 100; ada 0 hadi 100.",
  result: "Matokeo ya hali", assetValue: "Bei ya rasilimali ya pili", netAsset: "Rasilimali ya pili baada ya gharama", available: "Jumla inayopatikana kwa wakati", adjustedExpense: "Gharama baada ya badiliko", balance: "Ziada au upungufu", units: "vipimo vya kubuni",
  feedback: "Eleza kwa nini matokeo hubadilika upatikanaji ukiondolewa. Dhana ipi huathiri zaidi tarehe, na mpango haufai lini? Rudi kwenye somo kukamilisha majadiliano ya lazima.",
};
export const savingsCopy = { en, sw };
