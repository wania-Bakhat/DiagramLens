import {
  buildAtlasResult,
  pickAtlasOrgan
} from "../atlas";
import type { VisionAdapter } from "./types";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockVisionAdapter: VisionAdapter = {
  async extract({ file }) {
    await delay(700);

    const organ = pickAtlasOrgan(file.name);
    return buildAtlasResult(organ, file.name);
  }
};
