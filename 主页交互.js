/* =========================================================
   主页交互.js —— SillyTavern 主页交互脚本（.load 注入友好）
   目标：
   - 通过 data-action 事件代理绑定按钮（不依赖 onclick）
   - 支持：切换开场 swipe / 复制 QQ 群号 / 打开链接
   - 兼容：有无 triggerSlash / getChatMessages / setChatMessage
   使用：
   - 在注入的 HTML 末尾 <script src=".../主页交互.js"></script>
   - 在 HTML 元素上标记 data-action / data-swipe / data-url / data-qq
   ========================================================= */

(function () {
  'use strict';

  // 防止重复加载导致重复绑定
  if (window.__MDW_HOME_INTERACT_LOADED__) return;
  window.__MDW_HOME_INTERACT_LOADED__ = true;

  // ---------------------------
  // 小工具：消息提示
  // ---------------------------
  function toast(msg, severity = 'info') {
    // SillyTavern 环境下很多作者用 triggerSlash
    if (typeof window.triggerSlash === 'function') {
      window.triggerSlash(`/echo severity=${severity} ${msg}`);
      return;
    }
    // fallback
    try {
      console.log(`[HOME:${severity}]`, msg);
    } catch {}
    // 最后兜底
    if (severity === 'error' || severity === 'warning') {
      try {
        alert(msg);
      } catch {}
    }
  }

  // ---------------------------
  // 复制文本（剪贴板）
  // ---------------------------
  async function copyText(text) {
    if (!text) return toast('没有可复制的内容。', 'warning');

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        toast('已复制到剪贴板！', 'success');
        return;
      }
      // 退化方案
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-999999px';
      ta.style.top = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) toast('已复制到剪贴板！', 'success');
      else toast(`复制失败，请手动复制：${text}`, 'error');
    } catch (e) {
      toast(`复制失败，请手动复制：${text}`, 'error');
    }
  }

  // ---------------------------
  // 打开链接（新标签页）
  // ---------------------------
  function openLink(url) {
    if (!url) return toast('缺少链接地址（data-url）。', 'error');
    try {
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast(`无法打开链接，请手动复制：${url}`, 'error');
    }
  }

  // ---------------------------
  // 切换开场 swipe（依赖 ST/助手暴露的 API）
  // ---------------------------
  async function switchOpeningSwipe(swipeId, clickedEl) {
    // UI 反馈
    if (clickedEl) {
      clickedEl.classList.add('is-disabled');
      clickedEl.classList.add('is-selected');
    }

    // 依赖检测
    const hasGet = typeof window.getChatMessages === 'function';
    const hasSet = typeof window.setChatMessage === 'function';

    if (!hasGet || !hasSet) {
      toast('当前环境未暴露 getChatMessages / setChatMessage，无法自动切换开场。', 'warning');
      toast('你可以手动在第 0 条消息上滑动/切换 swipes。', 'info');
      if (clickedEl) clickedEl.classList.remove('is-disabled');
      return;
    }

    try {
      // swipeId 按你的原逻辑：messages[0].swipes[swipeId]
      const messages = await window.getChatMessages('0', { include_swipe: true });
      const msg0 = messages && messages[0];

      if (!msg0) throw new Error('未找到第 0 条消息（messages[0]）。');

      // 有的环境 swipes 可能是数组，有的可能是对象；这里都兼容一下
      const swipes = msg0.swipes;
      const target = swipes ? swipes[swipeId] : null;

      if (!target) {
        throw new Error(`开场 swipe ${swipeId} 未找到。请确认已按顺序添加 swipes。`);
      }

      await window.setChatMessage(target, 0, {
        swipe_id: swipeId,
        refresh: 'display_and_render_current',
      });

      toast(`已切换到开场 ${swipeId}。`, 'success');
    } catch (e) {
      toast(`切换失败：${e && e.message ? e.message : String(e)}`, 'error');
      if (clickedEl) {
        clickedEl.classList.remove('is-selected');
      }
    } finally {
      if (clickedEl) clickedEl.classList.remove('is-disabled');
    }
  }

  // ---------------------------
  // 事件代理：统一处理 data-action
  // ---------------------------
  function onClick(e) {
    const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.getAttribute('data-action');

    // 1) 复制 QQ
    if (action === 'copy-qq') {
      const qq = el.getAttribute('data-qq') || '';
      return copyText(qq);
    }

    // 2) 打开链接
    if (action === 'open-link') {
      const url = el.getAttribute('data-url') || '';
      return openLink(url);
    }

    // 3) 切换开场
    if (action === 'switch-opening') {
      const raw = el.getAttribute('data-swipe');
      const swipeId = Number(raw);
      if (!Number.isFinite(swipeId)) {
        return toast('缺少或错误的 data-swipe（应为数字）。', 'error');
      }

      // 取消其他卡片选中态（同一组内）
      try {
        document.querySelectorAll('[data-action="switch-opening"].is-selected').forEach((node) => {
          if (node !== el) node.classList.remove('is-selected');
        });
      } catch {}

      return switchOpeningSwipe(swipeId, el);
    }

    // 未知 action
    toast(`未知 action：${action}`, 'warning');
  }

  document.addEventListener('click', onClick);

  // ---------------------------
  // 初始化提示（可删）
  // ---------------------------
  toast('主页交互已加载。', 'info');
})();
