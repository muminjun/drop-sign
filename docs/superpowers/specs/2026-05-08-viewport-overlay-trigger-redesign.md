# DropSign v0.4 — Viewport Overlay & Trigger Redesign

## Overview

DropSign을 "배치 UI 레이어"로 재정의한다. SDK의 역할은 사용자가 서명을 어디에 놓을지 결정하는 UI를 제공하는 것이며, PNG 캡처는 SDK 책임에서 제거된다. 개발자는 `placement` 정규화 좌표를 받아 PDF 스탬핑, 커스텀 렌더링 등 자신의 파이프라인에서 처리한다.

## 1. Public API / Types

### `DropSignTrigger`

기존 `floating` / `inline` / `custom` 3종 → 2종으로 통합:

```ts
type DropSignTrigger =
  | {
      type: 'global';
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'; // default: bottom-right
      label?: string;
    }
  | {
      type: 'custom';
      element: string | HTMLElement;
    };
```

- **`global`**: `position: fixed` 버튼. 뷰포트에 항상 떠 있으며 서비스 어디서든 접근 가능. 기존 `floating` + `positionAnchor: 'viewport'` 역할.
- **`custom`**: 개발자가 요소를 제공하면 SDK가 클릭 핸들러를 붙인다. 기존 `inline` / `floating(target)` / `custom` 세 가지를 모두 대체.
- trigger 미지정 시 default: `global`, `bottom-right`.

### `NormalizedPlacement`

모든 좌표는 0–1 비율:

```ts
interface NormalizedPlacement {
  x: number;      // 기준 너비 대비 left 위치
  y: number;      // 기준 높이 대비 top 위치
  width: number;  // 기준 너비 대비 박스 너비
  height: number; // 기준 높이 대비 박스 높이
}
```

좌표 기준: `target` 제공 시 target 기준, 없으면 뷰포트 기준.

PDF 예시: `x * pdfPage.width`, `y * pdfPage.height` — 변환 없이 바로 사용 가능.

### `DropSignResult`

```ts
interface DropSignResult {
  signatureDataUrl: string;
  signatureBlob: Blob;
  placement: NormalizedPlacement;
}
```

캡처 관련 필드(`imageBlob`) 제거.

### `DropSignOptions`

```ts
interface DropSignOptions {
  target?: DropSignTarget;              // 좌표 기준 요소 (optional)
  trigger?: DropSignTrigger;            // default: global bottom-right
  messages?: DropSignMessages;
  signature?: DropSignSignatureOptions;
  onComplete?: (result: DropSignResult) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}
```

제거된 옵션: `capture`, `afterConfirm`, `classNamePrefix`, `buttonText`.

`target`은 더 이상 캡처 대상이 아니라 좌표 정규화의 기준 요소다. optional이며, 없으면 뷰포트 기준 좌표를 반환한다.

## 2. Overlay & Placement

### 오버레이

기존: `targetEl` 내부에 `position: absolute; inset: 0` 으로 마운트.

변경: `document.body`에 `position: fixed; inset: 0` 으로 마운트. 뷰포트 전체를 덮는다.

```ts
el.style.position = 'fixed';
el.style.inset = '0';
// overflow: hidden 제거
document.body.appendChild(el);
```

### 드래그 / 리사이즈 경계

기존: `container.getBoundingClientRect()` (= `targetEl` 범위) 로 클램핑.

변경: `window.innerWidth` / `window.innerHeight` 로 클램핑. 서명 박스를 뷰포트 어디든 이동 가능.

### `getPlacement()` 좌표 계산

```ts
function getPlacement(): NormalizedPlacement {
  const boxLeft = parseFloat(box.style.left);
  const boxTop  = parseFloat(box.style.top);

  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    return {
      x:      (boxLeft - rect.left) / rect.width,
      y:      (boxTop  - rect.top)  / rect.height,
      width:  parseFloat(box.style.width)  / rect.width,
      height: parseFloat(box.style.height) / rect.height,
    };
  }

  return {
    x:      boxLeft / window.innerWidth,
    y:      boxTop  / window.innerHeight,
    width:  parseFloat(box.style.width)  / window.innerWidth,
    height: parseFloat(box.style.height) / window.innerHeight,
  };
}
```

## 3. 모듈 변경 사항

### 제거

- `capture.ts` — 전체 삭제
- `types.ts`: `PersistResult`, `CaptureResult`, `BothResult`, `SignaturePlacement` 삭제
- `DropSignOptions`: `capture`, `afterConfirm`, `classNamePrefix`, `buttonText` 제거
- `index.ts`: 캡처 관련 export 제거

### 변경

| 파일 | 변경 내용 |
|------|-----------|
| `overlay.ts` | `document.body` 마운트, `position: fixed`, `overflow: hidden` 제거 |
| `placement.ts` | 드래그 경계 → 뷰포트 기준, `getPlacement()` → `NormalizedPlacement` 반환, `targetEl` optional |
| `trigger.ts` | `floating` → `global` rename, `inline` 제거, `custom`은 element 제공 방식만 유지 |
| `types.ts` | 새 타입으로 교체 |
| `DropSign.ts` | `captureResult` 호출 제거, `onComplete`에 `DropSignResult` 직접 전달 |
| `styles.ts` | 캡처 관련 CSS 제거 |

### 유지

- `signature-pad.ts` — 변경 없음
- `messages.ts` — 변경 없음

## 4. 테스트

- `DropSign.test.ts`: `html-to-image` mock 및 캡처 관련 assertion 제거
- `placement` 좌표가 0–1 범위 내인지 검증하는 케이스 추가
- `target` 없는 경우 뷰포트 기준 좌표 반환 검증
- `global` / `custom` 트리거 동작 테스트
