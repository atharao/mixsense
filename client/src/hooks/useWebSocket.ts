import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateLoadCellData } from '../store/batchSlice';

const DEFAULT_WS_URL = import.meta.env.VITE_WEIGHT_WS_URL || 'ws://localhost:1880/ws/weight';

export const useWebSocket = (wsUrl: string = DEFAULT_WS_URL) => {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);

  console.log('🔍 useWebSocket - isConnected:', isConnected, 'wsUrl:', wsUrl);

  const wsRef = useRef<WebSocket | null>(null);
  const previousWeightRef = useRef<number | null>(null);
  const stabilityCountRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Parse weight data from WebSocket message
   * Supports: {"weight": 123.45}, {"weight": "123.45", "stable": true}, or plain "123.45"
   */
  const parseWeightData = useCallback((message: string): number | null => {
    try {
      const data = JSON.parse(message);

      if (data && data.weight !== undefined && data.weight !== null) {
        const weight = typeof data.weight === 'string' ? parseFloat(data.weight) : data.weight;
        return !isNaN(weight) ? weight : null;
      }

      if (typeof data === 'number' && !isNaN(data)) return data;

      if (typeof data === 'string') {
        const weight = parseFloat(data);
        return !isNaN(weight) ? weight : null;
      }
    } catch {
      const weight = parseFloat(message.trim());
      return !isNaN(weight) ? weight : null;
    }

    return null;
  }, []);

  /**
   * Check weight stability (requires 3 consecutive readings within 0.1g)
   */
  const checkStability = useCallback((weight: number) => {
    if (previousWeightRef.current !== null) {
      const diff = Math.abs(weight - previousWeightRef.current);

      if (diff <= 0.1) {
        stabilityCountRef.current++;
        setIsStable(stabilityCountRef.current >= 3);
      } else {
        stabilityCountRef.current = 0;
        setIsStable(false);
      }
    }
    previousWeightRef.current = weight;
  }, []);

  /**
   * Ref to track monitoring state without causing re-renders
   */
  const isMonitoringRef = useRef(isMonitoring);

  useEffect(() => {
    isMonitoringRef.current = isMonitoring;
  }, [isMonitoring]);

  /**
   * Start monitoring weight data
   */
  const startMonitoring = useCallback(() => {
    setIsMonitoring(true);
  }, []);

  /**
   * Stop monitoring weight data
   */
  const stopMonitoring = useCallback(() => {
    setIsMonitoring(false);
    setCurrentWeight(null);
    setIsStable(false);
    previousWeightRef.current = null;
    stabilityCountRef.current = 0;
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
      console.log('✓ Weight WebSocket connected');
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
      console.log('🔌 Weight WebSocket closed');
      setIsConnected(false);

      // Only auto-reconnect if component is still mounted
      if (isMountedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('🔄 Reconnecting...');
          if (wsRef.current) {
            wsRef.current = null;
          }
          // Trigger reconnection by creating new WebSocket
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
      const weight = parseWeightData(event.data);

      if (weight !== null && isMonitoringRef.current) {
        setCurrentWeight(weight);
        checkStability(weight);

        dispatch(
          updateLoadCellData({
            weight,
            isStable: stabilityCountRef.current >= 3,
            timestamp: Date.now(),
          }),
        );
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
      setIsMonitoring(false);
    };
  }, [wsUrl, parseWeightData, checkStability, dispatch]);

  return {
    isConnected,
    error,
    currentWeight,
    isStable,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
  };
};
