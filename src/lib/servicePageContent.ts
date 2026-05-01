import type { ImageMetadata } from 'astro';

import detailingImage from '../assets/images/car-1.webp';
import protectionImage from '../assets/images/car-2.webp';
import correctionImage from '../assets/images/car-3.webp';
import newVehicleImage from '../assets/images/car-4.webp';

export interface ServiceFeature {
  title: string;
  description: string;
}

export interface ServicePriceCard {
  name: string;
  price: string;
  description: string;
}

export interface ServiceTrustPoint {
  title: string;
  description: string;
}

export interface ServicePageContent {
  title: string;
  description: string;
  eyebrow: string;
  heroSummary: string;
  heroBadges: string[];
  heroNote: string;
  image: ImageMetadata;
  imageAlt: string;
  overview: string[];
  includedHeading: string;
  includedIntro: string;
  includedItems: ServiceFeature[];
  bestFor: string[];
  pricingIntro: string;
  pricingCards: ServicePriceCard[];
  pricingAdjustments: string[];
  trustPoints: ServiceTrustPoint[];
  ctaHeading: string;
  ctaText: string;
}

const commonAdjustments = [
  'Vehicle size, class, and overall condition',
  'Heavy buildup, excessive dirt, or stain-heavy interiors',
  'Pet hair, sand, and extra cleanup time',
  'Third rows, extra passenger rows, and large cargo areas',
  'Truck beds, engine bay cleaning, and specialty add-ons',
  'Extra services like odor treatment, stain work, or additional protection',
];

export const detailingPageContent: ServicePageContent = {
  title: 'Mobile Detailing That Makes the Whole Vehicle Feel Reset',
  description:
    'From quick maintenance cleans to deeper interior and exterior refreshes, our detailing service is built to make daily drivers, family vehicles, and weekend cars feel cleaner, sharper, and easier to enjoy.',
  eyebrow: 'Interior + Exterior Detailing',
  heroSummary:
    'We bring professional mobile detailing to your driveway in Kentville and across the Annapolis Valley, with package options that scale from routine upkeep to a more complete reset.',
  heroBadges: ['Basic from $120', 'Standard from $180', 'Premium from $250'],
  heroNote:
    'Starting prices are a guide. Final pricing depends on size, condition, pet hair, buildup, extra rows, and add-ons.',
  image: detailingImage,
  imageAlt: 'A freshly detailed vehicle exterior with a deep clean shine',
  overview: [
    'Detailing is more than a quick wash. It is the process of cleaning, refreshing, and dialing in the vehicle so it looks better, feels better, and is easier to maintain afterward.',
    'Some vehicles only need a clean maintenance detail. Others need extra time for heavily used interiors, salt, pet hair, grime, or neglected paintwork. We tailor the job to the condition in front of us instead of forcing every vehicle into the same box.',
  ],
  includedHeading: 'What is typically included',
  includedIntro:
    'The exact depth depends on the package you choose, but most detailing appointments are built around the essentials below.',
  includedItems: [
    {
      title: 'Safe exterior wash',
      description:
        'A careful hand wash focused on lifting grime safely while cleaning wheels, tires, and the visible exterior surfaces.',
    },
    {
      title: 'Interior vacuum and reset',
      description:
        'Carpets, mats, seats, and tight areas get the kind of attention a normal car wash never touches.',
    },
    {
      title: 'Dash, console, and trim cleanup',
      description:
        'High-touch surfaces are wiped down and refreshed so the cabin looks cleaner and more put together.',
    },
    {
      title: 'Glass cleaning',
      description:
        'Interior and exterior glass is cleaned for a clearer view and a more finished overall result.',
    },
    {
      title: 'Final dressing and finishing touches',
      description:
        'Trim, tires, and final touch points are checked so the vehicle looks crisp when we wrap up.',
    },
    {
      title: 'Package-matched depth',
      description:
        'Basic, Standard, and Premium packages each allow a different level of time and refinement based on your goals.',
    },
  ],
  bestFor: [
    'Daily drivers that need a full reset',
    'Family vehicles that see heavy interior use',
    'Seasonal cleanups after winter salt or summer dust',
    'Vehicles being prepped for sale, trade-in, or photos',
  ],
  pricingIntro:
    'Our detailing packages follow Nova Detailing’s current structure. We can recommend the right level once we know the vehicle and condition.',
  pricingCards: [
    {
      name: 'Basic Detail',
      price: 'Starts at $120',
      description:
        'A strong maintenance-level option for lighter cleanup and regular upkeep.',
    },
    {
      name: 'Standard Detail',
      price: 'Starts at $180',
      description:
        'A more complete interior and exterior refresh for vehicles that need added time and attention.',
    },
    {
      name: 'Premium Detail',
      price: 'Starts at $250',
      description:
        'Our deepest detailing option for vehicles with heavier buildup or owners who want a fuller reset.',
    },
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'Mobile and convenient',
      description:
        'We come to your home, workplace, or lot so you do not need to shuffle your day around a shop visit.',
    },
    {
      title: 'Honest package guidance',
      description:
        'If your vehicle only needs a lighter service, we will tell you. If it needs more time, we will tell you that too.',
    },
    {
      title: 'Built around real condition',
      description:
        'We price and work based on what the vehicle actually needs, not just what sounds good on paper.',
    },
    {
      title: 'Results that feel worth it',
      description:
        'The goal is not just a cleaner car for a day. It is a vehicle that feels noticeably better to get back into.',
    },
  ],
  ctaHeading: 'Need a detail, but not sure which package fits?',
  ctaText:
    'Send us a quick message and we can point you toward the right package based on your vehicle, condition, and goals.',
};

