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
          span.style.animationDelay = `${idx * stagger}ms`;
          span.textContent = mode === 'chars' ? (item === ' ' ? '\u00A0' : item) : item + '\u00A0';
          el.appendChild(span);
        });
      });
    },

    // 6. Velocity Marquee auto-cloning for seamless looping
    initMarquee() {
      const tracks = document.querySelectorAll('.mos-ticker-track-left, .mos-ticker-track-right, .ticker-track-left, .ticker-track-right');
      if (!tracks.length) return;

      tracks.forEach(track => {
        if (track.dataset.mosMarqueeReady) return;
        track.dataset.mosMarqueeReady = 'true';

        // Auto-duplicate if single row so it loops seamlessly
        if (track.children.length === 1) {
          const clone = track.children[0].cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        }
      });
    },

    // 7. Editorial Scroll Scrub (Progressive Word Illumination)
    initScrub() {
      const scrubElements = document.querySelectorAll('.scrub-paragraph:not(#scrubParagraphText), [data-mos="scrub"]');
      if (!scrubElements.length) return;

      scrubElements.forEach(el => {
        if (el.dataset.mosScrubReady) return;
        el.dataset.mosScrubReady = 'true';

        if (!el.querySelector('.scrub-word')) {
          const rawText = el.textContent.trim();
          if (!rawText) return;

          const words = rawText.split(/\s+/);
          el.textContent = '';
          const wordSpans = [];

          const highlightAttr = el.getAttribute('data-mos-scrub-highlight') || 'motion,viewport,scroll,position,dynamic,physics,interface,lightweight,browser,hardware,acceleration,illuminates,brilliance,immersive,zero,fps';
          const highlightList = highlightAttr.toLowerCase().split(',').map(s => s.trim());

          words.forEach(word => {
            const span = document.createElement('span');
            span.className = 'scrub-word';
            const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (clean && highlightList.includes(clean)) {
              span.classList.add('highlight');
            }
            span.textContent = word;
            el.appendChild(span);
            el.appendChild(document.createTextNode(' '));
            wordSpans.push(span);
          });
          el._mosScrubWords = wordSpans;
        } else {
          el._mosScrubWords = Array.from(el.querySelectorAll('.scrub-word'));
        }
      });

      const updateScrubs = () => {
        const windowH = window.innerHeight || document.documentElement.clientHeight;
        const els = document.querySelectorAll('.scrub-paragraph:not(#scrubParagraphText), [data-mos="scrub"]');

        els.forEach(el => {
          const words = el._mosScrubWords;
          if (!words || !words.length) return;

          const rect = el.getBoundingClientRect();
          const start = windowH * 0.90;
          const end = windowH * 0.20;

          let progress = (start - rect.top) / (start - end);
          progress = Math.max(0, Math.min(1, progress));

          const parentStage = el.closest('.scrub-stage');
          if (parentStage) {
            const fill = parentStage.querySelector('.scrub-progress-fill');
            const label = parentStage.querySelector('#scrubPercentLabel, .scrub-percent-label');
            if (fill) fill.style.width = `${Math.round(progress * 100)}%`;
            if (label) label.textContent = `${Math.round(progress * 100)}%`;
          }

          const activeCount = Math.floor(progress * words.length);
          for (let i = 0; i < words.length; i++) {
            if (i <= activeCount) {
              words[i].classList.add('active');
            } else {
              words[i].classList.remove('active');
            }
          }
        });
      };

      if (!this._scrubBound) {
        this._scrubBound = true;
        let ticking = false;
        const onScrollOrResize = () => {
          if (!ticking) {
            ticking = true;
            window.requestAnimationFrame(() => {
              updateScrubs();
              ticking = false;
            });
          }
        };

        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize, { passive: true });
      }

      window.requestAnimationFrame(updateScrubs);
    },

    init(userOptions = {}) {
      this.options = { ...this.options, ...userOptions };

      // Prepare kinetic split text if any exists
      this.prepareSplitText();

      // Initialize velocity marquees and editorial scroll scrub
      this.initMarquee();
      this.initScrub();

      // Disconnect previous instance if re-initializing
      if (observerInstance) {
        observerInstance.disconnect();
      }

      const elements = document.querySelectorAll('[data-mos]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline)');

      // Pre-apply custom durations & delays once to eliminate scroll-time style recalcs
      elements.forEach(el => {
        const delay = el.getAttribute('data-mos-delay');
        const duration = el.getAttribute('data-mos-duration');
        if (delay) {
          const d = (!delay.endsWith('s') && !delay.endsWith('ms')) ? `${delay}ms` : delay;
          el.style.transitionDelay = d;
          el.style.animationDelay = d;
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
      this.initMarquee();
      this.initScrub();
      if (observerInstance) {
        const elements = document.querySelectorAll('[data-mos]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline)');
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
