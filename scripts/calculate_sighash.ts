import { sha256 } from "js-sha256";

function sighash(name: string): Buffer {
    const preimage = `global:${name}`;
    const hash = sha256.digest(preimage);
    return Buffer.from(hash.slice(0, 8));
}

console.log("create_covered_call:", sighash("create_covered_call").toJSON().data);
console.log("buy_option:        ", sighash("buy_option").toJSON().data);
console.log("exercise:          ", sighash("exercise").toJSON().data);
console.log("reclaim:           ", sighash("reclaim").toJSON().data);
console.log("update_price:      ", sighash("update_price").toJSON().data);
console.log("initialize_oracle: ", sighash("initialize_oracle").toJSON().data);
