# Responsive Design Guidelines

Responsive behavior is part of the required scope of every UI task. A UI change is not complete when it has only been implemented or verified on desktop.

## Core responsive design rules

1. **Start with content and the smallest supported layout.**
   - Define the essential content, actions, and reading order before adding desktop density or decoration.
   - Use mobile-first styles when practical, then enhance the layout as space becomes available.
   - On narrow screens, prefer reflow, wrapping, stacking, collapsing, or progressive disclosure over simply shrinking everything.
   - Do not hide meaningful content only because it is difficult to fit. If content is collapsed, keep it discoverable and accessible.

2. **Let content determine breakpoints.**
   - Add a breakpoint when the actual layout becomes crowded, sparse, clipped, overlapped, or difficult to read—not because a specific device model exists.
   - Reuse the project's existing breakpoint system before introducing another value.
   - Keep the number of breakpoints as small as the content allows.
   - Test immediately below and above each changed breakpoint.

3. **Use fluid layout primitives before media-query patches.**
   - Prefer CSS Grid and Flexbox with `%`, `fr`, `rem`, `minmax()`, `auto-fit`, `auto-fill`, and `clamp()` where appropriate.
   - Avoid fixed widths and heights for content that may grow, wrap, translate, or zoom.
   - Use media queries for page-level or viewport-level changes.
   - Consider container queries for reusable components whose layout depends on their available container width rather than the viewport.

4. **Guarantee reflow without loss.**
   - The page should work at `320px` CSS viewport width without page-level horizontal scrolling, loss of information, or loss of functionality.
   - Exceptions are limited to content that inherently requires two-dimensional movement, such as large data tables, maps, diagrams, or timelines. Contain scrolling within that component.
   - Text, controls, images, and cards must not overlap, clip, or escape their containers.
   - DOM order must preserve semantic reading and focus order even when CSS visually rearranges content.

5. **Preserve readable, zoomable text.**
   - Prefer `rem`/`em` for typography and text-related spacing.
   - Do not use viewport units alone for body text sizing; combine fluid sizing with sensible minimum and maximum values.
   - Text must remain available and functional at `200%` browser text zoom.
   - Do not truncate text by default. Use ellipsis or line clamping only when the requirement explicitly allows it and the full text remains available through an accessible interaction.
   - Keep headings, body text, labels, and supporting information in a consistent visual hierarchy at every width.

6. **Treat images and media as responsive content.**
   - Prevent media from overflowing its container with fluid sizing such as `max-inline-size: 100%` and proportional height.
   - Preserve intentional aspect ratios and avoid distortion.
   - Provide intrinsic `width` and `height` or `aspect-ratio` to reduce layout shift.
   - Use `loading="lazy"` for non-critical off-screen images when appropriate.
   - Use `srcset` and `sizes` for large raster images that are served at meaningfully different display sizes; use `<picture>` when art direction or format selection is required.

7. **Design for touch, mouse, and keyboard together.**
   - Interactive targets must satisfy the WCAG minimum target size of `24×24px` or equivalent spacing. Prefer at least `44×44px` for primary touch controls.
   - Do not make essential content or actions available only through hover.
   - Use `hover`, `pointer`, `any-hover`, and `any-pointer` media features only as capability enhancements, not as device detection.
   - Provide visible focus, active, selected, disabled, and error states.
   - Use semantic HTML first and add ARIA only where native semantics are insufficient.

8. **Respect user and device preferences.**
   - Support `prefers-reduced-motion` when adding non-essential animation or transitions.
   - Do not lock orientation.
   - Ensure fixed or sticky UI does not obscure focused controls or essential content.
   - Keep the viewport declaration compatible with user zoom:
     `<meta name="viewport" content="width=device-width, initial-scale=1">`.

9. **Keep spacing and density systematic.**
   - Reuse existing design tokens and spacing scales instead of introducing isolated values.
   - Reduce columns before shrinking cards or text below a readable size.
   - Maintain consistent gutters, alignment, and component proportions across breakpoints.
   - For long-form content, constrain line length rather than stretching text across the full desktop width.

10. **Responsive work includes evidence-based verification.**
    - For every UI change, verify at least `320px`, `360px` or `390px`, `768px`, `1024px`, and `1280px`.
    - When a breakpoint changes, also verify one pixel below and above that boundary.
    - Test portrait and landscape when navigation, fixed positioning, viewport height, or multi-column layout is affected.
    - Check page-level horizontal overflow, overlap, clipping, column count, spacing, text wrapping, image ratio, focus order, target size, and primary interactions.
    - Verify text at `200%` zoom when the change affects typography, controls, navigation, or fixed-size containers.
    - Use browser-rendered visual inspection together with DOM measurements when browser tooling is available.
    - Report the tested viewport sizes and responsive results in the final user-facing response.

## Definition of done for UI work

- Essential content and primary actions are available on mobile, tablet, and desktop.
- The page reflows at `320px` without unintended two-dimensional scrolling.
- There is no unintended clipping, overlap, truncation, or horizontal overflow.
- Layout density, columns, gaps, and typography adapt without becoming unreadable.
- Images do not break, distort, or cause avoidable layout shifts.
- Primary controls work with touch and keyboard, with visible focus.
- Text can be enlarged to `200%` without losing content or functionality.
- Changed breakpoints have been tested on both sides.
- The final response states which responsive checks were performed.

## Reference material

- [web.dev: Responsive web design basics](https://web.dev/articles/responsive-web-design-basics)
- [MDN: CSS media queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries)
- [MDN: Container size and style queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Containment/Container_size_and_style_queries)
- [web.dev: Responsive images](https://web.dev/learn/design/responsive-images)
- [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C: Understanding Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
- [W3C: Understanding Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text)
- [W3C: Understanding Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [Developer-oriented responsive design guide](https://medium.com/@canon.minjoo/%ED%92%80%EC%8A%A4%ED%83%9D-%EA%B0%9C%EB%B0%9C%EC%9E%90%EB%A5%BC-%EC%9C%84%ED%95%9C-%EB%B0%98%EC%9D%91%ED%98%95-%EC%9B%B9%EB%94%94%EC%9E%90%EC%9D%B8-%EA%B0%80%EC%9D%B4%EB%93%9C-44967d967bdf)
- [Responsive web design conventions and practical guide](https://epart.com/%EB%B0%98%EC%9D%91%ED%98%95-%EC%9B%B9-%EA%B0%9C%EB%B0%9C%EC%9D%84-%EC%9C%84%ED%95%9C-%EB%94%94%EC%9E%90%EC%9D%B8-%EC%BB%A8%EB%B2%A4%EC%85%98%EA%B3%BC-%EC%8B%A4%EB%AC%B4-%EA%B0%80%EC%9D%B4%EB%93%9C/)
