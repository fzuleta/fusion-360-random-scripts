export const bit1mm: IBit = {
  diameter: 1, 
  height: 10, 
  toolNumber: 3,  
  material: {
    'A2-Rough': {
      spindleSpeed: 19404,
      feedRate: 99,
      stepOver: 0.08,
    }
  }
}
export const bit1_6mm_2_flute: IBit = {
  diameter: 1.6256, 
  height: 10, 
  toolNumber: 3,  
  material: {
    'A2-Rough': {
      spindleSpeed: 11937,
      feedRate: 127,
      stepOver: 0.25,
    }
  }
}
export const bit3_175mm_2_flute: IBit = {
  diameter: 3.175, 
  height: 10, 
  toolNumber: 1,  
  material: {
    'A2-Rough': {
      spindleSpeed: 11937,
      feedRate: 127,
      stepOver: 0.25,
    }
  }
}
export const bit3_175mm_4_flute_harveyTool: IBit = {
  diameter: 3.175, 
  height: 10, 
  toolNumber: 2,  
  material: {
    'A2-Rough': {
      spindleSpeed: 11937,
      feedRate: 200,
      stepOver: 0.55,
    }
  }
}
export const bit3_175mm_4_flute_chino: IBit = {
  diameter: 3.175, 
  height: 10, 
  toolNumber: 1,  
  material: {
    'A2-Rough': {
      spindleSpeed: 10500,
      feedRate: 300,
      stepOver: 0.35,
    },
    'A2-Finish': {
      spindleSpeed: 11000,
      feedRate: 220,
      stepOver: 0.08,
    },
    'brass-Rough': {
      spindleSpeed: 11000,
      feedRate: 600,
      stepOver: 0.5,
    },
    'brass-Finish': {
      spindleSpeed: 11000,
      feedRate: 350,
      stepOver: 0.1,
    }
  }
}
export const bit3_175mm_3_flute_aluminum: IBit = {
  diameter: 3.175, 
  height: 10, 
  toolNumber: 4,  
  material: {
    'brass-Rough': {
      spindleSpeed: 11000,
      feedRate: 800,
      stepOver: 0.5,
    },
    'brass-Finish': {
      spindleSpeed: 11000,
      feedRate: 450,
      stepOver: 0.1,
    }
  }
}
export const bit6_35mm_4_flute_chino: IBit = {
  diameter: 6.35,
  height: 10, 
  toolNumber: 1,  
  material: {
    'A2-Rough': {
      spindleSpeed: 3056,
      feedRate: 490,
      stepOver: 0.7,
    }
  }
}

export const bitCatalog: Array<{ key: string; label: string; bit: IBit }> = [
  { key: 'bit1mm', label: '1.0 mm', bit: bit1mm },
  { key: 'bit1_6mm_2_flute', label: '1.6256 mm 2 flute', bit: bit1_6mm_2_flute },
  { key: 'bit3_175mm_2_flute', label: '3.175 mm 2 flute', bit: bit3_175mm_2_flute },
  { key: 'bit3_175mm_4_flute_harveyTool', label: '3.175 mm 4 flute Harvey Tool', bit: bit3_175mm_4_flute_harveyTool },
  { key: 'bit3_175mm_4_flute_chino', label: '3.175 mm 4 flute Chino', bit: bit3_175mm_4_flute_chino },
  { key: 'bit3_175mm_3_flute_aluminum', label: '3.175 mm 3 flute Aluminum', bit: bit3_175mm_3_flute_aluminum },
  { key: 'bit6_35mm_4_flute_chino', label: '6.35 mm 4 flute Chino', bit: bit6_35mm_4_flute_chino },
];

export const getBitKey = (bit: IBit): string | undefined => {
  return bitCatalog.find((entry) => entry.bit === bit)?.key;
};

export const getBitMaterials = (bit: IBit): TMaterial[] => {
  return Object.keys(bit.material) as TMaterial[];
};
