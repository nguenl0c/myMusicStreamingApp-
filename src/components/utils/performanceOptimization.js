// Performance optimization utilities
import { useRef, useEffect } from 'react';

// Debounce function để tránh gọi API quá nhiều
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Throttle function để giới hạn tần suất gọi hàm
export const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Cleanup function cho audio elements
export const cleanupAudioElement = (audioElement) => {
  if (audioElement) {
    try {
      audioElement.pause();
      audioElement.removeAttribute('src');
      audioElement.load();
    } catch (error) {
      console.warn('Error cleaning up audio element:', error);
    }
  }
};

// Memory management cho intervals và timeouts
export class IntervalManager {
  constructor() {
    this.intervals = new Set();
    this.timeouts = new Set();
  }

  setInterval(callback, delay) {
    const id = setInterval(callback, delay);
    this.intervals.add(id);
    return id;
  }

  setTimeout(callback, delay) {
    const id = setTimeout(() => {
      this.timeouts.delete(id);
      callback();
    }, delay);
    this.timeouts.add(id);
    return id;
  }

  clearInterval(id) {
    clearInterval(id);
    this.intervals.delete(id);
  }

  clearTimeout(id) {
    clearTimeout(id);
    this.timeouts.delete(id);
  }

  clearAll() {
    // Clear all intervals
    this.intervals.forEach(id => clearInterval(id));
    this.intervals.clear();
    
    // Clear all timeouts
    this.timeouts.forEach(id => clearTimeout(id));
    this.timeouts.clear();
  }
}

// Hook để quản lý cleanup
export const useCleanup = () => {
  const intervalManager = useRef(new IntervalManager());

  useEffect(() => {
    return () => {
      intervalManager.current.clearAll();
    };
  }, []);

  return intervalManager.current;
};

// Lazy loading cho images
export const lazyLoadImage = (src, fallback = '/placeholder.jpg') => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(src);
    img.onerror = () => resolve(fallback);
    img.src = src;
  });
};

// Check if element is in viewport
export const isInViewport = (element) => {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
};

// Memoization helper
export const memoize = (fn, getKey = (...args) => JSON.stringify(args)) => {
  const cache = new Map();
  
  return (...args) => {
    const key = getKey(...args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn(...args);
    cache.set(key, result);
    
    // Cleanup cache if it gets too large
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return result;
  };
};

// Error handling wrapper
export const withErrorHandling = (fn, fallback = null) => {
  return (...args) => {
    try {
      return fn(...args);
    } catch (error) {
      console.error('Error in function:', error);
      return fallback;
    }
  };
};

// Safe async operation
export const safeAsync = async (asyncFn, fallback = null) => {
  try {
    return await asyncFn();
  } catch (error) {
    console.error('Async operation failed:', error);
    return fallback;
  }
};

// Performance monitor
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  startTiming(label) {
    this.metrics.set(label, performance.now());
  }

  endTiming(label) {
    const startTime = this.metrics.get(label);
    if (startTime) {
      const duration = performance.now() - startTime;
      console.log(`${label}: ${duration.toFixed(2)}ms`);
      this.metrics.delete(label);
      return duration;
    }
    return null;
  }

  measureFunction(fn, label) {
    return (...args) => {
      this.startTiming(label);
      const result = fn(...args);
      this.endTiming(label);
      return result;
    };
  }
} 