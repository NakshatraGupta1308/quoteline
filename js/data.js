// Sample data. Replace these with your shop's real prices, finishes and job history.
// Prices are illustrative. ageDays is how old each price is at first load.

export const MATERIALS = [
  { id: "al6061", name: "6061 aluminum", family: "aluminum", keywords: ["6061"], generic: ["aluminum", "aluminium"], pricePerLb: 3.6, density: 0.098, machinability: 1.0, sheet: true, castable: true, castPerLb: 5.0, ageDays: 19, leadDays: 3 },
  { id: "al7075", name: "7075 aluminum", family: "aluminum", keywords: ["7075"], generic: [], pricePerLb: 6.2, density: 0.101, machinability: 1.15, sheet: false, castable: false, castPerLb: 0, ageDays: 41, leadDays: 5 },
  { id: "ss304", name: "304 stainless", family: "stainless", keywords: ["304"], generic: ["stainless"], pricePerLb: 4.8, density: 0.289, machinability: 2.1, sheet: true, castable: false, castPerLb: 0, ageDays: 8, leadDays: 4 },
  { id: "ss316", name: "316 stainless", family: "stainless", keywords: ["316"], generic: [], pricePerLb: 6.9, density: 0.29, machinability: 2.4, sheet: true, castable: false, castPerLb: 0, ageDays: 52, leadDays: 6 },
  { id: "steel1018", name: "1018 mild steel", family: "steel", keywords: ["1018"], generic: ["mild steel", "steel"], pricePerLb: 1.4, density: 0.284, machinability: 1.4, sheet: true, castable: true, castPerLb: 3.2, ageDays: 12, leadDays: 2 },
  { id: "steel4140", name: "4140 alloy steel", family: "steel", keywords: ["4140"], generic: [], pricePerLb: 2.1, density: 0.284, machinability: 1.8, sheet: false, castable: false, castPerLb: 0, ageDays: 30, leadDays: 4 },
  { id: "brass360", name: "360 brass", family: "brass", keywords: ["360"], generic: ["brass"], pricePerLb: 6.1, density: 0.307, machinability: 0.85, sheet: false, castable: true, castPerLb: 7.5, ageDays: 25, leadDays: 4 },
  { id: "acetal", name: "Acetal (Delrin)", family: "plastic", keywords: [], generic: ["acetal", "delrin"], pricePerLb: 5.2, density: 0.051, machinability: 0.8, sheet: false, castable: false, castPerLb: 0, ageDays: 60, leadDays: 5 }
];

export const FINISHES = [
  { id: "none", name: "No finish", keywords: [], perPart: 0, lot: 0, days: 0 },
  { id: "anodize", name: "Anodize", keywords: ["anodiz"], perPart: 2.4, lot: 85, days: 6 },
  { id: "powder", name: "Powder coat", keywords: ["powder coat", "powdercoat"], perPart: 3.1, lot: 120, days: 7 },
  { id: "zinc", name: "Zinc plate", keywords: ["zinc"], perPart: 1.1, lot: 65, days: 5 },
  { id: "passivate", name: "Passivate", keywords: ["passivat"], perPart: 1.4, lot: 60, days: 4 },
  { id: "blackoxide", name: "Black oxide", keywords: ["black oxide"], perPart: 0.9, lot: 50, days: 4 },
  { id: "heat", name: "Heat treat", keywords: ["heat treat"], perPart: 2.8, lot: 90, days: 7 },
  { id: "paint", name: "Paint", keywords: ["paint"], perPart: 2.0, lot: 60, days: 4 }
];

export const SAMPLES = [
  {
    id: "bracket",
    label: "Bracket, clear request",
    text: "Hi, we need a quote for 250 pcs of the attached bracket, 6061 aluminum, about 4 x 3 x 1 in. Please anodize (clear). It has four drilled holes and two tapped holes. Needed in 5 weeks. Print attached.\n\nThanks,\nDana, Prairie Ag Equipment"
  },
  {
    id: "shaft",
    label: "Shaft, tight tolerance",
    text: "Quote request: 1,200 stainless steel 304 shafts, 0.75 in diameter, 6 in long. Tolerance +/- 0.001 on the journal diameter. Passivate after machining. Delivery in 8 weeks. We need material certs with each lot."
  },
  {
    id: "enclosure",
    label: "Enclosure, export controlled",
    text: "Please quote 60 sheet metal enclosures, 12 x 8 x 0.06 in flat blank, mild steel, 4 bends, powder coat black. This is for an ITAR program so please handle the files accordingly. We need these ASAP."
  },
  {
    id: "messy",
    label: "Housing, vague request",
    text: "need about 500 of the housing, aluminum or 304 stainless is fine, tolerance tight. rush job, thx"
  }
];

