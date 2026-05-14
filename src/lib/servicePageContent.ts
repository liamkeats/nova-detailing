import type { ImageMetadata } from 'astro';

import detailingImage from '../assets/images/car-1.webp';
import protectionImage from '../assets/images/car-2.webp';
import correctionImage from '../assets/images/car-3.webp';
import newVehicleImage from '../assets/images/car-4.webp';

export interface ServiceFeature {
  title: string;
  description: string;
}

export interface ServicePriceCardDetailSection {
  title: string;
  items: string[];
}

export interface ServicePriceCard {
  name: string;
  price: string;
  description: string;
  details?: ServicePriceCardDetailSection[];
  note?: string;
}

export interface ServiceTrustPoint {
  title: string;
  description: string;
}

export interface ServiceTableRow {
  label: string;
  values: string[];
}

export interface ServiceTableSection {
  label: string;
  title: string;
  intro: string;
  columns: string[];
  rows: ServiceTableRow[];
  footnote?: string;
  noteTitle?: string;
  noteItems?: string[];
}

export interface ServiceStep {
  title: string;
  description: string;
}

export interface ServiceStepsSection {
  label: string;
  title: string;
  intro: string;
  steps: ServiceStep[];
}

export interface ServiceListColumn {
  title: string;
  intro?: string;
  items: string[];
}

export interface ServiceColumnsSection {
  label: string;
  title: string;
  intro: string;
  columns: ServiceListColumn[];
}

export interface ServiceAddOnItem {
  name: string;
  price: string;
  description: string;
}

export interface ServiceAddOnSection {
  label: string;
  title: string;
  intro: string;
  items: ServiceAddOnItem[];
  note?: string;
}

export interface ServiceMaintenancePlan {
  cadence: string;
  price: string;
  description: string;
}

export interface ServiceMaintenanceSection {
  label: string;
  title: string;
  intro: string;
  qualificationNote: string;
  plans: ServiceMaintenancePlan[];
  includesHeading: string;
  includes: string[];
  conditionNote: string;
  ctaHeading: string;
  ctaText: string;
  primaryButtonLabel: string;
  secondaryButtonLabel: string;
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
  educationSection?: ServiceColumnsSection;
  processSection?: ServiceStepsSection;
  includedHeading: string;
  includedIntro: string;
  includedItems: ServiceFeature[];
  pricingSectionLabel: string;
  pricingSectionTitle: string;
  bestFor: string[];
  pricingIntro: string;
  pricingCards: ServicePriceCard[];
  pricingTableSection?: ServiceTableSection;
  estimatorSection?: ServiceStepsSection;
  comparisonTableSection?: ServiceTableSection;
  addOnSection?: ServiceAddOnSection;
  maintenanceSection?: ServiceMaintenanceSection;
  pricingAdjustments: string[];
  trustPoints: ServiceTrustPoint[];
  ctaHeading: string;
  ctaText: string;
}

const commonAdjustments = [
  'Basic is only for vehicles already in decent condition. Heavy salt, heavy stains, bad pet hair, smoke smell, or problem cleanup should move into Premium, Executive, or the right add-ons.',
  'Larger SUVs, trucks, vans, and third-row vehicles take more time and usually cost more than a regular sedan.',
  'Heavy pet hair, salt buildup, staining, smoke smell, and extra cleanup time can all increase the final quote.',
  'Truck beds, engine bays, and specialty add-ons are priced separately when requested.',
  'We confirm the final price before the appointment once we know the vehicle, condition, and what you want done.',
];

