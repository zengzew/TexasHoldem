import { describe, expect, it } from 'vitest';
import { getBuyInPopoverClassName } from './buyInPopover';

describe('buyInPopover placement', () => {
  it('renders as an in-card dropdown on mobile and side popover on larger screens', () => {
    const className = getBuyInPopoverClassName();
    expect(className).toContain('left-0');
    expect(className).toContain('top-[calc(100%+0.5rem)]');
    expect(className).toContain('sm:left-full');
    expect(className).toContain('sm:top-1/2');
  });

  it('keeps a constrained mobile width', () => {
    expect(getBuyInPopoverClassName()).toContain('w-[min(17rem,calc(100vw-6rem))]');
    expect(getBuyInPopoverClassName()).toContain('sm:w-[min(72vw,17rem)]');
  });
});
