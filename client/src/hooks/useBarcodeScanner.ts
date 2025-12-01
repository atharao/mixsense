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

interface UseBarcodeScannerOptions {
  autoConnect?: boolean;
}

export const useBarcodeScanner = (
  wsUrl: string = DEFAULT_BARCODE_WS_URL,
  options: UseBarcodeScannerOptions = {},
) => {
  const { autoConnect = true } = options;
  console.log(
    `🔧 useBarcodeScanner hook initialized with autoConnect: ${autoConnect}, wsUrl: ${wsUrl}`,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<BarcodeData | null>(null);
  const [hasDataReceived, setHasDataReceived] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Parse barcode data from WebSocket message
   * Format: recipeId|stepId|materialCode|actualWeight|userId|timestamp
   */
  const parseBarcodeData = useCallback((message: string): BarcodeData | null => {
    console.log('🔍 Parsing barcode data:', message);

    try {
      // Try JSON format first
      const data = JSON.parse(message);
      if (data && typeof data === 'object' && data.recipeId !== undefined) {
        console.log('✓ Parsed barcode as JSON:', data);
        return {
          recipeId: Number(data.recipeId),
          stepId: Number(data.stepId),
          materialCode: data.materialCode,
          actualWeight: Number(data.actualWeight),
          userId: Number(data.userId),
          timestamp: data.timestamp,
        };
      }
    } catch (e) {
      // Not JSON, try pipe-delimited format
      console.log('ℹ️ Not JSON, trying pipe-delimited format...');
    }

    // Pipe-delimited format
    const parts = message.trim().split('|');
    if (parts.length >= 6) {
      const barcodeData: BarcodeData = {
        recipeId: parseInt(parts[0]),
        stepId: parseInt(parts[1]),
        materialCode: parts[2],
        actualWeight: parseFloat(parts[3]),
        userId: parseInt(parts[4]),
        timestamp: parts[5],
      };

      console.log('✓ Parsed barcode as pipe-delimited:', barcodeData);
      return barcodeData;
    }

    console.log('❌ Could not parse barcode data');
    return null;
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      console.log('📨 Barcode WebSocket message received');
      const messageStr = event.data;
      console.log('📊 Raw barcode message:', messageStr);

      const barcodeData = parseBarcodeData(messageStr);

      if (barcodeData) {
        console.log('✓ Barcode scanned successfully:', barcodeData);
        setLastScannedBarcode(barcodeData);
        setHasDataReceived(true);
      } else {
        console.error('❌ Failed to parse barcode data:', messageStr);
        setError('Invalid barcode format');
      }
    },
    [parseBarcodeData],
  );

  /**
   * Connect to Node-RED Barcode WebSocket
   */
  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('⚠️ Barcode WebSocket already connected');
      return true;
    }

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      console.log(`Connecting to Node-RED Barcode WebSocket at ${wsUrl}...`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✓ Barcode WebSocket connected successfully');
        setIsConnected(true);
        setError(null);

        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onerror = err => {
        console.error('❌ Barcode WebSocket error:', err);
        setError('WebSocket connection error');
        setIsConnected(false);
        setHasDataReceived(false);
      };

      ws.onclose = () => {
        console.log('🔌 Barcode WebSocket connection closed');
        setIsConnected(false);
        setHasDataReceived(false);

        // Only auto-reconnect if autoConnect is enabled
        if (autoConnect) {
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect barcode scanner...');
            connect();
          }, 3000);
        }
      };

      ws.onmessage = handleMessage;

      return true;
    } catch (err: any) {
      setError(`Failed to connect to Barcode WebSocket: ${err.message}`);
      console.error('Barcode WebSocket connection error:', err);
      return false;
    }
  }, [wsUrl, handleMessage, autoConnect]);

  /**
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      try {
        // Clear reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
        setHasDataReceived(false);
        setLastScannedBarcode(null);
      } catch (err: any) {
        setError(`Failed to disconnect from Barcode WebSocket: ${err.message}`);
        console.error('Barcode WebSocket disconnect error:', err);
      }
    }
  }, []);

  /**
   * Clear last scanned barcode (useful after processing)
   */
  const clearLastBarcode = useCallback(() => {
    setLastScannedBarcode(null);
  }, []);

  /**
   * Auto-connect on mount (if enabled) and cleanup on unmount
   */
  useEffect(() => {
    const shouldConnect = autoConnect;
    console.log(
      `🔧 useBarcodeScanner useEffect running - autoConnect: ${autoConnect}, shouldConnect: ${shouldConnect}`,
    );

    if (shouldConnect) {
      console.log('🔌 Auto-connecting to Node-RED Barcode WebSocket...');

      // Inline connection logic to avoid dependency issues
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('⚠️ Barcode WebSocket already connected, skipping duplicate connection');
        return;
      }

      try {
        console.log(`Connecting to Node-RED Barcode WebSocket at ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✓ Barcode WebSocket connected successfully');
          setIsConnected(true);
          setError(null);
        };

        ws.onerror = err => {
          console.error('❌ Barcode WebSocket error:', err);
          setError('WebSocket connection error');
          setIsConnected(false);
          setHasDataReceived(false);
        };

        ws.onclose = () => {
          console.log('🔌 Barcode WebSocket connection closed');
          setIsConnected(false);
          setHasDataReceived(false);
        };

        ws.onmessage = handleMessage;
      } catch (err: any) {
        setError(`Failed to connect to Barcode WebSocket: ${err.message}`);
        console.error('Barcode WebSocket connection error:', err);
      }
    }

    return () => {
      console.log('🔌 Cleaning up Barcode WebSocket connection...');

      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setIsConnected(false);
        setHasDataReceived(false);
        setLastScannedBarcode(null);
      }
    };
  }, [wsUrl, autoConnect, handleMessage]);

  return {
    isConnected,
    hasDataReceived,
    error,
    lastScannedBarcode,
    connect,
    disconnect,
    clearLastBarcode,
  };
};
