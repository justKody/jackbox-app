# Host jump-in

`HostJumpIn` is the "Jump-in · in game" design from the In-Game Screen Layout canvas: the screen dims, the wizard (`assets/wizard-host.webp`) jumps in from the bottom left and lands with a squash, a speech balloon pops out above it, and "Tap to continue" fades in. A tap hops the wizard back out and lifts the dim. Reduced motion shows and hides it without the jump.

It isn't mounted anywhere yet. To use it, render it last inside a screen's root view so it covers everything:

```tsx
const [tip, setTip] = useState(true);

<HostJumpIn
  visible={tip}
  title="Bold call! Priya went 62%."
  body="Higher or lower? You've got 10 seconds."
  onDismiss={() => setTip(false)}
/>
```

The screen's root needs `flex: 1` (every game screen has it) for the overlay to fill it.
