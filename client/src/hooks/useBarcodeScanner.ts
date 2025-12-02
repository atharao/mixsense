import { useEffect, useRef, useState, useCallback } from 'react';

export interface BarcodeData {
  recipeId: number;
  stepId: number;
  materialCode: string;
  actualWeight: number;
  userId: number;
  timestamp: string;
}

const DEFAULT_BARCODE_WS_URL =
  import.meta.env.VITE_BARCODE_WS_URL || 'ws://localhost:1880/ws/barcode';

export const useBarcodeScanner = (wsUrl: string = DEFAULT_BARCODE_WS_URL) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<BarcodeData | null>(null);

  console.log('🔍 useBarcodeScanner - isConnected:', isConnected, 'wsUrl:', wsUrl);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Parse barcode data: JSON or pipe-delimited (recipeId|stepId|materialCode|actualWeight|userId|timestamp)
   */
  const parseBarcodeData = useCallback((message: string): BarcodeData | null => {
    try {
      const data = JSON.parse(message);
      if (data && typeof data === 'object' && data.recipeId !== undefined) {
        return {
          recipeId: Number(data.recipeId),
          stepId: Number(data.stepId),
          materialCode: data.materialCode,
          actualWeight: Number(data.actualWeight),
          userId: Number(data.userId),
          timestamp: data.timestamp,
        };
      }
    } catch {
      const parts = message.trim().split('|');
      if (parts.length >= 6) {
        return {
          recipeId: parseInt(parts[0]),
          stepId: parseInt(parts[1]),
          materialCode: parts[2],
          actualWeight: parseFloat(parts[3]),
          userId: parseInt(parts[4]),
          timestamp: parts[5],
        };
      }
    }

    return null;
  }, []);

  /**
   * Clear last scanned barcode after processing
   */
  const clearLastBarcode = useCallback(() => {
    setLastScannedBarcode(null);
  }, []);

  /**
   * Auto-connect on mount and cleanup on unmount
   */
  useEffect(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Track component mount state to prevent reconnection after unmount
    const isMountedRef = { current: true };

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✓ Barcode WebSocket connected');
      setIsConnected(true);
      setError(null);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    ws.onerror = () => {
      setError('Connection error');
      setIsConnected(false);
    };

    ws.onclose = () => {
      console.log('🔌 Barcode WebSocket closed');
      setIsConnected(false);

      // Only auto-reconnect if component is still mounted
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Reconnecting barcode scanner...');
          if (wsRef.current) {
            wsRef.current = null;
          }
          const newWs = new WebSocket(wsUrl);
          wsRef.current = newWs;
          newWs.onopen = ws.onopen;
          newWs.onerror = ws.onerror;
          newWs.onclose = ws.onclose;
          newWs.onmessage = ws.onmessage;
        }, 3000);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      const barcodeData = parseBarcodeData(event.data);

      if (barcodeData) {
        console.log('✓ Barcode scanned:', barcodeData);
        setLastScannedBarcode(barcodeData);
      } else {
        console.error('❌ Invalid barcode format');
        setError('Invalid barcode format');
      }
    };

    return () => {
      // Mark as unmounted BEFORE cleanup to prevent reconnection
      isMountedRef.current = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsConnected(false);
      setLastScannedBarcode(null);
    };
  }, [wsUrl, parseBarcodeData]);

  return {
    isConnected,
    error,
    lastScannedBarcode,
    clearLastBarcode,
  };
};
