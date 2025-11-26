import { useEffect, useRef, useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import mqtt, { MqttClient } from 'mqtt';
import { updateLoadCellData } from '../store/batchSlice';

interface MQTTConfig {
  host?: string;
  port?: number;
  topic?: string;
  qos?: 0 | 1 | 2;
  protocol?: 'ws' | 'wss';
}

interface WeightData {
  weight: number | null;
  isStable: boolean;
  timestamp: number;
}

const DEFAULT_CONFIG: MQTTConfig = {
  host: 'localhost',
  port: 9001, // WebSocket port (not 1883 which is TCP)
  topic: 'mixsense/weight',
  qos: 0,
  protocol: 'ws',
};

export const useMQTT = (config: MQTTConfig = DEFAULT_CONFIG) => {
  const dispatch = useDispatch();
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [isStable, setIsStable] = useState(false);

  const clientRef = useRef<MqttClient | null>(null);
  const previousWeightRef = useRef<number | null>(null);
  const stabilityCountRef = useRef(0);

  const mqttHost = config.host || DEFAULT_CONFIG.host;
  const mqttPort = config.port || DEFAULT_CONFIG.port;
  const mqttTopic = config.topic || DEFAULT_CONFIG.topic;
  const mqttQos = config.qos || DEFAULT_CONFIG.qos;
  const mqttProtocol = config.protocol || DEFAULT_CONFIG.protocol;

  /**
   * Parse weight data from MQTT message
   * Supports formats:
   * - Simple numeric: "1234.56"
   * - JSON: {"weight": 1234.56, "stable": true}
   * - With units: "1234.56 kg"
   */
  const parseWeightData = useCallback(
    (message: string): { weight: number | null; stable: boolean } => {
      console.log(`🔍 Parsing message: "${message}"`);

      try {
        // Try parsing as JSON first
        const jsonData = JSON.parse(message);
        console.log('📋 Parsed as JSON:', jsonData);

        // Check if it's a plain number (e.g., "18.58" parses to 18.58)
        if (typeof jsonData === 'number') {
          console.log(`✓ Direct numeric JSON: ${jsonData}`);
          return {
            weight: jsonData,
            stable: false,
          };
        }

        // Check if it's an object with weight property
        if (typeof jsonData.weight === 'number') {
          console.log(`✓ JSON weight extracted: ${jsonData.weight}`);
          return {
            weight: jsonData.weight,
            stable: jsonData.stable !== undefined ? jsonData.stable : false,
          };
        }
      } catch (e) {
        // Not JSON, try simple numeric parsing
        console.log('ℹ️ Not JSON, trying numeric parse...');
        const normalized = message.trim();
        const numericMatch = normalized.match(/[-+]?\d+\.?\d*/);
        console.log('🔢 Regex match result:', numericMatch);

        if (numericMatch && numericMatch[0]) {
          const weight = parseFloat(numericMatch[0]);
          console.log(`🔢 Parsed float: ${weight}, isNaN: ${isNaN(weight)}`);
          return {
            weight: isNaN(weight) ? null : weight,
            stable: false, // Will be checked via stability algorithm
          };
        }
      }

      console.log('❌ All parsing methods failed');
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
   * Handle incoming MQTT messages
   */
  const handleMessage = useCallback(
    (topic: string, message: Buffer) => {
      console.log(`📨 MQTT message received on topic: ${topic}`);

      if (topic !== mqttTopic) {
        console.warn(`⚠️ Topic mismatch! Expected: ${mqttTopic}, Got: ${topic}`);
        return;
      }

      const messageStr = message.toString();
      console.log(`📊 Raw message: "${messageStr}"`);

      const { weight, stable } = parseWeightData(messageStr);

      if (weight !== null) {
        console.log(`✓ Parsed weight: ${weight} KG, Stable: ${stable}`);
        setCurrentWeight(weight);
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
    [mqttTopic, parseWeightData, checkStability, dispatch],
  );

  /**
   * Connect to MQTT broker via WebSocket
   */
  const connect = useCallback(async () => {
    try {
      // Use WebSocket protocol (ws:// or wss://) for browser compatibility
      const brokerUrl = `${mqttProtocol}://${mqttHost}:${mqttPort}`;

      console.log(`Connecting to MQTT broker at ${brokerUrl}...`);

      const client = mqtt.connect(brokerUrl, {
        reconnectPeriod: 1000,
        connectTimeout: 30000,
      });

      clientRef.current = client;

      client.on('connect', () => {
        console.log('✓ MQTT connected successfully');
        setIsConnected(true);
        setError(null);

        // Subscribe to the weight topic
        client.subscribe(mqttTopic!, { qos: (mqttQos || 0) as 0 | 1 | 2 }, err => {
          if (err) {
            setError(`Failed to subscribe to topic: ${err.message}`);
            console.error('MQTT subscription error:', err);
          } else {
            console.log(`✓ Subscribed to topic: ${mqttTopic}`);
          }
        });
      });

      client.on('error', err => {
        setError(`MQTT connection error: ${err.message}`);
        console.error('❌ MQTT error:', err);
        setIsConnected(false);
      });

      client.on('offline', () => {
        console.warn('⚠️ MQTT offline');
        setIsConnected(false);
      });

      client.on('reconnect', () => {
        console.log('🔄 MQTT reconnecting...');
      });

      client.on('close', () => {
        console.log('🔌 MQTT connection closed');
        setIsConnected(false);
      });

      client.on('disconnect', () => {
        console.log('🔌 MQTT disconnected');
        setIsConnected(false);
      });

      client.on('message', handleMessage);

      return true;
    } catch (err: any) {
      setError(`Failed to connect to MQTT broker: ${err.message}`);
      console.error('MQTT connection error:', err);
      return false;
    }
  }, [mqttHost, mqttPort, mqttTopic, mqttQos, mqttProtocol, handleMessage]);

  /**
   * Disconnect from MQTT broker
   */
  const disconnect = useCallback(async () => {
    if (clientRef.current) {
      try {
        clientRef.current.end(true);
        clientRef.current = null;
        setIsConnected(false);
        setCurrentWeight(null);
        setIsStable(false);
        previousWeightRef.current = null;
        stabilityCountRef.current = 0;
      } catch (err: any) {
        setError(`Failed to disconnect from MQTT broker: ${err.message}`);
        console.error('MQTT disconnect error:', err);
      }
    }
  }, []);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
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
  };
};
