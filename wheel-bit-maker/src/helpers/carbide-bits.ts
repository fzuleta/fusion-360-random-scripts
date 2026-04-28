 

export const SPEEDTIGER_4F_3_175_UNCOATED: IBit = {
  diameter: 3.175,
  height: 10,
  toolNumber: 1,
  brand: 'SPEED TIGER',
  label: '3.175mm 4F Speed Tiger Uncoated',
  description: 'Uncoated',
  material: {
    'brass-Rough': {
      spindleSpeed: 11500,
      feedRate: 600,
      stepOver: 0.1,
    },
    'brass-Finish': {
      spindleSpeed: 11500,
      feedRate: 375,
      stepOver: 0.03,
    }
  }
}
export const SPEEDTIGER_4F_3_175_COATED: IBit = {
  diameter: 3.175,
  height: 10,
  toolNumber: 1,
  brand: 'SPEED TIGER',
  label: '3.175mm 4F Speed Tiger AlTiBN Coated',
  description: 'AlTiBN Coated, CNC Router Bit for Hardened Steel, Alloy',
  material: {
    'A2-Rough': {
      spindleSpeed: 12000,
      feedRate: 480,   
      stepOver: 0.2,
    },
    'A2-Finish': {
      spindleSpeed: 13000,
      feedRate: 350,
      stepOver: 0.05,
    },
    'O1-Rough': {
      spindleSpeed: 15000,
      feedRate: 430,   
      stepOver: 0.2,
    },
    'O1-Finish': {
      spindleSpeed: 15000,
      feedRate: 300,
      stepOver: 0.05,
    },
  },
}

export const HARVEYTOOLS_4F_3_175mm_73125_C3: IBit = {
  diameter: 3.175,
  height: 10,
  toolNumber: 2,
  brand: 'HARVEY TOOLS',
  label: '3.175mm 4F Harvey Tools AlTiN COATED',
  description: '73125-C3 AlTiN COATED',
  material: {
    'A2-Rough': {
      spindleSpeed: 10000, 
      feedRate: 320,       
      stepOver: 0.15,      
    },
    'A2-Finish': {
      spindleSpeed: 11000, // Dropped from 17k to prevent edge-burn
      feedRate: 220,       // Results in ~0.005mm chipload
      stepOver: 0.05,      // Constant engagement for dimensional accuracy
    },
    'brass-Rough': {
      spindleSpeed: 12500,
      feedRate: 250,
      stepOver: 0.01,
    },
    'brass-Finish': {
      spindleSpeed: 12500,
      feedRate: 200,
      stepOver: 0.005,
    },
    'O1-Rough': {
      spindleSpeed: 15000,
      feedRate: 480,   
      stepOver: 0.2,
    },
    'O1-Finish': {
      spindleSpeed: 15000,
      feedRate: 350,
      stepOver: 0.05,
    },
  }
}

export const bitCatalog: Array<{ key: string; label: string; bit: IBit }> = [ 
  { key: 'bit3_175mm_4f_speed_tiger_uncoated', label: SPEEDTIGER_4F_3_175_UNCOATED.label, bit: SPEEDTIGER_4F_3_175_UNCOATED },
  { key: 'bit3_175mm_4f_speed_tiger_coated', label: SPEEDTIGER_4F_3_175_COATED.label, bit: SPEEDTIGER_4F_3_175_COATED },
  { key: 'bit3_175mm_4f_ht_73125_C3', label: HARVEYTOOLS_4F_3_175mm_73125_C3.label, bit: HARVEYTOOLS_4F_3_175mm_73125_C3 },
];

export const getBitKey = (bit: IBit): string | undefined => {
  return bitCatalog.find((entry) => entry.bit === bit)?.key;
};

export const getBitMaterials = (bit: IBit): TMaterial[] => {
  return Object.keys(bit.material) as TMaterial[];
};