// Past jobs. actualFactor is how much the real cost differed from the base model
// when the sample data was written (1.10 means ten percent over). markup is quoted price divided by actual cost.
export const HISTORY_RAW = [
  { id: "J-2291", name: "Bracket", materialId: "al6061", qty: 1000, dims: [4, 3, 1], tol: 0.005, finishId: "anodize", route: "mill", complexity: 2, actualFactor: 1.02, markup: 1.27, won: true },
  { id: "J-1873", name: "Bracket", materialId: "al6061", qty: 500, dims: [5, 3, 1], tol: 0.01, finishId: "anodize", route: "mill", complexity: 2, actualFactor: 1.04, markup: 1.31, won: true },
  { id: "J-3120", name: "Plate", materialId: "al6061", qty: 50, dims: [8, 6, 0.5], tol: 0.005, finishId: "none", route: "mill", complexity: 1, actualFactor: 1.0, markup: 1.42, won: false },
  { id: "J-2044", name: "Shaft", materialId: "ss304", qty: 800, dims: [0.75, 0.75, 5], tol: 0.001, finishId: "passivate", route: "turn", complexity: 2, actualFactor: 1.18, markup: 1.3, won: true },
  { id: "J-2380", name: "Shaft", materialId: "ss304", qty: 300, dims: [0.625, 0.625, 4], tol: 0.002, finishId: "passivate", route: "turn", complexity: 2, actualFactor: 1.22, markup: 1.36, won: false },
  { id: "J-1955", name: "Pin", materialId: "steel1018", qty: 2000, dims: [0.5, 0.5, 3], tol: 0.005, finishId: "zinc", route: "turn", complexity: 1, actualFactor: 0.96, markup: 1.24, won: true },
  { id: "J-2510", name: "Enclosure", materialId: "steel1018", qty: 100, dims: [12, 8, 0.06], tol: 0.02, finishId: "paint", route: "sheet", complexity: 2, actualFactor: 0.94, markup: 1.29, won: true },
  { id: "J-2622", name: "Enclosure", materialId: "steel1018", qty: 40, dims: [10, 6, 0.075], tol: 0.02, finishId: "powder", route: "sheet", complexity: 2, actualFactor: 1.01, markup: 1.45, won: false },
  { id: "J-2703", name: "Fitting", materialId: "ss316", qty: 200, dims: [1.5, 1.5, 2], tol: 0.002, finishId: "passivate", route: "turn", complexity: 3, actualFactor: 1.2, markup: 1.33, won: true },
  { id: "J-2811", name: "Housing", materialId: "al7075", qty: 120, dims: [6, 4, 2], tol: 0.002, finishId: "anodize", route: "mill", complexity: 3, actualFactor: 1.15, markup: 1.38, won: false },
  { id: "J-2877", name: "Fitting", materialId: "brass360", qty: 600, dims: [1, 1, 2.5], tol: 0.005, finishId: "none", route: "turn", complexity: 2, actualFactor: 0.98, markup: 1.26, won: true },
  { id: "J-2930", name: "Housing", materialId: "al6061", qty: 75, dims: [5, 5, 2], tol: 0.005, finishId: "anodize", route: "mill", complexity: 3, actualFactor: 1.06, markup: 1.34, won: true },
  { id: "J-3011", name: "Shaft", materialId: "steel4140", qty: 400, dims: [1, 1, 8], tol: 0.002, finishId: "heat", route: "turn", complexity: 2, actualFactor: 1.1, markup: 1.31, won: false }
];

export const REASON_TAGS = [
  { id: "slower", label: "This material runs slower than the model says" },
  { id: "fixture", label: "Needs a fixture or extra setup" },
  { id: "faster", label: "We run this faster than the model says" },
  { id: "customer", label: "Customer history" },
  { id: "other", label: "Other" }
];
