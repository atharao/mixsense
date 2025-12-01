import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateLoadCellData } from '../store/batchSlice';

interface WeightData {
  weight: number | null;
  isStable: boolean;
  timestamp: number;
}

const DEFAULT_WS_URL = import.meta.env.VITE_WEIGHT_WS_URL || 'ws://localhost:1880/ws/weight';

interface UseWebSocketOptions {
  autoConnect?: boolean;
}

export const useWebSocket = (wsUrl: string = DEFAULT_WS_URL, options: UseWebSocketOptions = {}) => {
  const { autoConnect = true } = options;
  console.log(`🔧 useWebSocket hook initialized with autoConnect: ${autoConnect}, wsUrl: ${wsUrl}`);
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);
  const [hasDataReceived, setHasDataReceived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const previousWeightRef = useRef<number | null>(null);
  const stabilityCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Parse weight data from WebSocket message
   * Primary format from Node-RED: {"weight": <number>}
   * Also supports: {"weight": <number>, "stable": true}
   * Fallback: Simple numeric string "1234.56"
   */
  const parseWeightData = useCallback(
    (message: string): { weight: number | null; stable: boolean } => {
      console.log(`🔍 Parsing Node-RED message:`, message);

      try {
        // Primary format: JSON from Node-RED
        const data = JSON.parse(message);
        console.log('📋 Parsed JSON:', data);

        // Node-RED format: {"weight": <number or string>}
        if (data && data.weight !== undefined && data.weight !== null) {
          const weightValue =
            typeof data.weight === 'string' ? parseFloat(data.weight) : data.weight;

          if (typeof weightValue === 'number' && !isNaN(weightValue)) {
            console.log(`✓ Weight from Node-RED: ${weightValue} KG`);
            return {
              weight: weightValue,
              stable: data.stable !== undefined ? data.stable : false,
            };
          }
        }

        // Fallback: Direct number in JSON (e.g., just "18.58")
        if (typeof data === 'number') {
          console.log(`✓ Direct numeric: ${data}`);
          return {
            weight: data,
            stable: false,
          };
        }

        // Fallback: Direct string number in JSON (e.g., just "18.58")
        if (typeof data === 'string') {
          const weightValue = parseFloat(data);
          if (!isNaN(weightValue)) {
            console.log(`✓ Direct numeric string: ${weightValue}`);
            return {
              weight: weightValue,
              stable: false,
            };
          }
        }
      } catch (e) {
        // Fallback: Simple numeric string (not JSON)
        console.log('ℹ️ Not JSON, trying plain numeric parse...');
        const normalized = message.trim();
        const numericMatch = normalized.match(/[-+]?\d+\.?\d*/);

        if (numericMatch && numericMatch[0]) {
          const weight = parseFloat(numericMatch[0]);
          if (!isNaN(weight)) {
            console.log(`✓ Parsed as number: ${weight}`);
            return { weight, stable: false };
          }
        }
      }

      console.log('❌ Could not parse weight from message');
      return { weight: null, stable: false };
    },
    [],
  );

  /**
   * Check weight stability over time
   */
  const checkStability = useCallback((weight: number) => {
    const STABILITY_THRESHOLD = 0.1; // grams
    const STABILITY_REQUIRED_READINGS = 3;

    if (previousWeightRef.current !== null) {
      const diff = Math.abs(weight - previousWeightRef.current);

      if (diff <= STABILITY_THRESHOLD) {
        stabilityCountRef.current++;
        if (stabilityCountRef.current >= STABILITY_REQUIRED_READINGS) {
          setIsStable(true);
        }
      } else {
        stabilityCountRef.current = 0;
        setIsStable(false);
      }
    }

    previousWeightRef.current = weight;
  }, []);

  /**
   * Handle incoming WebSocket messages
   */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      console.log(`📨 WebSocket message received`);

      const messageStr = event.data;
      console.log(`📊 Raw message: "${messageStr}"`);

      const { weight, stable } = parseWeightData(messageStr);

      if (weight !== null) {
        console.log(`✓ Parsed weight: ${weight} KG, Stable: ${stable}`);
        setCurrentWeight(weight);
        setHasDataReceived(true); // Mark that we're receiving data
        checkStability(weight);

        // Dispatch to Redux
        const weightData: WeightData = {
          weight,
          isStable: stable || stabilityCountRef.current >= 3,
          timestamp: Date.now(),
        };

        dispatch(updateLoadCellData(weightData));
      } else {
        console.error(`❌ Failed to parse weight from: "${messageStr}"`);
      }
    },
    [parseWeightData, checkStability, dispatch],
  );

  /**
   * Connect to Node-RED WebSocket
   */
  const connect = useCallback(() => {
    // Prevent duplicate connections
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket already connected, skipping duplicate connection');
      return true;
    }

    // Close any existing connection first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      console.log(`Connecting to Node-RED WebSocket at ${wsUrl}...`);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✓ WebSocket connected successfully');
        setIsConnected(true);
        setError(null);

        // Clear any pending reconnection attempts
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onerror = err => {
        console.error('❌ WebSocket error:', err);
        setError('WebSocket connection error');
        setIsConnected(false);
        setHasDataReceived(false);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        setIsConnected(false);
        setHasDataReceived(false);

        // Only auto-reconnect if autoConnect is enabled
        if (autoConnect) {
          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 3000);
        }
      };

      ws.onmessage = handleMessage;

      return true;
    } catch (err: any) {
      setError(`Failed to connect to WebSocket: ${err.message}`);
      console.error('WebSocket connection error:', err);
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
        setCurrentWeight(null);
        setIsStable(false);
        previousWeightRef.current = null;
        stabilityCountRef.current = 0;
      } catch (err: any) {
        setError(`Failed to disconnect from WebSocket: ${err.message}`);
        console.error('WebSocket disconnect error:', err);
      }
    }
  }, []);

  /**
   * Auto-connect on mount (if enabled) and cleanup on unmount
   */
  useEffect(() => {
    const shouldConnect = autoConnect;
    console.log(
      `🔧 useWebSocket useEffect running - autoConnect: ${autoConnect}, shouldConnect: ${shouldConnect}`,
    );

    if (shouldConnect) {
      console.log('🔌 Auto-connecting to Node-RED WebSocket...');

      // Inline connection logic to avoid dependency on connect function
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        console.log('⚠️ WebSocket already connected, skipping duplicate connection');
        return;
      }

      try {
        console.log(`Connecting to Node-RED WebSocket at ${wsUrl}...`);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('✓ WebSocket connected successfully');
          setIsConnected(true);
          setError(null);
        };

        ws.onerror = err => {
          console.error('❌ WebSocket error:', err);
          setError('WebSocket connection error');
          setIsConnected(false);
          setHasDataReceived(false);
        };

        ws.onclose = () => {
          console.log('🔌 WebSocket connection closed');
          setIsConnected(false);
          setHasDataReceived(false);
        };

        ws.onmessage = handleMessage;
      } catch (err: any) {
        setError(`Failed to connect to WebSocket: ${err.message}`);
        console.error('WebSocket connection error:', err);
      }
    }

    return () => {
      console.log('🔌 Cleaning up WebSocket connection...');

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
        setCurrentWeight(null);
        setIsStable(false);
        previousWeightRef.current = null;
        stabilityCountRef.current = 0;
      }
    };
  }, [wsUrl, autoConnect, handleMessage]); // Only depend on primitive values and stable callbacks

  return {
    isConnected,
    hasDataReceived,
    error,
    currentWeight,
    isStable,
    connect,
    disconnect,
  };
};
