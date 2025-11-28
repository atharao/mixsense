import React from 'react';
import { useWebSocket } from '../hooks/useWebSocket';

/**
 * Simple test page to verify Node-RED WebSocket connection
 * Navigate to this page to test if weight data is being received
 */
const TestWebSocket: React.FC = () => {
  const { isConnected, error, currentWeight, isStable } = useWebSocket();

  return (
    <div style={{ padding: 40, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 36, marginBottom: 20 }}>Node-RED WebSocket Test</h1>

      {/* Connection Status */}
      <div
        style={{
          padding: 20,
          marginBottom: 20,
          borderRadius: 8,
          backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
          border: `2px solid ${isConnected ? '#28a745' : '#dc3545'}`,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>
          Connection: {isConnected ? '✅ Connected' : '❌ Disconnected'}
        </h2>
        {error && <p style={{ color: '#721c24', marginTop: 10 }}>Error: {error}</p>}
      </div>

      {/* Weight Display */}
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
          borderRadius: 8,
          border: '2px solid #dee2e6',
        }}
      >
        <p style={{ fontSize: 18, color: '#6c757d', margin: 0 }}>Current Weight</p>
        <h1
          style={{
            fontSize: 72,
            margin: '10px 0',
            color: currentWeight !== null ? '#28a745' : '#6c757d',
          }}
        >
          {currentWeight !== null ? currentWeight.toFixed(2) : '--'}
        </h1>
        <p style={{ fontSize: 24, color: '#6c757d' }}>KG</p>
        {isStable && (
          <p
            style={{
              fontSize: 18,
              color: '#007bff',
              marginTop: 10,
              fontWeight: 'bold',
            }}
          >
            📊 Weight is stable
          </p>
        )}
      </div>

      {/* Debug Info */}
      <div style={{ marginTop: 30, padding: 20, backgroundColor: '#e9ecef', borderRadius: 8 }}>
        <h3>Debug Information</h3>
        <ul style={{ fontFamily: 'monospace', fontSize: 14 }}>
          <li>
            WebSocket URL: <code>ws://localhost:1880/ws/weight</code>
          </li>
          <li>Connection Status: {isConnected ? 'Connected' : 'Not Connected'}</li>
          <li>Current Weight: {currentWeight !== null ? `${currentWeight} KG` : 'No data'}</li>
          <li>Stability: {isStable ? 'Stable' : 'Unstable'}</li>
          <li>Error: {error || 'None'}</li>
        </ul>
        <p style={{ fontSize: 12, color: '#6c757d', marginTop: 15 }}>
          💡 Open browser console (F12) to see detailed WebSocket logs
        </p>
      </div>

      {/* Instructions */}
      <div style={{ marginTop: 30, padding: 20, backgroundColor: '#fff3cd', borderRadius: 8 }}>
        <h3>📋 Expected Node-RED Message Format</h3>
        <pre
          style={{
            backgroundColor: '#f8f9fa',
            padding: 15,
            borderRadius: 4,
            overflow: 'auto',
          }}
        >
          {`{
  "weight": 123.45
}

// Optional with stability flag:
{
  "weight": 123.45,
  "stable": true
}`}
        </pre>
      </div>
    </div>
  );
};

export default TestWebSocket;
