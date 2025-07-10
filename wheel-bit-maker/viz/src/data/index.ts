interface IModel {
  filename: string;
  getPasses: (stockRadius: number) => { lineStart: PointXY[], lineA: PointXY[], lineB: PointXY[], bitRadius: number }[]
}
export const models: {[key: string]: IModel} = {
  "model_0_13_Z112": {
    filename: 'm=0.13 Z=112.stl',
    getPasses: (stockRadius: number) => {
      let passes: any = [];
      // Pass 0
      let bitRadius = 3.175 / 2;
      console.log('Getting m0.13 Z112')
      const safeX = (bitRadius + (bitRadius*0.1));
      const safeY = (stockRadius + bitRadius + 2);
      const lineStart = [
        { x: safeX, y: safeY }, 
        { x: safeX, y: stockRadius }, 
        { x: 0, y: stockRadius }
      ];
      let lineA = [ // the border of the stock
        { x: 0, y: stockRadius }, 
        { x: -25.6, y: stockRadius }
      ];
      let lineB =  // the inner profile
        [
          { x: 0, y: 1.3 },
          { x: -0.42, y: 1.3 },
          { x: -0.42, y: 0.7 },
          { x: -10, y: 0.7 },
          { x: -15.6, y: stockRadius }
        ];
      passes.push({ lineStart, lineA, lineB, bitRadius });

      // PASS 1
      bitRadius = 1 / 2;
      lineA = [ // the border of the stock
        { x: 0, y: 2 }, 
        { x: -10.0, y: 2 }
      ];
      lineB =  // the inner profile
        [
          { x: 0, y: 1.298 },
          { x: -0.419, y: 1.298 },
          { x: -0.419, y: 0.7 },
          { x: -10, y: 0.7 }, 
        ];
      passes.push({ lineStart, lineA, lineB, bitRadius });
      
      // ------------------- 
      return passes;
    }
  },
  "model_0_13_z14": {
    filename: 'm=0.13 z=14.stl',
    getPasses: (stockRadius: number) => {
      let bitRadius = 3.175 / 2;
      console.log('Getting m0.13 z14')
      const safeX = (bitRadius + (bitRadius*0.1));
      const safeY = (stockRadius + bitRadius + 2);
      const lineStart = [
        { x: safeX, y: safeY }, 
        { x: safeX, y: stockRadius }, 
        { x: 0, y: stockRadius }
      ];
      const lineA = [
        { x: 0, y: stockRadius }, 
        { x: -25.6, y: stockRadius }
      ];
      const lineB =  
        [
          { x: 0, y: 1.303 },
          { x: -0.45, y: 1.303 },
          { x: -0.45, y: 0.7 },
          { x: -10, y: 0.7 },
          { x: -15.6, y: stockRadius }
        ];
      return [{ lineStart, lineA, lineB, bitRadius }]
    }
  }
}