export const protectionPageContent: ServicePageContent = {
  title: 'Vehicle Protection That Keeps the Finish Glossier and Easier to Maintain',
  description:
    'Our protection services are built for owners who want more than a clean look for one day. We help set the vehicle up so it stays easier to wash, easier to maintain, and better protected from daily wear.',
  eyebrow: 'Ceramic Coating + Surface Protection',
  heroSummary:
    'Around Kentville and the Annapolis Valley, vehicles deal with sun, rain, salt, grime, and regular road use. The right protection package helps your finish hold up better between washes and seasons.',
  heroBadges: ['Ceramic Coating: Quote Only', 'Prep starts from $180', 'Mobile service available'],
  heroNote:
    'Protection packages are quoted based on the vehicle, prep time, and how much correction the surfaces need beforehand.',
  image: protectionImage,
  imageAlt: 'A protected vehicle finish with strong gloss and reflection',
  overview: [
    'Vehicle protection is about preserving the condition you have now and making future maintenance easier. That usually means starting with a clean, properly prepped surface before any protection goes on.',
    'For some vehicles, a Standard or Premium detail gives us the clean foundation we need. For others, extra prep or correction is the bigger part of the job. That is why ceramic coating is handled as a quote-based service instead of a flat one-size-fits-all price.',
  ],
  includedHeading: 'What the protection process focuses on',
  includedIntro:
    'The final package is customized, but these are the areas we focus on during protection-based appointments.',
  includedItems: [
    {
      title: 'Prep wash and decontamination',
      description:
        'Protection only works well when the surface underneath it is properly cleaned and ready.',
    },
    {
      title: 'Surface inspection',
      description:
        'We look at the paint and finish condition so we can recommend the right prep and protection path.',
    },
    {
      title: 'Protection matched to your goals',
      description:
        'Some owners want easier maintenance, some want longer-term durability, and some want both.',
    },
    {
      title: 'Cleaner, glossier finish',
      description:
        'The goal is a finish that looks sharper and is easier to keep looking that way after the appointment.',
    },
    {
      title: 'Aftercare guidance',
      description:
        'We walk you through how to care for the vehicle afterward so the protection keeps paying off.',
    },
    {
      title: 'Quote-based accuracy',
      description:
        'We quote around real prep needs instead of giving you a number that ignores what the vehicle actually needs.',
    },
  ],
  bestFor: [
    'Newer vehicles you want to keep looking sharp',
    'Daily drivers parked outside year-round',
    'Owners who want easier maintenance between washes',
    'Vehicles getting ready for long-term ownership',
  ],
  pricingIntro:
    'Most protection jobs start with a clean prep base and then move into a quote-based coating recommendation.',
  pricingCards: [
    {
      name: 'Standard Detail Prep',
      price: 'Starts at $180',
      description:
        'A common starting point when the vehicle needs a solid cleanup before protection is applied.',
    },
    {
      name: 'Premium Detail Prep',
      price: 'Starts at $250',
      description:
        'Best when the vehicle needs more time, more cleanup, or a stronger reset before protection work.',
    },
    {
      name: 'Ceramic Coating',
      price: 'Quote Only',
      description:
        'Quoted based on vehicle size, prep needs, paint condition, and protection goals.',
    },
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'Prep comes first',
      description:
        'We do not rush straight to protection if the vehicle first needs more cleanup or prep work.',
    },
    {
      title: 'Protection with a purpose',
      description:
        'We focus on helping the vehicle stay easier to maintain, not just selling a buzzword package.',
    },
    {
      title: 'Clear quote process',
      description:
        'Because prep varies so much from vehicle to vehicle, we keep the quote process straightforward and honest.',
    },
    {
      title: 'Good fit for long-term owners',
      description:
        'If you plan to keep the vehicle and want the finish to stay easier to care for, this is where protection pays off.',
    },
  ],
  ctaHeading: 'Thinking about ceramic coating or long-term protection?',
  ctaText:
    'Send us a message with the vehicle and what you want from the finish, and we can guide you toward the right prep and protection plan.',
};

