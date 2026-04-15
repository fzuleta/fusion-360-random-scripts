
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

