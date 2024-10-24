;; data-oracle.clar
;; Main contract for managing subscriptions and data feeds

(define-constant ERR_UNAUTHORIZED (err u100))
(define-constant ERR_INVALID_SUBSCRIPTION (err u101))
(define-constant ERR_INVALID_ORACLE (err u102))
(define-constant ERR_INSUFFICIENT_PAYMENT (err u103))

;; Data structures
(define-map subscriptions
    { subscriber: principal }
    {
        active: bool,
        expiration: uint,
        subscription-type: (string-utf8 10)
    }
)
