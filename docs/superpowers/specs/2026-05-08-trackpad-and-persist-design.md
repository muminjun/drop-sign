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
// 기본값: 'capture' (하위 호환성 유지)
```

**`DropSignResult` — discriminated union으로 변경:**

```ts
interface DropSignResultBase {
  signatureBlob: Blob;
  signatureDataUrl: string;
  placement: SignaturePlacement;
}

interface PersistResult extends DropSignResultBase {
  afterConfirm: 'persist';
  persistedEl: HTMLElement;
  removePersisted: () => void;
}

interface CaptureResult extends DropSignResultBase {
  afterConfirm: 'capture';
  imageBlob: Blob;
}

interface BothResult extends DropSignResultBase {
  afterConfirm: 'both';
  imageBlob: Blob;
  persistedEl: HTMLElement;
  removePersisted: () => void;
}

export type DropSignResult = PersistResult | CaptureResult | BothResult;
```

`afterConfirm` discriminant 필드가 있으므로 strict TypeScript 환경에서 `if (result.afterConfirm === 'capture')` 한 줄로 타입이 좁혀진다. optional 필드에 대한 불필요한 null check 불필요.

#### 모드별 동작

| 모드 | DOM img 유지 | PNG 합성 | 결과 필드 |
|---|---|---|---|
| `'persist'` | ✅ | ❌ | `persistedEl`, `removePersisted`, `placement`, `signatureBlob`, `signatureDataUrl` |
| `'capture'` **(기본)** | ❌ | ✅ | `imageBlob`, `placement`, `signatureBlob`, `signatureDataUrl` |
| `'both'` | ✅ | ✅ | 전부 |

#### `'persist'` 모드 세부 동작

1. Confirm 시 placement 좌표 그대로 `<img>`를 `targetEl` 안에 `position: absolute`로 주입한다.
2. 오버레이(dashed border, 버튼)는 제거하되, 서명 img는 남긴다.
3. `DropSignResult.persistedEl`로 해당 엘리먼트를 노출한다.
4. `removePersisted()` 호출 시 img를 DOM에서 제거하고, `targetEl`의 `position`이 DropSign에 의해 변경된 경우 원래 값으로 복원한다.
5. `DropSign` 위젯의 `destroy()` 호출 시 persisted img는 **제거하지 않는다** — 개발자가 명시적으로 `removePersisted()`를 호출해야 한다.
6. `destroy()`는 persisted img가 DOM에 남아있는 동안 `targetEl.style.position`을 복원하지 않는다 — position 복원은 `removePersisted()`에 위임한다. 이렇게 해야 `position: absolute`인 img의 containing block이 유지된다.

#### 개발자 활용 예시

```ts
DropSign.init({
  target: '#contract',
  afterConfirm: 'persist',   // 명시 필요
  onComplete: async ({ persistedEl, removePersisted, placement, signatureDataUrl }) => {
    // 인쇄: 서명이 그 위치에 그대로 출력됨
    window.print();

    // 또는 pdf-lib으로 placement 좌표 사용
    await embedSignatureInPdf(pdfDoc, { placement, signatureDataUrl });

    // 완료 후 제거 (targetEl position도 함께 복원됨)
    removePersisted();
  }
});

// 'capture' 모드 — 기본값이므로 afterConfirm 생략 가능 (기존 동작과 동일)
DropSign.init({
  target: '#contract',
  onComplete: ({ imageBlob }) => {
    upload(imageBlob);
  }
});
```

---

## Breaking Changes

- `DropSignResult`가 단일 interface에서 discriminated union(`PersistResult | CaptureResult | BothResult`)으로 변경됨.
  - 기존에 `result.imageBlob`을 직접 접근하던 코드는 `result.afterConfirm === 'capture'` 또는 `result.afterConfirm === 'both'` 조건 분기 필요.
  - 기본값은 `'capture'`이므로 `afterConfirm`을 생략한 기존 코드는 런타임 동작이 유지됨. TypeScript 타입만 업데이트 필요.
- 버전 범프: **v0.2 → v0.3**

## Error Handling for Persist Mode

`'persist'` 또는 `'both'` 모드에서 async 작업(`dataUrlToBlob`, `captureResult`)이 실패할 경우:
- DOM 변경(`persistResult()` 호출)은 모든 async 작업이 완료된 **이후**에 수행한다.
- 이렇게 하면 에러 시 `persistResult()`가 호출되지 않으므로 img가 DOM에 누수되지 않는다.
- `'both'` 모드는 `captureResult()` 먼저, `persistResult()` 나중에 — PNG에 서명이 두 번 찍히는 것을 방지.

---

## Files to Change

| 파일 | 변경 내용 |
|---|---|
| `src/types.ts` | `DropSignOptions`에 `afterConfirm` 추가, `DropSignResult`를 discriminated union으로 교체 |
| `src/signature-pad.ts` | `canvas.style.touchAction = 'none'` 1줄 추가 |
| `src/capture.ts` | `persistResult()` 함수 추가 (persist 모드용), `captureResult()` 유지 |
| `src/DropSign.ts` | `afterConfirm` 분기 처리, `onComplete`에 결과 전달 |
| `src/DropSign.test.ts` | 신규 모드별 테스트 추가 |
