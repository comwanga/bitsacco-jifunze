import type { Lang } from "../i18n.ts";

// Blog (Makala) labels. Kept out of lib/i18n.ts, whose dictionary is bundled into every page's JavaScript;
// this module only reaches the pages and components that import it.
const en = {
  blogTitle: "Blog",
  blogLead: "Short reads that explain what's happening and point you to the lessons that go deeper.",
  blogAll: "All",
  blogFilter: "Filter posts by category",
  blogFeatured: "Featured",
  blogRecent: "Recent posts",
  blogContinue: "Continue learning",
  blogRelated: "Related posts",
  blogUpdated: "Updated",
  blogBy: "by",
  blogOtherLang: "In Kiswahili",
  blogFallback: "This post is written in Kiswahili.",
  blogEmpty: "Posts are coming soon.",
  blogVideoOffline: "This video needs an internet connection.",
  blogVideoOpens: "Opens on {host}",
};

const sw: Record<keyof typeof en, string> = {
  blogTitle: "Makala",
  blogLead: "Maelezo mafupi yanayokusaidia kuelewa kinachoendelea na kukuelekeza kwenye masomo yanayofuata.",
  blogAll: "Zote",
  blogFilter: "Chagua aina ya makala",
  blogFeatured: "Makala maalumu",
  blogRecent: "Makala za karibuni",
  blogContinue: "Endelea kujifunza",
  blogRelated: "Makala zinazohusiana",
  blogUpdated: "Ilisasishwa",
  blogBy: "na",
  blogOtherLang: "Kwa Kiingereza",
  blogFallback: "Makala hii imeandikwa kwa Kiingereza.",
  blogEmpty: "Makala zitakuja hivi karibuni.",
  blogVideoOffline: "Video hii inahitaji mtandao.",
  blogVideoOpens: "Inafunguka kwenye {host}",
};

export type BlogCopyKey = keyof typeof en;
export const blogCopy: Record<Lang, Record<BlogCopyKey, string>> = { sw, en };

export function blogText(lang: Lang, key: BlogCopyKey): string {
  return blogCopy[lang][key];
}