export const detailingPageContent: ServicePageContent = {
  title: 'Mobile Detailing Packages Built Around Your Vehicle',
  description:
    'Compare Interior, Exterior, Full Detail, and Executive packages, see what affects the starting price, and get a clearer idea of what your vehicle may need before you book.',
  eyebrow: 'Detailing Packages + Quote Guide',
  heroSummary:
    'Most customers start here because they want to know which package fits, what changes the quote, and why size or condition can affect the final price.',
  heroBadges: ['Basic Detail $195+', 'Standard Detail $375+', 'Premium Detail $575+', 'Executive $850+'],
  heroNote:
    'These are starting prices for regular-sized vehicles in average condition. Larger vehicles, extra rows, pet hair, stains, smoke smell, truck beds, engine bays, or heavier cleanup can increase the final price.',
  image: detailingImage,
  imageAlt: 'A freshly cleaned vehicle exterior after a full mobile detail',
  overview: [
    'Our detailing packages are built to cover very different kinds of vehicles. Some need a light refresh, some need the main full detail, some need a deeper reset, and some need a high-end package with more add-ons included.',
    'That is why we price detailing in layers instead of pretending every vehicle takes the same time. Use the package guide, vehicle-size notes, and add-on list below to get closer to the right starting point before you reach out.',
  ],
  includedHeading: 'What a detailing appointment is built around',
  includedIntro:
    'The exact package depth changes, but most detailing appointments are built around the same core categories below.',
  includedItems: [
    {
      title: 'Interior reset',
      description:
        'Vacuuming, surface wipe-downs, glass cleaning, mats, and the kind of interior cleanup that makes the cabin feel noticeably fresher again.',
    },
    {
      title: 'Exterior wash and finish work',
      description:
        'A careful hand wash with attention on wheels, tires, visible trim, and the overall finished look of the exterior.',
    },
    {
      title: 'Package-based depth',
      description:
        'Basic is the light refresh, Standard is the main full detail, Premium is the deeper reset, and Executive is the high-end package with more add-ons included.',
    },
    {
      title: 'Condition-based extras',
      description:
        'Heavier issues like pet hair, salt, smoke smell, stain work, or heavily neglected areas can require extra time beyond the base package.',
    },
    {
      title: 'Mobile convenience',
      description:
        'We come to your location when the setup works, so most customers can get the vehicle cleaned without rearranging the whole day around a shop visit.',
    },
    {
      title: 'A quote that matches the real vehicle',
      description:
        'The goal is to price the vehicle honestly based on its size, condition, and requested extras instead of burying that conversation until later.',
    },
  ],
  pricingSectionLabel: 'Package overview',
  pricingSectionTitle: 'Choose the level first, then narrow it down',
  pricingIntro:
    'Think of Basic as a light refresh, Standard as the main full detail, Premium as the deeper reset, and Executive as the high-end package with more add-ons included.',
  pricingCards: [
    {
      name: 'Basic Detail',
      price: '$195+',
      description:
        'Best for a light full-vehicle refresh when the vehicle is already in decent condition.',
      details: [
        {
          title: 'Best for',
          items: [
            'Vehicles that are already in decent shape',
            'Customers who want a lighter refresh',
            'Maintenance-style cleanup instead of a deep reset',
          ],
        },
        {
          title: 'Usually includes',
          items: [
            'Interior vacuum',
            'Basic wipe down of main surfaces',
            'Floor mats cleaned',
            'Exterior hand wash',
            'Wheels and tires cleaned',
          ],
        },
        {
          title: 'Watch for',
          items: [
            'Not meant for heavy stains, heavy salt, smoke smell, or major pet hair',
            'Larger vehicles, extra rows, or very dirty vehicles may increase the final price',
          ],
        },
      ],
      note: 'Basic is for vehicles that are already in decent condition. If the vehicle needs a real reset, Standard or Premium usually makes more sense.',
    },
    {
      name: 'Standard Detail',
      price: '$375+',
      description:
        'The main regular full detail for most daily drivers that need both interior and exterior attention.',
      details: [
        {
          title: 'Best for',
          items: [
            'Most daily drivers',
            'Vehicles with normal dirt, dust, and buildup',
            'Customers who want a proper interior and exterior clean without going all the way to Premium',
          ],
        },
        {
          title: 'Usually includes',
          items: [
            'Everything in Basic Detail',
            'More detailed interior wipe down',
            'More complete vacuuming and mat cleaning',
            'Light spot cleaning where needed',
            'Exterior hand wash',
            'Wheels, tires, and door jambs cleaned',
            'Exterior finish for a cleaner final look',
          ],
        },
        {
          title: 'Watch for',
          items: [
            'Heavy stains, major pet hair, smoke smell, or heavy salt may require Premium or extra charges',
            'Oversized vehicles or vehicles with extra rows may increase the final price',
          ],
        },
      ],
      note: 'Standard is the safest starting point for most normal full-detail customers.',
    },
    {
      name: 'Premium Detail',
      price: '$575+',
      description:
        'Built as a deeper reset for heavier cleanup, more neglected vehicles, or owners who want more time spent on the detail.',
      details: [
        {
          title: 'Best for',
          items: [
            'Vehicles that need a deeper reset',
            'Dirtier interiors with more buildup',
            'Customers who want extra time spent on problem areas',
            'Vehicles that have not been detailed in a while',
          ],
        },
        {
          title: 'Usually includes',
          items: [
            'Everything in Standard Detail',
            'Deeper interior cleaning',
            'More detailed cleaning of cracks, trim, and tight areas',
            'More attention to stains and dirty areas',
            'More complete mat and floor cleaning',
            'Exterior wash and finish',
            'Extra time spent improving the overall result',
          ],
        },
        {
          title: 'Watch for',
          items: [
            'Extreme stains, excessive pet hair, smoke smell, mold, or biohazard may still need a custom quote',
            'Final price depends on condition, vehicle size, and add-ons',
          ],
        },
      ],
      note: 'Premium is the better choice when the vehicle needs a noticeable reset, not just a lighter clean.',
    },
    {
      name: 'Executive Detail',
      price: '$850+',
      description:
        'The high-end non-ceramic package for customers who want Premium plus more add-ons included.',
      details: [
        {
          title: 'Best for',
          items: [
            'Customers who want the most complete non-ceramic detail',
            'Higher-end vehicles or owners who want the best result possible',
            'Vehicles needing extra time across the interior and exterior',
            'Customers who want more add-ons included instead of a basic clean',
          ],
        },
        {
          title: 'Usually includes',
          items: [
            'Everything in Premium Detail',
            'Extra time on detailed interior areas',
            'Extra attention to problem spots',
            'More complete exterior finish',
            'More included add-on style work depending on the vehicle',
            'Priority-level full vehicle cleanup',
          ],
        },
        {
          title: 'Watch for',
          items: [
            'This is still starting-at pricing',
            'Final quote depends on vehicle size, condition, add-ons, and customer expectations',
            'Ceramic coating and paint correction are still quote-only services',
          ],
        },
      ],
      note: 'Executive is for customers who want the most complete detailing package before moving into quote-only services like ceramic coating or paint correction.',
    },
  ],
  pricingTableSection: {
    label: 'Starting pricing',
    title: 'Interior, exterior, full detail, and Executive starting prices',
    intro:
      'These are starting prices for regular-sized vehicles in average condition. Final pricing can change based on size, condition, and add-ons.',
    columns: ['Interior Only', 'Exterior Only', 'Interior + Exterior'],
    rows: [
      {
        label: 'Basic',
        values: ['$125+', '$90+', '$195+'],
      },
      {
        label: 'Standard',
        values: ['$225+', '$175+', '$375+'],
      },
      {
        label: 'Premium',
        values: ['$350+', '$275+', '$575+'],
      },
      {
        label: 'Executive',
        values: ['Custom', 'Custom', '$850+'],
      },
    ],
    footnote:
      'Starting prices are based on regular-sized vehicles in average condition.',
    noteTitle: 'Final pricing may increase when:',
    noteItems: [
      'The vehicle is larger, has extra rows, or falls into the oversized category.',
      'Pet hair, heavy salt, staining, smoke smell, or major buildup adds extra cleanup time.',
      'Truck beds, engine bays, or extra work outside the base package is requested.',
      'The vehicle needs more than the normal amount of time to get it back to a solid finished result.',
    ],
  },
  estimatorSection: {
    label: 'Help me estimate my detail',
    title: 'A simple way to estimate where your vehicle starts',
    intro:
      'You do not need exact measurements. Most people can get pretty close just by working through the four checks below.',
    steps: [
      {
        title: '1. Pick your package',
        description:
          'Basic is a light refresh, Standard is the main full detail, Premium is the deeper reset, and Executive is the high-end non-ceramic package.',
      },
      {
        title: '2. Pick interior, exterior, or both',
        description:
          'Interior-only and exterior-only bookings start lower. Interior + exterior gives you the full package price shown above.',
      },
      {
        title: '3. Check vehicle size',
        description:
          'Sedans and small cars usually start at base price. Small SUVs and crossovers may stay at base price or increase slightly. Large SUVs, trucks, vans, and third-row vehicles should expect an oversized fee. Truck bed cleaning is extra when requested or heavily dirty.',
      },
      {
        title: '4. Check condition',
        description:
          'If the vehicle has pet hair, heavy salt, stains, smoke smell, or is much dirtier than average, expect the final quote to land above the starting price.',
      },
    ],
  },
  comparisonTableSection: {
    label: 'Package comparison',
    title: 'What changes between Basic, Standard, Premium, and Executive',
    intro:
      'This table is here to help you choose the level, not to replace the final quote.',
    columns: ['Basic', 'Standard', 'Premium', 'Executive'],
    rows: [
      {
        label: 'Overall feel',
        values: ['Light refresh', 'Main full detail', 'Deeper reset', 'Top full-detail package'],
      },
      {
        label: 'Best for',
        values: [
          'Vehicles already in decent condition',
          'Most daily drivers and family vehicles',
          'Heavier buildup or owners wanting more time spent',
          'Customers who want our most complete detailing service',
        ],
      },
      {
        label: 'Interior level',
        values: [
          'Basic vacuum and wipe-down',
          'Detailed wipe-down with light spot work',
          'Deeper reset with more extractor use where needed',
          'Premium interior with shampooing and heavier attention where needed',
        ],
      },
      {
        label: 'Exterior level',
        values: [
          'Simple exterior wash',
          'Proper exterior clean and finish',
          'Premium exterior with spray wax / paint sealant',
          'Premium exterior plus ceramic spray sealant',
        ],
      },
      {
        label: 'Best result',
        values: [
          'Cleaner daily driver',
          'Fresh, properly cleaned vehicle',
          'Deep reset inside and out',
          'The highest level full detail we offer',
        ],
      },
    ],
  },
  addOnSection: {
    label: 'Add-ons',
    title: 'Popular upgrades and extra cleanup items',
    intro:
      'These are common add-ons customers ask about when a vehicle needs more than the base detail alone.',
    items: [
      {
        name: 'Pet Hair Removal',
        price: '$60+',
        description: 'For visible pet hair beyond a normal vacuum.',
      },
      {
        name: 'Heavy Salt Treatment',
        price: '$60+',
        description: 'For winter salt buildup or crusted carpets and mats.',
      },
      {
        name: 'Heavy Stain Removal',
        price: '$40+ per stain',
        description: 'For individual stain treatment beyond normal light spot cleaning.',
      },
      {
        name: 'Smoke Smell Treatment',
        price: '$75+',
        description: 'For smoke odor. Severe cases may need a custom quote.',
      },
      {
        name: 'Truck Bed Rinse',
        price: '$35+',
        description: 'Basic truck bed rinse only, not a full truck bed restoration.',
      },
      {
        name: 'Engine Bay Cleaning',
        price: '$60+',
        description: 'Light engine bay clean/detail when the setup is safe and appropriate.',
      },
      {
        name: 'Seat or Mat Shampooing',
        price: '$30 each',
        description: 'Priced per seat or mat when deeper shampooing is needed.',
      },
      {
        name: 'Carpet Shampooing',
        price: '$75+',
        description: 'For carpet areas beyond basic spot work.',
      },
      {
        name: 'Spray Wax / Paint Sealant',
        price: '$75+',
        description: 'Basic gloss and short-term protection.',
      },
      {
        name: 'Ceramic Spray Sealant',
        price: '$125+',
        description: 'Better water-beading protection, not a true ceramic coating.',
      },
      {
        name: 'Clay Bar Treatment',
        price: '$100+',
        description: 'Paint decontamination add-on.',
      },
      {
        name: 'Iron/Fallout Removal',
        price: '$75+',
        description: 'Removes embedded iron contamination.',
      },
      {
        name: 'Heavy Tar/Bug Removal',
        price: '$50+',
        description: 'For heavy tar, sap, bug buildup, or grime.',
      },
      {
        name: 'Headlight Restoration',
        price: '$100+',
        description: 'Separate add-on, not included in Executive.',
      },
    ],
    note: 'If a customer starts adding lots of extras to Basic or Standard, we may recommend Premium or Executive instead. It keeps the quote cleaner and avoids underquoting.',
  },
  maintenanceSection: {
    label: 'Recurring details',
    title: 'Keep It Clean With Recurring Maintenance',
    intro:
      'Once a vehicle has had the right reset, recurring maintenance makes it easier to keep clean through the year without starting from scratch every visit.',
    qualificationNote:
      'Maintenance plans are available after an initial Standard, Premium, Executive, or New Vehicle Prep service. We reset the vehicle first so future visits can focus on upkeep instead of a full clean every time.',
    plans: [
      {
        cadence: 'Every 2 Weeks',
        price: '$125+ per visit',
        description:
          'Best for high-use vehicles, work vehicles, kids, pets, or messy daily drivers that need frequent upkeep.',
      },
      {
        cadence: 'Monthly',
        price: '$175+ per visit',
        description:
          'Best for most recurring customers who want the vehicle kept consistently clean without waiting too long between visits.',
      },
      {
        cadence: 'Every 2 Months',
        price: '$250+ per visit',
        description:
          'Best for lighter upkeep between deeper details when the vehicle is still being kept in fairly good shape.',
      },
    ],
    includesHeading: 'What a maintenance detail usually includes',
    includes: [
      'Maintenance vacuum',
      'Interior wipe down',
      'Interior windows',
      'Floor mats cleaned',
      'Light cracks and crevices',
      'Exterior hand wash',
      'Wheels and tires cleaned',
      'Exterior windows',
      'Quick spray protection if included or added',
    ],
    conditionNote:
      'Maintenance pricing assumes the vehicle has already been reset and is being kept in reasonable condition. Heavy pet hair, salt, staining, smoke smell, excessive dirt, skipped maintenance, or shampooing may require a regular detail or add-ons instead.',
    ctaHeading: 'Want to keep the vehicle easier to manage year-round?',
    ctaText:
      'If you are thinking about recurring upkeep, let us know after the first reset detail and we can talk through which schedule makes the most sense for your vehicle.',
    primaryButtonLabel: 'Ask About Recurring Details',
    secondaryButtonLabel: 'Set Up a Maintenance Plan',
  },
  bestFor: [
    'Drivers who want a clear starting point before asking for a quote',
    'Family vehicles, commuters, and daily drivers that need a proper reset',
    'Owners comparing light upkeep against a fuller deep-clean package',
    'Anyone trying to understand why vehicle size or condition changes the quote',
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'Pricing that explains itself',
      description:
        'The goal is to help you understand the starting point before you message us, not hide all the real pricing logic until later.',
    },
    {
      title: 'Honest package guidance',
      description:
        'If your vehicle only needs Basic, we will say that. If it needs Premium or extra add-ons, we will say that too.',
    },
    {
      title: 'Vehicle-by-vehicle quoting',
      description:
        'Two vehicles can share the same package but still price differently if one is much larger or much dirtier.',
    },
    {
      title: 'Mobile detailing that fits real life',
      description:
        'You can get the vehicle cleaned at home or work instead of burning time driving to a shop and arranging pickup later.',
    },
  ],
  ctaHeading: 'Want help picking the right detail before you book?',
  ctaText:
    'Send us the vehicle, package idea, and a few photos if you have them. We can usually tell you pretty quickly whether you are in the right starting range.',
};

