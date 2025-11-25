import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { setScannedQRCode } from '../store/batchSlice';
import jsQR from 'jsqr';

interface QRScannerConfig {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  scanInterval?: number;
}

const DEFAULT_CONFIG: QRScannerConfig = {
  width: 640,
  height: 480,
  facingMode: 'environment', // Use back camera on mobile
  scanInterval: 100, // Scan every 100ms
};

export const useQrScanner = (config: QRScannerConfig = DEFAULT_CONFIG) => {
  const dispatch = useDispatch();
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onScanRef = useRef<((data: string) => void) | null>(null);

  /**
   * Scan for QR code in the current video frame
   */
  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Check if video is ready
    if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw current video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get image data
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    // Scan for QR code
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      // Debounce: Only process if it's a new code
      if (code.data !== lastScannedCode) {
        setLastScannedCode(code.data);
        dispatch(setScannedQRCode(code.data));

        // Call custom callback if provided
        if (onScanRef.current) {
          onScanRef.current(code.data);
        }

        // Visual feedback: draw box around QR code
        context.strokeStyle = '#00FF00';
        context.lineWidth = 4;
        context.strokeRect(
          code.location.topLeftCorner.x,
          code.location.topLeftCorner.y,
          code.location.bottomRightCorner.x - code.location.topLeftCorner.x,
          code.location.bottomRightCorner.y - code.location.topLeftCorner.y,
        );
      }
    }
  }, [lastScannedCode, dispatch]);

  /**
   * Start scanning for QR codes
   */
  const startScanning = useCallback(
    async (videoElement: HTMLVideoElement, canvasElement: HTMLCanvasElement) => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera access is not supported in this browser');
        return false;
      }

      try {
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: config.width || DEFAULT_CONFIG.width },
            height: { ideal: config.height || DEFAULT_CONFIG.height },
            facingMode: config.facingMode || DEFAULT_CONFIG.facingMode,
          },
          audio: false,
        });

        streamRef.current = stream;
        videoRef.current = videoElement;
        canvasRef.current = canvasElement;

        // Attach stream to video element
        videoElement.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>(resolve => {
          videoElement.onloadedmetadata = () => {
            videoElement.play();
            setCameraReady(true);
            resolve();
          };
        });

        setIsScanning(true);
        setError(null);

        // Start scanning interval
        scanIntervalRef.current = setInterval(() => {
          scanFrame();
        }, config.scanInterval || DEFAULT_CONFIG.scanInterval);

        return true;
      } catch (err: any) {
        let errorMessage = 'Failed to access camera';

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Camera access denied. Please grant camera permissions.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          errorMessage = 'No camera found on this device.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          errorMessage = 'Camera is already in use by another application.';
        } else if (err.message) {
          errorMessage += `: ${err.message}`;
        }

        setError(errorMessage);
        console.error('QR Scanner error:', err);
        return false;
      }
    },
    [config, scanFrame],
  );

  /**
   * Stop scanning for QR codes
   */
  const stopScanning = useCallback(() => {
    // Stop scanning interval
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    // Stop media stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    canvasRef.current = null;
    setIsScanning(false);
    setCameraReady(false);
    setLastScannedCode(null);
  }, []);

  /**
   * Set custom callback for when a QR code is scanned
   */
  const setOnScan = useCallback((callback: (data: string) => void) => {
    onScanRef.current = callback;
  }, []);

  /**
   * Manually scan a QR code image file
   */
  const scanImageFile = useCallback(
    async (file: File): Promise<string | null> => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = e => {
          const img = new Image();

          img.onload = () => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            if (!context) {
              reject(new Error('Failed to get canvas context'));
              return;
            }

            canvas.width = img.width;
            canvas.height = img.height;

            context.drawImage(img, 0, 0);

            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

            const code = jsQR(imageData.data, imageData.width, imageData.height);

            if (code && code.data) {
              setLastScannedCode(code.data);
              dispatch(setScannedQRCode(code.data));

              if (onScanRef.current) {
                onScanRef.current(code.data);
              }

              resolve(code.data);
            } else {
              resolve(null);
            }
          };

          img.onerror = () => {
            reject(new Error('Failed to load image'));
          };

          img.src = e.target?.result as string;
        };

        reader.onerror = () => {
          reject(new Error('Failed to read file'));
        };

        reader.readAsDataURL(file);
      });
    },
    [dispatch],
  );

  /**
   * Reset the scanner (clear last scanned code)
   */
  const reset = useCallback(() => {
    setLastScannedCode(null);
    setError(null);
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return {
    isScanning,
    cameraReady,
    error,
    lastScannedCode,
    startScanning,
    stopScanning,
    setOnScan,
    scanImageFile,
    reset,
  };
};