export const correctionPageContent: ServicePageContent = {
  title: 'Scratch Removal and Paint Correction That Brings Clarity Back',
  description:
    'If the paint looks tired, hazy, swirled, or scratched up, our scratch removal and paint correction work is built to bring back gloss, depth, and a cleaner overall finish.',
  eyebrow: 'Scratch Removal + Paint Correction',
  heroSummary:
    'This service is about improving the paint you already have through careful polishing and correction work. The right result depends on paint condition, scratch depth, and how far you want to go.',
  heroBadges: ['Paint Correction: Quote Only', 'Scratch Removal: Quote Only', 'Ideal before ceramic coating'],
  heroNote:
    'Paint correction is always quoted because every vehicle, paint system, and defect level is different. Some deeper scratches may need touch-up or body shop work instead of polishing alone.',
  image: correctionImage,
  imageAlt: 'Vehicle paint correction work restoring gloss and reducing swirls',
  overview: [
    'Paint correction is designed to reduce or remove swirl marks, oxidation, light scratches, hazing, and the dull finish that builds up over time. It is one of the biggest visual upgrades you can make to a vehicle.',
    'The important part is being realistic. Some defects polish out beautifully, some improve a lot, and some are too deep to fully remove safely. We will always be straight with you about what the finish can realistically do.',
  ],
  includedHeading: 'What correction work usually involves',
  includedIntro:
    'Every correction job is different, but these are the core steps we focus on before and during the polishing process.',
  includedItems: [
    {
      title: 'Wash and decontamination',
      description:
        'The surface needs to be clean and stripped back before correction work can be evaluated properly.',
    },
    {
      title: 'Paint inspection and test spot',
      description:
        'We assess the finish and test a correction approach before committing the whole vehicle to a process.',
    },
    {
      title: 'Machine polishing',
      description:
        'The main correction step, tailored to reduce defects while respecting the paint that is there.',
    },
    {
      title: 'Refinement for clarity and gloss',
      description:
        'After correction, we refine the finish so the paint looks sharper and more even overall.',
    },
    {
      title: 'Protection after correction',
      description:
        'Once the finish is improved, we can help lock it in with a protection plan that makes sense.',
    },
    {
      title: 'Honest result expectations',
      description:
        'We focus on real improvement and smart correction, not overpromising what damaged paint can do.',
    },
  ],
  bestFor: [
    'Vehicles with swirl marks, haze, or dull paint',
    'Owners wanting a stronger finish before sale or show season',
    'Vehicles being prepped for ceramic coating',
    'Drivers who want the paint to look sharper again without repainting',
  ],
  pricingIntro:
    'Correction work is quote-based because the time and process depend entirely on the paint condition and the level of improvement you want.',
  pricingCards: [
    {
      name: 'Paint Inspection',
      price: 'Quote Only',
      description:
        'We assess the finish, defect level, and best approach before recommending the work.',
    },
    {
      name: 'Scratch Removal / Correction',
      price: 'Quote Only',
      description:
        'Quoted based on vehicle size, paint condition, and whether the job needs a lighter or deeper correction approach.',
    },
    {
      name: 'Protection Add-On',
      price: 'Quote Only',
      description:
        'Many owners choose to protect the finish afterward so the correction result lasts longer.',
    },
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'We correct with restraint',
      description:
        'The goal is meaningful improvement without pretending every scratch should be chased the same way.',
    },
    {
      title: 'Realistic defect assessment',
      description:
        'We will tell you what can likely improve, what can be softened, and what may remain visible.',
    },
    {
      title: 'Better gloss, not just shine',
      description:
        'Good correction brings back clarity and depth, not just a temporary polished look.',
    },
    {
      title: 'Great prep for protection',
      description:
        'If you are thinking about ceramic coating, correction is often the right place to start.',
    },
  ],
  ctaHeading: 'Want to know if your paint can be corrected?',
  ctaText:
    'Send us a few photos or chat with us directly and we can tell you whether your paint looks like a good candidate for scratch removal or correction.',
};

