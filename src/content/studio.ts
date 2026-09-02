/**
 * AURUM Detail Studio — single source of truth for brand, services and pricing.
 *
 * Two rules:
 *  1. Every figure a visitor can read, and every figure the AI receptionist can
 *     quote, resolves to this file. Nothing is hardcoded in a component.
 *  2. `knowledge.md` narrates this data for the chatbot. When a price changes
 *     here, change the sentence there too — they are read by different
 *     audiences but they must never disagree.
 */

export const studio = {
  name: "AURUM",
  fullName: "AURUM Detail Studio",
  wordmark: { head: "AURUM", tail: "Detail Studio" },
  tagline: "Paint protection and ceramic coating, done to a measured standard.",
  founded: 2016,

  city: "Ahmedabad",
  state: "Gujarat",
  address: "Survey 118, Sardar Patel Ring Road, Bopal, Ahmedabad 380058",
  mapsUrl: "https://maps.google.com/?q=Sardar+Patel+Ring+Road+Bopal+Ahmedabad",

  phone: "+91 98250 41200",
  phoneHref: "tel:+919825041200",
  whatsapp: "919825041200",
  email: "studio@aurumdetail.in",
  instagram: "@aurum.detail",
  instagramUrl: "https://instagram.com/aurum.detail",

  hours: {
    weekday: "Mon – Sat · 9:30 AM – 7:30 PM",
    sunday: "Sunday · By appointment only",
  },

  /** Capacity is a real constraint at this studio, and the site says so. */
  bays: 4,
  intakePerWeek: 9,
} as const;

export type ServiceSlug =
  | "paint-protection-film"
  | "ceramic-coating"
  | "paint-correction"
  | "interior-detail"
  | "glass-and-trim"
  | "maintenance-wash";

export type Service = {
  slug: ServiceSlug;
  code: string;
  name: string;
  summary: string;
  /** Shown on the service card — kept to four, because six reads as a spec sheet. */
  includes: readonly string[];
  duration: string;
  warranty: string;
  priceFrom: number;
  priceTo: number;
};

/**
 * Price bands are inclusive of GST and quoted per vehicle segment at the low
 * end (hatchback) and high end (full-size SUV / luxury). The AI receptionist
 * quotes bands only — never a single number — because the real figure needs
 * the panel inspection.
 */
export const services: readonly Service[] = [
  {
    slug: "paint-protection-film",
    code: "S01",
    name: "Paint Protection Film",
    summary:
      "A self-healing urethane skin over the panels that actually take damage. Stone chips, road rash and trolley scuffs stop at the film, not at your paint.",
    includes: [
      "Computer-cut patterns, no blade on your paint",
      "Wrapped edges on bonnet, bumper and mirrors",
      "Self-healing topcoat, gloss or satin",
      "Ten-year film warranty, registered to the VIN",
    ],
    duration: "3 – 6 days",
    warranty: "10 years on the film",
    priceFrom: 60000,
    priceTo: 285000,
  },
  {
    slug: "ceramic-coating",
    code: "S02",
    name: "Ceramic Coating",
    summary:
      "A cured silica layer that makes the surface hard, slick and genuinely easy to wash. Applied only over corrected paint — coating a swirled panel just locks the swirls in.",
    includes: [
      "Mandatory paint correction first",
      "9H coating, two layers plus a top layer",
      "Wheels, glass and trim coated to match",
      "Annual inspection included for the term",
    ],
    duration: "3 – 5 days",
    warranty: "5 years, inspection-linked",
    priceFrom: 25000,
    priceTo: 95000,
  },
  {
    slug: "paint-correction",
    code: "S03",
    name: "Paint Correction",
    summary:
      "Measured, staged machine polishing that removes swirls and etching instead of filling them. We read paint depth before we touch a panel and again after.",
    includes: [
      "Paint depth gauged on every panel",
      "One, two or three stage to your goal",
      "Before and after under inspection light",
      "Written depth log handed over with the car",
    ],
    duration: "1 – 3 days",
    warranty: "Finish documented at handover",
    priceFrom: 12000,
    priceTo: 55000,
  },
  {
    slug: "interior-detail",
    code: "S04",
    name: "Interior Detail",
    summary:
      "Extraction, not fragrance. Seats, carpet and headliner are cleaned through the pile, leather is fed, and every vent and seam is worked by hand.",
    includes: [
      "Hot-water extraction on fabric",
      "pH-correct leather clean and feed",
      "Steam on vents, seams and console",
      "Optional fabric or leather sealant",
    ],
    duration: "1 – 2 days",
    warranty: "Sealant covered 2 years",
    priceFrom: 6500,
    priceTo: 28000,
  },
  {
    slug: "glass-and-trim",
    code: "S05",
    name: "Glass & Trim",
    summary:
      "Windscreen coating that makes rain leave on its own above 60 km/h, plus restoration for the plastic and rubber that ages first on Indian roads.",
    includes: [
      "Hydrophobic windscreen and window coating",
      "Water-spot and wiper-haze removal",
      "Faded black trim restored, not dressed",
      "Rubber seals fed and protected",
    ],
    duration: "4 – 8 hours",
    warranty: "1 year on glass coating",
    priceFrom: 3500,
    priceTo: 14000,
  },
  {
    slug: "maintenance-wash",
    code: "S06",
    name: "Maintenance Wash",
    summary:
      "The wash a coated or filmed car is supposed to get. Two buckets, pH-neutral chemistry, touch-free drying — the routine that makes a five-year warranty actually reach five years.",
    includes: [
      "Two-bucket contact wash, grit guards",
      "Decontamination when the surface needs it",
      "Filtered-air touch-free dry",
      "Coating condition checked and logged",
    ],
    duration: "2 – 3 hours",
    warranty: "Keeps your coating warranty valid",
    priceFrom: 1500,
    priceTo: 4500,
  },
] as const;

