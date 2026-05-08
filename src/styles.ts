export const STYLES = `
  .ds-button {
    position: absolute;
    bottom: 16px;
    right: 16px;
    padding: 8px 18px;
    background: #1a1a2e;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.18);
    transition: background 0.15s;
  }
  .ds-button:hover {
    background: #16213e;
  }

  .ds-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.45);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ds-modal {
    background: #fff;
    border-radius: 10px;
    padding: 28px 24px 20px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.22);
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 380px;
  }

  .ds-modal-title {
    font-size: 17px;
    font-weight: 600;
    font-family: system-ui, sans-serif;
    color: #111;
    margin: 0;
  }

  .ds-canvas {
    border: 1.5px solid #d1d5db;
    border-radius: 6px;
    cursor: crosshair;
    touch-action: none;
    display: block;
    background: #fafafa;
  }

  .ds-modal-actions {
    display: flex;
    gap: 10px;
    justify-content: flex-end;
  }

  .ds-btn-clear {
    padding: 7px 16px;
    border: 1px solid #d1d5db;
    background: transparent;
    border-radius: 5px;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    color: #374151;
  }
  .ds-btn-clear:hover { background: #f3f4f6; }

  .ds-btn-use {
    padding: 7px 16px;
    background: #1a1a2e;
    color: #fff;
    border: none;
    border-radius: 5px;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
  }
  .ds-btn-use:hover { background: #16213e; }

  .ds-btn-cancel {
    padding: 7px 16px;
    border: 1px solid #d1d5db;
    background: transparent;
    border-radius: 5px;
    font-size: 13px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    color: #374151;
  }
  .ds-btn-cancel:hover { background: #f3f4f6; }

  .ds-placement-overlay {
    position: absolute;
    inset: 0;
    z-index: 9998;
    overflow: hidden;
    pointer-events: none;
  }

  .ds-sig-box {
    position: absolute;
    border: 2px dashed #1a1a2e;
    cursor: move;
    pointer-events: all;
    box-sizing: border-box;
    min-width: 60px;
    min-height: 30px;
  }

  .ds-sig-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    pointer-events: none;
    user-select: none;
  }

  .ds-sig-controls {
    position: absolute;
    top: -32px;
    right: 0;
    display: flex;
    gap: 4px;
  }

  .ds-sig-delete, .ds-sig-confirm {
    border: none;
    border-radius: 4px;
    padding: 3px 10px;
    font-size: 12px;
    font-family: system-ui, sans-serif;
    cursor: pointer;
    pointer-events: all;
  }

  .ds-sig-delete {
    background: #ef4444;
    color: #fff;
  }
  .ds-sig-delete:hover { background: #dc2626; }

  .ds-sig-confirm {
    background: #22c55e;
    color: #fff;
  }
  .ds-sig-confirm:hover { background: #16a34a; }

  .ds-resize-handle {
    position: absolute;
    width: 10px;
    height: 10px;
    background: #1a1a2e;
    border-radius: 2px;
    pointer-events: all;
  }
  .ds-resize-se {
    bottom: -5px;
    right: -5px;
    cursor: se-resize;
  }
  .ds-resize-sw {
    bottom: -5px;
    left: -5px;
    cursor: sw-resize;
  }
  .ds-resize-ne {
    top: -5px;
    right: -5px;
    cursor: ne-resize;
  }
  .ds-resize-nw {
    top: -5px;
    left: -5px;
    cursor: nw-resize;
  }
`;
