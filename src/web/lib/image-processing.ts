import { cropImageWithFfmpeg } from "@/lib/media";

export async function cropImage(
  imageUrl: string,
  cropX = 0,
  cropY = 0,
  cropW = 100,
  cropH = 100,
) {
  return cropImageWithFfmpeg({
    imageUrl,
    xPercent: cropX,
    yPercent: cropY,
    widthPercent: cropW,
    heightPercent: cropH,
  });
}