export const protectionPageContent: ServicePageContent = {
  title: 'Vehicle Protection, Ceramic Spray, and True Ceramic Coating',
  description:
    'Vehicle protection is not just about adding a coating. It starts with inspection, cleaning, decontamination, and sometimes polishing or paint correction before the coating even goes on.',
  eyebrow: 'Ceramic Coating + Vehicle Protection',
  heroSummary:
    'This page explains what ceramic coating actually does, why prep matters, and why we do not coat dirty or contaminated paint just to rush the job.',
  heroBadges: ['Spray Wax $75+', 'Ceramic Spray $125+', 'True Ceramic quote required'],
  heroNote:
    'Ceramic coating is quoted after we inspect the vehicle because wash, decontamination, polishing, or correction may all be needed before the coating can be applied properly.',
  image: protectionImage,
  imageAlt: 'A vehicle finish with strong gloss after prep and protection work',
  overview: [
    'Protection can mean a simple spray wax, a stronger ceramic spray sealant, or a true ceramic coating. The right option depends on your goal, the vehicle condition, and how much prep the paint needs.',
    'Ceramic spray sealant is not the same as a true ceramic coating. True ceramic coating is quote-only because size, prep, paint condition, coating choice, and workspace can all change the job.',
  ],
  educationSection: {
    label: 'What it actually does',
    title: 'What ceramic coating helps with, and what it does not',
    intro:
      'Coating is a great protection upgrade when the paint is properly prepared, but it is important to know what it can and cannot realistically do.',
    columns: [
      {
        title: 'What ceramic coating helps with',
        items: [
          'More gloss and a cleaner finished look',
          'Easier washing and maintenance afterward',
          'Better water and dirt release',
          'UV and environmental protection support',
          'A surface that is easier to keep looking sharp between washes',
        ],
      },
      {
        title: 'What ceramic coating does not do',
        items: [
          'It is not scratch-proof',
          'It does not fix already damaged paint by itself',
          'It does not remove swirl marks or scratches without polishing',
          'It is not a shortcut around washing and decontamination',
          'It does not replace realistic maintenance afterward',
        ],
      },
    ],
  },
  processSection: {
    label: 'Protection process',
    title: 'How we approach ceramic coating and protection work',
    intro:
      'A protection job only works when the prep is taken seriously. This is the normal flow we build around.',
    steps: [
      {
        title: '1. Inspection',
        description: 'We start by looking at the vehicle, paint condition, and your end goal.',
      },
      {
        title: '2. Wash',
        description: 'The vehicle is safely washed so the real condition can be seen clearly.',
      },
      {
        title: '3. Decontamination',
        description: 'Embedded contamination is removed before protection is considered.',
      },
      {
        title: '4. Paint inspection',
        description: 'We check for swirl marks, hazing, scratches, and other defects in the finish.',
      },
      {
        title: '5. Polish or paint correction if needed',
        description: 'If the finish needs improvement first, we address that before coating.',
      },
      {
        title: '6. Panel prep wipe',
        description: 'The surface is stripped and readied so the coating bonds properly.',
      },
      {
        title: '7. Coating application',
        description: 'The chosen coating is applied methodically panel by panel.',
      },
      {
        title: '8. Cure time',
        description: 'The coating needs proper time to set up before normal use and washing.',
      },
      {
        title: '9. Aftercare instructions',
        description: 'We explain how to care for the vehicle so the protection performs the way it should.',
      },
    ],
  },
  includedHeading: 'What goes into a protection appointment',
  includedIntro:
    'Some vehicles only need a lighter prep. Others need more polishing or correction before protection makes sense. These are the main buckets we plan around.',
  includedItems: [
    {
      title: 'Vehicle-specific prep',
      description:
        'We build the prep around the condition of the actual vehicle instead of pretending every coating job starts from the same paint.',
    },
    {
      title: 'Contamination removal',
      description:
        'A coating should go onto properly cleaned paint, not over embedded grime or contaminants.',
    },
    {
      title: 'Paint-quality check',
      description:
        'If the finish already has visible defects, we talk through whether polishing or correction should happen first.',
    },
    {
      title: 'Protection matched to the goal',
      description:
        'Some owners mainly want easier washing. Others want stronger gloss and long-term protection. The recommendation changes with that goal.',
    },
    {
      title: 'Clear expectations before we start',
      description:
        'We explain what the finish needs before coating so there are no surprises about prep, price, or the final result.',
    },
    {
      title: 'Aftercare support',
      description:
        'Good protection lasts longer when the owner knows how to wash and care for it properly afterward.',
    },
  ],
  pricingSectionLabel: 'Pricing guide',
  pricingSectionTitle: 'Protection pricing depends on the level you want',
  pricingIntro:
    'Spray wax and ceramic spray have simple starting prices. True ceramic coating is quoted after inspection because the prep matters so much.',
  pricingCards: [
    {
      name: 'Spray Wax / Paint Sealant',
      price: '$75+',
      description:
        'Basic gloss and short-term protection. A good add-on for exterior or full details.',
    },
    {
      name: 'Ceramic Spray Sealant',
      price: '$125+',
      description:
        'Better gloss and water-beading than spray wax. This is a premium protection upgrade, not a true ceramic coating.',
    },
    {
      name: 'True Ceramic Coating',
      price: 'Quote Required',
      description:
        'Quoted after inspection because size, prep, paint condition, coating choice, and workspace all matter.',
    },
  ],
  bestFor: [
    'Owners who want easier washing and longer-term finish protection',
    'Newer vehicles you want to keep looking sharp from early on',
    'Daily drivers exposed to sun, road grime, and weather year-round',
    'Anyone who wants the paint properly prepped before investing in coating',
  ],
  pricingAdjustments: commonAdjustments,
  trustPoints: [
    {
      title: 'We do not coat over problems',
      description:
        'If the vehicle needs proper prep first, that comes before the coating conversation.',
    },
    {
      title: 'Clear process from inspection to aftercare',
      description:
        'We explain how the coating job is built so you understand what you are paying for.',
    },
    {
      title: 'Protection that makes maintenance easier',
      description:
        'The point is a vehicle that stays glossier and simpler to clean, not just a buzzword package.',
    },
    {
      title: 'Better fit for long-term owners',
      description:
        'Protection work makes the most sense when you care about preserving the finish over time.',
    },
  ],
  ctaHeading: 'Want to know whether your vehicle is ready for coating?',
  ctaText:
    'Send us the make, model, and a few photos if you have them. We can usually tell you whether the next step is prep, polishing, correction, or a coating quote.',
};

