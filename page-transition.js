/*
  Transição premium (Awwwards/minimalista) usando GSAP.

  Regras:
  - Primeira entrada na aba: overlay aparece (via classe no <html>) e some após load.
  - Navegação interna (para outra página): overlay aparece no clique, navega, e a próxima página inicia coberta (via flag) e some após load.

  Requisitos:
  - Sem framework, compatível com browsers modernos.
  - Performance: estado inicial definido no <head> para evitar flicker.
*/

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('page-transition');
    if (!overlay) return;

    const content = overlay.querySelector('.page-transition__content');

    const ENTERED_KEY = 'pt:entered';
    const PENDING_KEY = 'pt:pending';
    const SHOW_UNTIL_KEY = 'pt:showUntil';

    // OBS: Não bloqueamos a animação do loader por 'reduce motion' aqui,
    // porque você quer explicitamente os traços se mexendo.
    const prefersReducedMotion = false;

    // Duração entre 0.6s e 1.2s, ease profissional.
    const D_IN = 0.8;
    const D_OUT = 0.9;
    const EASE = 'power2.out';

    // Tempo mínimo (ms) default. Em transições específicas (Projetos), usamos 3000ms.
    const DEFAULT_MIN_VISIBLE_MS = 5000;

    const getConfiguredMinVisibleMs = () => {
        try {
            const v = Number(sessionStorage.getItem('pt:minMs') || String(DEFAULT_MIN_VISIBLE_MS));
            if (Number.isFinite(v) && v > 0) return v;
        } catch (e) {
            // ignore
        }
        return DEFAULT_MIN_VISIBLE_MS;
    };

    let isTransitioning = false;

    // Tagline dinâmica no badge (renderizada via CSS var para evitar flicker)
    const TAGLINE_KEY = 'pt:tagline';

    // Timer LED (contorno da tela) — linha contínua SEM pontilhado.
    // Implementação por 5 segmentos (centro->direita, direita, topo, esquerda, esquerda->centro)
    // para evitar qualquer comportamento de dash do SVG.
    const timerSegBR = overlay.querySelector('.pt-t--br');
    const timerSegR = overlay.querySelector('.pt-t--r');
    const timerSegT = overlay.querySelector('.pt-t--t');
    const timerSegL = overlay.querySelector('.pt-t--l');
    const timerSegBL = overlay.querySelector('.pt-t--bl');
    const timerSegsOk = !!(timerSegBR && timerSegR && timerSegT && timerSegL && timerSegBL);

    // Loop único (neon + timer) para reduzir overhead e evitar travadas.
    let masterRaf = 0;
    let masterLastTs = 0;
    let lastPaintTs = 0;

    let neonRunning = false;
    let timerRunning = false;

    const getRemainingVisibleMsForTimer = () => {
        let remainingMs = 0;
        try {
            const until = Number(sessionStorage.getItem(SHOW_UNTIL_KEY) || '0');
            if (Number.isFinite(until) && until > 0) {
                remainingMs = Math.max(0, until - Date.now());
            }
        } catch (e) {
            // ignore
        }
        return remainingMs;
    };

    const applyTimerSegments = (progress01) => {
        if (!timerSegsOk) return;
        const p = Math.max(0, Math.min(1, progress01));

        // Frações do percurso total: 0.5 + 1 + 1 + 1 + 0.5 = 4.0
        const fBR = 0.125;
        const fR = 0.25;
        const fT = 0.25;
        const fL = 0.25;
        const fBL = 0.125;

        const seg = (from, len) => Math.max(0, Math.min(1, (p - from) / len));

        const vBR = seg(0, fBR);
        const vR = seg(fBR, fR);
        const vT = seg(fBR + fR, fT);
        const vL = seg(fBR + fR + fT, fL);
        const vBL = seg(fBR + fR + fT + fL, fBL);

        timerSegBR.style.transform = `scaleX(${vBR})`;
        timerSegR.style.transform = `scaleY(${vR})`;
        timerSegT.style.transform = `scaleX(${vT})`;
        timerSegL.style.transform = `scaleY(${vL})`;
        timerSegBL.style.transform = `scaleX(${vBL})`;
    };

    const startMasterLoopIfNeeded = () => {
        if (masterRaf) return;
        masterLastTs = 0;
        lastPaintTs = 0;
        masterRaf = requestAnimationFrame(stepMaster);
    };

    const stopMasterLoopIfPossible = () => {
        if (neonRunning || timerRunning) return;
        if (masterRaf) {
            cancelAnimationFrame(masterRaf);
            masterRaf = 0;
            masterLastTs = 0;
            lastPaintTs = 0;
        }
    };

    // Neon border (estilo do seu exemplo): segmento brilhante percorrendo o perímetro.
    const neonA = Array.from(overlay.querySelectorAll('.page-transition__neon-anim--a'));
    const neonB = Array.from(overlay.querySelectorAll('.page-transition__neon-anim--b'));
    const neonAll = [...neonA, ...neonB];

    const NEON_PER = 1000; // pathLength definido no SVG
    const NEON_SEG = 70;   // tamanho do segmento: traço curto (não contínuo)
    const NEON_LAP_S = 2.0; // tempo para dar a volta (mais lento)

    // Estado do neon (atualizado no loop master RAF)
    let neonOffsetA = 0;
    let neonOffsetB = -NEON_PER / 2;

    const applyNeonOffsets = () => {
        const a = ((neonOffsetA % NEON_PER) + NEON_PER) % NEON_PER;
        const b = ((neonOffsetB % NEON_PER) + NEON_PER) % NEON_PER;
        // Apenas via style (mais leve que setAttribute em cada frame).
        for (let i = 0; i < neonA.length; i++) {
            neonA[i].style.setProperty('stroke-dashoffset', String(a));
        }
        for (let i = 0; i < neonB.length; i++) {
            neonB[i].style.setProperty('stroke-dashoffset', String(b));
        }
    };

    const initNeon = () => {
        if (prefersReducedMotion) return;
        if (!neonAll.length) return;
        // garante estado inicial
        neonOffsetA = 0;
        neonOffsetB = -NEON_PER / 2;
        applyNeonOffsets();
    };

    const setNeonRunning = (running) => {
        if (prefersReducedMotion) return;
        if (!neonAll.length) return;

        neonRunning = !!running;
        if (neonRunning) {
            initNeon();
            startMasterLoopIfNeeded();
            return;
        }
        stopMasterLoopIfPossible();
    };

    const setTimerRunning = (running) => {
        if (!timerSegsOk) return;

        timerRunning = !!running;
        if (timerRunning) {
            const remainingMs = getRemainingVisibleMsForTimer();
            const minMs = getConfiguredMinVisibleMs();
            const p = 1 - (remainingMs / minMs);
            applyTimerSegments(p);
            startMasterLoopIfNeeded();
            return;
        }
        stopMasterLoopIfPossible();
    };

    const stepMaster = (ts) => {
        if (!masterRaf) return;
        if (!masterLastTs) masterLastTs = ts;
        const dt = Math.min(64, ts - masterLastTs);
        masterLastTs = ts;

        // Throttle ~30fps para reduzir custo em máquinas mais fracas.
        if (!lastPaintTs) lastPaintTs = ts;
        const shouldPaint = (ts - lastPaintTs) >= 33;

        if (neonRunning) {
            const speedPerMs = NEON_PER / (NEON_LAP_S * 1000);
            const delta = speedPerMs * dt;
            neonOffsetA += delta;
            neonOffsetB += delta;
            if (shouldPaint) applyNeonOffsets();
        }

        if (timerRunning && timerSegsOk) {
            const remainingMs = getRemainingVisibleMsForTimer();
            const minMs = getConfiguredMinVisibleMs();
            const p = 1 - (remainingMs / minMs);
            if (shouldPaint) applyTimerSegments(p);
            if (p >= 1) timerRunning = false;
        }

        if (shouldPaint) lastPaintTs = ts;

        if (!neonRunning && !timerRunning) {
            masterRaf = 0;
            masterLastTs = 0;
            lastPaintTs = 0;
            return;
        }
        masterRaf = requestAnimationFrame(stepMaster);
    };

    const hasGSAP = () => typeof window.gsap !== 'undefined' && typeof window.gsap.to === 'function';

    const setOverlayVisibleInstant = () => {
        document.documentElement.classList.add('pt-overlay-visible');
        overlay.style.visibility = 'visible';
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        setNeonRunning(true);
        setTimerRunning(true);
    };

    const setOverlayHiddenInstant = () => {
        overlay.style.opacity = '0';
        overlay.style.visibility = 'hidden';
        overlay.style.pointerEvents = 'none';
        document.documentElement.classList.remove('pt-overlay-visible');
        setNeonRunning(false);
        setTimerRunning(false);
    };

    const animateOut = () => {
        // Some suavemente após a página carregar por completo.
        if (prefersReducedMotion || !hasGSAP()) {
            setOverlayHiddenInstant();
            return;
        }

        // Garante estado visível antes de animar.
        document.documentElement.classList.add('pt-overlay-visible');
        window.gsap.set(overlay, { autoAlpha: 1, pointerEvents: 'none' });
        if (content) {
            window.gsap.set(content, { autoAlpha: 1, y: 0 });
        }

        const tl = window.gsap.timeline();
        if (content) {
            tl.to(content, { duration: 0.35, autoAlpha: 0, y: -6, ease: EASE }, 0);
        }
        tl.to(overlay, {
            duration: D_OUT,
            autoAlpha: 0,
            ease: EASE,
            onComplete: () => {
                document.documentElement.classList.remove('pt-overlay-visible');

                setNeonRunning(false);
                setTimerRunning(false);

                // Limpa flags de navegação e deadline.
                try {
                    sessionStorage.removeItem(PENDING_KEY);
                    sessionStorage.removeItem(SHOW_UNTIL_KEY);
                    sessionStorage.removeItem('pt:minMs');
                    sessionStorage.removeItem(TAGLINE_KEY);
                    document.documentElement.style.removeProperty('--pt-tagline');
                } catch (e) {}
            },
        }, 0);
    };

    const getRemainingVisibleMs = () => {
        let remainingMs = 0;
        try {
            const until = Number(sessionStorage.getItem(SHOW_UNTIL_KEY) || '0');
            if (Number.isFinite(until) && until > 0) {
                remainingMs = Math.max(0, until - Date.now());
            }
        } catch (e) {
            // ignore
        }
        return remainingMs;
    };

    const getTransitionProfileForUrl = (url) => {
        // Regras do usuário:
        // - Ir para "Projetos" (ex.: index.html#projetos) => 3s + tagline "Projetos"
        // - Voltar para tela anterior/portfólio => 3s + tagline "Portfólio"
        // - Restante mantém 5s
        let dest;
        try {
            dest = new URL(url, window.location.href);
        } catch {
            return { minMs: DEFAULT_MIN_VISIBLE_MS, tagline: 'Portfólio' };
        }

        const path = (dest.pathname || '').toLowerCase();
        const hash = (dest.hash || '').toLowerCase();

        if (path.endsWith('index.html')) {
            // Voltar para o portfólio (mesmo indo direto para a seção #projetos): badge = Portfólio
            return { minMs: 3000, tagline: 'Portfólio' };
        }

        if (path.includes('projeto-')) {
            return { minMs: 3000, tagline: 'Projetos' };
        }

        return { minMs: DEFAULT_MIN_VISIBLE_MS, tagline: 'Portfólio' };
    };

    const animateInAndNavigate = (url) => {
        if (isTransitioning) return;
        isTransitioning = true;

        const profile = getTransitionProfileForUrl(url);

        try {
            sessionStorage.setItem(PENDING_KEY, '1');
            // Define por quanto tempo (mín.) o overlay deve ficar visível contando a partir de agora.
            sessionStorage.setItem('pt:minMs', String(profile.minMs));
            sessionStorage.setItem(TAGLINE_KEY, profile.tagline);
            sessionStorage.setItem(SHOW_UNTIL_KEY, String(Date.now() + profile.minMs));
        } catch (e) {
            // ignore
        }

        // Atualiza imediatamente (na página atual) para não piscar ao aparecer o overlay.
        document.documentElement.style.setProperty('--pt-tagline', '"' + String(profile.tagline).replace(/"/g, '\\"') + '"');

        if (prefersReducedMotion || !hasGSAP()) {
            setOverlayVisibleInstant();
            window.location.href = url;
            return;
        }

        // Estado inicial sem flicker.
        document.documentElement.classList.add('pt-overlay-visible');
        setNeonRunning(true);
        setTimerRunning(true);
        window.gsap.set(overlay, { autoAlpha: 0, pointerEvents: 'auto' });
        if (content) {
            window.gsap.set(content, { autoAlpha: 0, y: 8 });
        }

        const tl = window.gsap.timeline({ defaults: { ease: EASE } });
        tl.to(overlay, { duration: D_IN, autoAlpha: 1 }, 0);
        if (content) {
            tl.to(content, { duration: 0.55, autoAlpha: 1, y: 0 }, 0.15);
        }
        tl.add(() => {
            window.location.href = url;
        });
    };

    const isInternalPageNavigation = (linkEl) => {
        if (!linkEl || !linkEl.href) return false;
        if (linkEl.target === '_blank') return false;
        if (linkEl.hasAttribute('download')) return false;

        const hrefAttr = linkEl.getAttribute('href') || '';
        if (hrefAttr.startsWith('#')) return false;
        if (/^(mailto:|tel:|javascript:)/i.test(hrefAttr)) return false;

        let url;
        try {
            url = new URL(linkEl.href, window.location.href);
        } catch {
            return false;
        }

        if (url.origin !== window.location.origin) return false;

        // Não anima âncoras na mesma página.
        const samePath = url.pathname === window.location.pathname;
        const sameSearch = url.search === window.location.search;
        if (samePath && sameSearch) return false;

        return true;
    };

    // Esconde após carregar tudo.
    const onLoaded = () => {
        // Marca como "já entrou" (1x por aba).
        try {
            sessionStorage.setItem(ENTERED_KEY, '1');
        } catch (e) {
            // ignore
        }

        // Respeita tempo mínimo do overlay.
        window.setTimeout(animateOut, getRemainingVisibleMs());
    };

    window.addEventListener('load', onLoaded, { once: true });

    // Inicializa a borda neon (tweens pausados por padrão) e liga se já estiver visível.
    initNeon();
    setNeonRunning(document.documentElement.classList.contains('pt-overlay-visible'));
    setTimerRunning(document.documentElement.classList.contains('pt-overlay-visible'));

    // Evita overlay preso ao voltar pelo BFCache.
    window.addEventListener('pageshow', (e) => {
        if (e.persisted) {
            // Ao voltar para a página (BFCache), mostra o overlay de forma premium e some suave.
            try {
                sessionStorage.removeItem(PENDING_KEY);
                sessionStorage.setItem(SHOW_UNTIL_KEY, String(Date.now() + getConfiguredMinVisibleMs()));
            } catch (err) {}

            setOverlayVisibleInstant();
            window.setTimeout(animateOut, getRemainingVisibleMs());
        }
    });

    // Intercepta QUALQUER link interno que vá para outra página.
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');
        if (!link) return;
        if (!isInternalPageNavigation(link)) return;

        event.preventDefault();
        animateInAndNavigate(link.href);
    });
});
