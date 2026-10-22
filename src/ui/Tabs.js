// The strip of tabs along the top of the Garage and the Hangar.
//
// It only draws: which tab is on, and whether the focus is on the strip. The
// screen that owns it keeps the state and the navigation (Left and Right on the
// strip, Q and E or a pad's bumpers from anywhere, a click on a tab) and tells it
// what to show through mark().

export class TabBar {
  // el: the strip; onPick(i): a tab was clicked; keys: print the Q and E key caps at
  // the ends (for a screen that changes tab with them).
  constructor(el, onPick, { keys = true } = {}) {
    this.el = el;
    this.onPick = onPick;
    this.keys = keys;
    this.buttons = [];
    el.setAttribute('role', 'tablist');
  }

  setTabs(names) {
    const key = (code) => {
      const k = document.createElement('kbd');
      k.textContent = code;
      k.setAttribute('aria-hidden', 'true');
      return k;
    };
    this.el.replaceChildren(...(this.keys ? [key('Q')] : []));
    this.buttons = names.map((name, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'garage-tab';
      b.textContent = name;
      b.tabIndex = -1;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => this.onPick(i));
      this.el.append(b);
      return b;
    });
    if (this.keys) this.el.append(key('E'));
  }

  mark(at, focused) {
    this.buttons.forEach((b, k) => {
      b.classList.toggle('on', k === at);
      b.setAttribute('aria-selected', k === at ? 'true' : 'false');
    });
    this.el.classList.toggle('focused', focused);
  }
}
