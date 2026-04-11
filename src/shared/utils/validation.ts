/**
 * Form validation utilities.
 * Returns an error message string on failure, or null on success.
 */

export type Validator = (value: unknown) => string | null;

/** Field must be non-empty string */
export function required(message = 'This field is required'): Validator {
  return (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return message;
    return null;
  };
}

/** Number must be >= min */
export function minValue(min: number, message?: string): Validator {
  return (value) => {
    const n = Number(value);
    if (isNaN(n) || n < min) return message ?? `Minimum value is ${min}`;
    return null;
  };
}

/** Number must be <= max */
export function maxValue(max: number, message?: string): Validator {
  return (value) => {
    const n = Number(value);
    if (isNaN(n) || n > max) return message ?? `Maximum value is ${max}`;
    return null;
  };
}

/** Number must be > 0 */
export function positiveOnly(message = 'Value must be greater than 0'): Validator {
  return (value) => {
    const n = Number(value);
    if (isNaN(n) || n <= 0) return message;
    return null;
  };
}

/** Integer quantity must be > 0 */
export function positiveQuantity(message = 'Quantity must be at least 1'): Validator {
  return (value) => {
    const n = Number(value);
    if (isNaN(n) || !Number.isInteger(n) || n <= 0) return message;
    return null;
  };
}

/** Stock must be > 0 */
export function stockAvailable(stock: number, message?: string): Validator {
  return () => {
    if (stock <= 0) return message ?? 'Product is out of stock';
    return null;
  };
}

/** Date must not be in the future (configurable) */
export function notFutureDate(message = 'Date cannot be in the future'): Validator {
  return (value) => {
    const d = new Date(String(value));
    if (isNaN(d.getTime())) return 'Invalid date';
    if (d > new Date()) return message;
    return null;
  };
}

/** End date must be after start date */
export function dateRangeValid(startDate: string, message = 'End date must be after start date'): Validator {
  return (value) => {
    const start = new Date(startDate);
    const end = new Date(String(value));
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 'Invalid date';
    if (end <= start) return message;
    return null;
  };
}

/** Valid email format */
export function validEmail(message = 'Invalid email address'): Validator {
  return (value) => {
    const s = String(value).trim();
    if (!s) return null; // optional — use required() separately
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? null : message;
  };
}

/**
 * Run a set of validators against a value.
 * Returns the first error message, or null if all pass.
 */
export function validate(value: unknown, validators: Validator[]): string | null {
  for (const v of validators) {
    const err = v(value);
    if (err) return err;
  }
  return null;
}

/**
 * Validate a form field and show/clear inline error.
 * Returns true if valid.
 */
export function validateField(
  input: HTMLElement,
  value: unknown,
  validators: Validator[]
): boolean {
  const error = validate(value, validators);
  const errorEl = input.parentElement?.querySelector<HTMLElement>('.field-error');

  input.classList.toggle('error', !!error);

  if (errorEl) {
    errorEl.textContent = error ?? '';
    errorEl.style.display = error ? 'block' : 'none';
  }

  return !error;
}

/**
 * Attach a field-error span after an input element (call once on form build).
 */
export function attachFieldError(input: HTMLElement): HTMLElement {
  const span = document.createElement('span');
  span.className = 'field-error';
  span.setAttribute('role', 'alert');
  span.setAttribute('aria-live', 'polite');
  span.style.cssText = 'display:none;font-size:var(--font-size-xs);color:var(--color-error);margin-top:var(--space-1);';
  input.insertAdjacentElement('afterend', span);
  return span;
}
