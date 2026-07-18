import type { Metric } from 'web-vitals';

export type WebVitalPayload = Pick<Metric, 'name' | 'value' | 'delta' | 'id' | 'rating' | 'navigationType'>;
export type WebVitalReporter = (metric: WebVitalPayload) => void;

export const shouldReportWebVitals = (flag = process.env.REACT_APP_ENABLE_ANALYTICS) => flag === 'true';

/** Keep performance telemetry deliberately free of routes, query strings and user data. */
export const sanitizeWebVital = (metric: Metric): WebVitalPayload => ({
  name: metric.name,
  value: metric.value,
  delta: metric.delta,
  id: metric.id,
  rating: metric.rating,
  navigationType: metric.navigationType,
});

export const dispatchWebVital: WebVitalReporter = (metric) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('alphalab:web-vital', { detail: metric }));
};

const reportWebVitals = (onPerfEntry: WebVitalReporter = dispatchWebVital) => {
  if (!shouldReportWebVitals() || typeof window === 'undefined' || typeof onPerfEntry !== 'function') return;

  void import('web-vitals')
    .then(({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const emit = (metric: Metric) => onPerfEntry(sanitizeWebVital(metric));
      onCLS(emit);
      onFCP(emit);
      onINP(emit);
      onLCP(emit);
      onTTFB(emit);
    })
    .catch((error) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Web Vitals could not be initialized.', error);
      }
    });
};

export default reportWebVitals;