export const newVehiclePageContent: ServicePageContent = {
  title: 'New Vehicle Detailing That Protects the Purchase From Day One',
  description:
    'A new vehicle still benefits from proper prep, cleanup, and protection. We help new owners start with a cleaner finish, better protection planning, and a stronger long-term baseline.',
  eyebrow: 'New Vehicle Prep',
  heroSummary:
    'Dealer delivery does not always mean perfect. New vehicles can still arrive with dust, residues, light marring, and surfaces that are ready for smarter protection than what most lot prep gives them.',
  heroBadges: ['Standard from $180', 'Premium from $250', 'Ceramic Coating: Quote Only'],
  heroNote:
    'Many new vehicle jobs start from our Standard or Premium detailing packages, then move into quote-based protection depending on how far you want to go.',
  image: newVehicleImage,
  imageAlt: 'A new vehicle being detailed and protected soon after delivery',
  overview: [
    'New vehicle detailing is about protecting the purchase early, while the finish is still fresh and easier to preserve. It is a smart time to clean up dealer residue, refine the presentation, and set the vehicle up for easier maintenance.',
    'Some owners want a clean prep and light refresh. Others want to start with ceramic coating or stronger long-term protection right away. We can build the appointment around how you plan to use and keep the vehicle.',
  ],
  includedHeading: 'What we focus on for new vehicle prep',
  includedIntro:
    'The exact service depends on the vehicle and your goals, but these are the areas that usually matter most on a newer purchase.',
  includedItems: [
    {
      title: 'Careful initial wash',
      description:
        'We start with a safe clean to remove shipping dust, lot grime, and surface contamination.',
    },
    {
      title: 'Light finish refinement',
      description:
        'If needed, we can improve light marring or marks so the paint starts off looking cleaner and sharper.',
    },
    {
      title: 'Interior touch-up and reset',
      description:
        'A new vehicle still benefits from a proper wipe-down, glass cleanup, and finishing attention inside.',
    },
    {
      title: 'Protection planning',
      description:
        'This is the best time to talk through ceramic coating or other protection options before wear sets in.',
    },
    {
      title: 'Owner-focused setup',
      description:
        'Some owners care most about looks, some about easy maintenance, and some about preserving value. We plan around that.',
    },
    {
      title: 'Strong baseline from the start',
      description:
        'Starting early helps keep the finish easier to maintain over the long run.',
    },
  ],
  bestFor: [
    'Brand-new purchases and recent deliveries',
    'Owners planning to keep the vehicle for years',
    'Anyone wanting ceramic coating from the beginning',
    'Drivers who want easier maintenance before the vehicle picks up wear',
  ],
  pricingIntro:
    'For newer vehicles, the starting point is usually a Standard or Premium detail, with protection options added based on your goals.',
  pricingCards: [
    {
      name: 'Standard Detail',
      price: 'Starts at $180',
      description:
        'A great fit for new vehicles that need a strong cleanup and prep without going all the way to a deeper reset.',
    },
    {
      name: 'Premium Detail',
      price: 'Starts at $250',
      description:
        'Best when you want more time, more refinement, or a stronger foundation before added protection.',
    },
    {
      name: 'Ceramic Coating',
      price: 'Quote Only',
      description:
        'Quoted separately based on the vehicle, prep needs, and how much protection you want from day one.',
    },
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'Ideal timing for protection',
      description:
        'It is much easier to preserve a newer finish early than to fix years of wear later.',
    },
    {
      title: 'Better than typical lot prep',
      description:
        'We take more time and care than the average dealership handoff clean usually allows.',
    },
    {
      title: 'Built around ownership goals',
      description:
        'Whether you want a clean fresh start or long-term protection, we can shape the service around that.',
    },
    {
      title: 'Strong long-term value',
      description:
        'Starting with better prep and protection can help the vehicle stay easier to maintain and present better over time.',
    },
  ],
  ctaHeading: 'Want to protect the new vehicle properly from the start?',
  ctaText:
    'Reach out with the make, model, and what level of protection you want, and we can help plan the right first appointment.',
};
