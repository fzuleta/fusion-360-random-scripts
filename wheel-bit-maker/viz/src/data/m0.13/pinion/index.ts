export const filename = 'm=0.13 z=14.stl';
 
const bottomCut = -0.6
export const pointsForTooth: ITeethPoint[] = [

  { // left base
    from: { x: -1, y: -0.6, z: 0},
    to: { x: -0.223, y: -0.6, z: 0 },
  },
  { // from base to first arc
    from: { x: -0.223, y: -0.6, z: 0 }, 
    to: { x: -0.223, y: -0.3025, z: 0 }, // base of the tooth
  },
  { // left first arc
    from: { x: -0.223, y: -0.3025, z: 0 },
    to: { x: -0.131, y: -0.218, z: 0},
    center: { x: -0.238, y:-0.193, z:0, anticlockwise: false},
  },
  { // left line between arcs
    from: { x: -0.131, y: -0.218, z: 0},
    to: { x: -0.111, y: -0.089, z: 0 },
  },
  { // left tip to center
    from: { x: -0.111, y: -0.089, z: 0},
    to: { x: 0, y: 0, z: 0},
    center: { x: 0, y: -0.114, z:0, anticlockwise: true}
  },
  {
    from: { x: 0, y: 0, z: 0},
    to: { x: 0.111, y: -0.089, z: 0},
    center: { x: 0, y: -0.114, z:0, anticlockwise: true}
  },
  {
    from: { x: 0.111, y: -0.089, z: 0},
    to: { x: 0.131, y: -0.218, z: 0},
  },
  {
    from: { x: 0.131, y: -0.218, z: 0},
    to: { x: 0.223, y: -0.3025, z: 0 },
    center: { x: 0.238, y:-0.193, z:0, anticlockwise: false},
  },
  {
    from: { x: 0.223, y: -0.3025, z: 0},
    to: { x: 0.223, y: bottomCut - 0.1, z: 0 },
  }, 
  { // left base
    from: { x: 0.223, y: bottomCut - 0.1, z: 0 },
    to: { x: -1, y: bottomCut - 0.1, z: 0},
  },
 
].map(it => {
  const offsetX = -0.223;
  const offsetY = 1.2970;
  const offsetZ = 0.01;
  [it.from, it.to, it.center].forEach(k => {
    if (!k) { return; }
    k.x += offsetX;
    k.y += offsetY; 
    k.z += offsetZ;
  })
  return it;
}); 

export const getPasses = (stockRadius: number) => {
  const passes: any = [];
  let bitRadius = 3.175 / 2;
  // console.log('Getting m0.13 z14')
  const safeX = (bitRadius + (bitRadius*0.1));
  const safeY = (stockRadius + bitRadius + 2);
  const z = 0;
  //=====================================================================
  // PASS 0
  //===================================================================== 
  const lineStart = [
    { x: safeX, y: safeY, z }, 
    { x: safeX, y: stockRadius, z }, 
    { x: 0, y: stockRadius, z }
  ];
  let lineA = [
    { x: 0, y: stockRadius, z }, 
    { x: -25.6, y: stockRadius, z }
  ];
  let lineB =  
    [
      { x: 0, y: 1.303, z },
      { x: -0.45, y: 1.303, z },
      { x: -0.45, y: 0.7, z },
      { x: -10, y: 0.7, z },
      { x: -15.6, y: stockRadius, z }
    ];

  lineA.forEach(it => it.y += bitRadius);
  let lineB_offset = JSON.parse(JSON.stringify(lineB))
  let i = 0;
  i=0;  lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].y += bitRadius;
  passes.push({ lineStart, lineA, lineB, lineB_offset, bitRadius });
  //=====================================================================
  // PASS 1
  //=====================================================================
  bitRadius = 0.381 / 2//1 / 2;
  lineA = [ // the border of the stock
    { x: 0, y: 2, z }, 
    { x: -10.0, y: 2, z }
  ];
  lineB =  // the inner profile
    [
      { x: 0, y: 1.298, z },
      { x: -0.419, y: 1.298, z },
      { x: -0.419, y: 0.7, z },
      { x: -10, y: 0.7, z }, 
    ];
  lineA.forEach(it => it.y += bitRadius);
  lineB_offset = JSON.parse(JSON.stringify(lineB));

  i = 0;
  i=0;  lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x -= bitRadius; lineB_offset[i].y += bitRadius;
  i++;  lineB_offset[i].x += bitRadius; lineB_offset[i].y += bitRadius;
  passes.push({ lineStart, lineA, lineB, bitRadius, lineB_offset });
  
  return passes;
}