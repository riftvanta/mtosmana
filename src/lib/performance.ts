// Performance monitoring and optimization utilities

// Performance metrics interface
interface PerformanceMetrics {
  pageLoadTime: number;
  databaseQueryTime: number;
  componentRenderTime: number;
  cacheHitRate: number;
  networkLatency: number;
  timestamp: number;
}

// Network connection interface
interface NetworkConnection {
  effectiveType: string;
  downlink: number;
  rtt: number;
  saveData: boolean;
}

// Performance monitoring class
class PerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private queryTimes: Map<string, number> = new Map();
  private cacheStats = { hits: 0, misses: 0 };

  // Track page load performance
  trackPageLoad(pageName: string) {
    if (typeof window !== 'undefined' && window.performance) {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      
      const loadTime = navigation.loadEventEnd - navigation.loadEventStart;
      const domContentLoadedTime = navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart;
      
      console.log(`📊 Performance [${pageName}]:`, {
        'Page Load Time': `${loadTime.toFixed(2)}ms`,
        'DOM Content Loaded': `${domContentLoadedTime.toFixed(2)}ms`,
        'Time to Interactive': `${navigation.domInteractive - navigation.fetchStart}ms`,
        'First Paint': this.getFirstPaint(),
        'Largest Contentful Paint': this.getLCP(),
      });
    }
  }

  // Track database query performance
  trackDatabaseQuery(queryName: string, startTime: number) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    this.queryTimes.set(queryName, duration);
    
    console.log(`🔥 Database Query [${queryName}]: ${duration.toFixed(2)}ms`);
    
    // Alert for slow queries (>1000ms)
    if (duration > 1000) {
      console.warn(`⚠️ Slow query detected: ${queryName} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  // Track cache performance
  trackCacheHit(cacheKey: string) {
    this.cacheStats.hits++;
    console.log(`💾 Cache HIT: ${cacheKey} (Hit rate: ${this.getCacheHitRate().toFixed(1)}%)`);
  }

  trackCacheMiss(cacheKey: string) {
    this.cacheStats.misses++;
    console.log(`💾 Cache MISS: ${cacheKey} (Hit rate: ${this.getCacheHitRate().toFixed(1)}%)`);
  }

  // Component render performance tracking
  trackComponentRender(componentName: string, renderTime: number) {
    console.log(`⚛️ Component Render [${componentName}]: ${renderTime.toFixed(2)}ms`);
    
    // Alert for slow renders (>100ms)
    if (renderTime > 100) {
      console.warn(`⚠️ Slow component render: ${componentName} took ${renderTime.toFixed(2)}ms`);
    }
  }

  // Network performance tracking
  trackNetworkRequest(url: string, startTime: number, success: boolean) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const status = success ? '✅' : '❌';
    console.log(`🌐 Network Request ${status}: ${url} - ${duration.toFixed(2)}ms`);
    
    return duration;
  }

  // Bundle size analysis
  trackBundleSize() {
    if (typeof window !== 'undefined' && window.performance) {
      const entries = performance.getEntriesByType('resource');
      const jsFiles = entries.filter(entry => entry.name.includes('.js'));
      const cssFiles = entries.filter(entry => entry.name.includes('.css'));
      
      const totalJSSize = jsFiles.reduce((total, file) => {
        const resource = file as PerformanceResourceTiming;
        return total + (resource.encodedBodySize || 0);
      }, 0);
      
      const totalCSSSize = cssFiles.reduce((total, file) => {
        const resource = file as PerformanceResourceTiming;
        return total + (resource.encodedBodySize || 0);
      }, 0);
      
      console.log(`📦 Bundle Analysis:`, {
        'JavaScript Size': `${(totalJSSize / 1024).toFixed(2)} KB`,
        'CSS Size': `${(totalCSSSize / 1024).toFixed(2)} KB`,
        'Total JS Files': jsFiles.length,
        'Total CSS Files': cssFiles.length,
      });
      
      // Alert if bundle is too large (>500KB)
      if (totalJSSize > 500 * 1024) {
        console.warn(`⚠️ Large JavaScript bundle detected: ${(totalJSSize / 1024).toFixed(2)} KB`);
      }
    }
  }

  // Memory usage tracking
  trackMemoryUsage() {
    if (typeof window !== 'undefined' && 'memory' in performance) {
      const memory = (performance as PerformanceWithMemory).memory;
      console.log(`💻 Memory Usage:`, {
        'Used': `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        'Total': `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        'Limit': `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        'Usage %': `${((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100).toFixed(1)}%`
      });
    }
  }

  // Mobile performance monitoring
  trackMobilePerformance() {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as NavigatorWithConnection).connection;
      if (connection) {
        console.log(`📱 Mobile Performance:`, {
          'Connection Type': connection.effectiveType,
          'Downlink Speed': `${connection.downlink} Mbps`,
          'RTT': `${connection.rtt}ms`,
          'Save Data Mode': connection.saveData ? 'ON' : 'OFF'
        });
        
        // Warn about slow connections
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
          console.warn('⚠️ Slow network detected. Consider optimizing for low bandwidth.');
        }
      }
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const summary = {
      cacheHitRate: this.getCacheHitRate(),
      averageQueryTime: this.getAverageQueryTime(),
      slowQueries: this.getSlowQueries(),
      totalMetrics: this.metrics.length
    };
    
    console.log('📊 Performance Summary:', summary);
    return summary;
  }

  // Private helper methods
  private getFirstPaint(): string {
    if (typeof window !== 'undefined' && window.performance) {
      const paintEntries = performance.getEntriesByType('paint');
      const firstPaint = paintEntries.find(entry => entry.name === 'first-paint');
      return firstPaint ? `${firstPaint.startTime.toFixed(2)}ms` : 'N/A';
    }
    return 'N/A';
  }

  private getLCP(): string {
    if (typeof window !== 'undefined' && window.performance) {
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      const lcp = lcpEntries[lcpEntries.length - 1];
      return lcp ? `${lcp.startTime.toFixed(2)}ms` : 'N/A';
    }
    return 'N/A';
  }

  private getCacheHitRate(): number {
    const total = this.cacheStats.hits + this.cacheStats.misses;
    return total > 0 ? (this.cacheStats.hits / total) * 100 : 0;
  }

  private getAverageQueryTime(): number {
    const times = Array.from(this.queryTimes.values());
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  private getSlowQueries(): string[] {
    return Array.from(this.queryTimes.entries())
      .filter(([, time]) => time > 1000)
      .map(([query]) => query);
  }
}

