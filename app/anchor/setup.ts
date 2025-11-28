import { Program, Idl, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./xstock_idl.json";

export const programId = new PublicKey("9VRMEYvEiKPeGz9N8wVQjvT5qpqcHqNqd31kSYZhop2s");

export const getProgram = (connection: Connection, wallet: any) => {
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    // @ts-ignore
    idl.address = programId.toBase58();
    // @ts-ignore
    return new Program(idl as Idl, provider);
};
