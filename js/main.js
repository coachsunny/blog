/* ============================================
   心茶记 - 主 JS 文件
   功能：导航滚动效果 / 移动端菜单 / 回到顶部
   ============================================ */

(function () {
  'use strict';

  // ---------- 导航栏滚动效果 ----------
  const navbar = document.querySelector('.navbar');
  if (navbar) {
    const handleNavScroll = function () {
      if (window.scrollY > 10) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    };
    handleNavScroll();
    window.addEventListener('scroll', handleNavScroll, { passive: true });
  }

  // ---------- 移动端菜单 ----------
  const menuToggle = document.querySelector('.menu-toggle');
  const navLinks = document.querySelector('.navbar-links');

  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', function () {
      const isOpen = navLinks.classList.toggle('open');
      // 切换图标
      const icons = menuToggle.querySelectorAll('svg');
      icons.forEach(function (icon) {
        icon.style.display = isOpen
          ? icon.dataset.icon === 'close' ? 'block' : 'none'
          : icon.dataset.icon === 'menu' ? 'block' : 'none';
      });
      menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    // 点击导航链接后关闭移动端菜单
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (navLinks.classList.contains('open')) {
          navLinks.classList.remove('open');
          const icons = menuToggle.querySelectorAll('svg');
          icons.forEach(function (icon) {
            icon.style.display = icon.dataset.icon === 'menu' ? 'block' : 'none';
          });
          menuToggle.setAttribute('aria-expanded', 'false');
        }
      });
    });

    // 点击外部关闭菜单
    document.addEventListener('click', function (e) {
      if (
        navLinks.classList.contains('open') &&
        !navbar.contains(e.target)
      ) {
        navLinks.classList.remove('open');
        const icons = menuToggle.querySelectorAll('svg');
        icons.forEach(function (icon) {
          icon.style.display = icon.dataset.icon === 'menu' ? 'block' : 'none';
        });
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---------- 回到顶部按钮 ----------
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    const handleBackToTopScroll = function () {
      if (window.scrollY > 400) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    };
    handleBackToTopScroll();
    window.addEventListener('scroll', handleBackToTopScroll, { passive: true });

    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---------- 锚点平滑滚动 ----------
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href.length > 1) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });

  // ---------- 入场动画：滚动时淡入 ----------
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );

    document.querySelectorAll('.scroll-fade').forEach(function (el) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
      observer.observe(el);
    });
  }

  // ---------- 微信社群弹窗控制 ----------
  const wechatBtn = document.getElementById('wechatBtn');
  const wechatModal = document.getElementById('wechatModal');
  const wechatModalClose = document.getElementById('wechatModalClose');

  if (wechatBtn && wechatModal) {
    wechatBtn.addEventListener('click', function (e) {
      e.preventDefault();
      wechatModal.classList.add('active');
    });

    if (wechatModalClose) {
      wechatModalClose.addEventListener('click', function () {
        wechatModal.classList.remove('active');
      });
    }

    wechatModal.addEventListener('click', function (e) {
      if (e.target === wechatModal) {
        wechatModal.classList.remove('active');
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && wechatModal.classList.contains('active')) {
        wechatModal.classList.remove('active');
      }
    });
  }

  // ---------- Mermaid 流程图自适应渲染与茶禅主题 ----------
  async function renderMermaidDiagrams() {
    const blocks = document.querySelectorAll(
      'div.language-mermaid pre.highlight code, pre code.language-mermaid, div.language-mermaid pre code, .mermaid'
    );
    if (!blocks.length) return;

    function doRender() {
      if (typeof mermaid === 'undefined') return;

      mermaid.initialize({
        startOnLoad: false,
        theme: 'base',
        themeVariables: {
          fontFamily: "'Noto Sans TC', 'Noto Sans SC', sans-serif",
          fontSize: '14.5px',
          primaryColor: '#eef4f0',
          primaryTextColor: '#2d4a3e',
          primaryBorderColor: '#a3b899',
          lineColor: '#6b8e23',
          secondaryColor: '#f7faf8',
          tertiaryColor: '#ffffff',
          edgeLabelBackground: '#ffffff'
        },
        flowchart: {
          htmlLabels: true,
          curve: 'basis'
        }
      });

      Array.from(blocks).forEach(async function (block, index) {
        const code = block.textContent.trim();
        const container = block.closest('div.language-mermaid') || block.closest('pre') || block;
        const renderId = 'mermaid-chart-' + Date.now() + '-' + index;

        try {
          const { svg } = await mermaid.render(renderId, code);
          const renderDiv = document.createElement('div');
          renderDiv.className = 'mermaid-container';
          renderDiv.innerHTML = svg;

          // 若当前为繁体中文模式，转换 SVG 内部文本节点
          if (typeof OpenCC !== 'undefined' && localStorage.getItem('blog_lang') === 'traditional') {
            try {
              const s2t = OpenCC.Converter({ from: 'cn', to: 'tw' });
              const walker = document.createTreeWalker(renderDiv, NodeFilter.SHOW_TEXT, null, false);
              let n;
              while ((n = walker.nextNode())) {
                if (n.nodeValue && n.nodeValue.trim()) {
                  n.nodeValue = s2t(n.nodeValue);
                }
              }
            } catch (err) {
              console.warn('OpenCC SVG localization error:', err);
            }
          }

          if (container.parentNode) {
            container.parentNode.replaceChild(renderDiv, container);
          }
        } catch (err) {
          console.error('Mermaid render error for chart #' + index, err);
        }
      });
    }

    if (typeof mermaid === 'undefined') {
      const script = document.createElement('script');
      const base = window.siteBaseUrl || '';
      script.src = (base.endsWith('/') ? base.slice(0, -1) : base) + '/js/mermaid.min.js';
      script.onload = doRender;
      script.onerror = function () {
        // CDN 降级备用
        const cdnScript = document.createElement('script');
        cdnScript.src = 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js';
        cdnScript.onload = doRender;
        document.head.appendChild(cdnScript);
      };
      document.head.appendChild(script);
    } else {
      doRender();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderMermaidDiagrams);
  } else {
    renderMermaidDiagrams();
  }
})();
