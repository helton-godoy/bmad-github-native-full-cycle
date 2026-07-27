import { useState, useEffect } from 'react';

export function useCustomHook() {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Hook logic
  }, []);

  return data;
}