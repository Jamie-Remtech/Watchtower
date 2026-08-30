import { useState, useEffect } from 'react';
import { subscribeTracker } from '../lib/tracker';

// React view onto the tracking singleton.
export const useTracker = () => {
  const [state, setState] = useState({ active: false, lastFix: null, error: null });
  useEffect(() => subscribeTracker(setState), []);
  return state;
};
