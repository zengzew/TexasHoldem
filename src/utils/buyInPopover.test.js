import { describe, expect, it } from 'vitest';
import { getBuyInPopoverClassName } from './buyInPopover';

describe('buyInPopover placement', () => {
  it('anchors the popover to the right of the trigger', () => {
    expect(getBuyInPopoverClassName()).toContain('left-full');
  });

  it('keeps a constrained mobile width', () => {
    expect(getBuyInPopoverClassName()).toContain('w-[min(72vw,17rem)]');
  });
});
