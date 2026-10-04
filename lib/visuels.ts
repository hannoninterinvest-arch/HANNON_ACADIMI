export const VISUELS = [
  {
    src: "/hannon-apprenante-en-ligne.avif",
    alt: "Une apprenante suit un cours en ligne depuis son bureau",
  },
  {
    src: "/hannon-formation-en-ligne (1).avif",
    alt: "Une participante prend des notes pendant une formation en ligne",
  },
  {
    src: "/hannon-professionnel-en-ligne.avif",
    alt: "Un professionnel en réunion visio avec son équipe",
  },
  {
    src: "/hannon-formation-equipe.avif",
    alt: "Une équipe réunie autour d’une formation",
  },
] as const;

export function visuelAutorise(chemin: string): boolean {
  return VISUELS.some((visuel) => visuel.src === chemin);
}
