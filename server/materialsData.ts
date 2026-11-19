import type { MaterialReferenceEntry, SortingProfile } from '../src/types/waste.ts';

export const SERVER_SORTING_PROFILES: SortingProfile[] = [
  {
    id: 'standard',
    label: 'Standard Curbside',
    shortLabel: 'Standard',
    description:
      'Typical single-stream municipal recycling (PET #1, HDPE #2, #5 PP, metals, glass, clean paper).',
    promptRule:
      'Municipal sorting rule: Standard single-stream curbside recycling (accept clean PET #1, HDPE #2, PP #5, metals, clean glass, dry unsoiled cardboard/paper; reject food-soiled paper, coated cups, flexible film, and composites).',
  },
  {
    id: 'strict',
    label: 'Strict Zero-Contam',
    shortLabel: 'Strict',
    description:
      'High-purity MRF sorting: rejects any visible residue, mixed caps, or uncertain resin grades.',
    promptRule:
      'Municipal sorting rule: Strict zero-contamination MRF (if significant food/liquid residue, unseparated multi-material caps/lids, coated paperboard, or uncertain resin grades appear, classify as Non-Recyclable or require strict separation in disposalAction).',
  },
  {
    id: 'compost',
    label: 'Compost-First City',
    shortLabel: 'Compost-First',
    description:
      'Includes curbside green organics guidance for food-soiled paper and fiber items.',
    promptRule:
      'Municipal sorting rule: Compost-First city (food-soiled uncoated paper/cardboard like greasy pizza boxes remains Non-Recyclable for the blue bin, but instruct municipal green organics bin composting in disposalAction).',
  },
  {
    id: 'deposit',
    label: 'Bottle Deposit / Return',
    shortLabel: 'Deposit Return',
    description:
      'Prioritizes intact beverage container return machines (reverse vending) over crushing.',
    promptRule:
      'Municipal sorting rule: Bottle Deposit & Return (DRS) region (for beverage bottles and aluminum cans, emphasize keeping barcodes readable and avoiding crushing in disposalAction for reverse-vending return).',
  },
];

export const SERVER_MATERIAL_DIRECTORY: MaterialReferenceEntry[] = [
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
    prepTip:
      'Never place in curbside bins (tangles sorting rollers); return clean & dry to grocery store drop-off.',
  },
  {
    id: 'pe-paperboard',
    code: 'PE-LINED PAP',
    name: 'Plastic-Coated Paper Cup',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Disposable hot coffee cups, wax/poly ice cream cartons',
    prepTip:
      'Separate recyclable #5/#6 lid or cardboard sleeve; dispose of lined cup in trash unless specialized recovery exists.',
  },
  {
    id: 'greasy-occ',
    code: 'SOILED FIBER',
    name: 'Grease-Saturated Paper',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Oil-stained pizza box bases, used paper napkins, food wrappers',
    prepTip:
      'Oil ruins paper pulp fibers; compost in municipal organics bin if available or place in landfill waste.',
  },
  {
    id: 'ps-6',
    code: 'PS #6 / EPS',
    name: 'Expanded Polystyrene Foam',
    stream: 'Contamination Trap',
    circularity: 'Linear / Landfill',
    examples: 'Foam takeout clamshells, packing peanuts, foam coffee cups',
    prepTip:
      'Not accepted in standard curbside bins; reuse packing blocks or locate specialized EPS densifier drop-offs.',
  },
  {
    id: 'e-waste',
    code: 'E-WASTE / LI-ION',
    name: 'Batteries & Small Electronics',
    stream: 'Drop-Off Only',
    circularity: 'Downcycle Path',
    examples: 'Lithium-ion cells, USB cables, vapes, circuit boards',
    prepTip:
      'Fire hazard in curbside trucks; tape battery terminals and hand over to certified e-waste/retail collection.',
  },
];

export function queryMaterialsDirectory(query = '', stream = 'All'): MaterialReferenceEntry[] {
  const q = query.trim().toLowerCase();
  const normalizedStream = stream.trim();

  return SERVER_MATERIAL_DIRECTORY.filter((entry) => {
    const matchesStream =
      !normalizedStream || normalizedStream === 'All' || entry.stream === normalizedStream;
    if (!matchesStream) return false;
    if (!q) return true;
    return (
      entry.code.toLowerCase().includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.examples.toLowerCase().includes(q) ||
      entry.prepTip.toLowerCase().includes(q)
    );
  });
}