export function serviceBySlug(slug: string): Service | undefined {
  return services.find((s) => s.slug === slug);
}

/** Vehicle segments drive every price band. Used by the form and the chatbot. */
export const segments = [
  { id: "hatchback", label: "Hatchback", example: "Swift, i20, Altroz" },
  { id: "sedan", label: "Sedan", example: "City, Verna, Slavia" },
  { id: "compact-suv", label: "Compact SUV", example: "Creta, Seltos, Nexon" },
  { id: "full-suv", label: "Full-size SUV", example: "Fortuner, XUV700, Safari" },
  { id: "luxury", label: "Luxury / Exotic", example: "BMW, Mercedes, Porsche" },
] as const;

export type SegmentId = (typeof segments)[number]["id"];

/**
 * The three packages the studio actually sells. Everything else is quoted
 * per car. Figures are the honest band for a compact SUV, the median segment.
 */
export const packages = [
  {
    id: "essential",
    name: "Essential",
    price: 28000,
    priceNote: "for a compact SUV",
    pitch: "A corrected, coated car that stays easy to wash.",
    includes: [
      "Single-stage paint correction",
      "5-year ceramic coating, paint only",
      "Glass coating on the windscreen",
      "Interior vacuum and wipe-down",
      "Two maintenance washes in year one",
    ],
    featured: false,
  },
  {
    id: "signature",
    name: "Signature",
    price: 96000,
    priceNote: "for a compact SUV",
    pitch: "Film where the damage lands, coating everywhere else.",
    includes: [
      "Two-stage paint correction with depth log",
      "PPF on bonnet, bumper, fenders and mirrors",
      "5-year ceramic coating over the full body",
      "Wheels, glass and trim coated",
      "Full interior detail with sealant",
      "Four maintenance washes in year one",
    ],
    featured: true,
  },
  {
    id: "concours",
    name: "Concours",
    price: 210000,
    priceNote: "for a compact SUV",
    pitch: "Full-body film. The car leaves sealed, top to bottom.",
    includes: [
      "Three-stage correction to a measured finish",
      "Full-body PPF, every painted panel",
      "Coating over film, plus wheels off and coated",
      "Complete interior with leather treatment",
      "Engine bay detail",
      "Twelve months of monthly maintenance",
    ],
    featured: false,
  },
] as const;

/** Process is four steps because a studio that lists nine is describing a factory. */
export const process = [
  {
    n: "01",
    title: "Inspection",
    body: "The car comes in, goes under the lights, and every panel gets gauged and photographed. You get the report whether or not you book.",
  },
  {
    n: "02",
    title: "Written quote",
    body: "A fixed figure against a written scope. It does not move once you have agreed it — no calls halfway through the job asking for more.",
  },
  {
    n: "03",
    title: "The work",
    body: "One car, one bay, one technician who owns it start to finish. Photographs at every stage land on your WhatsApp as they happen.",
  },
  {
    n: "04",
    title: "Handover",
    body: "We walk the car with you under the same inspection light. You leave with the depth log, the warranty registered to your VIN, and the aftercare schedule.",
  },
] as const;

export const faqs = [
  {
    q: "How long will my car be with you?",
    a: "A maintenance wash is a few hours. A coating is three to five days, and full-body film is up to six — most of which is the correction underneath, not the film itself. We hold four bays and take nine cars a week, so the date we give you is a date we can actually keep.",
  },
  {
    q: "Why does the coating cost less than the correction sometimes?",
    a: "Because the coating is the easy part. Coating is a few hours of careful application; correction is days of measured polishing that permanently removes damage. Anyone quoting you a cheap coating is quoting you a coating over swirls, and you will be able to see them under a light forever.",
  },
  {
    q: "Is PPF better than ceramic coating?",
    a: "They solve different problems. Film is physical thickness — it stops stone chips and scratches. Coating is chemistry — it makes the surface hard, slick and easy to clean, but it will not stop a stone. Most of our cars get film on the impact panels and coating over everything, which is exactly what the Signature package is.",
  },
  {
    q: "What actually voids the warranty?",
    a: "Automatic tunnel washes with spinning brushes, and pressure washing the film edges from close range. That is it. Bring the car in for its annual inspection and wash it properly in between, and the warranty holds for its full term.",
  },
  {
    q: "Do you work on new cars straight from the dealer?",
    a: "Those are the best ones to protect, and also never as flawless as people expect. Transport film, dealer washes and lot storage put swirls into most new cars before you collect them. We still gauge and correct first — protecting damaged paint just preserves the damage.",
  },
  {
    q: "Can I see the car while you have it?",
    a: "You get stage photographs on WhatsApp as the work happens, and you are welcome in the studio by appointment. We ask you to book the visit because opening a bay door mid-correction puts dust on a wet panel.",
  },
  {
    q: "Do you offer any guarantee on the finish?",
    a: "The film carries ten years and the coating carries five, both registered against your VIN. The finish itself is documented at handover with paint-depth readings and photographs under inspection light, so there is an objective record of what you received.",
  },
] as const;
