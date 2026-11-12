import type { Lang } from "./i18n.ts";

// Labels used only by server components (brand lockup, footer, lower home page). Kept out of lib/i18n.ts,
// whose dictionary is bundled into every page's JavaScript, the same way lib/simulations/copy.ts is.
const en = {
  brandBy: "by Bitsacco",
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
};

export type SiteCopy = Record<keyof typeof en, string>;

const sw: SiteCopy = {
  brandBy: "na Bitsacco",
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
};

export const siteCopy: Record<Lang, SiteCopy> = { en, sw };
