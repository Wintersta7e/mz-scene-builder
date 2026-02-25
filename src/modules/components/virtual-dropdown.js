// ============================================
// VirtualDropdown Component
// High-performance dropdown with virtual scrolling
// ============================================

const ITEM_HEIGHT = 28;       // Fixed height per item (px)
const VIEWPORT_HEIGHT = 250;  // Max visible height
const BUFFER_SIZE = 3;        // Extra items above/below viewport
const VISIBLE_COUNT = Math.ceil(VIEWPORT_HEIGHT / ITEM_HEIGHT) + BUFFER_SIZE * 2;

class VirtualDropdown {
  constructor(options) {
    this.container = options.container;
    this.placeholder = options.placeholder || '-- Select --';
    this.searchable = options.searchable !== false;
    this.onSelect = options.onSelect || (() => {});

    // Data
    this.items = [];           // Full data array [{value, label, ...}]
    this.filteredItems = [];   // After search filter
    this.selectedValue = null;
    this.selectedLabel = null;

    // Virtual scroll state
    this.scrollTop = 0;
    this.startIndex = 0;
    this.rafId = null;

    // Pre-allocated pool
    this.pool = new Array(VISIBLE_COUNT);

    // State
    this.isOpen = false;
    this.disabled = false;
    this.focusedIndex = -1;

    this._buildDOM();
    this._bindEvents();
  }

  _buildDOM() {
    this.container.innerHTML = '';
    this.container.className = 'virtual-dropdown';

    // Trigger button
    this.trigger = document.createElement('div');
    this.trigger.className = 'virtual-dropdown-trigger';
    this.trigger.textContent = this.placeholder;
    this.container.appendChild(this.trigger);

    // Dropdown panel
    this.dropdown = document.createElement('div');
    this.dropdown.className = 'virtual-dropdown-panel';
    this.dropdown.style.display = 'none';

    // Search input
    if (this.searchable) {
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'text';
      this.searchInput.className = 'virtual-dropdown-search';
      this.searchInput.placeholder = 'Search...';
      this.dropdown.appendChild(this.searchInput);
    }

    // Viewport
    this.viewport = document.createElement('div');
    this.viewport.className = 'virtual-dropdown-viewport';
    this.dropdown.appendChild(this.viewport);

    // Content container (sets scroll height)
    this.content = document.createElement('div');
    this.content.className = 'virtual-dropdown-content';
    this.viewport.appendChild(this.content);

    // Pre-create pool elements (never create during scroll)
    for (let i = 0; i < VISIBLE_COUNT; i++) {
      const el = document.createElement('div');
      el.className = 'virtual-dropdown-item';
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.right = '0';
      el.style.height = ITEM_HEIGHT + 'px';
      el.style.willChange = 'transform';
      this.content.appendChild(el);
      this.pool[i] = { el, index: -1 };
    }

    // Empty message
    this.emptyMsg = document.createElement('div');
    this.emptyMsg.className = 'virtual-dropdown-empty';
    this.emptyMsg.textContent = 'No items';
    this.emptyMsg.style.display = 'none';
    this.dropdown.appendChild(this.emptyMsg);

    document.body.appendChild(this.dropdown);
  }

