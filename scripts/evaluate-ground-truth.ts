export interface SheetGroundTruth {
  num: number;
  filename: string;
  width: number;
  height: number;
  staves: {
    yCenter: number;
    expected: string[];
  }[];
}

export const GROUND_TRUTH: SheetGroundTruth[] = [
  {
    num: 1,
    filename: "01a06cf2-c03d-74e0-a5ea-337e308e2c4e.jpg",
    width: 1206,
    height: 1689,
    staves: [
      { yCenter: 346, expected: ["C", "C/E", "F", "G", "C", "C/E", "F", "G"] },
      { yCenter: 478, expected: ["Bb", "C/Bb", "Am", "Dm", "Db", "Gsus4", "G"] },
      { yCenter: 648, expected: ["C", "C/E", "F", "G", "C", "C/E"] },
      { yCenter: 908, expected: ["F", "G", "F", "G/F", "Em", "Am", "Dm", "F/G"] },
      { yCenter: 1204, expected: ["C", "Bb/C", "C7", "F", "G/F", "Em", "Am", "Dm", "G", "C", "Bb/C", "C7"] },
      { yCenter: 1429, expected: ["F", "G/F", "Em", "Am", "Dm", "F/G", "C"] }
    ]
  },
  {
    num: 2,
    filename: "01a06cf2-c060-7129-afa7-a4f18cdac27e.jpg",
    width: 1170,
    height: 2053,
    staves: [
      { yCenter: 69, expected: ["G", "Em", "C", "D"] },
      { yCenter: 198, expected: ["G", "D/F#", "Em", "C"] },
      { yCenter: 367, expected: ["D", "G", "D/F#", "Em"] },
      { yCenter: 545, expected: ["C", "Dsus4", "D"] },
      { yCenter: 724, expected: ["G", "D/F#", "Em", "G/D", "C", "G/B"] },
      { yCenter: 890, expected: ["Am", "D", "G", "D/F#", "Em", "G/D"] },
      { yCenter: 1061, expected: ["C", "G/B", "Am", "D", "G"] },
      { yCenter: 1528, expected: ["C", "G"] },
      { yCenter: 1697, expected: ["C", "G", "C"] },
      { yCenter: 1886, expected: ["G", "D/F#", "Em", "C", "Dsus4", "D"] }
    ]
  },
  {
    num: 3,
    filename: "01a06cf2-c080-7394-bbda-46a37e2046b8.jpg",
    width: 1206,
    height: 1605,
    staves: [
      { yCenter: 224, expected: ["C", "G", "F", "C"] },
      { yCenter: 399, expected: ["F", "C/E", "Dm", "G", "C", "G"] },
      { yCenter: 571, expected: ["F", "C", "F", "G", "C"] },
      { yCenter: 742, expected: ["F", "G", "Em", "Am", "F", "G"] },
      { yCenter: 916, expected: ["C", "F", "G", "Em", "Am"] },
      { yCenter: 1087, expected: ["Dm", "G", "C"] }
    ]
  },
  {
    num: 4,
    filename: "01a06cf2-c0a5-71db-b714-f085ad3c5e11.jpg",
    width: 1206,
    height: 1616,
    staves: [
      { yCenter: 198, expected: ["C", "G/B", "Am", "Bb/G", "C/G", "F", "G/F", "Em", "Am"] },
      { yCenter: 392, expected: ["F", "G/F", "Em", "Am", "Dm", "Dm/C", "Bb", "F/G"] },
      { yCenter: 584, expected: ["C", "G/B", "Am", "Bb/G", "C/G", "F", "G/F", "Em", "Am"] },
      { yCenter: 786, expected: ["F", "G/F", "Em", "Am", "Dm", "Dm/C", "G7", "Bb/C"] },
      { yCenter: 969, expected: ["F", "G/F", "Em", "Am", "Dm", "G", "Em/C", "Bb/C"] },
      { yCenter: 1164, expected: ["F", "Em", "Am", "Dm", "G", "C"] }
    ]
  }
];
