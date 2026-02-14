use anchor_lang::{prelude::*};
use anchor_instruction_sysvar::Ed25519InstructionSignatures;
use solana_program::{ed25519_program, example_mocks::solana_sdk::signature, sysvar::instructions::load_instruction_at_checked};
use crate::{errors::DiceError, state::Bet};

#[derive(Accounts)]
pub struct ResolveBet<'info>{
    #[account(mut)]
    pub house: Signer<'info>,

    /// CHECK: no need account check
    #[account(mut)]
    pub player: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault", house.key().as_ref()],
        bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        mut,
        has_one = player,
        close = player,
        seeds = [b"bet", vault.key().as_ref(), bet.seed.to_le_bytes().as_ref()],
        bump = bet.bump
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: no need account check
    #[account(
        address = solana_program::sysvar::instructions::ID
    )]
    pub instruction_sysvar: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ResolveBet<'info> {
    pub fn verify_ed25519_signature(&mut self, sig: &[u8]) -> Result<()> {
        let ix = load_instruction_at_checked(
            0,
            &self.instruction_sysvar.to_account_info(),
        ).map_err(|_| DiceError::Ed25519Program)?;
        require_eq!(ix.program_id, ed25519_program::ID, DiceError::Ed25519Program);
        require_eq!(ix.accounts.len(), 0, DiceError::Ed25519Accounts);
        let signatures = Ed25519InstructionSignatures::unpack(
            &ix.data
        ).map_err(|_| DiceError::Ed25519Signature)?.0;

        require_eq!(signatures.len(), 1, DiceError::Ed25519Signature);

        let signature = &signatures[0];
        require!(signature.is_verifiable, DiceError::Ed25519Header);

        require_keys_eq!(
            signature.public_key.ok_or(DiceError::Ed25519Pubkey)?,
            self.house.key(),
            DiceError::Ed25519Pubkey
        );

        require!(
            &signature.signature.ok_or(DiceError::Ed25519Signature)?.eq(sig),
            DiceError::Ed25519Signature
        );

        Ok(())
    }

    pub fn resolve_bet(&mut self, bumps: &ResolveBetBumps, sig: &[u8]) -> Result<()> {
        Ok(())
    }
}