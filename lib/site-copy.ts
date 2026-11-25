import type { Lang } from "./i18n.ts";

// Labels used only by server components (brand lockup, footer, lower home page). Kept out of lib/i18n.ts,
// whose dictionary is bundled into every page's JavaScript, the same way lib/simulations/copy.ts is.
const en = {
  brandBy: "by Bitsacco",
  heroTitle: "Check before you save",
  heroSubtitle: "Chamas, SACCOs, personal savings and Bitcoin",
  heroLead:
    "Learn how savings groups and money tools really work, what the real risks are, and how Bitcoin can make them stronger. Free, in Kiswahili or English, no sign-up.",
  heroBrowse: "Browse all lessons",
  resourcesTitle: "Learning resources",
  glossaryCard: "Understand Bitcoin words in Kiswahili and English.",
  libraryAction: "Open the library",
  glossaryAction: "Open the glossary",
  libraryCount: "books and papers",
  glossaryCount: "terms",
  footerTagline: "Learn Bitcoin. Practise. Use it. Share.",
  footerLearning: "Learning",
  footerResources: "Resources",
  footerProject: "Project",
  footerLab: "Lightning lab",
  footerPractice: "Practice simulations",
  pathOutcomesTitle: "What you'll learn",
  pathFormatTitle: "How it works",
  pathAudienceTitle: "Who it's for",
  statsLessons: "{n} lessons",
  statsLanguages: "{n} languages",
  statsHours: "about {n} hours of reading",
  statsTerms: "{n} glossary terms",
};

export type SiteCopy = Record<keyof typeof en, string>;

const sw: SiteCopy = {
  brandBy: "na Bitsacco",
  heroTitle: "Kagua kabla ya kuweka akiba",
  heroSubtitle: "Chama, SACCO, akiba binafsi na Bitcoin",
  heroLead:
    "Elewa jinsi vikundi vya akiba na zana za fedha zinavyofanya kazi, hatari zake halisi, na jinsi Bitcoin inavyoweza kuviimarisha. Bure, kwa Kiswahili au Kiingereza, bila kujisajili.",
  heroBrowse: "Tazama masomo yote",
  resourcesTitle: "Rasilimali za kujifunza",
  glossaryCard: "Elewa maneno ya Bitcoin kwa Kiswahili na Kiingereza.",
  libraryAction: "Fungua maktaba",
  glossaryAction: "Fungua kamusi",
  libraryCount: "vitabu na karatasi",
  glossaryCount: "maneno",
  footerTagline: "Jifunze Bitcoin. Jaribu. Tumia. Shiriki.",
  footerLearning: "Kujifunza",
  footerResources: "Rasilimali",
  footerProject: "Mradi",
  footerLab: "Maabara ya Lightning",
  footerPractice: "Mazoezi ya Bitcoin",
  pathOutcomesTitle: "Utakachojifunza",
  pathFormatTitle: "Jinsi inavyofanya kazi",
  pathAudienceTitle: "Ni kwa ajili ya nani",
  statsLessons: "masomo {n}",
  statsLanguages: "lugha {n}",
  statsHours: "takriban saa {n} za kusoma",
  statsTerms: "maneno {n} ya kamusi",
};

export const siteCopy: Record<Lang, SiteCopy> = { en, sw };
