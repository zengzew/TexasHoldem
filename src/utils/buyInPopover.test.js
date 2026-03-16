import { describe, expect, it } from 'vitest';
import { getBuyInPopoverClassName } from './buyInPopover';

describe('buyInPopover placement', () => {
  it('renders as an in-card dropdown on mobile and side popover on larger screens', () => {
    const className = getBuyInPopoverClassName();
    expect(className).toContain('mt-2');
    expect(className).toContain('w-full');
    expect(className).toContain('sm:left-full');
    expect(className).toContain('sm:top-1/2');
  });

  it('keeps the popover anchored inline on mobile and constrained on larger screens', () => {
    const className = getBuyInPopoverClassName();
    expect(className).toContain('w-full');
    expect(className).toContain('sm:w-[min(72vw,17rem)]');
    expect(className).toContain('sm:absolute');
  });
});
