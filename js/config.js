// Edit this file to rename the product and set defaults for a shop.
export const CONFIG = {
  brand: "Quoteline",
  // Where the pilot request form sends mail. Leave empty to only save requests on the visitor's device.
  contactEmail: "",
  shop: {
    machineRates: { mill: 75, turn: 65, sheet: 110, cast: 60 }, // dollars per machine hour
    laborRate: 45,      // dollars per labor hour
    overhead: 1.15,     // multiplier on machine, labor and setup
    minMargin: 0.08     // never suggest a price below this margin
  }
};
