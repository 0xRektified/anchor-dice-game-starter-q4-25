use anchor_lang::{prelude::*};
use crate::state::Bet;

#[derive(Accounts)]
pub struct ResolveBet<'info>{
    // TODO
    #[account(mut)]
    pub player: Signer<'info>,
}

impl<'info> ResolveBet<'info> {
    pub fn verify_ed25519_signature(&mut self, sig: &Vec<u8>) -> Result<()> {
        // TODO
        Ok(())
    }

    pub fn resolve_bet(&mut self, bumps: &ResolveBetBumps, sig: &Vec<u8>) -> Result<()> {
        // TODO
        Ok(())
    }
}