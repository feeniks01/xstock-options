import { Program, Idl } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl.json";

export const programId = new PublicKey("Hc2qWi4vf3zng35gyucQNfZVi6ik7kkgwg3NonMsLcFJ");

export const getProgram = (connection: Connection, wallet: any) => {
    const provider = {
        connection,
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
    };
    // @ts-ignore
    return new Program(idl as Idl, programId, provider);
};
