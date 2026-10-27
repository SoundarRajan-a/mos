/**
 * SERRO (Modern Viewport Motion Engine) v1.0
 * Ultra-lightweight IntersectionObserver motion trigger + Kinetic Text Engine
 * Two-way scroll lifecycle: animates on entry, hides on exit, replays on every scroll
 * Author: SOUNDARRAJAN-A
 * https://github.com/soundarrajan-a/serro
 * MIT License
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    const instance = factory();
    root.SERRO = instance;
    root.Serro = instance;
    root.MOS = instance; // Backward compatibility
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  let observerInstance = null;

  const SERRO = {
    options: {
      rootMargin: '0px 0px -20px 0px',
      threshold: 0,
      once: false
    },

    // Split text into kinetic staggered spans
    prepareSplitText() {
      const splitParents = document.querySelectorAll('[data-serro-split], [data-mos-split]');
      splitParents.forEach(el => {
        if (el.dataset.serroSplitDone) return;
        el.dataset.serroSplitDone = 'true';

        const mode = el.getAttribute('data-serro-split') || el.getAttribute('data-mos-split'); // 'words' or 'chars'
        const stagger = parseInt(el.getAttribute('data-serro-stagger') || el.getAttribute('data-mos-stagger') || '50', 10);
        const anim = el.getAttribute('data-serro') || el.getAttribute('data-mos') || 'text-slide-up';
        const duration = el.getAttribute('data-serro-duration') || el.getAttribute('data-mos-duration');
        const text = el.textContent.trim();
        el.textContent = '';
        el.removeAttribute('data-serro');
        el.removeAttribute('data-mos'); // Remove from wrapper so children animate

        const items = mode === 'chars' ? text.split('') : text.split(/\s+/);
        items.forEach((item, idx) => {
          const span = document.createElement('span');
          span.className = 'serro-split-item mos-split-item';
          span.setAttribute('data-serro', anim);
          span.setAttribute('data-mos', anim);
          if (duration) {
            span.setAttribute('data-serro-duration', duration);
            span.setAttribute('data-mos-duration', duration);
          }
          span.style.transitionDelay = `${idx * stagger}ms`;
          span.style.animationDelay = `${idx * stagger}ms`;
          span.textContent = mode === 'chars' ? (item === ' ' ? '\u00A0' : item) : item + '\u00A0';
          el.appendChild(span);
        });
      });
    },

    // Velocity Marquee auto-cloning for seamless looping & guaranteed inline layout
    initMarquee() {
      const wraps = document.querySelectorAll('.serro-ticker-wrap, .mos-ticker-wrap');
      wraps.forEach(wrap => {
        wrap.style.overflow = 'hidden';
        wrap.style.width = '100%';
        wrap.style.position = 'relative';
      });

      const tracks = document.querySelectorAll('.serro-ticker-track-left, .serro-ticker-track-right, .mos-ticker-track-left, .mos-ticker-track-right, .ticker-track-left, .ticker-track-right');
      if (!tracks.length) return;

      tracks.forEach(track => {
        track.style.display = 'flex';
        track.style.flexDirection = 'row';
        track.style.flexWrap = 'nowrap';
        track.style.alignItems = 'center';
        track.style.width = 'max-content';

        // Auto-duplicate if single row so it loops seamlessly
        if (track.children.length === 1) {
          const clone = track.children[0].cloneNode(true);
          clone.setAttribute('aria-hidden', 'true');
          track.appendChild(clone);
        }

        Array.from(track.children).forEach(row => {
          row.style.display = 'inline-flex';
          row.style.flexDirection = 'row';
          row.style.flexWrap = 'nowrap';
          row.style.flexShrink = '0';
          row.style.alignItems = 'center';
          row.style.whiteSpace = 'nowrap';
          row.style.margin = '0 0.5rem';

          // Style ticker dots if present
          const dots = row.querySelectorAll('.ticker-dot');
          dots.forEach(d => {
            d.style.display = 'inline-block';
            d.style.width = '7px';
            d.style.height = '7px';
            d.style.borderRadius = '50%';
            d.style.background = '#3b82f6';
            d.style.flexShrink = '0';
          });
        });

        track.dataset.serroMarqueeReady = 'true';
      });
    },

    // Update scrub progressive word illumination
    updateScrubs() {
      const windowH = window.innerHeight || document.documentElement.clientHeight;
      const els = document.querySelectorAll('.scrub-paragraph:not(#scrubParagraphText), [data-serro="scrub"], [data-mos="scrub"]');

      els.forEach(el => {
        const words = el._serroScrubWords || el._mosScrubWords;
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
            words[i].style.opacity = '1';
            words[i].style.filter = 'blur(0px)';
            words[i].style.transform = 'translateY(0)';
          } else {
            words[i].classList.remove('active');
            words[i].style.opacity = '0.18';
            words[i].style.filter = 'blur(1.2px)';
            words[i].style.transform = 'translateY(2px)';
          }
        }
      });
    },

    // Editorial Scroll Scrub (Progressive Word Illumination)
    initScrub() {
      const scrubElements = document.querySelectorAll('.scrub-paragraph:not(#scrubParagraphText), [data-serro="scrub"], [data-mos="scrub"]');
      if (!scrubElements.length) return;

      scrubElements.forEach(el => {
        if (el.dataset.serroScrubReady) return;
        el.dataset.serroScrubReady = 'true';

        if (!el.querySelector('.scrub-word')) {
          const rawText = el.textContent.trim();
          if (!rawText) return;

          const words = rawText.split(/\s+/);
          el.textContent = '';
          const wordSpans = [];

          const highlightAttr = el.getAttribute('data-serro-scrub-highlight') || el.getAttribute('data-mos-scrub-highlight') || 'motion,viewport,scroll,position,dynamic,physics,interface,lightweight,browser,hardware,acceleration,illuminates,brilliance,immersive,zero,fps';
          const highlightList = highlightAttr.toLowerCase().split(',').map(s => s.trim());

          words.forEach(word => {
            const span = document.createElement('span');
            span.className = 'scrub-word';
            span.style.display = 'inline-block';
            span.style.marginRight = '0.28em';
            span.style.opacity = '0.18';
            span.style.filter = 'blur(1.2px)';
            span.style.transform = 'translateY(2px)';
            span.style.transition = 'opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1), filter 0.22s, transform 0.22s, color 0.22s';

            const clean = word.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (clean && highlightList.includes(clean)) {
              span.classList.add('highlight');
              span.style.color = '#3b82f6';
            }
            span.textContent = word;
            el.appendChild(span);
            el.appendChild(document.createTextNode(' '));
            wordSpans.push(span);
          });
          el._serroScrubWords = wordSpans;
          el._mosScrubWords = wordSpans;
        } else {
          el._serroScrubWords = Array.from(el.querySelectorAll('.scrub-word'));
          el._mosScrubWords = el._serroScrubWords;
        }
      });

      if (!this._scrubBound) {
        this._scrubBound = true;
        let ticking = false;
        const onScrollOrResize = () => {
          if (!ticking) {
            ticking = true;
            const run = () => {
              this.updateScrubs();
              ticking = false;
            };
            if (typeof window.requestAnimationFrame === 'function') {
              window.requestAnimationFrame(run);
            }
            setTimeout(run, 16);
          }
        };

        window.addEventListener('scroll', onScrollOrResize, { passive: true });
        window.addEventListener('resize', onScrollOrResize, { passive: true });
      }

      this.updateScrubs();
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

      const elements = document.querySelectorAll('[data-serro]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline), [data-mos]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline)');

      // Pre-apply custom durations & delays once to eliminate scroll-time style recalcs
      elements.forEach(el => {
        const delay = el.getAttribute('data-serro-delay') || el.getAttribute('data-mos-delay');
        const duration = el.getAttribute('data-serro-duration') || el.getAttribute('data-mos-duration');
        if (delay) {
          const d = (!delay.endsWith('s') && !delay.endsWith('ms')) ? `${delay}ms` : delay;
          el.style.transitionDelay = d;
          el.style.animationDelay = d;
        }
        if (duration) {
          const dur = (!duration.endsWith('s') && !duration.endsWith('ms')) ? `${duration}ms` : duration;
          el.style.setProperty('--serro-duration', dur);
          el.style.setProperty('--mos-duration', dur);
          el.style.transitionDuration = dur;
        }
      });

      observerInstance = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          const el = entry.target;
          const rect = entry.boundingClientRect;
          const windowH = window.innerHeight || document.documentElement.clientHeight;

          if (entry.isIntersecting) {
            const duration = el.getAttribute('data-serro-duration') || el.getAttribute('data-mos-duration');
            if (duration) {
              const dur = (!duration.endsWith('s') && !duration.endsWith('ms')) ? `${duration}ms` : duration;
              el.style.setProperty('--serro-duration', dur);
              el.style.setProperty('--mos-duration', dur);
              el.style.transitionDuration = dur;
            }
            el.classList.add('serro-animate');
            el.classList.add('mos-animate');

            if (this.options.once) {
              obs.unobserve(el);
            }
          } else if (!this.options.once) {
            // Anti-Flicker Two-Way Scroll:
            // Only reset elements that have scrolled well below the viewport (> 80px buffer).
            // Elements that scrolled above the viewport stay rendered, completely eliminating
            // the rapid boundary-chattering oscillation and flicker during scrolling.
            if (rect.top > windowH + 80) {
              el.classList.remove('serro-animate');
              el.classList.remove('mos-animate');
            }
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
        const elements = document.querySelectorAll('[data-serro]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline), [data-mos]:not(#liveTarget):not(#liveTextTarget):not(.typo-headline)');
        elements.forEach(el => observerInstance.observe(el));
      }
    }
  };

  // Safe auto-initialize when script loads
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => SERRO.init());
    } else {
      SERRO.init();
    }
  }

  return SERRO;
}));