// Type definitions for browser APIs
interface PerformanceWithMemory extends Performance {
  memory: {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  };
}

interface NavigatorWithConnection extends Navigator {
  connection: NetworkConnection;
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for component performance tracking
export const usePerformanceTracking = (componentName: string) => {
  const trackRender = (callback: () => void) => {
    const startTime = performance.now();
    callback();
    const renderTime = performance.now() - startTime;
    performanceMonitor.trackComponentRender(componentName, renderTime);
  };

  return { trackRender };
};

// Database query performance decorator
export const withPerformanceTracking = <T>(
  queryName: string,
  queryFunction: () => Promise<T>
): Promise<T> => {
  const startTime = performance.now();
  
  return queryFunction()
    .then(result => {
      performanceMonitor.trackDatabaseQuery(queryName, startTime);
      return result;
    })
    .catch(error => {
      performanceMonitor.trackDatabaseQuery(`${queryName}_ERROR`, startTime);
      throw error;
    });
};

// Mobile performance optimization utilities
export const mobileOptimizations = {
  // Lazy load images
  setupLazyLoading: () => {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.classList.remove('lazy');
              imageObserver.unobserve(img);
            }
          }
        });
      });

      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  },

  // Optimize for battery and data usage
  enableDataSaver: () => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as NavigatorWithConnection).connection;
      if (connection && connection.saveData) {
        console.log('📱 Data saver mode detected - optimizing experience');
        // Reduce image quality, disable animations, etc.
        document.body.classList.add('data-saver-mode');
      }
    }
  },

  // Service worker registration for caching
  registerServiceWorker: async () => {
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('✅ Service Worker registered successfully');
      } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
      }
    }
  }
};

// Initialize performance monitoring
export const initializePerformanceMonitoring = () => {
  // Track initial page load
  if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
      performanceMonitor.trackPageLoad(window.location.pathname);
      performanceMonitor.trackBundleSize();
      performanceMonitor.trackMemoryUsage();
      performanceMonitor.trackMobilePerformance();
    });

    // Track performance periodically
    setInterval(() => {
      performanceMonitor.trackMemoryUsage();
      performanceMonitor.getPerformanceSummary();
    }, 60000); // Every minute

    // Mobile optimizations
    mobileOptimizations.enableDataSaver();
    mobileOptimizations.setupLazyLoading();
  }
}; 