# DropSign v0.3 — Trackpad Fix & `afterConfirm` Persist Mode

**Date:** 2026-05-08  
**Status:** Approved

---

## Problem

### 1. Trackpad (MacBook) — 캔버스에 서명 불가

`signature_pad` 라이브러리는 Pointer Events API를 사용한다. CSS 클래스로 `touch-action: none`을 설정해도, 일부 브라우저(Safari, 구버전 Chrome)는 첫 번째 포인터 이벤트 발생 시점에 이 CSS를 아직 반영하지 못해 트랙패드 제스처를 스크롤로 처리한다. 그 결과 캔버스에 획이 그려지지 않는다.

### 2. Confirm 후 서명이 사라짐 — 개발자 활용도 제한

현재 `captureResult()`는 서명 `<img>`를 DOM에 임시 주입 → PNG 합성 → 즉시 제거하는 방식이다. 결과물이 `imageBlob` 하나뿐이라 개발자가 인쇄, PDF 삽입, 자체 렌더링 등을 하려면 매번 PNG를 다시 파싱해야 한다.

---

## Solution

### Fix 1 — 인라인 `touch-action` 설정

`signature-pad.ts`에서 canvas 엘리먼트 생성 직후, `SignaturePad` 초기화 전에 인라인 스타일을 추가한다.

```ts
canvas.style.touchAction = 'none';
```

CSS 클래스(`.ds-canvas { touch-action: none }`)는 유지하되, 인라인 스타일로도 명시해 브라우저가 첫 이벤트 전에 반드시 반영하도록 강제한다.

**변경 파일:** `src/signature-pad.ts` (1줄 추가)

---

### Fix 2 — `afterConfirm` 옵션

#### API 변경

**`DropSignOptions` 신규 필드:**

```ts
afterConfirm?: 'persist' | 'capture' | 'both';
// 기본값: 'persist'
```

**`DropSignResult` 변경:**

```ts
export interface DropSignResult {
  signatureBlob: Blob;        // 항상 존재
  signatureDataUrl: string;   // 항상 존재
  placement: SignaturePlacement; // 항상 존재

  imageBlob?: Blob;           // 'capture' | 'both'일 때만
  persistedEl?: HTMLElement;  // 'persist' | 'both'일 때만
  removePersisted?: () => void; // 'persist' | 'both'일 때만
}
```

#### 모드별 동작

| 모드 | DOM img 유지 | PNG 합성 | 결과 필드 |
|---|---|---|---|
| `'persist'` **(기본)** | ✅ | ❌ | `persistedEl`, `removePersisted`, `placement`, `signatureBlob`, `signatureDataUrl` |
| `'capture'` | ❌ | ✅ | `imageBlob`, `placement`, `signatureBlob`, `signatureDataUrl` |
| `'both'` | ✅ | ✅ | 전부 |

#### `'persist'` 모드 세부 동작

1. Confirm 시 placement 좌표 그대로 `<img>`를 `targetEl` 안에 `position: absolute`로 주입한다.
2. 오버레이(dashed border, 버튼)는 제거하되, 서명 img는 남긴다.
3. `DropSignResult.persistedEl`로 해당 엘리먼트를 노출한다.
4. `removePersisted()` 호출 시 img를 DOM에서 제거한다.
5. `DropSign` 위젯의 `destroy()` 호출 시 persisted img는 **제거하지 않는다** — 개발자가 명시적으로 `removePersisted()`를 호출해야 한다.

#### 개발자 활용 예시

```ts
DropSign.init({
  target: '#contract',
  afterConfirm: 'persist',   // 기본값이므로 생략 가능
  onComplete: ({ persistedEl, removePersisted, placement, signatureDataUrl }) => {
    // 인쇄: 서명이 그 위치에 그대로 출력됨
    window.print();

    // 또는 pdf-lib으로 placement 좌표 사용
    await embedSignatureInPdf(pdfDoc, { placement, signatureDataUrl });

    // 완료 후 제거
    removePersisted();
  }
});

// 'capture' 모드 (기존 동작)
DropSign.init({
  target: '#contract',
  afterConfirm: 'capture',
  onComplete: ({ imageBlob }) => {
    upload(imageBlob);
  }
});
```

---

## Breaking Changes

- `DropSignResult.imageBlob`이 `Blob`에서 `Blob | undefined`(optional)로 변경됨.
  - 기존에 `afterConfirm`을 명시하지 않은 코드는 이제 기본값이 `'persist'`이므로 `imageBlob`이 `undefined`가 됨.
  - 기존 동작을 유지하려면 `afterConfirm: 'capture'`를 명시해야 함.
- 버전 범프: **v0.2 → v0.3**

---

## Files to Change

| 파일 | 변경 내용 |
|---|---|
| `src/types.ts` | `DropSignOptions`에 `afterConfirm` 추가, `DropSignResult` 필드 optional 처리 |
| `src/signature-pad.ts` | `canvas.style.touchAction = 'none'` 1줄 추가 |
| `src/capture.ts` | `persistResult()` 함수 추가 (persist 모드용), `captureResult()` 유지 |
| `src/DropSign.ts` | `afterConfirm` 분기 처리, `onComplete`에 결과 전달 |
| `src/DropSign.test.ts` | 신규 모드별 테스트 추가 |
