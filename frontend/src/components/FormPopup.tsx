import { type ReactNode, useEffect } from "react";

type FormPopupProps = {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onRequestClose: () => void;
  onMinimize: () => void;
  children: ReactNode;
};

export function FormPopup({
  isOpen,
  title,
  subtitle,
  onRequestClose,
  onMinimize,
  children,
}: FormPopupProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="future-modal form-popup"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <article
        className="future-modal__content form-popup__content"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="form-popup__header">
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
          <div className="form-popup__controls">
            <button
              type="button"
              className="btn btn-tertiary"
              onClick={onMinimize}
            >
              Minimizar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onRequestClose}
            >
              Cerrar
            </button>
          </div>
        </header>
        {children}
      </article>
    </div>
  );
}
