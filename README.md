# Dice Game with Instruction Introspection

> **Turbin3 Q1 2026 - Final Assignment** - A provably fair dice game built on Solana using Anchor and instruction introspection for Ed25519 signature verification.

## Overview

This is one of the **final two assignments** for the Turbin3 Q1 2026 cohort. This project demonstrates advanced Solana concepts including **instruction introspection** - a technique to verify Ed25519 signatures within a program by inspecting instructions in the current transaction.

## How It Works

1. **House Initialization** - The house creates a vault account to hold funds for payouts
2. **Place Bet** - Players deposit SOL and predict a roll (1-100)
3. **Resolve Bet** - House resolves the bet using an Ed25519 signature
   - The signature is verified via **instruction introspection**
   - The signature hash determines the dice roll (1-100)
   - If player's prediction > actual roll, they win
4. **Refund** - Players can refund unresolved bets

### Instruction Introspection

The program uses the `anchor-instruction-sysvar` crate to inspect the Ed25519 instruction that must be included in the same transaction as the resolve instruction. This allows on-chain verification of the house's signature without passing it through program accounts.

## Features

- **Provably Fair** - Dice rolls derived from cryptographic signatures
- **Ed25519 Verification** - Signature validation via instruction introspection
- **House Edge** - 1.5% house edge (150 basis points)
- **Secure Betting** - PDA-based bet accounts prevent manipulation
- **Automatic Payouts** - Winners receive payouts immediately upon resolution

## Architecture

```
programs/
└── anchor-dice-game-q4-25/
    └── src/
        ├── lib.rs                    # Program entry point
        ├── state/
        │   └── mod.rs               # Bet account structure
        ├── instructions/
        │   ├── initialize.rs        # Vault initialization
        │   ├── place_bet.rs        # Bet placement
        │   ├── resolve_bet.rs      # Ed25519 verification & resolution
        │   └── refund_bet.rs       # Bet refunds
        └── errors.rs               # Custom error definitions
```

## Getting Started

### Prerequisites
- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.32.1
- Node.js 18+
- Yarn

### Installation

```bash
cd anchor-dice-game-starter-q4-25

# Install dependencies
yarn install

# Build the program
anchor build

# Run tests
anchor test
```

## Payout Calculation

Winning bets receive payouts based on the predicted roll and house edge:

```
payout = (bet_amount × (100 - house_edge%)) ÷ (predicted_roll - 1)
```

Example:
- Bet: 1 SOL
- Predicted Roll: 50
- Actual Roll: 30
- Payout: (1 × 98.5) ÷ 49 ≈ 2.01 SOL

## 📚 Resources

- [Instruction Introspection Guide](https://solanacookbook.com/references/programs.html#how-to-get-the-instruction-sysvar)
- [Anchor Framework Docs](https://www.anchor-lang.com/)
- [Turbin3 Program](https://www.turbin3.org/)
