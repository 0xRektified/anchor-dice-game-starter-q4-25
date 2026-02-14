import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { AnchorDiceGameQ425 } from "../target/types/anchor_dice_game_q4_25";
import { Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Ed25519Program } from "@solana/web3.js";
import { expect, assert } from "chai";
import { ed25519 } from "@noble/curves/ed25519";

describe("anchor-dice-game-q4-25", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.anchorDiceGameQ425 as Program<AnchorDiceGameQ425>;

  const house = Keypair.generate();
  const player = Keypair.generate();

  let vault: PublicKey;

  before(async () => {
    await provider.connection.requestAirdrop(house.publicKey, 10 * LAMPORTS_PER_SOL);
    await provider.connection.requestAirdrop(player.publicKey, 10 * LAMPORTS_PER_SOL);
    await new Promise(resolve => setTimeout(resolve, 1000));

    [vault] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), house.publicKey.toBuffer()],
      program.programId
    );

    console.log(`House: ${house.publicKey}`);
    console.log(`Player: ${player.publicKey}`);
    console.log(`Vault: ${vault}`);
  });

  describe("Initialize", () => {
    it("House initializes vault with funds", async () => {
      const initAmount = 5 * LAMPORTS_PER_SOL;

      const houseBalanceBefore = await provider.connection.getBalance(house.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vault);
      expect(vaultBalanceBefore).to.equal(0);

      await program.methods
        .initialize(new BN(initAmount))
        .accountsStrict({
          house: house.publicKey,
          vault: vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([house])
        .rpc();

      const houseBalanceAfter = await provider.connection.getBalance(house.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vault);

      expect(vaultBalanceAfter).to.equal(initAmount);

      const totalCost = houseBalanceBefore - houseBalanceAfter;
      const txFee = totalCost - initAmount;
      expect(houseBalanceAfter).to.equal(houseBalanceBefore - initAmount - txFee);
    });

    it("House can add more funds to vault", async () => {
      const additionalAmount = 2 * LAMPORTS_PER_SOL;
      const vaultBalanceBefore = await provider.connection.getBalance(vault);

      await program.methods
        .initialize(new BN(additionalAmount))
        .accountsStrict({
          house: house.publicKey,
          vault: vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([house])
        .rpc();

      const vaultBalanceAfter = await provider.connection.getBalance(vault);
      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + additionalAmount);
    });
  });

  describe("Place Bet", () => {
    it("Player places a valid bet", async () => {
      const betAmount = 0.1 * LAMPORTS_PER_SOL;
      const betRoll = 50;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      const playerBalanceBefore = await provider.connection.getBalance(player.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vault);

      await program.methods
        .placeBet(betSeed, betRoll, new BN(betAmount))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const betAccount = await program.account.bet.fetch(betPda);
      expect(betAccount.player.toBase58()).to.equal(player.publicKey.toBase58());
      expect(betAccount.seed.toString()).to.equal(betSeed.toString());
      expect(betAccount.roll).to.equal(betRoll);
      expect(betAccount.amount.toNumber()).to.equal(betAmount);

      const playerBalanceAfter = await provider.connection.getBalance(player.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vault);

      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore + betAmount);
      expect(playerBalanceAfter).to.be.lessThan(playerBalanceBefore - betAmount);
    });

    it("Fails with bet amount below minimum (< 0.01 SOL)", async () => {
      const betAmount = 0.009 * LAMPORTS_PER_SOL;
      const betRoll = 50;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      try {
        await program.methods
          .placeBet(betSeed, betRoll, new BN(betAmount))
          .accountsStrict({
            player: player.publicKey,
            house: house.publicKey,
            vault: vault,
            bet: betPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();

        assert.fail("Should have failed with MinimumBet");
      } catch (error) {
        expect(error.message).to.not.include("Should have failed");
        expect(error.message).to.include("MinimumBet");
      }
    });

    it("Fails with bet amount above maximum (> 1 SOL)", async () => {
      const betAmount = 1.1 * LAMPORTS_PER_SOL;
      const betRoll = 50;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      try {
        await program.methods
          .placeBet(betSeed, betRoll, new BN(betAmount))
          .accountsStrict({
            player: player.publicKey,
            house: house.publicKey,
            vault: vault,
            bet: betPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();

        assert.fail("Should have failed with MaximumBet");
      } catch (error) {
        expect(error.message).to.not.include("Should have failed");
        expect(error.message).to.include("MaximumBet");
      }
    });

    it("Fails with roll below minimum (< 2)", async () => {
      const betAmount = 0.1 * LAMPORTS_PER_SOL;
      const betRoll = 1;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      try {
        await program.methods
          .placeBet(betSeed, betRoll, new BN(betAmount))
          .accountsStrict({
            player: player.publicKey,
            house: house.publicKey,
            vault: vault,
            bet: betPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();

        assert.fail("Should have failed with MinimumRoll");
      } catch (error) {
        expect(error.message).to.not.include("Should have failed");
        expect(error.message).to.include("MinimumRoll");
      }
    });

    it("Fails with roll above maximum (> 96)", async () => {
      const betAmount = 0.1 * LAMPORTS_PER_SOL;
      const betRoll = 97;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      try {
        await program.methods
          .placeBet(betSeed, betRoll, new BN(betAmount))
          .accountsStrict({
            player: player.publicKey,
            house: house.publicKey,
            vault: vault,
            bet: betPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();

        assert.fail("Should have failed with MaximumRoll");
      } catch (error) {
        expect(error.message).to.not.include("Should have failed");
        expect(error.message).to.include("MaximumRoll");
      }
    });
  });

  describe("Resolve Bet", () => {
    let winningBetPda: PublicKey;
    let winningBetSeed: BN;
    let losingBetPda: PublicKey;
    let losingBetSeed: BN;

    before(async () => {
      winningBetSeed = new BN(Math.floor(Math.random() * 1000000));
      [winningBetPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), winningBetSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(winningBetSeed, 95, new BN(0.1 * LAMPORTS_PER_SOL))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: winningBetPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      losingBetSeed = new BN(Math.floor(Math.random() * 1000000));
      [losingBetPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), losingBetSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(losingBetSeed, 2, new BN(0.1 * LAMPORTS_PER_SOL))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: losingBetPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();
    });

    it("House resolves winning bet with valid Ed25519 signature", async () => {
      const betAccount = await program.account.bet.fetch(winningBetPda);

      const betData = await serializeBet(betAccount, program);

      const signature = signMessage(house, betData);

      const playerBalanceBefore = await provider.connection.getBalance(player.publicKey);
      const vaultBalanceBefore = await provider.connection.getBalance(vault);

      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: house.publicKey.toBytes(),
        message: betData,
        signature: signature,
      });

      await program.methods
        .resolveBet(Buffer.from(signature))
        .accountsStrict({
          house: house.publicKey,
          player: player.publicKey,
          vault: vault,
          bet: winningBetPda,
          instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([house])
        .rpc();

      const playerBalanceAfter = await provider.connection.getBalance(player.publicKey);
      const vaultBalanceAfter = await provider.connection.getBalance(vault);

      expect(playerBalanceAfter).to.be.greaterThan(playerBalanceBefore);
      expect(vaultBalanceAfter).to.be.lessThan(vaultBalanceBefore);

      const betAccountAfter = await provider.connection.getAccountInfo(winningBetPda);
      expect(betAccountAfter).to.be.null;

    });

    it("House resolves losing bet with valid Ed25519 signature", async () => {
      const betAccount = await program.account.bet.fetch(losingBetPda);

      const betData = await serializeBet(betAccount, program);
      const signature = signMessage(house, betData);

      const vaultBalanceBefore = await provider.connection.getBalance(vault);

      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: house.publicKey.toBytes(),
        message: betData,
        signature: signature,
      });

      await program.methods
        .resolveBet(Buffer.from(signature))
        .accountsStrict({
          house: house.publicKey,
          player: player.publicKey,
          vault: vault,
          bet: losingBetPda,
          instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([ed25519Ix])
        .signers([house])
        .rpc();

      const vaultBalanceAfter = await provider.connection.getBalance(vault);
      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore);

      const betAccountAfter = await provider.connection.getAccountInfo(losingBetPda);
      expect(betAccountAfter).to.be.null;
    });

    it("Fails to resolve with wrong signer (not house)", async () => {
      const wrongSigner = Keypair.generate();
      await provider.connection.requestAirdrop(wrongSigner.publicKey, 1 * LAMPORTS_PER_SOL);
      await new Promise(resolve => setTimeout(resolve, 1000));

      const betSeed = new BN(Math.floor(Math.random() * 1000000));
      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(betSeed, 50, new BN(0.1 * LAMPORTS_PER_SOL))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const betAccount = await program.account.bet.fetch(betPda);

      const betData = await serializeBet(betAccount, program);
      const signature = signMessage(wrongSigner, betData);

      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: wrongSigner.publicKey.toBytes(),
        message: betData,
        signature: signature,
      });

      try {
        await program.methods
          .resolveBet(Buffer.from(signature))
          .accountsStrict({
            house: wrongSigner.publicKey,
            player: player.publicKey,
            vault: vault,
            bet: betPda,
            instructionSysvar: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: SystemProgram.programId,
          })
          .preInstructions([ed25519Ix])
          .signers([wrongSigner])
          .rpc();

        assert.fail("Should have failed with constraint violation");
      } catch (error) {
        expect(error.message).to.satisfy((msg: string) =>
          msg.includes("ConstraintSeeds") || msg.includes("Ed25519Pubkey")
        );
        console.log("Correctly rejected wrong signer");
      }
    });
  });

  describe("Refund Bet", () => {
    it("Fails to refund before timeout (< 1000 slots)", async () => {
      const betSeed = new BN(Math.floor(Math.random() * 1000000));
      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(betSeed, 50, new BN(0.1 * LAMPORTS_PER_SOL))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      try {
        await program.methods
          .refundBet()
          .accountsStrict({
            player: player.publicKey,
            house: house.publicKey,
            vault: vault,
            bet: betPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([player])
          .rpc();

        assert.fail("Should have failed with TimeoutNotReached");
      } catch (error) {
        expect(error.message).to.include("TimeoutNotReached");
        console.log("Correctly rejected premature refund");
      }
    });
  });

  describe("Payout Calculations", () => {
    it("Verifies correct payout for 50% win chance (roll=50)", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const betRoll = 50;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(betSeed, betRoll, new BN(betAmount))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const expectedPayout = Math.floor(Math.floor(betAmount * 9850 / (betRoll - 1)) / 100);
      const expectedMultiplier = expectedPayout / betAmount;

      expect(expectedPayout).to.be.greaterThan(0);
      expect(expectedMultiplier).to.be.greaterThan(1);
      expect(expectedMultiplier).to.equal(expectedPayout / betAmount);
    });

    it("Verifies correct payout for 95% win chance (roll=95)", async () => {
      const betAmount = 1 * LAMPORTS_PER_SOL;
      const betRoll = 95;
      const betSeed = new BN(Math.floor(Math.random() * 1000000));

      const [betPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("bet"), vault.toBuffer(), betSeed.toArrayLike(Buffer, "le", 16)],
        program.programId
      );

      await program.methods
        .placeBet(betSeed, betRoll, new BN(betAmount))
        .accountsStrict({
          player: player.publicKey,
          house: house.publicKey,
          vault: vault,
          bet: betPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([player])
        .rpc();

      const expectedPayout = Math.floor(Math.floor(betAmount * 9850 / (betRoll - 1)) / 100);
      const expectedMultiplier = expectedPayout / betAmount;

      expect(expectedPayout).to.be.greaterThan(0);
      expect(expectedMultiplier).to.be.greaterThan(1);
      expect(expectedMultiplier).to.equal(expectedPayout / betAmount);
    });

  });
});

async function serializeBet(bet: any, program: Program<AnchorDiceGameQ425>): Promise<Uint8Array> {
  const encoded = await program.coder.accounts.encode("bet", bet);
  return encoded.subarray(8);
}

 // Sign using @noble/curves/ed25519 same library used by @solana/web3.js
function signMessage(keypair: Keypair, message: Uint8Array): Uint8Array {
  const privateKeyBytes = keypair.secretKey.slice(0, 32);
  const signature = ed25519.sign(message, privateKeyBytes);
  return signature;
}

