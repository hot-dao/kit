import { observer } from "mobx-react-lite";
import { action, makeObservable, observable } from "mobx";
import { createRoot } from "react-dom/client";
import styled from "styled-components";
import uuid4 from "uuid4";

import { PSmall } from "../uikit/text";

export interface ToastConfig {
  id: string;
  message: string;
  type: "success" | "failed" | "pending";
  progressText?: string;
  progress?: number;
  duration?: number;
}

export interface ToastController extends ToastConfig {
  timer: NodeJS.Timeout | null;
  update: (config: Partial<ToastConfig>) => void;
  dismiss: () => void;
}

export class ToastManager {
  root: HTMLDivElement | null = null;
  toasts: ToastController[] = [];

  constructor() {
    makeObservable(this, {
      toasts: observable,
      present: action,
      dismiss: action,
      update: action,
      mount: action,
      unmount: action,
      pending: action,
      success: action,
      failed: action,
    });
  }

  mount() {
    if (document.getElementById("toast-root")) return;
    if (this.root) return;

    const root = document.createElement("div");
    root.id = "toast-root";
    document.body.appendChild(root);
    createRoot(root).render(<ToastProvider manager={this} />);
    this.root = root;
  }

  unmount() {
    if (!this.root) return;
    this.root.remove();
    this.root = null;
  }

  pending(message: string) {
    return this.present({ message, type: "pending", duration: Infinity });
  }

  success(message: string) {
    return this.present({ message, type: "success" });
  }

  failed(message: string) {
    return this.present({ message, type: "failed" });
  }

  present(config: Omit<ToastConfig, "id">) {
    this.mount();
    const id = uuid4();
    let timer: NodeJS.Timeout | null = null;

    if (config.duration !== Infinity) {
      timer = setTimeout(() => this.dismiss(id), config.duration || 3000);
    }

    const toast: ToastController & { timer: NodeJS.Timeout | null; update: (config: Partial<ToastConfig>) => void; dismiss: () => void } = {
      update: (config: Partial<ToastConfig>) => this.update(id, config),
      dismiss: () => this.dismiss(id),
      progressText: config.progressText,
      message: config.message,
      type: config.type,
      timer: timer,
      id,
    };

    this.toasts.unshift(toast);
    return toast;
  }

  update(id: string, config: Partial<Omit<ToastConfig, "id">>) {
    const toast = this.toasts.find((toast) => toast.id === id);
    if (!toast) return;

    toast.message = config.message || toast.message;
    toast.duration = config.duration || toast.duration;
    toast.progress = config.progress || toast.progress;
    toast.progressText = config.progressText || toast.progressText;
    toast.type = config.type || toast.type;

    if (config.duration) {
      if (toast.timer) clearTimeout(toast.timer);
      if (config.duration === Infinity) toast.timer = null;
      else toast.timer = setTimeout(() => this.dismiss(id), config.duration);
    }
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((toast) => toast.id !== id);
  }
}

const ToastProvider = observer(({ manager }: { manager: ToastManager }) => {
  return (
    <Root>
      {manager.toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </Root>
  );
});

const Toast = observer(({ toast }: { toast: ToastController }) => {
  return (
    <Container onClick={() => toast.dismiss()} $type={toast.type}>
      <ToastHeader>
        {toast.type === "success" && <SuccessIcon />}
        {toast.type === "failed" && <ErrorIcon />}
        {toast.type === "pending" && <CircleLoader />}
        <PSmall style={{ color: "#fff", fontWeight: "bold" }}>{toast.message}</PSmall>
      </ToastHeader>

      {toast.progressText && (
        <ToastContent>
          <PSmall>{toast.progressText}</PSmall>
        </ToastContent>
      )}
    </Container>
  );
});

const SuccessIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.7434 2.00439C17.2643 1.86277 21.8544 6.22285 21.9963 11.7437C22.138 17.2647 17.7771 21.8559 12.2561 21.9976C6.73539 22.139 2.14498 17.7781 2.00317 12.2573C1.86153 6.7364 6.22251 2.1462 11.7434 2.00439ZM18.0481 8.31299C17.7633 8.01235 17.2883 7.99898 16.9875 8.28369L10.5208 14.4097L7.00024 11.2095C6.69387 10.931 6.21934 10.9531 5.94067 11.2593C5.6623 11.5657 5.68436 12.0402 5.99048 12.3188L10.0276 15.9888L10.5422 16.4565L11.0471 15.978L18.0198 9.37354C18.3204 9.08874 18.3327 8.61369 18.0481 8.31299Z"
      fill="#00DE93"
    />
  </svg>
);

const ErrorIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M11.7424 2.00537C17.2633 1.86369 21.8534 6.22385 21.9954 11.7446C22.1368 17.2655 17.776 21.8569 12.2551 21.9985C6.73479 22.1396 2.14419 17.7787 2.0022 12.2583C1.86056 6.73754 6.22177 2.14744 11.7424 2.00537ZM12.0002 14.2505C11.586 14.2505 11.2502 14.5863 11.2502 15.0005V15.5005C11.2504 15.9146 11.5861 16.2505 12.0002 16.2505C12.4142 16.2503 12.7501 15.9145 12.7502 15.5005V15.0005C12.7502 14.5864 12.4143 14.2506 12.0002 14.2505ZM12.0002 7.25049C11.586 7.25049 11.2502 7.58627 11.2502 8.00049V13.0005C11.2504 13.4146 11.5861 13.7505 12.0002 13.7505C12.4142 13.7503 12.7501 13.4145 12.7502 13.0005V8.00049C12.7502 7.58637 12.4143 7.25065 12.0002 7.25049Z"
      fill="#F34747"
    />
  </svg>
);

const CircleLoader = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" stroke="#FDBF1E" strokeWidth="3" fill="none" strokeLinecap="round" strokeDasharray="40" strokeDashoffset="0">
      <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
    </circle>
  </svg>
);

const Root = styled.div`
  position: fixed;
  bottom: 48px;
  left: 12px;
  right: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1000000000;
`;

const ToastContent = styled.div`
  display: flex;
  flex-direction: column;
  background: var(--surface-container, #1f1f1f);
  padding: 8px 12px;
  gap: 4px;
`;

const ToastHeader = styled.div`
  display: flex;
  padding: 12px;
  align-items: center;
  padding: 12px;
  gap: 12px;
`;

const Container = styled.div<{ $type: "success" | "failed" | "pending" }>`
  border-radius: var(--border-radius-16, 16px);
  border: 1px solid var(--border-border-default, #323232);
  background: var(--surface-container-high, #272727);
  box-shadow: -6px 6px 16px 0 rgba(0, 0, 0, 0.6);
  overflow: hidden;
  position: relative;

  cursor: pointer;
  width: 320px;

  &::before {
    content: "";
    border-radius: 292px;
    background: ${(props) => (props.$type === "success" ? "rgba(0, 222, 147, 0.08)" : props.$type === "failed" ? "rgba(243, 71, 71, 0.08)" : "rgba(253, 191, 30, 0.08)")};
    filter: blur(14px);
    position: absolute;
    right: 33px;
    top: -15px;
    width: 292px;
    height: 33px;
  }

  &:hover {
    transform: scale(1.02);
  }

  animation: fadeIn 0.3s ease-in-out;
  transition: 0.2s transform;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
