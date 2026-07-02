/* ============================================================
   Event Delegation System — lightweight click delegation
   ============================================================
   Gantikan pattern onclick="Module.action(id)" dengan:
     <button data-action="action-name" data-id="123">

   Lalu daftar handler:
     Delegate.on('action-name', (el) => Module.action(el.dataset.id))

   Init dipanggil di App.init().
   ============================================================ */

const Delegate = {
  _handlers: {},

  /** Init global click listener */
  init(container) {
    (container || document).addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;
      const action = target.dataset.action;
      const handler = Delegate._handlers[action];
      if (handler) {
        handler(target, e);
      }
    });
  },

  /** Register handler untuk data-action */
  on(action, handler) {
    Delegate._handlers[action] = handler;
  },

  /** Remove handler */
  off(action) {
    delete Delegate._handlers[action];
  },
};
