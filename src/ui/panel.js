// Small helper for re-renderable modal panels built on ui.openModal.
// render() returns the panel's inner HTML; onClick(e, rerender) handles clicks.
import './extras.css';

export function openPanel(ui, id, { width = 640, render, onClick, pauses = false, onClose }) {
  const html = () => `<div class="panel xpanel" style="width:min(${width}px,calc(95 * var(--sw)))">${render()}</div>`;
  const el = ui.openModal(id, html(), { pauses, onClose });
  const panel = () => el.querySelector('.panel');
  const rerender = () => {
    if (!ui.modal || ui.modal.el !== el) return;
    const p = panel();
    const x = p.querySelector(':scope > .modal-x');
    const scroll = p.querySelector('.scroll');
    const top = scroll ? scroll.scrollTop : 0;
    p.innerHTML = render();
    if (x) p.appendChild(x);
    const s2 = p.querySelector('.scroll');
    if (s2) s2.scrollTop = top;
  };
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-a="close"]')) return ui.closeModal();
    if (onClick) onClick(e, rerender);
  });
  return { el, rerender, isOpen: () => !!(ui.modal && ui.modal.el === el) };
}
