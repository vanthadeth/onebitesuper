import { validStaffPin } from "@onebite/core/access";

export function generateTemporaryPin(previous = ""): string {
 const range=1_000_000, limit=Math.floor(0x1_0000_0000/range)*range;
 let pin: string;
 do { let value: number; do {value=crypto.getRandomValues(new Uint32Array(1))[0];} while(value>=limit);pin=String(value%range).padStart(6,"0"); } while(pin===previous||!validStaffPin(pin));
 return pin;
}
