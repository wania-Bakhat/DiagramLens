declare module "three/examples/jsm/loaders/GLTFLoader.js" {
  export class GLTFLoader {
    setCrossOrigin(value: string): this;
    load(
      url: string,
      onLoad: (gltf: { scene: import("three").Group }) => void,
      onProgress?: (event: ProgressEvent<EventTarget>) => void,
      onError?: (event: unknown) => void
    ): void;
  }
}
