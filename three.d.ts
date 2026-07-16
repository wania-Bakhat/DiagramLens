declare module "three" {
  const THREE: any;
  export = THREE;
}

declare module "three/examples/jsm/controls/OrbitControls.js" {
  export class OrbitControls {
    constructor(object: any, domElement?: HTMLElement);
    enabled: boolean;
    enableDamping: boolean;
    enablePan: boolean;
    enableZoom: boolean;
    minDistance: number;
    maxDistance: number;
    target: any;
    update(): void;
    dispose(): void;
  }
}
