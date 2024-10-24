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

;; Governance
(define-data-var min-stake uint u10000) ;; Minimum STX required to become an oracle
(define-data-var subscription-fee uint u100) ;; Monthly fee in STX
(define-data-var owner principal tx-sender)

;; Read-only functions
(define-read-only (get-subscription (subscriber principal))
    (map-get? subscriptions {subscriber: subscriber})
)

(define-read-only (get-oracle (oracle-id uint))
    (map-get? oracles {oracle-id: oracle-id})
)

(define-read-only (get-latest-data (oracle-id uint))
    (map-get? data-feeds {
        oracle-id: oracle-id,
        timestamp: (get-block-info? time u0)
    })
)
