// ==UserScript==
// @name         链动小铺 增强工具（精简稳定版）
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  过滤缺货 + 价格排序 + 布局切换 + 控制面板（带按钮反馈）
// @author       Alun
// @match        https://pay.ldxp.cn/shop/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    const state = {
        filterOn: true,
        sortAsc: true,
        gridMode: true,
    };

    function extractPrice(item) {
        const priceEl = item.querySelector('.nowPrice') || 
                        item.querySelector('.goods-price .nowPrice') ||
                        item.querySelector('[class*="price"]');
        if (!priceEl) return Infinity;
        const priceText = priceEl.textContent.trim();
        const match = priceText.match(/(\d+\.?\d*)/);
        return match ? parseFloat(match[1]) : Infinity;
    }

    function apply() {
        console.log('🔄 执行中...');

        const container = document.querySelector('.goods_list') || document.body;
        let items = Array.from(container.querySelectorAll('.goods_item, .goods-item'));

        if (items.length === 0) return;

        let hiddenCount = 0;
        let shownItems = [];

        items.forEach(item => {
            if (state.filterOn && item.querySelector('.stock.rank0')) {
                item.style.display = 'none';
                hiddenCount++;
            } else {
                item.style.display = '';
                shownItems.push(item);
            }
        });

        if (shownItems.length > 1) {
            shownItems.sort((a, b) => state.sortAsc ? extractPrice(a) - extractPrice(b) : extractPrice(b) - extractPrice(a));

            const parent = shownItems[0]?.parentNode;
            if (parent) {
                const fragment = document.createDocumentFragment();
                shownItems.forEach(item => fragment.appendChild(item));
                parent.appendChild(fragment);
            }
        }

        applyLayoutCSS();
        updateButtons();
        console.log('✅ 完成');
    }

    function applyLayoutCSS() {
        let old = document.getElementById('ldxp-style');
        if (old) old.remove();

        const style = document.createElement('style');
        style.id = 'ldxp-style';
        style.textContent = state.gridMode ? gridGridCSS() : gridListCSS();
        document.head.appendChild(style);
    }

    function gridGridCSS() {
        return `
            .goods_content ._index .list, .goods_list {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 12px !important;
                align-items: stretch !important;
                height: auto !important;
                min-height: auto !important;
            }
            .goods_content ._index .list .goods_item, .goods_list .goods_item {
                flex: 0 0 calc(25% - 12px) !important;
                max-width: calc(25% - 12px) !important;
                background: white !important;
                border-radius: 8px !important;
                overflow: hidden !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
            }
            .goods_content ._index .list[style*="height"] { height: auto !important; min-height: auto !important; }
        `;
    }

    function gridListCSS() {
        return `
            .goods_content ._index .list, .goods_list {
                display: flex !important;
                flex-direction: column !important;
                gap: 12px !important;
                height: auto !important;
                min-height: auto !important;
            }
            .goods_content ._index .list .goods_item, .goods_list .goods_item {
                flex: 0 0 auto !important;
                width: 100% !important;
                display: flex !important;
                flex-direction: row !important;
                padding: 12px !important;
                background: white !important;
                border-radius: 8px !important;
                overflow: hidden !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
            }
        `;
    }

    function updateButtons() {
        const total = document.querySelectorAll('.goods_item, .goods-item').length;
        const hidden = document.querySelectorAll('.goods_item[style*="display: none"], .goods-item[style*="display: none"]').length;
        const stats = document.getElementById('ldxp-stats');
        if (stats) stats.textContent = `📦 ${total - hidden} / ${total} 个商品`;
    }

    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'ldxp-panel';
        panel.style.cssText = `
            position: fixed; top: 80px; right: 20px; z-index: 999999;
            background: rgba(255,255,255,0.97);
            border-radius: 14px; padding: 16px 18px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.2);
            font-family: -apple-system, sans-serif;
            min-width: 200px; user-select: none; border: 1px solid #f0f0f0;
        `;

        panel.innerHTML = `
            <div style="font-size:14px;font-weight:700;color:#333;margin-bottom:12px;border-bottom:1px solid #eee;padding-bottom:10px;cursor:grab;" id="ldxp-title">
                🛠️ 链动小铺增强
                <span style="float:right;font-size:11px;color:#999;cursor:pointer;" id="ldxp-collapse">收起</span>
            </div>
            <div id="ldxp-content" style="display:flex;flex-direction:column;gap:8px;">
                <button id="ldxp-btn-filter" style="padding:8px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;background:#f5576c;color:white;">🙈 隐藏缺货</button>
                <button id="ldxp-btn-sort" style="padding:8px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;background:#667eea;color:white;">📈 价格升序</button>
                <button id="ldxp-btn-layout" style="padding:8px 14px;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;width:100%;background:#2ecc71;color:white;">📐 Grid布局</button>
                <button id="ldxp-btn-reset" style="padding:8px 14px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;width:100%;background:#f5f5f5;color:#666;margin-top:4px;">🔄 刷新恢复</button>
                <div id="ldxp-stats" style="margin-top:10px;padding-top:10px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center;">加载中...</div>
            </div>
        `;

        document.body.appendChild(panel);

        // 按钮点击反馈
        const buttons = {
            filter: document.getElementById('ldxp-btn-filter'),
            sort: document.getElementById('ldxp-btn-sort'),
            layout: document.getElementById('ldxp-btn-layout'),
            reset: document.getElementById('ldxp-btn-reset')
        };

        buttons.filter.addEventListener('click', () => {
            state.filterOn = !state.filterOn;
            apply();
            feedback(buttons.filter, state.filterOn ? '#f5576c' : '#e0e0e0', '隐藏缺货');
        });

        buttons.sort.addEventListener('click', () => {
            state.sortAsc = !state.sortAsc;
            apply();
            feedback(buttons.sort, state.sortAsc ? '#f5576c' : '#e0e0e0', '价格排序');
        });

        buttons.layout.addEventListener('click', () => {
            state.gridMode = !state.gridMode;
            apply();
            feedback(buttons.layout, state.gridMode ? '#f5576c' : '#e0e0e0', '布局切换');
        });

        buttons.reset.addEventListener('click', () => {
            location.reload();
        });

        let collapsed = false;
        document.getElementById('ldxp-collapse').addEventListener('click', () => {
            collapsed = !collapsed;
            const content = document.getElementById('ldxp-content');
            document.getElementById('ldxp-collapse').textContent = collapsed ? '展开' : '收起';
            content.style.display = collapsed ? 'none' : 'flex';
        });

        let dragging = false, sx, sy, ox, oy;
        const title = document.getElementById('ldxp-title');
        title.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            dragging = true;
            const rect = panel.getBoundingClientRect();
            sx = e.clientX; sy = e.clientY; ox = rect.left; oy = rect.top;
            panel.style.transition = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });

        function onMove(e) {
            if (!dragging) return;
            panel.style.left = (ox + e.clientX - sx) + 'px';
            panel.style.top = (oy + e.clientY - sy) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        }
        function onUp() {
            dragging = false;
            panel.style.transition = 'all 0.3s ease';
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }

        updateButtons();
    }

    function feedback(btn, bg, text) {
        const originalBg = btn.style.background;
        const originalColor = btn.style.color;
        btn.style.background = bg;
        btn.style.color = '#fff';
        setTimeout(() => {
            btn.style.background = originalBg;
            btn.style.color = originalColor;
        }, 800);
    }

    function start() {
        createPanel();
        apply();

        const observer = new MutationObserver(() => {
            const timer = setTimeout(apply, 300);
            return () => clearTimeout(timer);
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})();
