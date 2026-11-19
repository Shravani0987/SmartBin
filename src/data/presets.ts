import type { MaterialReferenceEntry, SamplePreset, SortingProfile } from '../types/waste';

export const SAMPLE_PRESETS: SamplePreset[] = [
  {
    id: 'pet-bottle',
    label: 'PET Water Bottle',
    shortTag: 'Plastic #1',
    imageUrl: '/src/assets/images/preset_pet_bottle_1795070527222.jpg',
    hint: 'Clean clear PET bottle with cap attached',
  },
  {
    id: 'greasy-pizza-box',
    label: 'Greasy Pizza Box',
    shortTag: 'Soiled Fiber',
    imageUrl: '/src/assets/images/preset_greasy_pizza_box_1795070528835.jpg',
    hint: 'Oil-stained corrugated cardboard test case',
  },
  {
    id: 'coffee-cup',
    label: 'Takeaway Coffee Cup',
    shortTag: 'Lined Edge Case',
    imageUrl: '/src/assets/images/preset_coffee_cup_1795070527309.jpg',
    hint: 'Multi-material cup with plastic lid and sleeve',
  },
  {
    id: 'aluminum-can',
    label: 'Aluminum Soda Can',
    shortTag: 'Metal Loop',
    imageUrl: '/src/assets/images/preset_aluminum_can_1795070528622.jpg',
    hint: 'Infinitely recyclable crushed beverage can',
  },
];

export const CAPTURE_TIPS: string[] = [
  'Center one primary waste item against a contrasting surface.',
  'Include visible grease stains, food residue, or resin codes in frame.',
  'Drop multiple photos at once to batch-classify a full sorting pile.',
];

export const SORTING_PROFILES: SortingProfile[] = [
  {
    id: 'standard',
    label: 'Standard Curbside',
    shortLabel: 'Standard',
    description: 'Typical single-stream municipal recycling (PET #1, HDPE #2, #5 PP, metals, glass, clean paper).',
    promptRule:
      'Apply standard single-stream municipal curbside rules: accept clean/rinsable PET #1, HDPE #2, PP #5, aluminum/steel cans, clean glass, and dry unsoiled cardboard/paper; reject greasy paper, coated cups, flexible film, and composites.',
  },
  {
    id: 'strict',
    label: 'Strict Zero-Contam',
    shortLabel: 'Strict',
    description: 'High-purity MRF sorting: rejects any visible residue, mixed caps, or uncertain resin grades.',
    promptRule:
      'Apply strict high-purity sorting rules: if any significant residue, mixed-material lid, unclear resin code, or coated surface is present, lean toward Non-Recyclable or flag strict separation steps in disposalAction.',
  },
  {
    id: 'compost',
    label: 'Compost-First City',
    shortLabel: 'Compost-First',
    description: 'Includes curbside green organics guidance for food-soiled paper and fiber items.',
    promptRule:
      'Apply Compost-First municipal rules: food-soiled uncoated paper/cardboard (like greasy pizza boxes) remains Non-Recyclable for the blue bin, but explicitly instruct green-bin municipal composting in disposalAction.',
  },
  {
    id: 'deposit',
    label: 'Bottle Deposit / Return',
    shortLabel: 'Deposit Return',
    description: 'Prioritizes intact beverage container return machines (reverse vending) over crushing.',
    promptRule:
      'Apply Deposit-Return (DRS) rules: for beverage bottles and aluminum cans, keep barcodes readable and avoid crushing in disposalAction so they qualify for reverse-vending deposit return.',
  },
];

export const MATERIAL_DIRECTORY: MaterialReferenceEntry[] = [
  {
    id: 'pet-1',
    code: 'PET #1',
    name: 'Polyethylene Terephthalate',
    stream: 'Recyclable',
    circularity: 'High Loop',
    examples: 'Water & soda bottles, clear clamshell berry containers',
    prepTip: 'Empty liquids completely; keep plastic cap screwed on unless local rules specify otherwise.',
  },
  {
    id: 'hdpe-2',
    code: 'HDPE #2',
    name: 'High-Density Polyethylene',
    stream: 'Recyclable',
    circularity: 'High Loop',
    examples: 'Milk jugs, laundry detergent bottles, shampoo containers',
    prepTip: 'Quick rinse to remove soap or dairy residue; leave labels attached.',
  },
  {
    id: 'aluminum-41',
    code: 'ALU 41',
    name: 'Aluminum Beverage Alloy',
    stream: 'Recyclable',
    circularity: 'High Loop',
    examples: 'Soda cans, sparkling water cans, clean foil trays',
    prepTip: 'Empty completely; avoid crushing if your region uses reverse-vending deposit scanners.',
  },
  {
    id: 'cardboard-occ',
    code: 'PAP 20 / OCC',
    name: 'Corrugated Cardboard',
    stream: 'Recyclable',
    circularity: 'High Loop',
    examples: 'Shipping boxes, clean cereal boxes, unsoiled pizza lids',
    prepTip: 'Flatten dry boxes; tear off and discard any oil- or cheese-soaked sections.',
  },
  {
    id: 'pp-5',
    code: 'PP #5',
    name: 'Polypropylene',
    stream: 'Recyclable',
    circularity: 'Downcycle Path',
    examples: 'Yogurt tubs, takeout deli containers, bottle caps',
    prepTip: 'Scrape clean and rinse oil/dairy; check whether your local MRF accepts #5 tubs.',
  },
  {
    id: 'ldpe-4',
    code: 'LDPE #4 FILM',
    name: 'Flexible Plastic Film & Bags',
    stream: 'Drop-Off Only',
    circularity: 'Downcycle Path',
    examples: 'Grocery bags, bread wraps, shipping air pillows, shrink wrap',
    prepTip: 'Never place in curbside bins (tangles sorting rollers); return clean & dry to grocery store drop-off.',
  },
  {
    id: 'pe-paperboard',
    code: 'PE-LINED PAP',
    name: 'Plastic-Coated Paper Cup',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Disposable hot coffee cups, wax/poly ice cream cartons',
    prepTip: 'Separate recyclable #5/#6 lid or cardboard sleeve; dispose of lined cup in trash unless specialized recovery exists.',
  },
  {
    id: 'greasy-occ',
    code: 'SOILED FIBER',
    name: 'Grease-Saturated Paper',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Oil-stained pizza box bases, used paper napkins, food wrappers',
    prepTip: 'Oil ruins paper pulp fibers; compost in municipal organics bin if available or place in landfill waste.',
  },
  {
    id: 'ps-6',
    code: 'PS #6 / EPS',
    name: 'Expanded Polystyrene Foam',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Foam takeout clamshells, packing peanuts, foam coffee cups',
    prepTip: 'Not accepted in standard curbside bins; reuse packing blocks or locate specialized EPS densifier drop-offs.',
  },
  {
    id: 'e-waste',
    code: 'E-WASTE / LI-ION',
    name: 'Batteries & Small Electronics',
    stream: 'Drop-Off Only',
    circularity: 'Downcycle Path',
    examples: 'Lithium-ion cells, USB cables, vapes, circuit boards',
    prepTip: 'Fire hazard in curbside trucks; tape battery terminals and hand over to certified e-waste/retail collection.',
  },
];
