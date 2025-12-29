(function () {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let observer = null;

    if (!prefersReduced) {
        observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const el = entry.target;

                if (entry.isIntersecting) {
                    if (el.classList.contains('reveal-group')) {
                        Array.from(el.children).forEach((child, index) => {
                            child.style.setProperty('--index', index);
                        });
                    }

                    if (el.matches('.services-grid-container, .guides-grid, .resources-grid, .tutors-container, .choose-grid, .how-grid')) {
                        Array.from(el.children).forEach((child, index) => {
                            child.style.setProperty('--index', index);
                        });
                    }

                    const animationHint = el.dataset?.animate || '';
                    if (animationHint === 'fade-slide' || animationHint === 'auto-slide') {
                        const rect = el.getBoundingClientRect();
                        const fromRight = rect.left > (window.innerWidth / 2);
                        el.classList.toggle('from-right', fromRight);
                        el.classList.toggle('from-left', !fromRight);
                    }

                    el.classList.add('in-view');

                    if (el.children && el.children.length) {
                        Array.from(el.children).forEach((child) => child.classList.add('in-view'));
                    }
                } else {
                    el.classList.remove('in-view', 'from-left', 'from-right');

                    if (el.children && el.children.length) {
                        Array.from(el.children).forEach((child) => child.classList.remove('in-view'));
                    }
                }
            });
        }, {
            root: null,
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.12
        });
    }

    function seedIndexes(selector) {
        document.querySelectorAll(selector).forEach((container) => {
            Array.from(container.children).forEach((child, index) => {
                child.style.setProperty('--index', index);
            });
        });
    }

    function initAnimations() {
        if (!observer) {
            return;
        }

        const targets = document.querySelectorAll([
            '[data-animate]',
            '.reveal',
            '.reveal-group',
            '.how-grid',
            '.services-grid-container > *',
            '.guides-grid > *',
            '.resources-grid > *',
            '.tutors-container > *',
            '.choose-grid > *'
        ].join(', '));

        targets.forEach((el) => observer.observe(el));

        [
            '.reveal-group',
            '.choose-grid',
            '.how-grid',
            '.services-grid-container',
            '.guides-grid',
            '.resources-grid',
            '.tutors-container'
        ].forEach(seedIndexes);
    }

    function initMobileNav() {
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        const mobileNav = document.getElementById('mobileNav');

        if (!toggleBtn || !mobileNav) {
            return;
        }

        const panel = mobileNav.querySelector('.mobile-nav__panel');
        const closeTriggers = mobileNav.querySelectorAll('[data-mobile-close]');
        const moreToggle = mobileNav.querySelector('.mobile-more-toggle');
        const morePanel = document.getElementById('mobileMorePanel');
        const navLinks = mobileNav.querySelectorAll('.mobile-nav__links a, .mobile-nav__actions a, .mobile-nav__actions button');
        const focusSelector = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';
        const body = document.body;
        let focusable = [];
        let firstFocusable = null;
        let lastFocusable = null;

        function refreshFocusable() {
            focusable = Array.from(panel.querySelectorAll(focusSelector));
            firstFocusable = focusable[0] || null;
            lastFocusable = focusable[focusable.length - 1] || null;
        }

        function openNav() {
            mobileNav.classList.add('is-open');
            mobileNav.setAttribute('aria-hidden', 'false');
            toggleBtn.classList.add('is-active');
            toggleBtn.setAttribute('aria-expanded', 'true');
            body.classList.add('mobile-nav-open');
            refreshFocusable();
            if (firstFocusable) {
                window.requestAnimationFrame(() => firstFocusable.focus());
            }
        }

        function closeMorePanel() {
            if (!morePanel || !moreToggle) {
                return;
            }

            morePanel.classList.remove('is-open');
            morePanel.setAttribute('hidden', '');
            moreToggle.classList.remove('is-open');
            moreToggle.setAttribute('aria-expanded', 'false');
        }

        function closeNav() {
            mobileNav.classList.remove('is-open');
            mobileNav.setAttribute('aria-hidden', 'true');
            toggleBtn.classList.remove('is-active');
            toggleBtn.setAttribute('aria-expanded', 'false');
            body.classList.remove('mobile-nav-open');
            closeMorePanel();
        }

        toggleBtn.addEventListener('click', () => {
            const isOpen = mobileNav.classList.contains('is-open');
            if (isOpen) {
                closeNav();
            } else {
                openNav();
            }
        });

        closeTriggers.forEach((element) => {
            element.addEventListener('click', closeNav);
        });

        navLinks.forEach((element) => {
            element.addEventListener('click', () => {
                // Delay closing slightly to allow button feedback to display
                window.setTimeout(closeNav, 120);
            });
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && mobileNav.classList.contains('is-open')) {
                event.preventDefault();
                closeNav();
                toggleBtn.focus();
            }

            if (event.key === 'Tab' && mobileNav.classList.contains('is-open')) {
                refreshFocusable();
                if (!focusable.length) {
                    event.preventDefault();
                    return;
                }

                if (event.shiftKey && document.activeElement === firstFocusable) {
                    event.preventDefault();
                    lastFocusable.focus();
                } else if (!event.shiftKey && document.activeElement === lastFocusable) {
                    event.preventDefault();
                    firstFocusable.focus();
                }
            }
        });

        mobileNav.addEventListener('click', (event) => {
            if (!panel.contains(event.target)) {
                closeNav();
            }
        });

        if (moreToggle && morePanel) {
            const toggleMore = () => {
                const willOpen = !moreToggle.classList.contains('is-open');
                if (willOpen) {
                    moreToggle.classList.add('is-open');
                    moreToggle.setAttribute('aria-expanded', 'true');
                    morePanel.removeAttribute('hidden');
                    window.requestAnimationFrame(() => morePanel.classList.add('is-open'));
                } else {
                    closeMorePanel();
                }
            };

            moreToggle.addEventListener('click', toggleMore);
        }

        window.matchMedia('(min-width: 769px)').addEventListener('change', (event) => {
            if (event.matches && mobileNav.classList.contains('is-open')) {
                closeNav();
            }
        });
    }

    function initServiceCardInteractions() {
        const cards = Array.from(document.querySelectorAll('.service-card'));

        if (!cards.length) {
            return;
        }

        const prefersHover = window.matchMedia('(hover: hover)');

        const closeAll = (exception) => {
            cards.forEach((card) => {
                if (card !== exception) {
                    card.classList.remove('is-open');
                    card.setAttribute('aria-expanded', 'false');
                }
            });
        };

        const activateCard = (card) => {
            const allowHover = prefersHover.matches && window.innerWidth > 1024;
            if (allowHover) {
                return;
            }

            const willOpen = !card.classList.contains('is-open');
            closeAll(willOpen ? card : null);
            card.classList.toggle('is-open', willOpen);
            card.setAttribute('aria-expanded', String(willOpen));
        };

        cards.forEach((card) => {
            card.setAttribute('role', 'button');
            card.setAttribute('tabindex', '0');
            card.setAttribute('aria-expanded', 'false');

            card.addEventListener('click', (event) => {
                event.preventDefault();
                activateCard(card);
            });

            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activateCard(card);
                }
            }, { passive: false });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 1024) {
                closeAll();
            }
        });
    }

    function initTestimonialsCarousel() {
        const carousel = document.getElementById('testimonialsCarousel');
        const track = document.getElementById('carouselTrack');
        const prevBtn = document.getElementById('carouselPrev');
        const nextBtn = document.getElementById('carouselNext');
        const indicatorsContainer = document.getElementById('carouselIndicators');

        if (!carousel || !track || !prevBtn || !nextBtn || !indicatorsContainer) {
            return;
        }

        const slides = Array.from(track.querySelectorAll('.testimonial-slide'));
        let currentIndex = 0;
        let autoSlideInterval = null;
        const AUTO_SLIDE_DURATION = 5000; // 5 seconds

        // Create indicators
        slides.forEach((_, index) => {
            const indicator = document.createElement('div');
            indicator.className = 'carousel-indicator';
            if (index === 0) {
                indicator.classList.add('active');
            }
            indicator.setAttribute('data-index', index);
            indicator.setAttribute('aria-label', `Go to slide ${index + 1}`);
            indicator.addEventListener('click', () => goToSlide(index));
            indicatorsContainer.appendChild(indicator);
        });

        const indicators = Array.from(indicatorsContainer.querySelectorAll('.carousel-indicator'));

        function updateCarousel() {
            // Update slides
            slides.forEach((slide, index) => {
                if (index === currentIndex) {
                    slide.classList.add('active');
                } else {
                    slide.classList.remove('active');
                }
            });

            // Update indicators
            indicators.forEach((indicator, index) => {
                if (index === currentIndex) {
                    indicator.classList.add('active');
                } else {
                    indicator.classList.remove('active');
                }
            });
        }

        function goToSlide(index) {
            if (index < 0) {
                currentIndex = slides.length - 1;
            } else if (index >= slides.length) {
                currentIndex = 0;
            } else {
                currentIndex = index;
            }
            updateCarousel();
            resetAutoSlide();
        }

        function nextSlide() {
            goToSlide(currentIndex + 1);
        }

        function prevSlide() {
            goToSlide(currentIndex - 1);
        }

        function startAutoSlide() {
            autoSlideInterval = setInterval(() => {
                nextSlide();
            }, AUTO_SLIDE_DURATION);
        }

        function stopAutoSlide() {
            if (autoSlideInterval) {
                clearInterval(autoSlideInterval);
                autoSlideInterval = null;
            }
        }

        function resetAutoSlide() {
            stopAutoSlide();
            startAutoSlide();
        }

        // Event listeners
        nextBtn.addEventListener('click', () => {
            nextSlide();
        });

        prevBtn.addEventListener('click', () => {
            prevSlide();
        });

        // Pause auto-slide on hover
        carousel.addEventListener('mouseenter', stopAutoSlide);
        carousel.addEventListener('mouseleave', startAutoSlide);

        // Pause auto-slide when user interacts with controls
        [prevBtn, nextBtn, ...indicators].forEach(element => {
            element.addEventListener('click', () => {
                resetAutoSlide();
            });
        });

        // Keyboard navigation
        carousel.addEventListener('keydown', (event) => {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                prevSlide();
                resetAutoSlide();
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                nextSlide();
                resetAutoSlide();
            }
        });

        // Make carousel focusable for keyboard navigation
        carousel.setAttribute('tabindex', '0');

        // Initialize
        updateCarousel();
        startAutoSlide();

        // Pause auto-slide when page is not visible
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                stopAutoSlide();
            } else {
                startAutoSlide();
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initAnimations();
        initMobileNav();
        initServiceCardInteractions();
        initTestimonialsCarousel();
    });
})();
