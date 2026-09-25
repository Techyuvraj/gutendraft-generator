import React, { useEffect, useRef } from 'react';

/**
 * In-app replacement for window.confirm. Built on <dialog>, whose modal mode
 * already gives the top layer, a focus trap and Escape-to-cancel for free.
 */
const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    busy = false,
    onConfirm,
    onCancel,
}) => {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) {
            dialog.showModal();
            // Start on the safe choice, so Enter never deletes by accident.
            cancelRef.current?.focus();
        } else if (!open && dialog.open) {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            className="confirm-dialog"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            // Escape fires "cancel"; route it through our state instead of
            // letting the element close itself out from under React.
            onCancel={(e) => {
                e.preventDefault();
                if (!busy) onCancel();
            }}
            // A click on the backdrop lands on the <dialog> element itself.
            onClick={(e) => {
                if (e.target === dialogRef.current && !busy) onCancel();
            }}
        >
            <div className="confirm-dialog-body">
                <h2 id="confirm-dialog-title" className="confirm-dialog-title">{title}</h2>
                <p id="confirm-dialog-message" className="confirm-dialog-message">{message}</p>
                <div className="confirm-dialog-actions">
                    <button
                        ref={cancelRef}
                        type="button"
                        className="btn-icon confirm-dialog-cancel"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className={`btn-primary confirm-dialog-confirm ${danger ? 'danger' : ''}`}
                        onClick={onConfirm}
                        disabled={busy}
                    >
                        {busy ? 'Please wait…' : confirmLabel}
                    </button>
                </div>
            </div>
        </dialog>
    );
};

export default ConfirmDialog;