export const correctionPageContent: ServicePageContent = {
  title: 'Paint Correction for Swirls, Haze, and Dull Paint',
  description:
    'Paint correction is for vehicles that still have recoverable paint but need polishing work to improve swirl marks, haze, dullness, and light defects before the finish looks sharp again.',
  eyebrow: 'Paint Correction',
  heroSummary:
    'This page explains what correction can realistically improve, what may still remain visible, and how we think about light enhancement versus deeper correction work.',
  heroBadges: ['Spot Polishing $50/panel', 'Paint Enhancement $400+', 'One-Step $650+'],
  heroNote:
    'Paint correction improves many defects, but not everything can be safely removed. Deep scratches through the clear coat, rock chips, rust, peeling clear coat, or failed paint may need more than polishing alone.',
  image: correctionImage,
  imageAlt: 'Vehicle paint correction work restoring gloss and reducing swirls',
  overview: [
    'Paint correction is the service people usually need when the paint still has life left in it but looks dull, swirled, washed out, or scratched up from regular use and poor wash habits.',
    'The key is being realistic. Some defects improve dramatically. Some only soften. Some are too deep or too damaged to be corrected safely. We would rather explain that honestly than oversell what the paint can do.',
  ],
  educationSection: {
    label: 'What it helps with',
    title: 'What paint correction can improve, and what it may not fully fix',
    intro:
      'Correction is incredibly effective for the right kind of paint damage, but it is still limited by the condition of the finish underneath.',
    columns: [
      {
        title: 'What it usually helps with',
        items: [
          'Swirl marks',
          'Light scratches',
          'Oxidation',
          'Haze',
          'Dull paint',
          'Wash marks and general loss of clarity',
        ],
      },
      {
        title: 'What it may not fully fix',
        items: [
          'Deep scratches through the clear coat',
          'Rock chips',
          'Peeling clear coat',
          'Rust',
          'Failed or badly damaged paint',
        ],
      },
    ],
  },
  includedHeading: 'How we approach correction work',
  includedIntro:
    'Every vehicle is different, but most correction jobs follow the same basic structure before we decide how aggressive to go.',
  includedItems: [
    {
      title: 'Wash and decontamination',
      description:
        'The paint has to be properly cleaned before the true defect level can be inspected.',
    },
    {
      title: 'Paint inspection',
      description:
        'We assess the finish to separate light correctable defects from deeper damage or limitations.',
    },
    {
      title: 'Test spot and process choice',
      description:
        'A test area helps us see whether the vehicle needs a simple enhancement, one-step, or something deeper.',
    },
    {
      title: 'Machine polishing',
      description:
        'This is where the real correction happens, tailored to the paint and the level of improvement being targeted.',
    },
    {
      title: 'Refinement and finish check',
      description:
        'We work toward better clarity, gloss, and overall uniformity instead of just chasing one isolated scratch.',
    },
    {
      title: 'Protection recommendation afterward',
      description:
        'Once the paint looks better, it often makes sense to protect it so the improvement lasts longer.',
    },
  ],
  pricingSectionLabel: 'Correction levels',
  pricingSectionTitle: 'Three common correction starting points',
  pricingIntro:
    'The right level depends on paint condition, vehicle size, and how much improvement you are actually chasing.',
  pricingCards: [
    {
      name: 'Spot Polishing',
      price: '$50 per panel',
      description:
        'For one panel or a small area that needs gloss improvement or light polishing.',
    },
    {
      name: 'Paint Enhancement',
      price: '$400+',
      description:
        'A lighter polishing step for dull paint, better gloss, minor haze, and light swirl improvement.',
    },
    {
      name: 'One-Step Paint Correction',
      price: '$650+',
      description:
        'For swirl and haze reduction across the vehicle with stronger gloss improvement.',
    },
    {
      name: 'Multi-Step Correction',
      price: 'Quote Required',
      description:
        'Used when defects are more serious or expectations are high. Quoted after inspection.',
    },
  ],
  bestFor: [
    'Vehicles with visible swirl marks, haze, or dull paint',
    'Owners preparing the vehicle for coating or long-term protection',
    'Cars that still have healthy paint but need clarity brought back',
    'Anyone wanting to improve the finish without repainting the vehicle',
  ],
  pricingAdjustments: [
    'Vehicle size matters because larger surfaces take more polishing time.',
    'Paint hardness, defect severity, and the number of polishing stages all change the final quote.',
    'Some vehicles need additional prep or follow-up protection after correction.',
    'We confirm whether the paint is a good candidate before promising a result.',
  ],
  trustPoints: [
    {
      title: 'Realistic correction advice',
      description:
        'We tell you what can likely improve, what may only soften, and what may still stay visible.',
    },
    {
      title: 'Improvement over hype',
      description:
        'The goal is a finish that genuinely looks better, not vague promises about perfection.',
    },
    {
      title: 'Good prep for coating',
      description:
        'If you are thinking about ceramic coating, correction is often the step that makes the final result worth it.',
    },
    {
      title: 'Quoted around the real paint',
      description:
        'We price correction around the actual surface, not a generic number that ignores how different one vehicle can be from another.',
    },
  ],
  ctaHeading: 'Not sure whether your paint needs enhancement or full correction?',
  ctaText:
    'Send us a few photos in good light and tell us what bothers you most about the finish. We can usually point you toward the correction level that makes the most sense.',
};

