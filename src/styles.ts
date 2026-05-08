export const STYLES = `
  .ds-button {
    position: absolute;
    bottom: 24px;
    right: 24px;
    padding: 10px 22px;
    background: #0f172a;
    color: #fff;
    border: none;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    z-index: 9999;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .ds-button:hover {
    background: #1e293b;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }
  .ds-button:active {
    transform: translateY(0);
  }

  .ds-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.4);
    backdrop-filter: blur(2px);
    z-index: 100000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .ds-modal {
    background: #fff;
    border-radius: 12px;
    padding: 32px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 440px;
    max-width: 90vw;
  }

  .ds-modal-title {
    font-size: 18px;
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    color: #0f172a;
    margin: 0;
  }

  .ds-canvas {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: crosshair;
    touch-action: none;
    display: block;
    background: #f8fafc;
  }

  .ds-modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .ds-btn-clear, .ds-btn-cancel, .ds-btn-use {
    padding: 8px 18px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .ds-btn-clear, .ds-btn-cancel {
    border: 1px solid #e2e8f0;
    background: #fff;
    color: #475569;
  }
  .ds-btn-clear:hover, .ds-btn-cancel:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #1e293b;
  }

  .ds-btn-use {
    background: #0f172a;
    color: #fff;
    border: none;
  }
  .ds-btn-use:hover {
    background: #1e293b;
  }

  .ds-placement-overlay {
    position: absolute;
    inset: 0;
    z-index: 9998;
    overflow: hidden;
    pointer-events: none;
  }

  .ds-sig-box {
    position: absolute;
    border: 1px dashed #64748b;
    background: rgba(248, 250, 252, 0.4);
    cursor: move;
    pointer-events: all;
    box-sizing: border-box;
    min-width: 60px;
    min-height: 30px;
    transition: border-color 0.2s;
  }
  .ds-sig-box:hover {
    border-color: #0f172a;
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
    top: -40px;
    right: 0;
    display: flex;
    gap: 6px;
    background: #0f172a;
    padding: 4px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .ds-sig-delete, .ds-sig-confirm {
    border: none;
    border-radius: 4px;
    padding: 4px 10px;
    font-size: 12px;
    font-weight: 600;
    font-family: system-ui, -apple-system, sans-serif;
    cursor: pointer;
    pointer-events: all;
    transition: all 0.15s ease;
  }

  .ds-sig-delete {
    background: transparent;
    color: #fca5a5;
  }
  .ds-sig-delete:hover {
    background: #ef4444;
    color: #fff;
  }

  .ds-sig-confirm {
    background: #22c55e;
    color: #fff;
  }
  .ds-sig-confirm:hover {
    background: #16a34a;
  }

  .ds-resize-handle {
    position: absolute;
    width: 8px;
    height: 8px;
    background: #fff;
    border: 1.5px solid #0f172a;
    border-radius: 50%;
    pointer-events: all;
    box-sizing: border-box;
  }
  .ds-resize-se {
    bottom: -4px;
    right: -4px;
    cursor: se-resize;
  }
  .ds-resize-sw {
    bottom: -4px;
    left: -4px;
    cursor: sw-resize;
  }
  .ds-resize-ne {
    top: -4px;
    right: -4px;
    cursor: ne-resize;
  }
  .ds-resize-nw {
    top: -4px;
    left: -4px;
    cursor: nw-resize;
  }
`;
