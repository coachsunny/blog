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
})();
