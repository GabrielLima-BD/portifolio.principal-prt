document.addEventListener('DOMContentLoaded', () => {
    // Verificação de carregamento
    console.log('Script.js carregado!');

    // Abre janela centralizada e (na prática) em tela cheia.
    // Observação: browsers podem bloquear popups se não for via clique do usuário.
    function openAppWindow(url) {
        if (!url || url === '#') return null;

        const screenW = window.screen?.availWidth || window.innerWidth;
        const screenH = window.screen?.availHeight || window.innerHeight;

        // Tela cheia + fallback centralizado
        const width = screenW;
        const height = screenH;
        const left = 0;
        const top = 0;

        const features = [
            `width=${width}`,
            `height=${height}`,
            `left=${left}`,
            `top=${top}`,
            'resizable=yes',
            'scrollbars=yes',
            'noopener=yes',
            'noreferrer=yes'
        ].join(',');

        const win = window.open(url, '_blank', features);
        try {
            if (win) {
                win.focus();
                // Alguns browsers ignoram, mas ajuda quando permitido.
                win.moveTo(0, 0);
                win.resizeTo(screenW, screenH);
            }
        } catch (e) {}

        return win;
    }

    // Pausa/retoma particles.js quando o usuário sai/volta para a Home
    // Importante: particles.js usa um loop interno via requestAnimationFrame em pJS.fn.vendors.draw.
    // Então para "despausar" precisamos disparar vendors.draw/start (e não pJS.fn.draw).
    let particlesPaused = null;
    const setParticlesPaused = (paused) => {
        try {
            if (particlesPaused === paused) return;
            particlesPaused = paused;

            const dom = window.pJSDom || [];
            dom.forEach((entry) => {
                const pJS = entry && entry.pJS;
                if (!pJS) return;

                // trava movimento
                if (pJS.particles && pJS.particles.move) {
                    pJS.particles.move.enable = !paused;
                }

                // pausa/retoma o loop de render
                if (paused) {
                    const rafId = pJS.fn && pJS.fn.drawAnimFrame;
                    if (rafId) {
                        try { cancelAnimationFrame(rafId); } catch (e) {}
                        pJS.fn.drawAnimFrame = null;
                    }
                } else {
                    // retoma o loop (evita duplicar)
                    if (pJS.fn && !pJS.fn.drawAnimFrame) {
                        if (pJS.fn.vendors && typeof pJS.fn.vendors.start === 'function') {
                            pJS.fn.vendors.start();
                        } else if (pJS.fn.vendors && typeof pJS.fn.vendors.draw === 'function') {
                            pJS.fn.vendors.draw();
                        }
                    }
                }
            });
        } catch (e) {
            // fail-silent
        }
    };

    // Observa a Home: se saiu, pausa; se voltou, retoma.
    const homeSection = document.getElementById('home');
    if (homeSection && typeof IntersectionObserver === 'function') {
        const homeObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                // Quando a Home não está visível o suficiente, pausa.
                setParticlesPaused(!entry.isIntersecting);
            });
        }, { root: null, threshold: 0.15 });
        homeObserver.observe(homeSection);
    }

    // Mapeamento de linguagens para ícones do Font Awesome
    const languageIcons = {
        'python': 'fab fa-python',
        'javascript': 'fab fa-js',
        'postgresql': 'fas fa-database',
        'nodejs': 'fab fa-node-js',
        'express': 'fab fa-js',
        'mongodb': 'fas fa-database',
        'sql': 'fas fa-database',
        'powerbi': 'fas fa-chart-column'
    };

    // Animações de scroll para seções
    const sections = document.querySelectorAll('.section');
    const projectItems = document.querySelectorAll('.project-item');

    const observerOptions = {
        root: null,
        threshold: 0.1,
        rootMargin: '0px'
    };

    const sectionObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));
    projectItems.forEach(item => sectionObserver.observe(item));

    // Navegação suave apenas para links internos
    const menuLinks = document.querySelectorAll('.menu a');
    menuLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetSection = document.getElementById(targetId);

                if (targetSection) {
                    targetSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                    if (window.innerWidth <= 768) {
                        document.querySelector('.sidebar').classList.remove('active');
                    }
                }
            });
        }
    });

    // Menu hambúrguer
    const menuToggle = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
    });

    // Indicador de seção ativa (scroll spy)
    const scrollSpyObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                menuLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href').substring(1) === entry.target.id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { threshold: 0.5 });

    sections.forEach(section => scrollSpyObserver.observe(section));

    // Carousel da seção "Sobre"
    const sobreCarousel = document.querySelector('.sobre-carousel');
    const sobreSlides = document.querySelectorAll('.sobre-slide');
    const dots = document.querySelectorAll('.carousel-dots .dot, .carousel-dots-top .dot');
    let currentSlide = 0;
    let isDragging = false;
    let startX = 0;
    let currentX = 0;

    function updateCarousel() {
        const offset = -currentSlide * 100;
        sobreCarousel.style.transform = `translateX(${offset}%)`;
        
        dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === currentSlide);
        });
    }

    function goToSlide(slide) {
        currentSlide = Math.max(0, Math.min(slide, sobreSlides.length - 1));
        updateCarousel();
    }

    // Navegação por dots (top e bottom)
    dots.forEach(dot => {
        dot.addEventListener('click', (e) => {
            goToSlide(parseInt(e.target.dataset.slide));
        });
    });

    // Arrasto com mouse/touch
    sobreCarousel.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
    });

    sobreCarousel.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        currentX = e.clientX - startX;
    });

    sobreCarousel.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        
        if (currentX < -50) {
            goToSlide(currentSlide + 1);
        } else if (currentX > 50) {
            goToSlide(currentSlide - 1);
        } else {
            updateCarousel();
        }
        currentX = 0;
    });

    // Suporte para touch
    sobreCarousel.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
    });

    sobreCarousel.addEventListener('touchend', (e) => {
        currentX = e.changedTouches[0].clientX - startX;
        
        if (currentX < -50) {
            goToSlide(currentSlide + 1);
        } else if (currentX > 50) {
            goToSlide(currentSlide - 1);
        } else {
            updateCarousel();
        }
        currentX = 0;
    });

    updateCarousel();

    // Modais para serviços
    const serviceItems = document.querySelectorAll('.service-item');
    const modals = document.querySelectorAll('.modal');
    const closes = document.querySelectorAll('.modal-close');

    serviceItems.forEach(item => {
        item.addEventListener('click', () => {
            const service = item.dataset.service;
            const modal = document.getElementById(`modal-${service}`);
            if (modal) {
                modal.classList.add('active'); // Mostra o modal (pai)
                const modalContent = modal.querySelector('.modal-content');
                modalContent.classList.remove('closing'); // Garante que não está fechando
            }
        });
    });

    closes.forEach(close => {
        close.addEventListener('click', function() {
            const modal = this.closest('.modal');
            const modalContent = modal.querySelector('.modal-content');
            modalContent.classList.add('closing');
            setTimeout(() => {
                modal.classList.remove('active');
                modalContent.classList.remove('closing');
            }, 500); // Tempo igual ao da animação
        });
    });

    // Fecha ao clicar fora do conteúdo
    window.addEventListener('click', (e) => {
        modals.forEach(modal => {
            if (e.target === modal && modal.classList.contains('active')) {
                const modalContent = modal.querySelector('.modal-content');
                modalContent.classList.add('closing');
                setTimeout(() => {
                    modal.classList.remove('active');
                    modalContent.classList.remove('closing');
                }, 500);
            }
        });
    });

    // Fecha com ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modals.forEach(modal => {
                if (modal.classList.contains('active')) {
                    const modalContent = modal.querySelector('.modal-content');
                    modalContent.classList.add('closing');
                    setTimeout(() => {
                        modal.classList.remove('active');
                        modalContent.classList.remove('closing');
                    }, 500);
                }
            });
        }
    });

    // Carregamento progressivo: inicializa efeitos pesados fora do primeiro paint.
    const scheduleHeavyWork = (fn) => {
        if (typeof window.requestIdleCallback === 'function') {
            window.requestIdleCallback(fn, { timeout: 1500 });
            return;
        }
        window.setTimeout(fn, 450);
    };

    // Particles.js para fundo e home (adiado)
    let particlesInitialized = false;
    const initParticlesOnce = () => {
        if (particlesInitialized) return;
        if (typeof window.particlesJS !== 'function') return;
        particlesInitialized = true;

        window.particlesJS('full-page-particles', {
            particles: {
                number: { value: 60, density: { enable: true, value_area: 800 } },
                color: { value: '#ffffff' },
                shape: { type: 'circle' },
                opacity: { value: 0.4, random: true },
                size: { value: 2, random: true },
                line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.3, width: 1 },
                move: { enable: true, speed: 1, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
            },
            interactivity: {
                detect_on: 'canvas',
                events: { onhover: { enable: true, mode: 'grab' }, onclick: { enable: true, mode: 'push' }, resize: true },
                modes: { grab: { distance: 100, line_linked: { opacity: 0.7 } }, push: { particles_nb: 1 } }
            },
            retina_detect: true
        });

        window.particlesJS('particles-js', {
            particles: {
                number: { value: 100, density: { enable: true, value_area: 800 } },
                color: { value: '#ffffff' },
                shape: { type: 'circle' },
                opacity: { value: 0.6, random: true },
                size: { value: 3, random: true },
                line_linked: { enable: true, distance: 150, color: '#ffffff', opacity: 0.5, width: 1.5 },
                move: { enable: true, speed: 2, direction: 'none', random: false, straight: false, out_mode: 'out', bounce: false }
            },
            interactivity: {
                detect_on: 'canvas',
                events: { onhover: { enable: true, mode: 'repulse' }, onclick: { enable: true, mode: 'push' }, resize: true },
                modes: { repulse: { distance: 100, duration: 0.4 }, push: { particles_nb: 3 } }
            },
            retina_detect: true
        });

        // Se o usuário já estiver fora da Home quando inicializar, pausa imediatamente.
        if (homeSection) {
            const rect = homeSection.getBoundingClientRect();
            const inView = rect.bottom > 0 && rect.top < window.innerHeight;
            setParticlesPaused(!inView);
        }
    };

    scheduleHeavyWork(initParticlesOnce);

    // Botão voltar ao topo
    const backToTop = document.querySelector('.back-to-top');
    window.addEventListener('scroll', () => {
        backToTop.classList.toggle('visible', window.scrollY > 300);
    });
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Swiper para projetos (lazy-init quando a seção Projetos entrar na tela)
    let swipersInitialized = false;
    function initializeSwiper(selector) {
        return new Swiper(selector, {
            freeMode: true,
            mousewheel: true,
            keyboard: true,
            spaceBetween: 20,
            grabCursor: true,
            breakpoints: {
                0: { slidesPerView: 1.1, },
                640: { slidesPerView: 2.1, },
                1024: { slidesPerView: 2.5, }
            }
        });
    }

    const initSwipersOnce = () => {
        if (swipersInitialized) return;
        if (typeof window.Swiper !== 'function') return;

        const hasLarge = document.querySelector('.large-projects');
        const hasSmall = document.querySelector('.small-projects');
        if (!hasLarge && !hasSmall) return;

        swipersInitialized = true;
        if (hasLarge) initializeSwiper('.large-projects');
        if (hasSmall) initializeSwiper('.small-projects');
    };

    const projectsSection = document.getElementById('projetos');
    if (projectsSection) {
        const projectsObserver = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                initSwipersOnce();
                obs.disconnect();
            });
        }, { root: null, threshold: 0.15 });

        projectsObserver.observe(projectsSection);
    } else {
        scheduleHeavyWork(initSwipersOnce);
    }

    // Modal de projeto
    const projectModal = document.getElementById('project-modal');
    const projectModalCloseBtn = projectModal.querySelector('.modal-close-btn');
    const projectModalContent = projectModal.querySelector('.modal-content');
    const modalFullProjectWrap = document.getElementById('modal-full-project');
    const modalFullProjectLink = document.getElementById('modal-full-project-link');
    const modalLiveWrap = document.getElementById('modal-live');
    const modalLiveLink = document.getElementById('modal-live-link');

    if (modalLiveLink) {
        modalLiveLink.addEventListener('click', (e) => {
            e.preventDefault();
            const url = modalLiveLink.getAttribute('href');
            openAppWindow(url);
        });
    }
    document.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', (e) => {
            const projectId = item.dataset.projectId;
            if (!projectId) return;

            const title = item.dataset.title;
            const image = item.dataset.image;
            const description = item.dataset.description;
            const languages = JSON.parse(item.dataset.languages);
            const githubLink = item.dataset.github;
            const fullPage = item.dataset.fullPage;
            const live = item.dataset.live;

            document.getElementById('modal-title').innerText = title;
            document.getElementById('modal-image').src = image;
            document.getElementById('modal-description').innerText = description;

            const githubAnchor = document.getElementById('modal-github-link');
            if (githubLink && githubLink !== '#') {
                githubAnchor.href = githubLink;
                githubAnchor.classList.remove('is-disabled');
                githubAnchor.setAttribute('aria-disabled', 'false');
                githubAnchor.removeAttribute('tabindex');
            } else {
                githubAnchor.href = '#';
                githubAnchor.classList.add('is-disabled');
                githubAnchor.setAttribute('aria-disabled', 'true');
                githubAnchor.setAttribute('tabindex', '-1');
            }

            if (fullPage) {
                modalFullProjectLink.href = fullPage;
                modalFullProjectWrap.hidden = false;
            } else {
                modalFullProjectLink.href = '#';
                modalFullProjectWrap.hidden = true;
            }

            if (live) {
                if (modalLiveLink) modalLiveLink.href = live;
                if (modalLiveWrap) modalLiveWrap.hidden = false;
            } else {
                if (modalLiveLink) modalLiveLink.href = '#';
                if (modalLiveWrap) modalLiveWrap.hidden = true;
            }

            const languagesContainer = document.getElementById('modal-languages-icons');
            languagesContainer.innerHTML = '';
            languages.forEach(lang => {
                const iconClass = languageIcons[lang];
                if (iconClass) {
                    const iconElement = document.createElement('i');
                    iconElement.className = iconClass;
                    languagesContainer.appendChild(iconElement);
                }
            });

            projectModal.classList.add('visible');
            projectModalContent.classList.remove('closing');
            document.body.style.overflow = 'hidden';
        });
    });

    function closeProjectModal() {
        projectModalContent.classList.add('closing');
        setTimeout(() => {
            projectModal.classList.remove('visible');
            projectModalContent.classList.remove('closing');
            document.body.style.overflow = 'auto';
        }, 500); // Tempo igual ao da animação CSS
    }

    projectModalCloseBtn.addEventListener('click', closeProjectModal);

    projectModal.addEventListener('click', (e) => {
        if (e.target === projectModal) {
            closeProjectModal();
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && projectModal.classList.contains('visible')) {
            closeProjectModal();
        }
    });

    // Efeito de digitação na home
    const typingEl = document.querySelector('.typing-effect');
    if (typingEl) {
        const startTyping = () => {
            const text = 'Seja bem-vindo ao meu ';
            const highlight = 'Portfólio';
            let i = 0, j = 0;

            typingEl.innerHTML = '<span class="typing-text"></span><span class="typing-cursor">|</span>';
            const typingTextEl = typingEl.querySelector('.typing-text');

            function type() {
                if (i < text.length) {
                    typingTextEl.innerHTML += text.charAt(i);
                    i++;
                    setTimeout(type, 110);
                } else if (j < highlight.length) {
                    if (j === 0) typingTextEl.innerHTML += '<span class="highlight"></span>';
                    const highlightEl = typingTextEl.querySelector('.highlight');
                    highlightEl.textContent += highlight.charAt(j);
                    j++;
                    setTimeout(type, 110);
                }
            }

            type();
        };

        // Se o overlay premium estiver ativo, inicia a digitação APÓS o timer de 5s.
        let delayMs = 0;
        try {
            const until = Number(sessionStorage.getItem('pt:showUntil') || '0');
            if (Number.isFinite(until) && until > Date.now()) {
                delayMs = Math.max(0, until - Date.now());
            }
        } catch (e) {
            // ignore
        }

        const overlayVisible = document.documentElement.classList.contains('pt-overlay-visible');
        if (overlayVisible) {
            // Fail-safe: se não houver deadline (storage bloqueado), usa 5s.
            if (!delayMs) delayMs = 5000;
            setTimeout(startTyping, delayMs);
        } else {
            startTyping();
        }
    }

    // Funcionalidade de drag/arrasto no carousel de formações
    const carousel = document.querySelector('.formacoes-carousel');
    if (carousel) {
        let isDown = false;
        let startX;
        let scrollLeft;

        carousel.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
            carousel.style.cursor = 'grabbing';
        });

        carousel.addEventListener('mouseleave', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });

        carousel.addEventListener('mouseup', () => {
            isDown = false;
            carousel.style.cursor = 'grab';
        });

        carousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - carousel.offsetLeft;
            const walk = (x - startX) * 1.5; // Multiplier para velocidade
            carousel.scrollLeft = scrollLeft - walk;
        });

        // Suporte para touch em devices móveis
        carousel.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
        });

        carousel.addEventListener('touchend', () => {
            isDown = false;
        });

        carousel.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - carousel.offsetLeft;
            const walk = (x - startX) * 1.5;
            carousel.scrollLeft = scrollLeft - walk;
        });
    }

    // Modais de Formação
    const formacaoBtns = document.querySelectorAll('.formacao-btn');
    const modaisFormacao = document.querySelectorAll('.modal-formacao');

    formacaoBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const formacaoId = btn.dataset.formacao;
            const modal = document.getElementById(`modal-${formacaoId}`);
            if (modal) {
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            }
        });
    });

    modaisFormacao.forEach(modal => {
        const closeBtn = modal.querySelector('.modal-close');
        const overlay = modal.querySelector('.modal-overlay');

        const fecharModal = () => {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        };

        if (closeBtn) {
            closeBtn.addEventListener('click', fecharModal);
        }

        if (overlay) {
            overlay.addEventListener('click', fecharModal);
        }

        // Fechar ao pressionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.classList.contains('active')) {
                fecharModal();
            }
        });
    });
});
