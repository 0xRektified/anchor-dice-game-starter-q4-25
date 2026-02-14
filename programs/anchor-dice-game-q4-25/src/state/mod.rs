use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bet {
    pub player: Pubkey,
    pub seed: u128,
    pub slot: u64,
    pub amount: u64,
    pub roll: u8,
    pub bump : u8
}

impl Bet {
    pub fn to_slice(&self) -> Vec<u8> {
        self.try_to_vec().unwrap()
    }
}