  _bindEvents() {
    // Trigger click
    this.trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.disabled) {
        this.isOpen ? this.close() : this.open();
      }
    });

    // Search input - no debounce since filtering is fast (<3ms)
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => {
        this._filterItems(this.searchInput.value);
      });
      this.searchInput.addEventListener('click', (e) => e.stopPropagation());
      this.searchInput.addEventListener('keydown', (e) => this._handleKeydown(e));
    }

    // Event delegation for clicks (single handler)
    this.content.addEventListener('click', (e) => {
      const el = e.target.closest('.virtual-dropdown-item');
      if (el) {
        const idx = parseInt(el.dataset.idx, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.filteredItems.length) {
          this._selectByIndex(idx);
        }
      }
    });

    // Scroll with passive listener for best performance
    this.viewport.addEventListener('scroll', () => {
      if (this.rafId) return;
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        this._onScroll();
      });
    }, { passive: true });

    // Keyboard
    this.viewport.addEventListener('keydown', (e) => this._handleKeydown(e));

    // Close on outside click
    this._onDocClick = (e) => {
      if (this.isOpen && !this.container.contains(e.target) && !this.dropdown.contains(e.target)) {
        this.close();
      }
    };
    document.addEventListener('click', this._onDocClick);

    // Escape
    this._onDocKey = (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    };
    document.addEventListener('keydown', this._onDocKey);
  }

  _onScroll() {
    const newStart = Math.max(0, Math.floor(this.viewport.scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
    if (newStart !== this.startIndex) {
      this.startIndex = newStart;
      this._render();
    }
  }

  _render() {
    const items = this.filteredItems;
    const count = items.length;
    const start = this.startIndex;
    const selectedVal = this.selectedValue;
    const focusIdx = this.focusedIndex;

    for (let i = 0; i < VISIBLE_COUNT; i++) {
      const poolItem = this.pool[i];
      const dataIdx = start + i;
      const el = poolItem.el;

      if (dataIdx >= count) {
        poolItem.index = -1;
        el.style.visibility = 'hidden';
        continue;
      }

      const item = items[dataIdx];
      const needsUpdate = poolItem.index !== dataIdx;

      if (needsUpdate) {
        poolItem.index = dataIdx;
        el.style.transform = `translateY(${dataIdx * ITEM_HEIGHT}px)`;
      }

      // Always update text content (items array may have changed due to filtering)
      // and set idx for click handler
      if (el.textContent !== item.label) {
        el.textContent = item.label;
      }
      el.dataset.idx = dataIdx;
      el.style.visibility = 'visible';

      // Build className
      const isSelected = item.value === selectedVal;
      const isFocused = dataIdx === focusIdx;
      const isDisabled = item.disabled;

      let cls = 'virtual-dropdown-item';
      if (isSelected) cls += ' selected';
      if (isFocused) cls += ' focused';
      if (isDisabled) cls += ' disabled';

      // Only update if changed
      if (el.className !== cls) {
        el.className = cls;
      }
    }
  }

  _filterItems(query) {
    const q = query.toLowerCase().trim();
    // Avoid array copy when not filtering
    if (!q) {
      this.filteredItems = this.items;
    } else {
      this.filteredItems = this.items.filter(item => item.label.toLowerCase().includes(q));
    }
    this.focusedIndex = this.filteredItems.length > 0 ? 0 : -1;
    this.content.style.height = (this.filteredItems.length * ITEM_HEIGHT) + 'px';
    this.viewport.scrollTop = 0;
    this.startIndex = 0;
    this._render();
    this.emptyMsg.style.display = this.filteredItems.length === 0 ? '' : 'none';
  }

  _handleKeydown(e) {
    if (!this.isOpen) return;
    const len = this.filteredItems.length;
    if (len === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.focusedIndex = Math.min(this.focusedIndex + 1, len - 1);
        this._scrollToFocused();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
        this._scrollToFocused();
        break;
      case 'Enter':
        e.preventDefault();
        if (this.focusedIndex >= 0) this._selectByIndex(this.focusedIndex);
        break;
      case 'Home':
        e.preventDefault();
        this.focusedIndex = 0;
        this._scrollToFocused();
        break;
      case 'End':
        e.preventDefault();
        this.focusedIndex = len - 1;
        this._scrollToFocused();
        break;
    }
  }

  _scrollToFocused() {
    if (this.focusedIndex < 0) return;
    const itemTop = this.focusedIndex * ITEM_HEIGHT;
    const viewTop = this.viewport.scrollTop;
    const viewH = this.viewport.clientHeight;

    if (itemTop < viewTop) {
      this.viewport.scrollTop = itemTop;
    } else if (itemTop + ITEM_HEIGHT > viewTop + viewH) {
      this.viewport.scrollTop = itemTop + ITEM_HEIGHT - viewH;
    }
    this._onScroll();
    this._render();
  }

  _selectByIndex(index) {
    const item = this.filteredItems[index];
    if (!item || item.disabled) return;
    this.selectedValue = item.value;
    this.selectedLabel = item.label;
    this.trigger.textContent = item.label;
    this.trigger.classList.add('has-value');
    this.close();
    this.onSelect(item.value, item);
  }

  // Public API

  setItems(items) {
    this.items = items || [];
    this.filteredItems = this.items;
    this.focusedIndex = -1;
    this.startIndex = 0;
    this.content.style.height = (this.filteredItems.length * ITEM_HEIGHT) + 'px';
    this._render();
    this.emptyMsg.style.display = this.items.length === 0 ? '' : 'none';
  }

  setSelected(value, label) {
    this.selectedValue = value;
    if (value !== null && value !== undefined) {
      this.selectedLabel = label || (this.items.find(i => i.value === value)?.label) || String(value);
      this.trigger.textContent = this.selectedLabel;
      this.trigger.classList.add('has-value');
    } else {
      this.selectedLabel = null;
      this.trigger.textContent = this.placeholder;
      this.trigger.classList.remove('has-value');
    }
    if (this.isOpen) this._render();
  }

  getSelected() {
    return { value: this.selectedValue, label: this.selectedLabel };
  }

  clear() {
    this.setSelected(null, null);
  }

  open() {
    if (this.disabled || this.isOpen) return;

    const rect = this.trigger.getBoundingClientRect();
    this.dropdown.style.top = rect.bottom + 'px';
    this.dropdown.style.left = rect.left + 'px';
    this.dropdown.style.width = rect.width + 'px';
    this.dropdown.style.display = '';

    this.isOpen = true;
    this.container.classList.add('open');

    // Reset scroll state
    this.viewport.scrollTop = 0;
    this.startIndex = 0;

    // Sync filteredItems with items (clears any previous filter)
    this.filteredItems = this.items;
    this.content.style.height = (this.filteredItems.length * ITEM_HEIGHT) + 'px';
    this.emptyMsg.style.display = this.filteredItems.length === 0 ? '' : 'none';
    this.focusedIndex = this.filteredItems.length > 0 ? 0 : -1;

    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchInput.focus();
    }

    // Scroll to selected if any
    if (this.selectedValue !== null) {
      const idx = this.filteredItems.findIndex(i => i.value === this.selectedValue);
      if (idx >= 0) {
        this.focusedIndex = idx;
        this.viewport.scrollTop = Math.max(0, idx * ITEM_HEIGHT - VIEWPORT_HEIGHT / 2);
        this.startIndex = Math.max(0, Math.floor(this.viewport.scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
      }
    }

    this._render();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.dropdown.style.display = 'none';
    this.container.classList.remove('open');
  }

  setDisabled(disabled) {
    this.disabled = disabled;
    this.container.classList.toggle('disabled', disabled);
    if (disabled && this.isOpen) this.close();
  }

  setPlaceholder(text) {
    this.placeholder = text;
    if (this.selectedValue === null) this.trigger.textContent = text;
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    document.removeEventListener('click', this._onDocClick);
    document.removeEventListener('keydown', this._onDocKey);
    if (this.dropdown.parentNode) this.dropdown.parentNode.removeChild(this.dropdown);
    this.container.innerHTML = '';
  }
}

module.exports = { VirtualDropdown };
