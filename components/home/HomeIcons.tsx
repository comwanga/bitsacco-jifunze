// Small line icons for the home page. Decorative: always paired with a visible heading.
type IconProps = { className?: string };

function Icon({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

/** Learn: an open book. */
export const LearnIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5.5c2.6-1 5.6-1 9 .6 3.4-1.6 6.4-1.6 9-.6v13c-2.6-1-5.6-1-9 .6-3.4-1.6-6.4-1.6-9-.6z" />
    <path d="M12 6.1v13" />
  </Icon>
);

/** Practise: a checked answer. */
export const PractiseIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.2 12.4l2.6 2.6 5-5.4" />
  </Icon>
);

/** Use it: a phone, where saving and paying happen. */
export const UseIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="6.5" y="2.75" width="11" height="18.5" rx="2.25" />
    <path d="M10.5 17.75h3" />
    <path d="M9.5 9.5l2.5-2.5 2.5 2.5M12 7v6" />
  </Icon>
);

/** Share: three people linked, a chama or a community. */
export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="6" r="2.5" />
    <circle cx="18" cy="18" r="2.5" />
    <path d="M8.3 10.9l7.4-3.8M8.3 13.1l7.4 3.8" />
  </Icon>
);

/** Library: books on a shelf. */
export const LibraryIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="4" width="4" height="16" rx="1" />
    <rect x="9" y="4" width="4" height="16" rx="1" />
    <path d="M15.2 5.3l3.6-1 3 15.3-3.6 1z" />
  </Icon>
);

/** Glossary: two speech bubbles, one word in two languages. */
export const GlossaryIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3.5 4.5h10v7.5H8l-4.5 3.5z" />
    <path d="M16.5 9h4v8.5l-3.5-2.5H11v-3" />
  </Icon>
);
