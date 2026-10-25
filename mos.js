/**
 * MOS (Modern Viewport Motion Engine) v1.0
 * Ultra-lightweight IntersectionObserver motion trigger + Kinetic Text Engine
 * Two-way scroll lifecycle: animates on entry, hides on exit, replays on every scroll
 * https://github.com/soundarrajan-a/mos
 * MIT License
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MOS = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let observerInstance = null;

  const MOS = {
    options: {
      rootMargin: '0px 0px -20px 0px',
      threshold: 0,
      once: false
    },

    // Split text into kinetic staggered spans
    prepareSplitText() {
      const splitParents = document.querySelectorAll('[data-mos-split]');
      splitParents.forEach(el => {
        if (el.dataset.mosSplitDone) return;
        el.dataset.mosSplitDone = 'true';

        const mode = el.getAttribute('data-mos-split'); // 'words' or 'chars'
        const stagger = parseInt(el.getAttribute('data-mos-stagger') || '50', 10);
        const anim = el.getAttribute('data-mos') || 'text-slide-up';
        const duration = el.getAttribute('data-mos-duration');
        const text = el.textContent.trim();
        el.textContent = '';
        el.removeAttribute('data-mos'); // Remove from wrapper so children animate

        const items = mode === 'chars' ? text.split('') : text.split(/\s+/);
        items.forEach((item, idx) => {
          const span = document.createElement('span');
          span.className = 'mos-split-item';
          span.setAttribute('data-mos', anim);
          if (duration) span.setAttribute('data-mos-duration', duration);
          span.style.transitionDelay = `${idx * stagger}ms`;
          span.textContent = mode === 'chars' ? (item === ' ' ? '\u00A0' : item) : item + '\u00A0';
          el.appendChild(span);
        });
      });
    },

    init(userOptions = {}) {
      this.options = { ...this.options, ...userOptions };

      // Prepare kinetic split text if any exists
      this.prepareSplitText();

      // Disconnect previous instance if re-initializing
      if (observerInstance) {
        observerInstance.disconnect();
      }

      const elements = document.querySelectorAll('[data-mos]:not(#liveTarget):not(.typo-headline)');

      // Pre-apply custom durations & delays once to eliminate scroll-time style recalcs
      elements.forEach(el => {
        const delay = el.getAttribute('data-mos-delay');
        const duration = el.getAttribute('data-mos-duration');
        if (delay) {
          const d = (!delay.endsWith('s') && !delay.endsWith('ms')) ? `${delay}ms` : delay;
          el.style.transitionDelay = d;
        }
        if (duration) {
          const dur = (!duration.endsWith('s') && !duration.endsWith('ms')) ? `${duration}ms` : duration;
          el.style.setProperty('--mos-duration', dur);
          el.style.transitionDuration = dur;
        }
      });

      observerInstance = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          const el = entry.target;

          if (entry.isIntersecting) {
            const duration = el.getAttribute('data-mos-duration');
            if (duration) {
              const dur = (!duration.endsWith('s') && !duration.endsWith('ms')) ? `${duration}ms` : duration;
              el.style.setProperty('--mos-duration', dur);
              el.style.transitionDuration = dur;
            }
            el.style.removeProperty('transition');
            el.classList.add('mos-animate');

            if (this.options.once) {
              obs.unobserve(el);
            }
          } else if (!this.options.once) {
            // TWO-WAY SCROLL: Instant off-screen reset (zero GPU compositing load while off-screen)
            el.style.setProperty('transition', 'none', 'important');
            el.classList.remove('mos-animate');
          }
        });
      }, {
        rootMargin: this.options.rootMargin,
        threshold: this.options.threshold
      });

      elements.forEach(el => observerInstance.observe(el));
    },

    refresh() {
      this.prepareSplitText();
      if (observerInstance) {
        const elements = document.querySelectorAll('[data-mos]:not(#liveTarget):not(.typo-headline)');
        elements.forEach(el => observerInstance.observe(el));
      }
    }
  };

  // Safe auto-initialize when script loads
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => MOS.init());
    } else {
      MOS.init();
    }
  }

  return MOS;
}));
