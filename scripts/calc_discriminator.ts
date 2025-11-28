import { sha256 } from "js-sha256";

function getDiscriminator(name: string) {
    const preimage = `account:${name}`;
    const hash = sha256.digest(preimage);
    const discriminator = hash.slice(0, 8);
    console.log(`${name}: [${discriminator.join(", ")}]`);
}

function getInstructionDiscriminator(name: string) {
    const preimage = `global:${name}`;
    const hash = sha256.digest(preimage);
    const discriminator = hash.slice(0, 8);
    console.log(`${name}: [${discriminator.join(", ")}]`);
}

getInstructionDiscriminator("create_covered_call");
getInstructionDiscriminator("buy_option");
getInstructionDiscriminator("exercise");
getInstructionDiscriminator("reclaim");
getInstructionDiscriminator("update_price");
getInstructionDiscriminator("initialize_oracle");
