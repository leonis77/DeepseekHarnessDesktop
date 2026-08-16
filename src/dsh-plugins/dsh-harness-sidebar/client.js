// dsh-harness-sidebar 浏览器半：在侧栏底部注册「会话管理」入口，
// 点击跳转到 Harness UI 的会话管理页（远程网关 /__manage）。
// 手写、无打包器：client 模块系统以 CJS factory 包裹，内核把 { apply, inject } 采纳为客户端插件。
window.__ModuleLoader__.load({
  id: 'dsh-harness-sidebar',
  factory: (require) => {
    const module = { exports: {} };
    const exports = module.exports;
    const React = require('react');
    const NS = 'harness-sidebar';
    const zh = { manage: '会话管理' };
    const en = { manage: 'Sessions' };

    const inject = ['slots', 'locale'];

    function ManageButton() {
      return React.createElement(
        'button',
        {
          type: 'button',
          title: '会话管理',
          onClick: () => {
            window.location.href = '/__manage';
          },
          style: {
            cursor: 'pointer',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            padding: '6px 8px',
            fontSize: '13px',
          },
        },
        '会话管理'
      );
    }

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'harness-sidebar: dictionaries');
      ctx.effect(
        () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: 'harness-manage',
              locale: NS,
              inject: () => ({}),
            },
            ManageButton
          ),
        'harness-sidebar: manage entry'
      );
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});
