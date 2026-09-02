import type { ServiceSlug } from "./studio";

/**
 * Every image on the site, in one map.
 *
 * All of them are frames pulled from the same body of studio footage, which is
 * deliberate: six unrelated stock photographs read as six different businesses,
 * and the whole job of this page is to look like one real place.
 */
export const serviceImage: Record<ServiceSlug, string> = {
  "paint-protection-film": "/media/svc-ppf.jpg",
  "ceramic-coating": "/media/svc-coating.jpg",
  "paint-correction": "/media/svc-correction.jpg",
  "interior-detail": "/media/svc-interior.jpg",
  "glass-and-trim": "/media/svc-glass.jpg",
  "maintenance-wash": "/media/svc-wash.jpg",
};

export const workImages = [
  { src: "/media/work-01.jpg", caption: "Two-stage correction", meta: "Sedan · 3 days" },
  { src: "/media/work-02.jpg", caption: "Coating over corrected paint", meta: "Compact SUV · 4 days" },
  { src: "/media/work-03.jpg", caption: "Wheels off, faces coated", meta: "Full-size SUV · 2 days" },
  { src: "/media/work-04.jpg", caption: "Front-end film", meta: "Sedan · 3 days" },
  { src: "/media/work-05.jpg", caption: "Decontamination wash", meta: "Hatchback · 1 day" },
  { src: "/media/work-06.jpg", caption: "Coating application", meta: "Luxury · 5 days" },
] as const;

export const aboutImage = "/media/about-studio.jpg";
export const processImage = "/media/process-inspect.jpg";
