import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions {
  onMessage: (data: any) => void;
  onError?: (error: Event) => void;
  enabled?: boolean;
  reconnectInterval?: number;
}

export function useSSE(url: string, options: UseSSEOptions) {
  const { onMessage, onError, enabled = true, reconnectInterval = 5000 } = options;
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!enabled) return undefined;

    const connect = () => {
      try {
        const eventSource = new EventSource(url);
        eventSourceRef.current = eventSource;

        eventSource.onopen = () => {
          setIsConnected(true);
          console.log('[SSE] Connected to', url);
        };

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (error) {
            console.error('[SSE] Parse error:', error);
          }
        };

        eventSource.onerror = (error) => {
          setIsConnected(false);
          console.error('[SSE] Connection error:', error);
          onError?.(error);
          
          // Close and attempt to reconnect
          eventSource.close();
          reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
        };
      } catch (error) {
        console.error('[SSE] Connection failed:', error);
        reconnectTimeoutRef.current = setTimeout(connect, reconnectInterval);
      }
    };

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [url, enabled, onMessage, onError, reconnectInterval]);

  return { isConnected };
}
