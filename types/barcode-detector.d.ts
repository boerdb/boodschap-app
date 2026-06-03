interface BarcodeDetectorOptions {
  formats?: string[];
}

interface DetectedBarcode {
  rawValue: string;
  format: string;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector: typeof BarcodeDetector;
}

declare global {
  // eslint-disable-next-line no-var
  var BarcodeDetector: typeof BarcodeDetector | undefined;
}
