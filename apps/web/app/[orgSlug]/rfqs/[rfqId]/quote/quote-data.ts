// Stub quote data. Estimate unit prices mirror screenshot 17_0 (real values
// come from the estimate computation later). Currency is EUR per the DACH product.

export interface QuoteEstimate {
  quantity: number;
  unitPrice: number;
}

export interface QuotePartSeed {
  partId: string;
  partNumber: string;
  revision: string;
  description: string;
  defaultNote: string;
  noBid?: boolean;
  estimates: QuoteEstimate[];
}

export const QUOTE_PARTS: QuotePartSeed[] = [
  {
    partId: "p2",
    partNumber: "4990202",
    revision: "A",
    description: "COLLAR MOUNTING BRACKET",
    defaultNote: "",
    estimates: [
      { quantity: 1, unitPrice: 792.7 },
      { quantity: 25, unitPrice: 128.04 },
      { quantity: 150, unitPrice: 106.22 },
    ],
  },
  {
    partId: "p1",
    partNumber: "5216488",
    revision: "A",
    description: "VENT PLATE, BASE PLATE",
    defaultNote: "quoted including finishing per drawing",
    estimates: [
      { quantity: 1, unitPrice: 1063.48 },
      { quantity: 50, unitPrice: 222.63 },
      { quantity: 300, unitPrice: 210.04 },
    ],
  },
  {
    partId: "p3",
    partNumber: "PEAT Motor Stand",
    revision: "",
    description: "PEAT Motor Stand",
    defaultNote: "",
    estimates: [
      { quantity: 1, unitPrice: 1629.54 },
      { quantity: 2, unitPrice: 1087.83 },
      { quantity: 5, unitPrice: 778.78 },
      { quantity: 10, unitPrice: 682.61 },
    ],
  },
  {
    partId: "p4",
    partNumber: "7781002",
    revision: "B",
    description: "SPACER RING — NO BID",
    defaultNote: "",
    noBid: true,
    estimates: [],
  },
];

export const DEFAULT_QUOTE_NOTE =
  "Thank you for the opportunity to quote this project. Lead times are ARO. Please call if any questions or concerns. Thank you";

export const QUOTE_CUSTOMER = {
  contact: "Alex Huckstepp",
  organization: "Tesla",
};
