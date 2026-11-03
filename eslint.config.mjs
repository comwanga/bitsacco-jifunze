import next from "eslint-config-next";

const config = [
  { ignores: [".next/**", "out/**", ".superpowers/**", "next-env.d.ts"] },
  ...next,
];

export default config;
