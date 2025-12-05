import { Program, Idl, AnchorProvider } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./xstock_idl.json";

export const programId = new PublicKey("9SPZCWiT2xcYA7DDZTpSbhGFdDugSr9VqeQ7PVFBFgN");

export const getProgram = (connection: Connection, wallet: any) => {
    const provider = new AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    // @ts-ignore
    idl.address = programId.toBase58();
    // @ts-ignore
    return new Program(idl as Idl, provider);
};
