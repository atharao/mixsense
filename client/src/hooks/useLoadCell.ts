import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { updateLoadCellData } from '../store/batchSlice';

interface LoadCellConfig {
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: ParityType;
  bufferSize?: number;
  flowControl?: FlowControlType;
}

interface LoadCellData {
  weight: number | null;
  isStable: boolean;
  timestamp: number;
}

const DEFAULT_CONFIG: LoadCellConfig = {
  baudRate: 9600,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
};

export const useLoadCell = (config: LoadCellConfig = DEFAULT_CONFIG) => {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);

  const portRef = useRef<SerialPort | null>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);
  const decoderRef = useRef(new TextDecoder());
  const bufferRef = useRef('');
  const stabilityCheckRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previousWeightRef = useRef<number | null>(null);
  const stabilityCountRef = useRef(0);

  /**
   * Parse weight data from load cell
   * Supports common load cell formats:
   * - Simple numeric: "1234.56"
   * - With units: "1234.56 g"
   * - With sign: "+1234.56"
   * - Stability indicator: "ST 1234.56" or "US 1234.56"
   */
  const parseWeightData = useCallback((data: string): { weight: number | null; stable: boolean } => {
    // Remove whitespace and normalize
    const normalized = data.trim().toUpperCase();

    // Check for stability indicator
    const isStable = normalized.startsWith('ST') || (!normalized.startsWith('US') && !normalized.includes('UNSTABLE'));

    // Extract numeric value
    const numericMatch = normalized.match(/[-+]?\d+\.?\d*/);
    if (!numericMatch) {
      return { weight: null, stable: false };
    }

    const weight = parseFloat(numericMatch[0]);
    return {
      weight: isNaN(weight) ? null : weight,
      stable: isStable,
    };
  }, []);

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
   * Process incoming data from the load cell
   */
  const processData = useCallback(
    (chunk: string) => {
      bufferRef.current += chunk;

      // Split by newline or carriage return
      const lines = bufferRef.current.split(/[\r\n]+/);

      // Keep the last partial line in the buffer
      bufferRef.current = lines.pop() || '';

      // Process complete lines
      lines.forEach((line) => {
        if (!line.trim()) return;

        const { weight, stable } = parseWeightData(line);

        if (weight !== null) {
          setCurrentWeight(weight);
          checkStability(weight);

          // Dispatch to Redux
          const loadCellData: LoadCellData = {
            weight,
            isStable: stable,
            timestamp: Date.now(),
          };

          dispatch(updateLoadCellData(loadCellData));
        }
      });
    },
    [parseWeightData, checkStability, dispatch]
  );

  /**
   * Read data from the serial port
   */
  const readData = useCallback(async () => {
    if (!portRef.current?.readable) return;

    try {
      const reader = portRef.current.readable.getReader();
      readerRef.current = reader;

      while (true) {
        const { value, done } = await reader.read();

        if (done) {
          reader.releaseLock();
          break;
        }

        const chunk = decoderRef.current.decode(value, { stream: true });
        processData(chunk);
      }
    } catch (err: any) {
      if (err.name !== 'NetworkError' && err.name !== 'AbortError') {
        setError(`Error reading from load cell: ${err.message}`);
        console.error('Load cell read error:', err);
      }
    } finally {
      readerRef.current = null;
    }
  }, [processData]);

  /**
   * Connect to the load cell via Web Serial API
   */
  const connect = useCallback(async () => {
    if (!('serial' in navigator)) {
      setError('Web Serial API is not supported in this browser');
      return false;
    }

    try {
      // Request port access
      const port = await navigator.serial.requestPort();
      portRef.current = port;

      // Open the port with configuration
      await port.open({
        baudRate: (config.baudRate || DEFAULT_CONFIG.baudRate) as number,
        dataBits: config.dataBits || DEFAULT_CONFIG.dataBits,
        stopBits: config.stopBits || DEFAULT_CONFIG.stopBits,
        parity: config.parity || DEFAULT_CONFIG.parity,
        flowControl: config.flowControl || DEFAULT_CONFIG.flowControl,
      });

      setIsConnected(true);
      setError(null);

      // Start reading data
      readData();

      return true;
    } catch (err: any) {
      setError(`Failed to connect to load cell: ${err.message}`);
      console.error('Load cell connection error:', err);
      return false;
    }
  }, [config, readData]);

  /**
   * Disconnect from the load cell
   */
  const disconnect = useCallback(async () => {
    try {
      // Cancel the reader
      if (readerRef.current) {
        await readerRef.current.cancel();
        readerRef.current = null;
      }

      // Close the port
      if (portRef.current) {
        await portRef.current.close();
        portRef.current = null;
      }

      setIsConnected(false);
      setCurrentWeight(null);
      setIsStable(false);
      bufferRef.current = '';
      previousWeightRef.current = null;
      stabilityCountRef.current = 0;
    } catch (err: any) {
      setError(`Failed to disconnect from load cell: ${err.message}`);
      console.error('Load cell disconnect error:', err);
    }
  }, []);

  /**
   * Tare/zero the load cell
   */
  const tare = useCallback(async () => {
    if (!portRef.current?.writable) {
      setError('Load cell not connected');
      return false;
    }

    try {
      const writer = portRef.current.writable.getWriter();

      // Send tare command (common commands: "T", "TARE", or "Z")
      const tareCommand = new TextEncoder().encode('T\r\n');
      await writer.write(tareCommand);

      writer.releaseLock();

      // Reset current weight
      setCurrentWeight(0);
      previousWeightRef.current = 0;
      stabilityCountRef.current = 0;

      return true;
    } catch (err: any) {
      setError(`Failed to tare load cell: ${err.message}`);
      console.error('Load cell tare error:', err);
      return false;
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (stabilityCheckRef.current) {
        clearInterval(stabilityCheckRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    error,
    currentWeight,
    isStable,
    connect,
    disconnect,
    tare,
  };
};
