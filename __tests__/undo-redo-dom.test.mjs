/**
 * @jest-environment jsdom
 *
 * Covers the DOM-touching parts of undo-redo that the existing
 * undo-redo.test.mjs skips:
 *   - showConfirmDialog (modal lifecycle, button click, Escape,
 *     focus restore, Tab cycling)
 *   - checkUnsavedChanges (modal-vs-fast-path, both resolve outcomes)
 *   - updateWindowTitle (clean vs dirty title)
 */

/* global window */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../src/modules/logger.js', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), time: jest.fn(), timeEnd: jest.fn() }
}));

jest.unstable_mockModule('../src/modules/elements.js', () => ({
  getElements: jest.fn(() => ({ btnPlay: { textContent: '▶' } })),
  initElements: jest.fn()
}));

jest.unstable_mockModule('../src/modules/event-bus.js', () => ({
  eventBus: { on: jest.fn(), emit: jest.fn(), off: jest.fn(), clear: jest.fn() },
  Events: { RENDER: 'render', RENDER_TIMELINE: 'render:timeline', RENDER_PREVIEW: 'render:preview' }
}));

const { state } = await import('../src/modules/state.js');
const { showConfirmDialog, checkUnsavedChanges, updateWindowTitle, markDirty, markClean } =
  await import('../src/modules/undo-redo.js');

beforeEach(() => {
  document.body.textContent = '';
  document.title = 'Timeline Scene Builder';
  state.isDirty = false;
});

describe('updateWindowTitle', () => {
  it('shows the clean title when state is not dirty', () => {
    state.isDirty = false;
    updateWindowTitle();
    expect(document.title).toBe('Timeline Scene Builder');
  });

  it('appends an asterisk when the scene is dirty', () => {
    state.isDirty = true;
    updateWindowTitle();
    expect(document.title).toBe('Timeline Scene Builder *');
  });

  it('is called by markDirty', () => {
    state.isDirty = false;
    markDirty();
    expect(state.isDirty).toBe(true);
    expect(document.title).toBe('Timeline Scene Builder *');
  });

  it('is called by markClean', () => {
    state.isDirty = true;
    markClean();
    expect(state.isDirty).toBe(false);
    expect(document.title).toBe('Timeline Scene Builder');
  });
});

describe('showConfirmDialog', () => {
  it('builds a modal in the DOM with the title, message, and buttons', () => {
    showConfirmDialog('Title Text', 'Body message text.', ['OK', 'Cancel']);
    const modal = document.querySelector('.modal');
    expect(modal).not.toBeNull();
    expect(modal.querySelector('h3').textContent).toBe('Title Text');
    expect(modal.querySelector('p').textContent).toBe('Body message text.');
    const buttons = modal.querySelectorAll('button');
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toBe('OK');
    expect(buttons[1].textContent).toBe('Cancel');
  });

  it('marks the first button as the primary action', () => {
    showConfirmDialog('T', 'M', ['Primary', 'Secondary']);
    const buttons = document.querySelectorAll('.modal button');
    expect(buttons[0].className).toContain('btn-primary');
    expect(buttons[1].className).not.toContain('btn-primary');
  });

  it('resolves with the clicked button label and removes the modal', async () => {
    const promise = showConfirmDialog('T', 'M', ['Yes', 'No']);
    const buttons = document.querySelectorAll('.modal button');
    buttons[0].click();
    await expect(promise).resolves.toBe('Yes');
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('resolves with the second button when the second button is clicked', async () => {
    const promise = showConfirmDialog('T', 'M', ['Yes', 'No']);
    const buttons = document.querySelectorAll('.modal button');
    buttons[1].click();
    await expect(promise).resolves.toBe('No');
  });

  it('resolves with the LAST button when Escape is pressed (default cancel)', async () => {
    const promise = showConfirmDialog('T', 'M', ['Continue', 'Abort']);
    const modal = document.querySelector('.modal');
    modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(promise).resolves.toBe('Abort');
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('focuses the first button when the modal opens', () => {
    showConfirmDialog('T', 'M', ['First', 'Second']);
    const buttons = document.querySelectorAll('.modal button');
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('restores focus to the previously-focused element on close', async () => {
    const trigger = document.createElement('button');
    trigger.textContent = 'open dialog';
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const promise = showConfirmDialog('T', 'M', ['OK']);
    const modalBtn = document.querySelector('.modal button');
    modalBtn.click();
    await promise;

    expect(document.activeElement).toBe(trigger);
  });

  it('Tab from the last button cycles focus to the first', () => {
    showConfirmDialog('T', 'M', ['A', 'B', 'C']);
    const modal = document.querySelector('.modal');
    const buttons = modal.querySelectorAll('button');
    buttons[2].focus();
    expect(document.activeElement).toBe(buttons[2]);

    const tabEvent = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
    modal.dispatchEvent(tabEvent);

    expect(document.activeElement).toBe(buttons[0]);
  });

  it('Shift+Tab from the first button cycles focus to the last', () => {
    showConfirmDialog('T', 'M', ['A', 'B', 'C']);
    const modal = document.querySelector('.modal');
    const buttons = modal.querySelectorAll('button');
    buttons[0].focus();

    const shiftTab = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
    modal.dispatchEvent(shiftTab);

    expect(document.activeElement).toBe(buttons[2]);
  });
});

describe('checkUnsavedChanges', () => {
  it('returns true immediately when state is not dirty (no modal shown)', async () => {
    state.isDirty = false;
    const result = await checkUnsavedChanges();
    expect(result).toBe(true);
    expect(document.querySelector('.modal')).toBeNull();
  });

  it('opens a modal when state is dirty, resolves true when "Continue" clicked', async () => {
    state.isDirty = true;
    const promise = checkUnsavedChanges();
    const modal = document.querySelector('.modal');
    expect(modal).not.toBeNull();
    const buttons = modal.querySelectorAll('button');
    const continueBtn = Array.from(buttons).find((b) => b.textContent === 'Continue');
    continueBtn.click();
    await expect(promise).resolves.toBe(true);
  });

  it('opens a modal when state is dirty, resolves false when "Cancel" clicked', async () => {
    state.isDirty = true;
    const promise = checkUnsavedChanges();
    const modal = document.querySelector('.modal');
    const buttons = modal.querySelectorAll('button');
    const cancelBtn = Array.from(buttons).find((b) => b.textContent === 'Cancel');
    cancelBtn.click();
    await expect(promise).resolves.toBe(false);
  });

  it('resolves false on Escape (matches "Cancel" via last-button default)', async () => {
    state.isDirty = true;
    const promise = checkUnsavedChanges();
    const modal = document.querySelector('.modal');
    modal.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await expect(promise).resolves.toBe(false);
  });
});
