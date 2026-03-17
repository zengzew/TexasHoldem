import { describe, expect, it } from 'vitest';
import { getBuyInPopoverClassName } from './buyInPopover';

describe('buyInPopover placement', () => {
  it('renders as a centered floating overlay on mobile and side popover on larger screens', () => {
    const className = getBuyInPopoverClassName();
    expect(className).toContain('absolute');
    expect(className).toContain('left-1/2');
    expect(className).toContain('top-[calc(100%+0.5rem)]');
    expect(className).toContain('-translate-x-1/2');
    expect(className).toContain('sm:left-full');
    expect(className).toContain('sm:top-1/2');
  });

  it('keeps the popover constrained on mobile and larger screens', () => {
    const className = getBuyInPopoverClassName();
    expect(className).toContain('w-[min(18rem,calc(100vw-5rem))]');
    expect(className).toContain('max-w-[calc(100vw-5rem)]');
    expect(className).toContain('sm:w-[min(72vw,17rem)]');
  });
});
