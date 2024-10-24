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

(define-map oracles
    { oracle-id: uint }
    {
        provider: principal,
        data-type: (string-utf8 20),
        votes: uint,
        active: bool,
        stake: uint
    }
)

(define-map data-feeds
    { oracle-id: uint, timestamp: uint }
    {
        value: (string-utf8 50),
        provider: principal,
        verified: bool
    }
)

