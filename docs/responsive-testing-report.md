# Responsive Testing Report

## Devices & Breakpoints

- Mobile: 360×640, 414×896
- Tablet: 768×1024, 834×1112
- Desktop: 1280×800, 1920×1080
- Browsers: Chrome, Firefox, Safari, Edge (latest)

## Pages Tested

- `/signin` — layout stacks on mobile, form stays centered; images scale.
- `/alumni-profile` — cards and buttons align; text wraps; no overflow.
- `/alumni-stories` — table grid horizontal scroll preserved; action buttons accessible; images scale.
- `/alumni-stories/[id]` — form inputs responsive; preview image scales with fallback.
- `/alumni-success` — cards maintain grid; text truncation consistent.
- `/events` — image uploader preview scales; form grid adapts.

## Results

- No overlapping content observed at standard breakpoints.
- Images scale properly with global base CSS and fallbacks.
- Remote images load on production after HTTPS normalization and domain config.

## Notes

- Large tables continue to use horizontal scroll on small screens by design.
- Additional component-specific refinements can be incrementally applied where necessary.