export const newVehiclePageContent: ServicePageContent = {
  title: 'New Vehicle Detailing for a Cleaner Start',
  description:
    'A new vehicle is the best time to inspect, clean, protect, and set up the finish for easier long-term maintenance before normal wear and bad wash habits start stacking up.',
  eyebrow: 'New Vehicle Detailing',
  heroSummary:
    'New vehicles can still have dealer wash marks, transport contamination, dust, fingerprints, or light defects. A proper first detail gives the vehicle a cleaner starting point before regular wear builds up.',
  heroBadges: ['Refresh $195+', 'Prep Detail $250+', 'Protection Package $475+'],
  heroNote:
    'New vehicles can start with a light refresh, move into prep before protection, or get a ceramic spray protection package. True ceramic coating is quoted after inspection.',
  image: newVehicleImage,
  imageAlt: 'A new vehicle being carefully cleaned and protected early in its life',
  overview: [
    'A vehicle being new does not automatically mean the paint is perfect. It may already have dealership wash marks, shipping dust, bonded contamination, fingerprints, light marring, or residues that are worth cleaning up properly before you move into protection.',
    'The value of new vehicle detailing is simple: inspect it early, clean it properly, fix what needs fixing, and protect it before the finish has time to collect months or years of avoidable wear.',
  ],
  educationSection: {
    label: 'Why do it early',
    title: 'What we often find on new vehicles, and why early protection helps',
    intro:
      'New vehicle owners are often surprised by how much benefit there is in getting the first detail and protection plan done properly instead of relying on lot prep alone.',
    columns: [
      {
        title: 'What can still show up on a new vehicle',
        items: [
          'Dealer wash marks',
          'Transport contamination',
          'Dust and fingerprints',
          'Light marring or small finish defects',
          'Residue from delivery prep or lot handling',
        ],
      },
      {
        title: 'Why protection from day one helps',
        items: [
          'It makes the finish easier to maintain from the beginning',
          'It preserves gloss before regular wear sets in',
          'It gives you a cleaner baseline for future washing and detailing',
          'It lets you catch defects early before coating or long-term protection',
          'It helps the vehicle stay sharper-looking over time',
        ],
      },
    ],
  },
  processSection: {
    label: 'Starting point',
    title: 'How we approach a new vehicle appointment',
    intro:
      'The exact path depends on the vehicle and your protection goals, but this is the general flow we build around.',
    steps: [
      {
        title: '1. Inspect the finish',
        description: 'We look for dealer marks, transport contamination, or light defects first.',
      },
      {
        title: '2. Clean it properly',
        description: 'A safe wash and decontamination removes what the vehicle picked up before delivery.',
      },
      {
        title: '3. Correct anything that makes sense',
        description: 'If there are light defects worth addressing early, we talk through that before protection.',
      },
      {
        title: '4. Protect the vehicle for easier upkeep',
        description: 'This can mean a better maintenance baseline now or a stronger coating plan right away.',
      },
    ],
  },
  includedHeading: 'What matters most on a new vehicle detail',
  includedIntro:
    'The point is not just to clean a new vehicle. It is to start it off correctly and make the next few years easier to maintain.',
  includedItems: [
    {
      title: 'Safe initial cleanup',
      description:
        'We remove delivery dust, lot grime, and surface contamination without treating the finish like a rushed handoff clean.',
    },
    {
      title: 'Finish inspection',
      description:
        'This is where we catch wash marks, light defects, or contamination before long-term protection is applied.',
    },
    {
      title: 'Protection planning',
      description:
        'New vehicles are one of the best candidates for ceramic coating or long-term protection because the baseline is still fresh.',
    },
    {
      title: 'Interior touch-up and finishing',
      description:
        'Even a new interior benefits from a proper wipe-down, glass cleaning, and final prep attention.',
    },
    {
      title: 'A cleaner maintenance starting point',
      description:
        'The earlier the vehicle is cleaned and protected properly, the easier it usually is to keep it that way.',
    },
    {
      title: 'Advice based on ownership goals',
      description:
        'Some owners want a quick fresh start, some want coating right away, and some want a longer-term preservation plan. We build around that.',
    },
  ],
  pricingSectionLabel: 'Starting pricing',
  pricingSectionTitle: 'New vehicle packages start with cleanup, prep, and protection',
  pricingIntro:
    'New vehicles often need less correction than older cars, but they still benefit from proper cleanup, prep, and protection planning.',
  pricingCards: [
    {
      name: 'New Vehicle Refresh',
      price: '$195+',
      description:
        'A simple new vehicle clean with light interior refresh, exterior hand wash, glass, mats, and basic cleanup.',
    },
    {
      name: 'New Vehicle Prep Detail',
      price: '$250+',
      description:
        'A better starting point before protection. Includes proper cleanup, exterior prep, wheels, tires, glass, and readiness for protection add-ons.',
    },
    {
      name: 'New Vehicle Protection Package',
      price: '$475+',
      description:
        'Includes New Vehicle Prep Detail plus Ceramic Spray Sealant for better gloss and water-beading protection.',
    },
    {
      name: 'True Ceramic Coating',
      price: 'Quote Required',
      description:
        'Quoted after inspection based on paint condition, prep needed, vehicle size, coating choice, and workspace.',
    },
  ],
  bestFor: [
    'Brand-new or nearly new vehicles you want to protect early',
    'Owners planning to keep the vehicle for years',
    'Anyone considering ceramic coating from the start',
    'Drivers who want easier washing and maintenance from day one',
  ],
  pricingAdjustments: [
    'Vehicle size still matters, even on newer vehicles.',
    'If the paint has dealer marks or other defects, light polishing or correction may be recommended before protection.',
    'Protection and coating choices are quoted around the real prep needed.',
    'We confirm the best starting point once we know the finish condition and your long-term goal for the vehicle.',
  ],
  trustPoints: [
    {
      title: 'New does not always mean perfect',
      description:
        'We look at the actual condition of the finish instead of assuming the dealership handoff left it flawless.',
    },
    {
      title: 'Best timing for protection',
      description:
        'It is easier to preserve a newer finish now than to undo years of wear later.',
    },
    {
      title: 'Built around long-term ownership',
      description:
        'This service is meant to help the vehicle stay easier to maintain and better looking from the beginning.',
    },
    {
      title: 'A smarter first appointment',
      description:
        'Instead of waiting until the finish is already beat up, you start with a cleaner, better-protected baseline right away.',
    },
  ],
  ctaHeading: 'Want to set up the new vehicle properly from the start?',
  ctaText:
    'Send us the make, model, and whether you are mainly after cleanup, protection, or a coating plan. We can help shape the right first appointment from there.',
};
